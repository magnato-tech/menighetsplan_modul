import { describe, expect, test } from "vitest";
import { inPeriod, overviewOf, type AccountRow } from "../src/utils/accountOverview";
import type { Group, Person } from "../src/types";

// Every person and address here is made up.

const person = (id: string, name: string, email?: string, globalRole: Person["globalRole"] = "member"): Person => ({ id, name, email, globalRole });
const account = (email: string | null, lastLoginAt: string | null = null): AccountRow => ({
  email,
  emailVerified: true,
  disabled: false,
  provider: "google",
  createdAt: "2026-01-01T10:00:00.000Z",
  lastLoginAt,
});
const group = (id: string, leaderIds: string[], deputyLeaderIds?: string[]): Group => ({ id, name: id, leaderIds, memberIds: [], deputyLeaderIds });

const persons: Person[] = [
  person("ada", "Ada", "ada@example.org"),
  person("bjorn", "Bjørn", "bjorn@example.org"),
  person("cora", "Cora", "cora@example.org"),
  person("anna", "Anna", "anna@example.org"),
  person("delt-1", "Else Delt", "familien@example.org"),
  person("delt-2", "Erik Delt", "familien@example.org"),
  person("uten", "Ulf Uten"),
  person("dora", "Dora", "  Dora@Example.org "),
];
const groups: Group[] = [group("lyd", ["cora"], ["bjorn"])];

describe("Innloggingsoversikten", () => {
  test("den som har konto med sin adresse, har logget inn", () => {
    const overview = overviewOf(persons, groups, [account("ada@example.org", "2026-11-20T08:00:00.000Z")]);
    expect(overview.signedIn.map((row) => row.person.id)).toEqual(["ada"]);
    expect(overview.signedIn[0].account.lastLoginAt).toBe("2026-11-20T08:00:00.000Z");
    expect(overview.neverSignedIn.map((row) => row.person.id)).not.toContain("ada");
  });

  test("den som kan logge inn uten å ha vært inne står i listen, og lederne først", () => {
    const overview = overviewOf(persons, groups, []);
    expect(overview.neverSignedIn.map((row) => [row.person.name, row.isLeader])).toEqual([
      ["Bjørn", true],
      ["Cora", true],
      ["Ada", false],
      ["Anna", false],
      ["Dora", false],
    ]);
  });

  test("delt adresse: ingen av dem kan logge inn, og kontoen med adressen står som delt utenfor registeret", () => {
    const overview = overviewOf(persons, groups, [account("familien@example.org", "2026-11-01T08:00:00.000Z")]);
    expect(overview.cannotSignIn).toEqual([
      { person: persons[4], reason: "shared", address: "familien@example.org" },
      { person: persons[5], reason: "shared", address: "familien@example.org" },
      { person: persons[6], reason: "no-email" },
    ]);
    expect(overview.neverSignedIn.map((row) => row.person.id)).not.toContain("delt-1");
    expect(overview.notInRegister).toHaveLength(1);
    expect(overview.notInRegister[0]).toMatchObject({ address: "familien@example.org", shared: true });
  });

  test("uten e-post kan man ikke logge inn", () => {
    const overview = overviewOf(persons, groups, []);
    expect(overview.cannotSignIn).toContainEqual({ person: persons[6], reason: "no-email" });
  });

  test("en konto med en adresse som ingen i registeret har, står som kom inn men ikke i registeret", () => {
    const overview = overviewOf(persons, groups, [account("ukjent@example.org", "2026-11-22T08:00:00.000Z")]);
    expect(overview.notInRegister).toEqual([{ address: "ukjent@example.org", account: account("ukjent@example.org", "2026-11-22T08:00:00.000Z"), shared: false }]);
  });

  test("store bokstaver og mellomrom i adressene gir samme person", () => {
    const overview = overviewOf(persons, groups, [account(" DORA@example.ORG ", "2026-11-23T08:00:00.000Z")]);
    expect(overview.signedIn.map((row) => row.person.id)).toEqual(["dora"]);
    expect(overview.notInRegister).toEqual([]);
  });

  test("en konto uten adresse kan ikke knyttes til noen, og står ikke i listene", () => {
    const overview = overviewOf(persons, groups, [account(null), account("")]);
    expect(overview.notInRegister).toEqual([]);
  });

  test("den som kom inn sist, står først blant dem som har logget inn", () => {
    const overview = overviewOf(
      persons,
      groups,
      [account("ada@example.org", "2026-11-01T08:00:00.000Z"), account("dora@example.org", "2026-11-09T08:00:00.000Z")]
    );
    expect(overview.signedIn.map((row) => row.person.id)).toEqual(["dora", "ada"]);
  });
});

describe("Perioden i Innlogging", () => {
  const now = Date.parse("2026-11-24T12:00:00.000Z");
  test("en tid innenfor de siste dagene er med, en eldre er ikke, og uten periode er alt med", () => {
    expect(inPeriod("2026-11-20T12:00:00.000Z", 7, now)).toBe(true);
    expect(inPeriod("2026-11-10T12:00:00.000Z", 7, now)).toBe(false);
    expect(inPeriod("2026-11-10T12:00:00.000Z", 30, now)).toBe(true);
    expect(inPeriod("2026-10-01T12:00:00.000Z", 30, now)).toBe(false);
    expect(inPeriod("2020-01-01T00:00:00.000Z", null, now)).toBe(true);
    expect(inPeriod(null, 30, now)).toBe(false);
    expect(inPeriod("tull", 30, now)).toBe(false);
  });
});


describe("Innloggingsoversikten når en person har flere adresser", () => {
  const mari: Person = { id: "mari", name: "Mari", email: "mari@example.org", globalRole: "member", extraEmails: [{ address: "mari.privat@example.org", copy: false, login: true }] };

  test("har logget inn når en av adressene har konto, og den nyeste av dem vises med sin adresse", () => {
    const overview = overviewOf(
      [mari],
      [],
      [account("mari@example.org", "2026-11-01T08:00:00.000Z"), account("mari.privat@example.org", "2026-11-20T08:00:00.000Z")]
    );
    expect(overview.signedIn.map((row) => row.person.id)).toEqual(["mari"]);
    expect(overview.signedIn[0].account.email).toBe("mari.privat@example.org");
    expect(overview.neverSignedIn).toEqual([]);
    expect(overview.notInRegister).toEqual([]);
  });

  test("aldri logget inn når ingen av adressene har konto, og en konto på en adresse som ikke kan logge inn, står utenfor registeret", () => {
    const overview = overviewOf([mari], [], [account("mari.kopi@example.org", null)]);
    expect(overview.neverSignedIn.map((row) => row.person.id)).toEqual(["mari"]);
    expect(overview.notInRegister.map((row) => row.address)).toEqual(["mari.kopi@example.org"]);
  });

  test("en person som bare har en adresse som får kopi, kan ikke logge inn", () => {
    const kopi: Person = { id: "kopi", name: "Kopi", globalRole: "member", extraEmails: [{ address: "kopi@example.org", copy: true, login: false }] };
    expect(overviewOf([kopi], [], []).cannotSignIn).toEqual([{ person: kopi, reason: "no-email" }]);
  });

  test("en ekstra innloggingsadresse som står på en annen person, gjør den delt, og den andre kan ikke logge inn med den", () => {
    const other = person("other", "Other", "mari.privat@example.org");
    const overview = overviewOf([mari, other], [], []);
    expect(overview.neverSignedIn.map((row) => row.person.id)).toEqual(["mari"]);
    expect(overview.cannotSignIn).toEqual([{ person: other, reason: "shared", address: "mari.privat@example.org" }]);
  });
});
