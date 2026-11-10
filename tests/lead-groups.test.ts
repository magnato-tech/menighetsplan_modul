import { describe, expect, test } from "vitest";
import { ledGroupDropouts, nextLedActivity, withLedGroupsFirst } from "../src/utils/leadGroups";
import type { Assignment, Gathering, Group, Task } from "../src/types";

// The groups on Min side and the next activity of a group the user leads.

const NOW = Date.parse("2027-01-01T00:00:00.000Z");
const group = (id: string, roles: { leaders?: string[]; deputies?: string[]; members?: string[] }) => ({
  id,
  memberIds: roles.members ?? [],
  leaderIds: roles.leaders ?? [],
  deputyLeaderIds: roles.deputies ?? [],
});
const gathering = (id: string, groupId: string, startsAt: string, extra: Partial<Gathering> = {}) =>
  ({ id, groupId, title: `Samling ${id}`, startsAt, visibility: "intern", ...extra }) as Gathering;
const task = (id: string, gatheringId: string, groupId: string | undefined, status: Task["status"], neededCount = 1) =>
  ({ id, gatheringId, groupId, title: `Oppgave ${id}`, status, neededCount }) as Task;
const assignment = (id: string, taskId: string, response: Assignment["response"]) =>
  ({ id, taskId, personId: `p-${id}`, response }) as Assignment;

describe("Gruppene til den som er på Min side", () => {
  test("ledere og nestledere kommer først, og rekkefølgen innenfor hver del står", () => {
    const groups = [
      group("a", { members: ["me"] }),
      group("b", { leaders: ["me"] }),
      group("c", { members: ["x"] }),
      group("d", { deputies: ["me"] }),
      group("e", { members: ["me"] }),
    ];
    expect(withLedGroupsFirst(groups, "me").map((g) => g.id)).toEqual(["b", "d", "a", "c", "e"]);
  });
});

describe("Neste aktivitet i en gruppe man leder", () => {
  test("velger den første kommende, og hopper over det som er passert", () => {
    const gatherings = [
      gathering("past", "g1", "2026-12-20T10:00:00.000Z"),
      gathering("later", "g1", "2027-01-20T10:00:00.000Z"),
      gathering("next", "g1", "2027-01-10T10:00:00.000Z"),
    ];
    const result = nextLedActivity({ groupId: "g1", gatherings, tasks: [], assignments: [], now: NOW });
    expect(result?.gathering.id).toBe("next");
  });

  test("finner en samling som bare har en oppgave for gruppen, selv om samlingen tilhører en annen gruppe", () => {
    const gatherings = [gathering("s", "annen", "2027-01-05T10:00:00.000Z")];
    const tasks = [task("t", "s", "g1", "open")];
    const result = nextLedActivity({ groupId: "g1", gatherings, tasks, assignments: [], now: NOW });
    expect(result?.gathering.id).toBe("s");
    expect(result?.hasTasks).toBe(true);
  });

  test("teller bare gruppens egne oppgaver på samlingen", () => {
    const gatherings = [gathering("s", "g1", "2027-01-05T10:00:00.000Z")];
    const tasks = [task("mine", "s", "g1", "assigned"), task("andres", "s", "annen", "open")];
    const assignments = [assignment("1", "mine", "confirmed"), assignment("2", "andres", "confirmed")];
    const result = nextLedActivity({ groupId: "g1", gatherings, tasks, assignments, now: NOW });
    expect(result?.staffing.totalTasks).toBe(1);
    expect(result?.staffing.color).toBe("green");
    expect(result?.staffing.badgeText).toBe("Dekket");
  });

  test("uten oppgaver er samlingen grønn og hasTasks er false", () => {
    const gatherings = [gathering("s", "g1", "2027-01-05T10:00:00.000Z")];
    const result = nextLedActivity({ groupId: "g1", gatherings, tasks: [], assignments: [], now: NOW });
    expect(result?.hasTasks).toBe(false);
    expect(result?.staffing.color).toBe("green");
  });

  test("en ledig oppgave uten svar gir rød", () => {
    const gatherings = [gathering("s", "g1", "2027-01-05T10:00:00.000Z")];
    const tasks = [task("t", "s", "g1", "vacant")];
    const result = nextLedActivity({ groupId: "g1", gatherings, tasks, assignments: [], now: NOW });
    expect(result?.staffing.color).toBe("red");
    expect(result?.staffing.badgeText).toBe("Mangler 1");
  });

  test("ingenting som ligger fram i tid gir null", () => {
    const gatherings = [gathering("past", "g1", "2026-12-20T10:00:00.000Z")];
    expect(nextLedActivity({ groupId: "g1", gatherings, tasks: [], assignments: [], now: NOW })).toBeNull();
  });
});

describe("Forfall i grupper man leder, som må fylles", () => {
  const ledGroup = (id: string, roles: { leaders?: string[]; deputies?: string[]; members?: string[] }) =>
    ({
      id,
      name: `Gruppe ${id}`,
      memberIds: roles.members ?? [],
      leaderIds: roles.leaders ?? [],
      deputyLeaderIds: roles.deputies ?? [],
    }) as Group;

  test("en rød samling i en gruppe man leder er med, med bare den gruppens forfall", () => {
    const groups = [ledGroup("g1", { leaders: ["me"] })];
    const gatherings = [gathering("s", "g1", "2027-01-05T10:00:00.000Z")];
    const tasks = [task("t", "s", "g1", "open"), task("t2", "s", "g1", "open")];
    const assignments = [assignment("1", "t", "withdrawn")];
    const result = ledGroupDropouts({ groups, personId: "me", gatherings, tasks, assignments, now: NOW });
    expect(result.map((r) => [r.gathering.id, r.group.id])).toEqual([["s", "g1"]]);
    expect(result[0].staffing.color).toBe("red");
    expect(result[0].staffing.vacantCount).toBe(1);
  });

  test("en gruppe man er nestleder i, med forfall, er med", () => {
    const groups = [ledGroup("g2", { deputies: ["me"] })];
    const gatherings = [gathering("s", "g2", "2027-01-05T10:00:00.000Z")];
    const tasks = [task("t", "s", "g2", "open")];
    const assignments = [assignment("1", "t", "withdrawn")];
    const result = ledGroupDropouts({ groups, personId: "me", gatherings, tasks, assignments, now: NOW });
    expect(result.map((r) => r.group.id)).toEqual(["g2"]);
  });

  test("en oppgave som aldri er fylt, uten forfall, er ikke med selv om samlingen er rød", () => {
    const groups = [ledGroup("g1", { leaders: ["me"] })];
    const gatherings = [gathering("s", "g1", "2027-01-05T10:00:00.000Z")];
    const tasks = [task("t", "s", "g1", "open")];
    expect(ledGroupDropouts({ groups, personId: "me", gatherings, tasks, assignments: [], now: NOW })).toEqual([]);
  });

  test("en gruppe man bare er medlem av, er ikke med", () => {
    const groups = [ledGroup("g3", { members: ["me"] })];
    const gatherings = [gathering("s", "g3", "2027-01-05T10:00:00.000Z")];
    const tasks = [task("t", "s", "g3", "open")];
    expect(ledGroupDropouts({ groups, personId: "me", gatherings, tasks, assignments: [], now: NOW })).toEqual([]);
  });

  test("passerte og avlyste samlinger, og avlyste oppgaver, er ikke med", () => {
    const groups = [ledGroup("g1", { leaders: ["me"] })];
    const gatherings = [
      gathering("past", "g1", "2026-12-20T10:00:00.000Z"),
      gathering("avlyst", "g1", "2027-01-05T10:00:00.000Z", { cancelled: true }),
      gathering("kansellert-oppgave", "g1", "2027-01-06T10:00:00.000Z"),
    ];
    const tasks = [
      task("p", "past", "g1", "open"),
      task("a", "avlyst", "g1", "open"),
      task("c", "kansellert-oppgave", "g1", "cancelled"),
    ];
    expect(ledGroupDropouts({ groups, personId: "me", gatherings, tasks, assignments: [], now: NOW })).toEqual([]);
  });

  test("en samling med bare ledige (gule) oppgaver er ikke med", () => {
    const groups = [ledGroup("g1", { leaders: ["me"] })];
    const gatherings = [gathering("s", "g1", "2027-01-05T10:00:00.000Z")];
    const tasks = [task("t", "s", "g1", "assigned")];
    const pending = [assignment("1", "t", "pending")];
    // Someone asked and not yet answered, with the need not met: yellow, not red
    const asked = [task("u", "s", "g1", "open", 2)];
    const askedPending = [assignment("2", "u", "pending")];
    expect(ledGroupDropouts({ groups, personId: "me", gatherings, tasks, assignments: [], now: NOW })).toEqual([]);
    expect(ledGroupDropouts({ groups, personId: "me", gatherings, tasks, assignments: pending, now: NOW })).toEqual([]);
    expect(ledGroupDropouts({ groups, personId: "me", gatherings, tasks: asked, assignments: askedPending, now: NOW })).toEqual([]);
  });

  test("bare den ledede gruppens oppgaver teller, selv om en annen gruppes oppgave på samme samling har forfall", () => {
    const groups = [ledGroup("g1", { leaders: ["me"] }), ledGroup("g2", { members: ["x"] })];
    const gatherings = [gathering("s", "g1", "2027-01-05T10:00:00.000Z")];
    const tasks = [task("mine", "s", "g1", "open"), task("andres", "s", "g2", "open")];
    const assignments = [assignment("1", "mine", "confirmed"), assignment("2", "andres", "withdrawn")];
    expect(ledGroupDropouts({ groups, personId: "me", gatherings, tasks, assignments, now: NOW })).toEqual([]);
  });

  test("sorteres etter startsAt", () => {
    const groups = [ledGroup("g1", { leaders: ["me"] }), ledGroup("g2", { leaders: ["me"] })];
    const gatherings = [
      gathering("sen", "g1", "2027-01-20T10:00:00.000Z"),
      gathering("tidlig", "g2", "2027-01-05T10:00:00.000Z"),
    ];
    const tasks = [task("a", "sen", "g1", "open"), task("b", "tidlig", "g2", "open")];
    const assignments = [assignment("1", "a", "withdrawn"), assignment("2", "b", "withdrawn")];
    const result = ledGroupDropouts({ groups, personId: "me", gatherings, tasks, assignments, now: NOW });
    expect(result.map((r) => r.gathering.id)).toEqual(["tidlig", "sen"]);
  });
});
