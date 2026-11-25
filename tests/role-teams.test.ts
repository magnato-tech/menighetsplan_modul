import { describe, expect, test } from "vitest";
import {
  canGiveBack,
  giveBack,
  isUndistributed,
  newTaskTeamFields,
  roleHasTeam,
  roleTeamFields,
  roleTeamIds,
  taskTeamIds,
  takeForTeam,
} from "../src/utils/roleTeams";

describe("roleTeamIds og roleHasTeam", () => {
  test("en rolle med ett team har bare det", () => {
    expect(roleTeamIds({ groupId: "a" })).toEqual(["a"]);
    expect(roleHasTeam({ groupId: "a" }, "a")).toBe(true);
    expect(roleHasTeam({ groupId: "a" }, "b")).toBe(false);
  });

  test("en rolle uten team har ingen", () => {
    expect(roleTeamIds({})).toEqual([]);
    expect(roleTeamIds(undefined)).toEqual([]);
    expect(roleHasTeam({}, "a")).toBe(false);
  });

  test("delte team kommer fra groupIds, i rekkefølgen de ble lagt til", () => {
    const role = { groupId: "a", groupIds: ["a", "b"] };
    expect(roleTeamIds(role)).toEqual(["a", "b"]);
    expect(roleHasTeam(role, "b")).toBe(true);
  });

  test("roleTeamIds gir en kopi, så kallere ikke endrer rollen", () => {
    const role = { groupIds: ["a", "b"] };
    roleTeamIds(role).push("c");
    expect(role.groupIds).toEqual(["a", "b"]);
  });
});

describe("roleTeamFields", () => {
  test("ett team lagres uten groupIds", () => {
    expect(roleTeamFields(["a"])).toEqual({ groupId: "a", groupIds: undefined });
  });

  test("flere team lagres med groupIds, og det første også som groupId", () => {
    expect(roleTeamFields(["a", "b"])).toEqual({ groupId: "a", groupIds: ["a", "b"] });
  });

  test("tomme og dupliserte team fjernes", () => {
    expect(roleTeamFields(["a", "", "a"])).toEqual({ groupId: "a", groupIds: undefined });
    expect(roleTeamFields([])).toEqual({ groupId: undefined, groupIds: undefined });
  });
});

describe("newTaskTeamFields", () => {
  test("rolle med ett team: oppgaven får teamet", () => {
    expect(newTaskTeamFields({ groupId: "a" })).toEqual({ groupId: "a", teamChoices: undefined });
  });

  test("delt rolle: oppgaven er ikke fordelt, og kan gå til hvert av teamene", () => {
    expect(newTaskTeamFields({ groupId: "a", groupIds: ["a", "b"] })).toEqual({ groupId: undefined, teamChoices: ["a", "b"] });
  });

  test("rolle uten team: oppgaven har ingen team", () => {
    expect(newTaskTeamFields({})).toEqual({ groupId: undefined, teamChoices: undefined });
    expect(newTaskTeamFields(undefined)).toEqual({ groupId: undefined, teamChoices: undefined });
  });
});

describe("isUndistributed og taskTeamIds", () => {
  test("en oppgave uten team med valg er ikke fordelt", () => {
    expect(isUndistributed({ teamChoices: ["a", "b"], status: "open" })).toBe(true);
  });

  test("en oppgave med team, eller uten valg, er fordelt", () => {
    expect(isUndistributed({ groupId: "a", teamChoices: ["a", "b"], status: "open" })).toBe(false);
    expect(isUndistributed({ status: "open" })).toBe(false);
    expect(isUndistributed({ teamChoices: [], status: "open" })).toBe(false);
  });

  test("avlyste oppgaver er ikke fordelt", () => {
    expect(isUndistributed({ teamChoices: ["a"], status: "cancelled" })).toBe(false);
  });

  test("synlig for teamet: oppgavens team, eller valgene når den ikke er fordelt", () => {
    expect(taskTeamIds({ groupId: "a", teamChoices: ["a", "b"] })).toEqual(["a"]);
    expect(taskTeamIds({ teamChoices: ["a", "b"] })).toEqual(["a", "b"]);
    expect(taskTeamIds({})).toEqual([]);
  });
});

describe("gi og ta oppgaver", () => {
  test("å ta oppgaven skriver bare groupId", () => {
    expect(takeForTeam("a")).toEqual({ groupId: "a" });
  });

  test("å gi tilbake setter oppgaven ikke fordelt blant de delte teamene", () => {
    expect(giveBack(["a", "b"])).toEqual({ groupId: undefined, teamChoices: ["a", "b"] });
  });

  test("bare et team som har oppgaven, og rollen er delt, kan gi den tilbake", () => {
    expect(canGiveBack({ groupId: "a", status: "open" }, ["a", "b"])).toBe(true);
    expect(canGiveBack({ groupId: "c", status: "open" }, ["a", "b"])).toBe(false);
    expect(canGiveBack({ groupId: "a", status: "open" }, ["a"])).toBe(false);
    expect(canGiveBack({ groupId: "a", status: "cancelled" }, ["a", "b"])).toBe(false);
    expect(canGiveBack({ status: "open" }, ["a", "b"])).toBe(false);
  });
});
