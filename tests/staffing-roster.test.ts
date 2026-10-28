import { describe } from "vitest";
import { assert } from "./assert";
import {
  buildStaffingRoster,
  orderStaffingRoster,
  rosterByTeam,
  rowsNeedingAction,
  staffingStateOf,
  summarizeStaffingRoster,
  type RosterPlace,
} from "../src/utils/staffingRoster";
import type { RunSheetTask } from "../src/utils/runSheet";
import type { Assignment, Group, ProgramItem, Task } from "../src/types";
import { RESPONSE_LABELS, calculateTaskStaffingStatus } from "../src/utils/staffing";

describe("Bemanning", () => {
  const teams: Record<string, Group> = {
    lovsang: { id: "lovsang", name: "Lovsang", memberIds: [], leaderIds: [] },
    vert: { id: "vert", name: "Møtevert", memberIds: [], leaderIds: [] },
    leder: { id: "leder", name: "Gudstjenesteleder", memberIds: [], leaderIds: [] },
  };

  // A task with its people, worked out by the same rules the gathering view uses
  const detail = (
    id: string,
    groupId: string | undefined,
    responses: Assignment["response"][],
    extra: Partial<Task> = {}
  ): RunSheetTask => {
    const task: Task = { id, gatheringId: "g", groupId, title: id, status: "open", neededCount: 1, ...extra };
    const assignments: Assignment[] = responses.map((response, i) => ({ id: `${id}-${i}`, taskId: id, personId: `p-${id}-${i}`, response }));
    const staffing = calculateTaskStaffingStatus(task, assignments);
    return {
      task,
      taskGroup: groupId ? teams[groupId] : undefined,
      isMyGroup: groupId === "lovsang",
      neededCount: staffing.neededCount,
      assignedPersons: assignments.map((assignment) => ({
        assignment,
        person: { id: assignment.personId, name: assignment.personId, globalRole: "member" },
        statusLabel: RESPONSE_LABELS[assignment.response],
        response: assignment.response,
      })),
      confirmedPersonsCount: staffing.confirmedCount,
      isFullyCovered: staffing.isFullyCovered,
      hasWithdrawn: staffing.hasForfall,
    };
  };

  const program: ProgramItem[] = [
    { time: "10:45", title: "Velkommen ved inngang", taskId: "Møtevert" },
    { time: "11:00", title: "Lovsang x2", taskId: "Lovsang" },
    { time: "11:07", title: "Åpningsord", taskId: "Møteleder" },
    { time: "11:10", title: "Bønn", taskId: "Møteleder" },
    { time: "11.15", title: "Kunngjøringer", taskId: "Møteleder" },
    { time: "11:18", title: "Lovsang x3", taskId: "Lovsang" },
  ];
  const tasks = [
    detail("Møteleder", "leder", ["withdrawn"]),
    detail("Lovsang", "lovsang", ["confirmed"]),
    detail("Møtevert", "vert", []),
    detail("Kirkekaffe", "vert", ["pending"], { instruction: "Møt opp kl. 10:15 og trakt kaffe." }),
    detail("Taler", undefined, ["confirmed"]),
    detail("Barnekirke", "lovsang", ["confirmed", "withdrawn"], { neededCount: 2 }),
    detail("Teknikk", "vert", [], { status: "cancelled" }),
  ];
  const rows = buildStaffingRoster(program, tasks);
  const row = (id: string) => rows.find((r) => r.task.id === id)!;

  // 1. Every task once
  assert(rows.length === tasks.length, "Hver oppgave står én gang, også når programmet bruker den flere ganger");
  assert(row("Møteleder").programTimes.join(",") === "11:07,11:10,11:15", "Programpostene oppgaven brukes i, står som klokkeslett");
  assert(row("Lovsang").programTimes.join(",") === "11:00,11:18", "Samme rolle i to programposter gir to klokkeslett");
  assert(row("Kirkekaffe").programTimes.length === 0 && row("Kirkekaffe").meetAt === "10:15", "En servicerolle utenfor programmet har oppmøtetiden sin");
  assert(row("Lovsang").groupName === "Lovsang" && row("Taler").groupName === undefined, "Teamet kommer fra oppgaven, og en rolle kan være uten team");

  // 2. The state is what the one who must act needs to know
  assert(row("Møteleder").state === "forfall", "En plass som er ledig etter et forfall, er forfall");
  assert(row("Møtevert").state === "ubesatt", "En plass ingen er spurt til, er ubesatt");
  assert(row("Kirkekaffe").state === "venter", "En plass der noen er spurt og ikke har svart, venter");
  assert(row("Lovsang").state === "dekket", "En plass med en som har sagt ja, er dekket");
  assert(row("Barnekirke").state === "forfall" && row("Barnekirke").free === 1, "Én av to bekreftet etter et forfall: forfall, med én ledig plass");
  assert(row("Teknikk").state === "avlyst", "En avlyst oppgave er avlyst, ikke ubesatt");
  assert(
    row("Barnekirke").people.map((p) => p.response).join(",") === "confirmed,withdrawn",
    "De som står på, kommer før dem som har trukket seg"
  );

  // 3. A replacement asked after a forfall is waiting, and a replacement who said yes covers it
  const replaced = buildStaffingRoster(program, [detail("Møteleder", "leder", ["withdrawn", "pending"])])[0];
  assert(replaced.state === "venter", "Forfall og en ny som er spurt: venter på svar, ikke noe å gjøre ennå");
  const covered = buildStaffingRoster(program, [detail("Møteleder", "leder", ["withdrawn", "confirmed"])])[0];
  assert(covered.state === "dekket", "Forfall og en ny som har sagt ja: dekket");

  // 4. The order
  const ordered = orderStaffingRoster(rows);
  assert(
    ordered.attention.map((r) => r.task.id).join(",") === "Møteleder,Barnekirke,Møtevert",
    "Det som må ordnes står først: forfall før ubesatt, og etter klokka"
  );
  assert(
    ordered.teams.map((t) => t.name).join(",") === "Møtevert,Lovsang,Uten team",
    "Teamene står i den rekkefølgen de kommer i programmet, og roller uten team til slutt"
  );
  assert(
    ordered.teams[0].rows.map((r) => r.task.id).join(",") === "Kirkekaffe,Teknikk",
    "Innenfor et team står rollene etter klokka"
  );
  const all = [...ordered.attention, ...ordered.teams.flatMap((t) => t.rows)];
  assert(all.length === rows.length && new Set(all.map((r) => r.task.id)).size === rows.length, "Hver rolle står ett sted, aldri to");

  const held = orderStaffingRoster(rows, new Map<string, RosterPlace>([["Møtevert", "team"], ["Lovsang", "attention"]]));
  assert(
    !held.attention.some((r) => r.task.id === "Møtevert") && held.teams[0].rows.some((r) => r.task.id === "Møtevert"),
    "En rolle som er endret i teamet sitt, blir stående der"
  );
  assert(
    held.attention.some((r) => r.task.id === "Lovsang"),
    "En rolle som er ordnet fra «Må ordnes», blir stående der til visningen åpnes igjen"
  );

  // 5. The summary
  const summary = summarizeStaffingRoster(rows);
  assert(
    summary.forfall === 2 && summary.ubesatt === 1 && summary.venter === 1 && summary.dekket === 2 && summary.total === 6,
    "Oppsummeringen teller hver tilstand, og avlyste oppgaver er ikke med"
  );

  // 5b. The teams as cards: the same order, and what each team adds up to
  const cards = rosterByTeam(rows);
  assert(
    cards.map((t) => t.name).join(",") === "Møtevert,Lovsang,Gudstjenesteleder,Uten team",
    "Teamkortene står i samme rekkefølge som teamene i Må ordnes-visningen, og uten team sist"
  );
  assert(
    cards.map((t) => t.rows.length).join(",") === "3,2,1,1",
    "Hver rad står i ett teamkort, også det som må ordnes"
  );
  const team = (name: string) => cards.find((t) => t.name === name)!;
  assert(
    team("Lovsang").confirmed === 2 && team("Lovsang").pending === 0 && team("Lovsang").free === 1,
    "Lovsang-kortet teller bekreftede og ledige på alle sine roller"
  );
  assert(
    team("Møtevert").pending === 1 && team("Møtevert").free === 1 && team("Møtevert").confirmed === 0,
    "Møtevert-kortet teller venter og ledig, og en avlyst rolle teller ikke som ledig"
  );
  assert(team("Uten team").confirmed === 1 && team("Uten team").free === 0, "Roller uten team får et eget kort");

  // 5c. What the filter shows: what must be ordered, and what was changed while the view is open
  assert(
    rowsNeedingAction(rows).map((r) => r.task.id).join(",") === "Møteleder,Møtevert,Barnekirke",
    "Filteret viser forfall og ubesatt, og ingen andre"
  );
  assert(
    rowsNeedingAction(rows, new Map<string, RosterPlace>([["Kirkekaffe", "team"]])).some((r) => r.task.id === "Kirkekaffe"),
    "En rolle som er endret mens visningen er åpen, blir stående i filteret"
  );

  // 6. One rule
  assert(
    staffingStateOf({ status: "assigned", isFullyCovered: false, hasForfall: false, hasAssignments: false, free: 1 }) === "venter",
    "Uten tildelingene i nettleseren sier den lagrede statusen at plassen er tatt"
  );
  assert(
    staffingStateOf({ status: "vacant", isFullyCovered: false, hasForfall: true, hasAssignments: false, free: 1 }) === "forfall",
    "En oppgave som står ledig etter et akutt forfall, er forfall"
  );
});
