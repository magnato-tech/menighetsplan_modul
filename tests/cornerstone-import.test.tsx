// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  birthDateFromNationalId,
  CORNERSTONE_COLUMNS,
  csvFileError,
  dayFromFile,
  decodeCsvBytes,
  NOT_CSV_MESSAGE,
  parseCsv,
  personInputOf,
  readCornerstoneFile,
} from "../src/utils/cornerstoneImport";

// Persons brought in from a CSV file exported from Cornerstone. Everyone here is made up, and so
// are the identity numbers: they are not real numbers and do not pass the check digits.

const planner = vi.hoisted(() => ({ addPersons: vi.fn((list: unknown[]) => ({ success: true, persons: list }) as { success: boolean; error?: string; persons: unknown[] }) }));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => planner }));

import { CornerstoneImportDialog } from "../src/pages/admin/CornerstoneImportDialog";

// The columns as Cornerstone writes them: the ones that are read, among many that are not
const HEADING = [
  "Fødselsnummer", "Land for fødselsnr", "Cornerstone-ID", "Etternavn", "Fornavn", "Mellomnavn", "Adresse 1", "Postnummer 1", "Poststed 1",
  "E-posttype 1", "E-post 1", "E-post 2", "Telefontype 1", "Telefonnummer 1", "Kjønn", "Fødselsdato", "Dødsdato", "Sivilstatus", "Yrke", "Kommentar",
  "Forelder 1 sitt navn", "Gruppens navn 1", "Menigheten: Medlemstype 1", "Menigheten: Innmeldt dato 1", "Menigheten: Utmeldt dato 1",
  "Trossamfunn: Innmeldt dato 1", "Trossamfunn: Utmeldt dato 1", "Menigheten: Dåp av troende Dato",
];
type Row = Partial<Record<(typeof HEADING)[number], string>>;
const quote = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csv = (rows: Row[], separator = ";") => [HEADING, ...rows.map((row) => HEADING.map((name) => row[name] ?? ""))].map((fields) => fields.map(quote).join(separator)).join("\r\n");

const kari: Row = {
  Fødselsnummer: "12038012345", "Cornerstone-ID": "1001", Fornavn: "Kari", Etternavn: "Eksempel", "Adresse 1": "Storgata 1", "Poststed 1": "Lillevik",
  "E-post 1": "Kari@Eksempel.no", "Telefonnummer 1": "900 00 001", Kjønn: "K", Fødselsdato: "12.03.1980", Sivilstatus: "Gift", Yrke: "Lærer",
  Kommentar: "Ring etter kl. 16; ikke før", "Menigheten: Medlemstype 1": "Medlem", "Menigheten: Innmeldt dato 1": "01.09.2005",
  "Trossamfunn: Innmeldt dato 1": "01.09.2005", "Menigheten: Dåp av troende Dato": "14.06.1996",
};
const ola: Row = { Fornavn: "Ola", Mellomnavn: "Test", Etternavn: "Eksempel", "E-post 1": "ola@eksempel.no", Fødselsdato: "1978-11-02", "Menigheten: Innmeldt dato 1": "01.09.2005", "Menigheten: Utmeldt dato 1": "01.01.2020" };
const child: Row = { Fødselsnummer: "05061350012", Fornavn: "Liten", Etternavn: "Eksempel", "E-post 1": "kari@eksempel.no", "Forelder 1 sitt navn": "Kari Eksempel" };
const today = "2026-10-13";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Filen fra Cornerstone", () => {
  test("bare det registeret har felt for, hentes: navn, e-post, telefon, fødselsdato og de to medlemskapene", () => {
    const { error, persons, rows } = readCornerstoneFile(csv([kari, ola]), [], today);
    expect(error).toBeNull();
    expect(rows).toBe(2);
    expect(persons.map(personInputOf)).toEqual([
      { name: "Kari Eksempel", email: "kari@eksempel.no", phone: "900 00 001", birthDate: "1980-03-12", congregationMember: true, denominationMember: true },
      // Ola has left the congregation, and was never registered in the denomination
      { name: "Ola Test Eksempel", email: "ola@eksempel.no", phone: "", birthDate: "1978-11-02" },
    ]);
  });

  test("fødselsnummer, adresse, yrke, kommentar og resten kommer ikke med, i noen form", () => {
    const { persons } = readCornerstoneFile(csv([kari, child]), [], today);
    const stored = JSON.stringify(persons);
    for (const left of ["12038012345", "05061350012", "Storgata", "Lillevik", "Lærer", "Gift", "Ring etter", "1001", "1996"]) expect(stored).not.toContain(left);
    expect(Object.keys(personInputOf(persons[0])).sort()).toEqual(["birthDate", "congregationMember", "denominationMember", "email", "name", "phone"]);
    // The columns that are read, are these and no others
    expect(Object.values(CORNERSTONE_COLUMNS)).toHaveLength(12);
  });

  test("barn hentes inn som alle andre, og fødselsdatoen tas fra fødselsnummeret når kolonnen er tom", () => {
    const result = readCornerstoneFile(csv([kari, child]), [], today);
    expect(result.persons[1]).toMatchObject({ name: "Liten Eksempel", birthDate: "2013-06-05" });
    expect(result.birthDatesFromNationalId).toBe(1);
  });

  test("en adresse logger inn én person: den blir på den eldste, og barnet legges inn uten", () => {
    const result = readCornerstoneFile(csv([child, kari]), [], today);
    expect(result.persons.map((person) => [person.name, person.email])).toEqual([["Liten Eksempel", ""], ["Kari Eksempel", "kari@eksempel.no"]]);
    expect(result.withoutSharedEmail).toEqual([{ line: 2, name: "Liten Eksempel" }]);
  });

  test("står adressen alt på en i registeret, beholder den personen den, og ingen av de nye får den", () => {
    const register = [{ name: "Kari Eksempel", email: "kari@eksempel.no" }];
    const result = readCornerstoneFile(csv([kari, child]), register, today);
    expect(result.skipped).toEqual([{ line: 2, name: "Kari Eksempel", reason: "in-register" }]);
    expect(result.persons.map((person) => [person.name, person.email])).toEqual([["Liten Eksempel", ""]]);
  });

  test("den som finnes fra før, legges ikke inn på nytt: samme navn, eller samme fornavn og e-post", () => {
    const register = [
      { name: "kari  eksempel", email: "" },
      { name: "Ola Eksempel", email: "OLA@eksempel.no", birthDate: "1978-11-02" },
    ];
    const result = readCornerstoneFile(csv([kari, ola]), register, today);
    expect(result.persons).toEqual([]);
    expect(result.skipped.map((row) => row.reason)).toEqual(["in-register", "in-register"]);
  });

  test("to med samme navn og ulik fødselsdato er to personer", () => {
    const register = [{ name: "Kari Eksempel", email: "", birthDate: "1951-01-01" }];
    expect(readCornerstoneFile(csv([kari]), register, today).persons).toHaveLength(1);
  });

  test("døde, rader uten navn og den som står to ganger, hoppes over og sies fra om", () => {
    const result = readCornerstoneFile(csv([kari, { ...ola, Dødsdato: "03.02.2024" }, { "E-post 1": "ingen@eksempel.no" }, kari]), [], today);
    expect(result.persons.map((person) => person.name)).toEqual(["Kari Eksempel"]);
    expect(result.skipped).toEqual([
      { line: 3, name: "Ola Test Eksempel", reason: "died" },
      { line: 4, name: "(uten navn)", reason: "no-name" },
      { line: 5, name: "Kari Eksempel", reason: "twice-in-file" },
    ]);
  });

  test("en e-post som ikke er en adresse, og en fødselsdato som ikke er en dato, blir stående tomme", () => {
    const { persons } = readCornerstoneFile(csv([{ Fornavn: "Per", Etternavn: "Prøve", "E-post 1": "har ikke", Fødselsdato: "31.02.1990" }, { Fornavn: "Framtid", Etternavn: "Prøve", Fødselsdato: "01.01.2030" }]), [], today);
    expect(persons.map(personInputOf)).toEqual([{ name: "Per Prøve", email: "", phone: "" }, { name: "Framtid Prøve", email: "", phone: "" }]);
  });

  test("en fil som ikke er fra Cornerstone, sier hva som mangler", () => {
    expect(readCornerstoneFile("Navn;E-post\r\nKari;kari@eksempel.no", [], today).error).toMatch(/ser ikke ut som en eksport fra Cornerstone.*«Fornavn» og «Etternavn»/);
    expect(readCornerstoneFile("", [], today).error).toBe("Filen er tom.");
  });
});

describe("CSV-filen", () => {
  test("leses med semikolon, komma eller tabulator, og et felt i anførselstegn kan holde skilletegn og linjeskift", () => {
    for (const separator of [";", ",", "\t"]) {
      const { persons, error } = readCornerstoneFile(csv([kari, ola], separator), [], today);
      expect(error).toBeNull();
      expect(persons.map((person) => person.name)).toEqual(["Kari Eksempel", "Ola Test Eksempel"]);
    }
    expect(parseCsv('﻿a;b\r\n"en; to";"sa ""hei""\nog gikk"\r\n\r\n')).toEqual([["a", "b"], ["en; to", 'sa "hei"\nog gikk']]);
  });

  test("æ, ø og å leses riktig både fra Cornerstone og fra en fil lagret i Excel", () => {
    const text = "Fornavn;Etternavn\r\nÅse;Sjøvær";
    expect(decodeCsvBytes(new TextEncoder().encode(text))).toBe(text);
    const fromExcel = Uint8Array.from([...text].map((char) => (char === "Å" ? 0xc5 : char === "ø" ? 0xf8 : char === "æ" ? 0xe6 : char.charCodeAt(0))));
    expect(decodeCsvBytes(fromExcel)).toBe(text);
  });

  test("en Excel-fil, eller noe annet enn CSV, gir beskjed om å lagre som CSV i Excel først", () => {
    const text = new TextEncoder().encode(csv([kari]));
    expect(csvFileError("personer.csv", text)).toBeNull();
    expect(csvFileError("PERSONER.CSV", text)).toBeNull();
    expect(csvFileError("personer.xlsx", Uint8Array.from([0x50, 0x4b, 3, 4]))).toBe(NOT_CSV_MESSAGE);
    // An Excel workbook that has only been given another name, is still not a CSV file
    expect(csvFileError("personer.csv", Uint8Array.from([0x50, 0x4b, 3, 4, 20, 0]))).toBe(NOT_CSV_MESSAGE);
    expect(csvFileError("personer.csv", Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0]))).toBe(NOT_CSV_MESSAGE);
    expect(csvFileError("personer.pdf", Uint8Array.from([0x25, 0x50, 0x44, 0x46]))).toBe(NOT_CSV_MESSAGE);
    expect(csvFileError("personer.txt", text)).toBe(NOT_CSV_MESSAGE);
    expect(NOT_CSV_MESSAGE).toMatch(/Åpne den i Excel.*«CSV»/);
  });
});

describe("Datoene", () => {
  test("en dato leses slik Norge og maskiner skriver den", () => {
    expect(dayFromFile("12.03.1980")).toBe("1980-03-12");
    expect(dayFromFile("1/9/2005")).toBe("2005-09-01");
    expect(dayFromFile("1980-03-12 00:00:00")).toBe("1980-03-12");
    expect(dayFromFile("")).toBeNull();
    expect(dayFromFile("mars 1980")).toBeNull();
    expect(dayFromFile("31.02.1990")).toBeNull();
  });

  test("fødselsnummeret gir datoen, med riktig århundre, og bare den", () => {
    expect(birthDateFromNationalId("12038012345")).toBe("1980-03-12");
    expect(birthDateFromNationalId("050613 50012")).toBe("2013-06-05");
    expect(birthDateFromNationalId("01014592345")).toBe("1945-01-01");
    // A D-number has four added to the first digit
    expect(birthDateFromNationalId("52038012345")).toBe("1980-03-12");
    for (const wrong of ["", "1203801234", "abcdefghijk", "32138012345"]) expect(birthDateFromNationalId(wrong)).toBeNull();
  });
});

describe("Skjemaet «Hent inn fra Cornerstone»", () => {
  const onDone = vi.fn();
  const onClose = vi.fn();
  const show = (register: { name: string; email?: string }[] = []) => render(<CornerstoneImportDialog register={register} onDone={onDone} onClose={onClose} />);
  const choose = (name: string, content: string | Uint8Array) => {
    const file = new File([content], name);
    // jsdom's File has no arrayBuffer in every version
    Object.defineProperty(file, "arrayBuffer", { value: async () => (typeof content === "string" ? new TextEncoder().encode(content) : content).buffer });
    fireEvent.change(screen.getByLabelText("CSV-fil fra Cornerstone"), { target: { files: [file] } });
  };

  test("viser hva som blir hentet inn før noe lagres, og lagrer bare feltene registeret har", async () => {
    show([{ name: "Ola Test Eksempel" }]);
    expect(screen.getByText(/Fødselsnummer, adresse og alt annet i\s+filen blir ikke lagret/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Hent inn" }) as HTMLButtonElement).disabled).toBe(true);

    choose("personer.csv", csv([kari, ola, child]));
    const found = await screen.findByRole("region", { name: "Dette blir hentet inn" });
    expect(found.textContent).toContain("2 personer blir lagt inn, av 3 i personer.csv. Ingenting er lagret ennå.");
    expect(found.textContent).toContain("1 har e-post, og kan logge inn");
    expect(found.textContent).toContain("2 har fødselsdato (1 hentet fra fødselsnummeret, som ikke lagres)");
    expect(found.textContent).toContain("1 er medlem i menigheten");
    expect(within(found).getByText("1 person legges inn uten e-post, fordi en annen har samme adresse")).toBeTruthy();
    expect(within(found).getByText("Finnes i registeret fra før: 1 hoppes over")).toBeTruthy();
    expect(found.textContent).not.toContain("12038012345");
    expect(planner.addPersons).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Hent inn 2 personer" }));
    expect(planner.addPersons).toHaveBeenCalledWith([
      { name: "Kari Eksempel", email: "kari@eksempel.no", phone: "900 00 001", birthDate: "1980-03-12", congregationMember: true, denominationMember: true },
      { name: "Liten Eksempel", email: "", phone: "", birthDate: "2013-06-05" },
    ]);
    expect(onDone).toHaveBeenCalledWith(2);
  });

  test("en Excel-fil gir beskjeden om CSV, og ingenting kan hentes inn", async () => {
    show();
    choose("personer.xlsx", Uint8Array.from([0x50, 0x4b, 3, 4]));
    expect((await screen.findByRole("alert")).textContent).toBe(NOT_CSV_MESSAGE);
    expect(screen.queryByRole("region", { name: "Dette blir hentet inn" })).toBeNull();
    expect((screen.getByRole("button", { name: "Hent inn" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("en CSV-fil som ikke er fra Cornerstone, og en lagring som ikke går, sier fra", async () => {
    show();
    choose("annet.csv", "Navn;E-post\r\nKari;kari@eksempel.no");
    expect((await screen.findByRole("alert")).textContent).toMatch(/ser ikke ut som en eksport fra Cornerstone/);

    planner.addPersons.mockReturnValueOnce({ success: false, error: "Du har ikke tilgang.", persons: [] });
    choose("personer.csv", csv([kari]));
    fireEvent.click(await screen.findByRole("button", { name: "Hent inn 1 person" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Du har ikke tilgang."));
    expect(onDone).not.toHaveBeenCalled();
  });

  test("«Avbryt» lukker uten å lagre", async () => {
    show();
    choose("personer.csv", csv([kari]));
    await screen.findByRole("region", { name: "Dette blir hentet inn" });
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));
    expect(onClose).toHaveBeenCalled();
    expect(planner.addPersons).not.toHaveBeenCalled();
  });
});
