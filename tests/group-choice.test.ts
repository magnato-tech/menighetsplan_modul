import { describe, expect, test } from "vitest";
import type { Group } from "../src/types";
import { groupsToJoin } from "../src/utils/groupChoice";

// The groups a person can be put into from the person's own card.

const group = (id: string, name: string, more: Partial<Group> = {}): Group => ({ id, name, memberIds: [], leaderIds: [], ...more });
const groups = [
  group("hus", "Husgruppe 1", { category: "husgruppe", memberIds: ["p1"] }),
  group("rigg", "Rigging", { category: "tjenestegruppe", leaderIds: ["p2"] }),
  group("kjokken", "Kjøkken", { category: "tjenestegruppe", memberIds: ["p1"] }),
  group("lyd", "Lyd og bilde"),
  group("kalender", "Felleskalender", { category: "tjenestegruppe" }),
  group("ny", "Talere", { category: "tjenestegruppe" }),
  group("rad", "Menighetsråd", { category: "ledergruppe", deputyLeaderIds: ["p3"] }),
];
const gatherings = [{ groupId: "kalender" }, { groupId: "kalender" }, { groupId: "kjokken" }];
const names = (personId: string) => groupsToJoin(groups, gatherings, personId).map((choice) => [choice.label, choice.groups.map((g) => g.name)]);

describe("Gruppene en person kan legges inn i", () => {
  test("er de personen ikke er med i, tjenestegruppene først og hver sort etter navn", () => {
    expect(names("p1")).toEqual([
      ["Tjenestegruppe", ["Lyd og bilde", "Rigging", "Talere"]],
      ["Ledergruppe", ["Menighetsråd"]],
    ]);
  });

  test("leder og nestleder er alt med i gruppen sin", () => {
    expect(names("p2")[0][1]).not.toContain("Rigging");
    expect(names("p3").some(([label]) => label === "Ledergruppe")).toBe(false);
  });

  test("gruppen som bare holder kalenderen, er ikke blant dem, men en ny gruppe uten deltakere er det", () => {
    const all = names("ukjent").flatMap(([, list]) => list);
    expect(all).not.toContain("Felleskalender");
    expect(all).toContain("Talere");
  });

  test("den som er med i alt, har ingenting å velge", () => {
    expect(groupsToJoin([groups[0]], [], "p1")).toEqual([]);
  });
});
