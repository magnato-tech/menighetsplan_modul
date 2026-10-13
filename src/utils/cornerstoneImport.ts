import type { NewPersonInput } from "../data/newDocuments";
import type { Person } from "../types";
import { birthDateError, todayInNorway } from "./birthDate";
import { loginIdOf } from "./logins";

// Persons from a file exported from the member register Cornerstone, as a CSV file.
//
// The file is read in the administrator's own browser. Only what the register here has a field
// for, is taken out of it: name, e-mail, phone, date of birth, and whether the person is a
// member of the congregation and of the denomination. Every other column is left unread:
// address, sex, marital status, occupation, comments, parents, baptism and the rest. The
// national identity number is never stored and never shown; it is only looked at for the date
// of birth when the file has none.

/** The columns that are read, by the names Cornerstone gives them. */
export const CORNERSTONE_COLUMNS = {
  firstName: "Fornavn",
  middleName: "Mellomnavn",
  lastName: "Etternavn",
  email: "E-post 1",
  phone: "Telefonnummer 1",
  birthDate: "Fødselsdato",
  /** Read only when the date of birth is empty, and only for that date. */
  nationalId: "Fødselsnummer",
  died: "Dødsdato",
  congregationJoined: "Menigheten: Innmeldt dato 1",
  congregationLeft: "Menigheten: Utmeldt dato 1",
  denominationJoined: "Trossamfunn: Innmeldt dato 1",
  denominationLeft: "Trossamfunn: Utmeldt dato 1",
} as const;

/** A file is Cornerstone's when it has these. */
const REQUIRED_COLUMNS = [CORNERSTONE_COLUMNS.firstName, CORNERSTONE_COLUMNS.lastName] as const;

// ---------- The file as text and as rows ----------

/** The file's text. Cornerstone's own export is UTF-8; a file saved again from Excel is often not. */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    return new TextDecoder("windows-1252").decode(view);
  }
}

export const NOT_CSV_MESSAGE = "Filen er ikke en CSV-fil. Åpne den i Excel, velg «Lagre som» og filtypen «CSV», og hent inn den filen i stedet.";

/**
 * Why the file is not a CSV file, in words for the administrator. Null when it may be one. An
 * Excel workbook is known by its name and by how it begins, also when it has been given the name
 * of a CSV file.
 */
export function csvFileError(fileName: string, bytes: ArrayBuffer | Uint8Array): string | null {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const startsWith = (...values: number[]) => values.every((value, at) => view[at] === value);
  const workbook = startsWith(0x50, 0x4b) || startsWith(0xd0, 0xcf, 0x11, 0xe0); // .xlsx (a zip) and .xls
  const pdf = startsWith(0x25, 0x50, 0x44, 0x46);
  const binary = view.subarray(0, 2000).includes(0);
  return workbook || pdf || binary || !/\.csv$/i.test(fileName.trim()) ? NOT_CSV_MESSAGE : null;
}

/** What stands between the fields: the one of semicolon, tab and comma the heading line has most of outside quotes. */
function separatorOf(headingLine: string): string {
  const counts = new Map<string, number>([[";", 0], ["\t", 0], [",", 0]]);
  let quoted = false;
  for (const char of headingLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** The rows of a CSV text, each a list of fields. A field in quotes may hold the separator, a line break and a doubled quote. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstBreak = source.search(/\r?\n/);
  const separator = separatorOf(firstBreak < 0 ? source : source.slice(0, firstBreak));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((fields) => fields.some((value) => value.trim() !== ""));
}

// ---------- Dates ----------

const pad = (value: number): string => String(value).padStart(2, "0");
const asDay = (year: number, month: number, day: number): string | null => {
  const text = `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
  return birthDateError(text, "9999-12-31") === null ? text : null;
};

/** A date as the register stores it, "1980-03-12", from the ways a file writes one. Null when it is none. */
export function dayFromFile(value: string): string | null {
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return asDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const norwegian = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (norwegian) return asDay(Number(norwegian[3]), Number(norwegian[2]), Number(norwegian[1]));
  return null;
}

/**
 * The date of birth a Norwegian national identity number (or D-number) carries. The number itself
 * goes no further than this function: only the date comes out.
 */
export function birthDateFromNationalId(value: string): string | null {
  const digits = value.replace(/[\s.-]/g, "");
  if (!/^\d{11}$/.test(digits)) return null;
  let day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const shortYear = Number(digits.slice(4, 6));
  const serial = Number(digits.slice(6, 9));
  if (day > 40) day -= 40; // a D-number has four added to the first digit
  let century: number | null = null;
  if (serial <= 499) century = 1900;
  else if (serial <= 749 && shortYear >= 54) century = 1800;
  else if (shortYear <= 39) century = 2000;
  else if (serial >= 900 && shortYear >= 40) century = 1900;
  return century === null ? null : asDay(century + shortYear, month, day);
}

// ---------- From rows to persons ----------

export type SkipReason = "died" | "no-name" | "in-register" | "twice-in-file";

export const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  died: "Står med dødsdato",
  "no-name": "Mangler navn",
  "in-register": "Finnes i registeret fra før",
  "twice-in-file": "Står to ganger i filen",
};

export interface ImportCandidate extends NewPersonInput {
  /** The line in the file, counted with the heading as line 1. */
  line: number;
}

export interface CornerstoneImport {
  /** Why the file cannot be read as Cornerstone's, in words for the administrator. Null when it can. */
  error: string | null;
  /** The persons that will be added. */
  persons: ImportCandidate[];
  skipped: { line: number; name: string; reason: SkipReason }[];
  /** Persons added without the e-mail address the file gave them, because another person has it. Each address can sign in one person only. */
  withoutSharedEmail: { line: number; name: string }[];
  /** How many persons had no date of birth in the file, and got it from the identity number. */
  birthDatesFromNationalId: number;
  /** How many rows the file had under the heading. */
  rows: number;
}

const sameText = (value: string): string => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("nb");
const firstNameOf = (name: string): string => sameText(name).split(" ")[0] ?? "";

type Known = Pick<Person, "name" | "email" | "birthDate">;

/** The same person: the same full name, or the same first name and e-mail address. Two different dates of birth are two persons. */
function samePerson(a: Known, b: Known): boolean {
  if (a.birthDate && b.birthDate && a.birthDate !== b.birthDate) return false;
  if (sameText(a.name) === sameText(b.name)) return true;
  const email = loginIdOf(a.email);
  return email !== "" && email === loginIdOf(b.email) && firstNameOf(a.name) === firstNameOf(b.name);
}

const empty = (error: string | null): CornerstoneImport => ({ error, persons: [], skipped: [], withoutSharedEmail: [], birthDatesFromNationalId: 0, rows: 0 });

/**
 * What a Cornerstone file adds to the register. Nothing is stored here: this is what the
 * administrator is shown before pressing «Hent inn».
 */
export function readCornerstoneFile(text: string, register: readonly Known[], today: string = todayInNorway()): CornerstoneImport {
  const rows = parseCsv(text);
  if (rows.length === 0) return empty("Filen er tom.");
  const heading = rows[0].map((name) => name.trim());
  const missing = REQUIRED_COLUMNS.filter((name) => !heading.includes(name));
  if (missing.length > 0) {
    return empty(`Filen ser ikke ut som en eksport fra Cornerstone: kolonnen «${missing.join("» og «")}» mangler. Eksporter personene som CSV og prøv igjen.`);
  }
  const place = Object.fromEntries(Object.entries(CORNERSTONE_COLUMNS).map(([key, name]) => [key, heading.indexOf(name)])) as Record<keyof typeof CORNERSTONE_COLUMNS, number>;
  const read = (fields: string[], key: keyof typeof CORNERSTONE_COLUMNS): string => (place[key] >= 0 ? (fields[place[key]] ?? "").trim() : "");

  const result = empty(null);
  result.rows = rows.length - 1;
  rows.slice(1).forEach((fields, at) => {
    const line = at + 2;
    const name = [read(fields, "firstName"), read(fields, "middleName"), read(fields, "lastName")].filter(Boolean).join(" ").replace(/\s+/g, " ");
    if (name === "") return void result.skipped.push({ line, name: "(uten navn)", reason: "no-name" });
    if (read(fields, "died") !== "") return void result.skipped.push({ line, name, reason: "died" });

    let birthDate = dayFromFile(read(fields, "birthDate"));
    let fromNationalId = false;
    if (!birthDate) {
      birthDate = birthDateFromNationalId(read(fields, "nationalId"));
      fromNationalId = birthDate !== null;
    }
    if (birthDate && birthDateError(birthDate, today) !== null) birthDate = null;

    const email = loginIdOf(read(fields, "email"));
    const person: ImportCandidate = {
      line,
      name,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
      phone: read(fields, "phone"),
      ...(birthDate ? { birthDate } : {}),
      ...(read(fields, "congregationJoined") !== "" && read(fields, "congregationLeft") === "" ? { congregationMember: true } : {}),
      ...(read(fields, "denominationJoined") !== "" && read(fields, "denominationLeft") === "" ? { denominationMember: true } : {}),
    };

    if (register.some((known) => samePerson(known, person))) return void result.skipped.push({ line, name, reason: "in-register" });
    if (result.persons.some((earlier) => samePerson(earlier, person))) return void result.skipped.push({ line, name, reason: "twice-in-file" });
    if (birthDate && fromNationalId) result.birthDatesFromNationalId++;
    result.persons.push(person);
  });

  // One address signs in one person. Where several have the same one (a family's), it stays on the
  // one who has it in the register already, or else on the eldest in the file, and the others are
  // added without it. Otherwise none of them could sign in (see utils/logins.ts).
  const taken = new Set(register.map((known) => loginIdOf(known.email)).filter(Boolean));
  const byAddress = new Map<string, ImportCandidate[]>();
  for (const person of result.persons) if (person.email) byAddress.set(person.email, [...(byAddress.get(person.email) ?? []), person]);
  for (const [address, sharing] of byAddress) {
    const eldestFirst = [...sharing].sort((a, b) => (a.birthDate ?? "9999").localeCompare(b.birthDate ?? "9999") || a.line - b.line);
    const without = taken.has(address) ? eldestFirst : eldestFirst.slice(1);
    for (const person of without) {
      person.email = "";
      result.withoutSharedEmail.push({ line: person.line, name: person.name });
    }
  }
  result.withoutSharedEmail.sort((a, b) => a.line - b.line);
  return result;
}

/** A candidate as what the register stores: without the line it stood on. */
export function personInputOf({ line: _line, ...input }: ImportCandidate): NewPersonInput {
  return input;
}
