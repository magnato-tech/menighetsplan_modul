import { describe } from "vitest";
import { assert } from "./assert";
import { staffingDotFor, worstStaffingDot } from "../src/utils/staffing";
import { gatheringsNeedingAssignments, leaderDotForGathering } from "../src/utils/personalCalendar";
import { buildRunSheet, sharedRunSheet, type RunSheetTask } from "../src/utils/runSheet";
import type { Assignment, Task } from "../src/types";

describe("Prikken for gruppeleder", () => {
  const task = (id: string, status: Task["status"], neededCount = 2, groupId = "lyd", gatheringId = "g1"): Task => ({
    id, gatheringId, groupId, title: id, status, neededCount,
  });
  const answer = (taskId: string, response: Assignment["response"], n = 1): Assignment[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${taskId}-${response}-${i}`, taskId, personId: `p${i}-${response}`, response }));

  // 1. One task
  assert(staffingDotFor(task("t", "open"), []) === "red", "Ingen på oppgaven er rød");
  assert(staffingDotFor(task("t", "open"), answer("t", "declined")) === "red", "Den som har sagt nei, teller ikke");
  assert(staffingDotFor(task("t", "vacant"), answer("t", "withdrawn")) === "red", "Et forfall som ikke er erstattet, er rødt");
  assert(staffingDotFor(task("t", "open"), answer("t", "confirmed")) === "yellow", "Én av to har sagt ja: gul");
  assert(staffingDotFor(task("t", "open", 1), answer("t", "pending")) === "yellow", "Forespurt uten svar: gul");
  assert(staffingDotFor(task("t", "assigned"), []) === "yellow", "Alle plasser forespurt (lagret status) er gul, også før tildelingene er hentet");
  assert(staffingDotFor(task("t", "confirmed"), []) === null, "Fullt bemannet har ingen prikk");
  assert(staffingDotFor(task("t", "cancelled"), []) === null, "En avlyst oppgave har ingen prikk");

  // 2. Several tasks give one dot, the worst
  assert(worstStaffingDot(["yellow", "red", null]) === "red", "Rød vinner");
  assert(worstStaffingDot([null, "yellow"]) === "yellow", "Ellers gul");
  assert(worstStaffingDot([null, null]) === null, "Alt i orden: ingen prikk");

  // 3. The calendar: only the groups one leads, never on a cancelled event
  const tasks = [task("lyd-1", "confirmed"), task("lyd-2", "open"), task("kjokken", "open", 2, "kjokken")];
  const assignments = answer("lyd-2", "confirmed");
  const led = new Set(["lyd"]);
  assert(leaderDotForGathering({ id: "g1" }, tasks, assignments, led) === "yellow", "Lederen av Lyd ser gul, ikke Kjøkkens røde");
  assert(leaderDotForGathering({ id: "g1" }, tasks, assignments, new Set(["kjokken"])) === "red", "Lederen av Kjøkken ser rød");
  assert(leaderDotForGathering({ id: "g1" }, tasks, assignments, new Set()) === null, "Den som ikke leder noen gruppe, ser ingen prikk");
  assert(leaderDotForGathering({ id: "g1", cancelled: true }, tasks, assignments, led) === null, "Et avlyst arrangement har ingen prikk");
  assert(gatheringsNeedingAssignments(["g1", "g2"], tasks, led).join() === "g1", "Tildelingene hentes bare der en egen oppgave har ledig plass");
  assert(gatheringsNeedingAssignments(["g1"], [task("lyd-1", "confirmed")], led).length === 0, "Fullt bemannet trenger ingen henting");

  // 4. The run sheet: the dot only on rows of one's own groups
  const detail = (t: Task, isMyGroup: boolean, list: Assignment[]): RunSheetTask => ({
    task: t,
    isMyGroup,
    neededCount: t.neededCount ?? 1,
    assignedPersons: list.map((a) => ({ assignment: a, statusLabel: "", response: a.response })),
    confirmedPersonsCount: list.filter((a) => a.response === "confirmed").length,
    isFullyCovered: false,
    hasWithdrawn: false,
  });
  const rows = sharedRunSheet(
    buildRunSheet([], [detail(task("egen", "open"), true, []), detail(task("annen", "open", 2, "kjokken"), false, [])]),
    "leder"
  );
  assert(rows.find((r) => r.id === "task-egen")?.dot === "red", "Egen gruppes tomme oppgave er rød i kjøreplanen");
  assert(rows.find((r) => r.id === "task-annen")?.dot === undefined, "En annen gruppes oppgave har ingen prikk");
});
