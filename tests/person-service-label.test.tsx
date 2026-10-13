// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Group, Person } from "../src/types";
import { isInServiceGroup, isServiceGroup, matchesPersonSearch, personAccess, PERSON_ACCESS_LABEL, sortPersonRows, type PersonDirectoryRow } from "../src/utils/personDirectory";

// «Frivillig» in the register is said of the one who is in a service group, so the list shows who
// serves and who can be asked. Everyone here is made up.

vi.mock("../src/firebase", async () => (await import("./support/offlineFirestore")).firebaseModuleMock);
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => ({}) }));
const operating = vi.hoisted(() => ({ mode: "production" as "demo" | "production" | null }));
vi.mock("../src/hooks/useOperatingMode", () => ({ useOperatingMode: () => operating.mode }));

import { PersonsTab } from "../src/pages/admin/tabs/PersonsTab";
import type { StudioData } from "../src/pages/admin/studio";

const person = (id: string, name: string, more: Partial<Person> = {}): Person => ({ id, name, globalRole: "member", ...more });
const group = (id: string, name: string, category?: Group["category"]): Group => ({ id, name, memberIds: [], leaderIds: [], ...(category ? { category } : {}) });

const kitchen = group("kjokken", "Kjøkken", "tjenestegruppe");
const oldTeam = group("lyd", "Lyd og bilde"); // stored before groups had a category
const houseGroup = group("hus", "Husgruppe 1", "husgruppe");

const row = (p: Person, groups: Group[] = [], leaderInGroups: Group[] = [], deputyInGroups: Group[] = []): PersonDirectoryRow => ({ person: p, groups, leaderInGroups, deputyInGroups });
const serves = row(person("1", "Anne Aktiv"), [kitchen]);
const oldServes = row(person("2", "Bjørn Bilde"), [oldTeam]);
const onlyHouse = row(person("3", "Cecilie Celle"), [houseGroup]);
const nowhere = row(person("4", "David Ledig"));
const admin = row(person("5", "Eva Eier", { globalRole: "admin" }));
const leadsHouse = row(person("6", "Frode Fører"), [houseGroup], [houseGroup]);
const everyone = [serves, oldServes, onlyHouse, nowhere, admin, leadsHouse];

afterEach(() => {
  cleanup();
  operating.mode = "production";
});

describe("Hvem som er frivillig", () => {
  test("den som er i en tjenestegruppe, er det; husgruppe alene teller ikke", () => {
    expect(isServiceGroup(kitchen)).toBe(true);
    expect(isServiceGroup(oldTeam)).toBe(true);
    expect(isServiceGroup(houseGroup)).toBe(false);
    expect(everyone.map(isInServiceGroup)).toEqual([true, true, false, false, false, false]);
    // A deputy leader of a service group serves in it
    expect(isInServiceGroup(row(person("7", "Gro"), [], [], [kitchen]))).toBe(true);
  });

  test("merkelappen følger det: «Frivillig» bare på den som er i en tjenestegruppe, og ingen merkelapp ellers", () => {
    expect(everyone.map((r) => PERSON_ACCESS_LABEL[personAccess(r)])).toEqual(["Frivillig", "Frivillig", "", "", "Administrator", "Gruppeleder"]);
  });

  test("de uten merkelapp står sist når listen sorteres på den, og et søk på «frivillig» finner bare de frivillige", () => {
    expect(sortPersonRows(everyone, "access", "asc").map((r) => r.person.name)).toEqual(["Eva Eier", "Frode Fører", "Anne Aktiv", "Bjørn Bilde", "Cecilie Celle", "David Ledig"]);
    expect(everyone.filter((r) => matchesPersonSearch(r, "frivillig")).map((r) => r.person.name)).toEqual(["Anne Aktiv", "Bjørn Bilde"]);
  });
});

describe("Personregisteret i admin", () => {
  const studio = { adminPersons: everyone, adminGroups: [kitchen, oldTeam, houseGroup].map((g) => ({ group: g })), addPerson: vi.fn() } as unknown as StudioData;
  const show = () =>
    render(
      <MemoryRouter>
        <PersonsTab studio={studio} />
      </MemoryRouter>
    );
  const lineOf = (name: string) => screen.getAllByRole("row").find((line) => line.textContent?.includes(name))!;

  test("tabellen viser «Frivillig» på den som tjener, og en strek på den som ikke gjør det", () => {
    show();
    expect(within(lineOf("Anne Aktiv")).getByText("Frivillig")).toBeTruthy();
    expect(within(lineOf("Bjørn Bilde")).getByText("Frivillig")).toBeTruthy();
    for (const name of ["Cecilie Celle", "David Ledig"]) expect(within(lineOf(name)).queryByText("Frivillig")).toBeNull();
    expect(within(lineOf("Eva Eier")).getByText("Administrator")).toBeTruthy();
  });

  test("«Ikke i noen tjenestegruppe» viser dem som kan spørres", () => {
    show();
    expect(screen.getAllByRole("row")).toHaveLength(everyone.length + 1);
    fireEvent.click(screen.getByLabelText("Ikke i noen tjenestegruppe"));
    const names = screen.getAllByRole("row").slice(1).map((line) => line.textContent ?? "");
    expect(names).toHaveLength(4);
    for (const name of ["Cecilie Celle", "David Ledig", "Eva Eier", "Frode Fører"]) expect(names.some((text) => text.includes(name))).toBe(true);
    expect(names.some((text) => text.includes("Anne Aktiv"))).toBe(false);
  });

  test("oppdiktede testpersoner tilbys ikke når løsningen er i produksjon, eller når det ikke er kjent", () => {
    const few = { ...studio, adminPersons: everyone.slice(0, 2) } as unknown as StudioData;
    const offered = () => screen.queryAllByRole("button", { name: /testdata|32 personer/i }).length;
    const draw = () => render(<MemoryRouter><PersonsTab studio={few} /></MemoryRouter>);

    draw();
    expect(offered()).toBe(0);
    expect(screen.queryByText(/testmiljø med 32 personer/)).toBeNull();
    cleanup();

    operating.mode = null;
    draw();
    expect(offered()).toBe(0);
    cleanup();

    operating.mode = "demo";
    draw();
    expect(offered()).toBe(2);
  });

  test("kortene har samme merkelapp som tabellen", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Kort" }));
    const cardOf = (name: string) => screen.getByRole("heading", { name }).parentElement!;
    expect(within(cardOf("Anne Aktiv")).getByText("Frivillig")).toBeTruthy();
    expect(within(cardOf("David Ledig")).queryByText("Frivillig")).toBeNull();
    expect(within(cardOf("Cecilie Celle")).queryByText("Frivillig")).toBeNull();
    expect(within(cardOf("Eva Eier")).getByText("Administrator")).toBeTruthy();
  });
});
