import { describe, expect, test } from "vitest";
import { buildDayLoads, otherLoadsSameDay } from "../src/utils/sameDayLoads";
import type { Assignment, Gathering, Group, Task } from "../src/types";

// Local times, so the calendar day is the same in every time zone
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0).toISOString();

const group = (id: string, name: string) =>
  ({ id, name, memberIds: [], leaderIds: [] }) as unknown as Group;
const gathering = (id: string, startsAt: string, title = `Samling ${id}`) =>
  ({ id, groupId: "g1", title, startsAt, visibility: "intern" }) as unknown as Gathering;
const task = (id: string, gatheringId: string, title: string, groupId?: string) =>
  ({ id, gatheringId, title, groupId, status: "assigned" }) as unknown as Task;
const assignment = (id: string, taskId: string, personId: string, response: Assignment["response"] = "confirmed") =>
  ({ id, taskId, personId, response }) as unknown as Assignment;

const groups = [group("g1", "Lyd"), group("g2", "Rigging")];

describe("Samme person på flere oppgaver samme dag", () => {
  test("to oppgaver samme dag: hver ser den andre", () => {
    const gatherings = [gathering("e1", at(25, 10)), gathering("e2", at(25, 18))];
    const tasks = [task("t1", "e1", "Lyd", "g1"), task("t2", "e2", "Kjøkken", "g1")];
    const assignments = [assignment("a1", "t1", "p1"), assignment("a2", "t2", "p1")];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    const forT1 = otherLoadsSameDay(loads, "p1", at(25, 10), "t1");
    expect(forT1.map((load) => load.taskId)).toEqual(["t2"]);
    const forT2 = otherLoadsSameDay(loads, "p1", at(25, 18), "t2");
    expect(forT2.map((load) => load.taskId)).toEqual(["t1"]);
  });

  test("samme oppgave blir utelatt", () => {
    const gatherings = [gathering("e1", at(25, 10))];
    const tasks = [task("t1", "e1", "Lyd", "g1")];
    const assignments = [assignment("a1", "t1", "p1")];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    expect(otherLoadsSameDay(loads, "p1", at(25, 10), "t1")).toEqual([]);
  });

  test("oppgaver på en annen dag gir ingenting", () => {
    const gatherings = [gathering("e1", at(25, 10)), gathering("e2", at(26, 10))];
    const tasks = [task("t1", "e1", "Lyd", "g1"), task("t2", "e2", "Lyd", "g1")];
    const assignments = [assignment("a1", "t1", "p1"), assignment("a2", "t2", "p1")];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    expect(otherLoadsSameDay(loads, "p1", at(25, 10), "t1")).toEqual([]);
  });

  test("avslått og trukket tilbake teller ikke", () => {
    const gatherings = [gathering("e1", at(25, 10)), gathering("e2", at(25, 12)), gathering("e3", at(25, 14))];
    const tasks = [task("t1", "e1", "Lyd", "g1"), task("t2", "e2", "Lyd", "g1"), task("t3", "e3", "Lyd", "g1")];
    const assignments = [
      assignment("a1", "t1", "p1"),
      assignment("a2", "t2", "p1", "declined"),
      assignment("a3", "t3", "p1", "withdrawn"),
    ];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    expect(otherLoadsSameDay(loads, "p1", at(25, 10), "t1")).toEqual([]);
    expect(loads.get("p1")?.map((load) => load.assignmentId)).toEqual(["a1"]);
  });

  test("ventende svar teller", () => {
    const gatherings = [gathering("e1", at(25, 10)), gathering("e2", at(25, 12))];
    const tasks = [task("t1", "e1", "Lyd", "g1"), task("t2", "e2", "Lyd", "g1")];
    const assignments = [assignment("a1", "t1", "p1"), assignment("a2", "t2", "p1", "pending")];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    expect(otherLoadsSameDay(loads, "p1", at(25, 10), "t1").map((load) => load.taskId)).toEqual(["t2"]);
  });

  test("oppgave fra en annen gruppe er med, med gruppenavn", () => {
    const gatherings = [gathering("e1", at(25, 10)), gathering("e2", at(25, 12))];
    const tasks = [task("t1", "e1", "Lyd", "g1"), task("t2", "e2", "Bygg opp", "g2")];
    const assignments = [assignment("a1", "t1", "p1"), assignment("a2", "t2", "p1")];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    const other = otherLoadsSameDay(loads, "p1", at(25, 10), "t1");
    expect(other).toHaveLength(1);
    expect(other[0]).toMatchObject({ taskId: "t2", taskTitle: "Bygg opp", groupId: "g2", groupName: "Rigging" });
  });

  test("oppgave uten gruppe gir ingen gruppenavn", () => {
    const gatherings = [gathering("e1", at(25, 10)), gathering("e2", at(25, 12))];
    const tasks = [task("t1", "e1", "Lyd", "g1"), task("t2", "e2", "Taler")];
    const assignments = [assignment("a1", "t1", "p1"), assignment("a2", "t2", "p1")];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    const other = otherLoadsSameDay(loads, "p1", at(25, 10), "t1");
    expect(other[0].groupId).toBeUndefined();
    expect(other[0].groupName).toBeUndefined();
  });

  test("manglende oppgave eller samling hoppes over", () => {
    const gatherings = [gathering("e1", at(25, 10))];
    const tasks = [task("t1", "e1", "Lyd", "g1"), task("t2", "eMangler", "Lyd", "g1")];
    const assignments = [
      assignment("a1", "t1", "p1"),
      assignment("a2", "tMangler", "p1"),
      assignment("a3", "t2", "p1"),
    ];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    expect(loads.get("p1")?.map((load) => load.assignmentId)).toEqual(["a1"]);
    expect(otherLoadsSameDay(loads, "p1", at(25, 10), "t9")).toHaveLength(1);
  });

  test("lister sorteres etter startsAt", () => {
    const gatherings = [
      gathering("e1", at(25, 18)),
      gathering("e2", at(25, 8)),
      gathering("e3", at(25, 12)),
    ];
    const tasks = [task("t1", "e1", "A", "g1"), task("t2", "e2", "B", "g1"), task("t3", "e3", "C", "g1")];
    const assignments = [assignment("a1", "t1", "p1"), assignment("a2", "t2", "p1"), assignment("a3", "t3", "p1")];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    expect(loads.get("p1")?.map((load) => load.taskId)).toEqual(["t2", "t3", "t1"]);
    expect(otherLoadsSameDay(loads, "p1", at(25, 12), "t9").map((load) => load.taskId)).toEqual(["t2", "t3", "t1"]);
  });

  test("andre personer påvirkes ikke", () => {
    const gatherings = [gathering("e1", at(25, 10)), gathering("e2", at(25, 12))];
    const tasks = [task("t1", "e1", "Lyd", "g1"), task("t2", "e2", "Lyd", "g1")];
    const assignments = [assignment("a1", "t1", "p1"), assignment("a2", "t2", "p2")];
    const loads = buildDayLoads({ assignments, tasks, gatherings, groups });

    expect(otherLoadsSameDay(loads, "p1", at(25, 10), "t1")).toEqual([]);
    expect(otherLoadsSameDay(loads, "ukjent", at(25, 10))).toEqual([]);
  });
});
