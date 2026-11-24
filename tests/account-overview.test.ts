import { describe, expect, test } from "vitest";
import { overviewOf, type AccountRow } from "../src/utils/accountOverview";
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
