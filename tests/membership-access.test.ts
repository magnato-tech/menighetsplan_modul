import { describe, expect, test } from "vitest";
import { canOpenMyMembership } from "../src/utils/membershipAccess";
import { mayEnterAdmin } from "../src/utils/session";
import type { Group, Person } from "../src/types";

const person = (over: Partial<Person> & Pick<Person, "id" | "globalRole">): Person =>
  ({
    name: "Kari",
    ...over,
  }) as Person;

const groupLeader: Group = {
  id: "g1",
  name: "Lyd",
  memberIds: ["p1"],
  leaderIds: ["p1"],
};

describe("Mitt medlemskap", () => {
  test("alle i registeret har tilgang", () => {
    expect(canOpenMyMembership(person({ id: "p1", globalRole: "member" }), [])).toBe(true);
    expect(canOpenMyMembership(person({ id: "p1", globalRole: "member" }), [groupLeader])).toBe(true);
    expect(canOpenMyMembership(person({ id: "a", globalRole: "admin" }), [])).toBe(true);
    expect(canOpenMyMembership(person({ id: "n", globalRole: "nettredaktor" }), [])).toBe(true);
    expect(
      canOpenMyMembership(person({ id: "p1", globalRole: "member", membershipClerk: true }), [groupLeader])
    ).toBe(true);
  });
});

describe("Inngang til admin", () => {
  test("protokollansvarlig kan inn uten å være administrator", () => {
    expect(mayEnterAdmin(person({ id: "p1", globalRole: "member", membershipClerk: true }))).toBe(true);
  });

  test("vanlig frivillig kan ikke inn", () => {
    expect(mayEnterAdmin(person({ id: "p1", globalRole: "member" }))).toBe(false);
  });
});