import { describe, expect, test } from "vitest";
import { nextLedActivity, withLedGroupsFirst } from "../src/utils/leadGroups";
import type { Assignment, Gathering, Task } from "../src/types";

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
