import { describe } from "vitest";
import { assert } from "./assert";
import {
  countUrgentTasks,
  followUpGroups,
  stillToStaff,
  taskStateOf,
  upcomingGatherings,
  withinWeeks,
  type StudioData,
} from "../src/pages/admin/studio";
import type { Assignment, Gathering, Task } from "../src/types";
import { RESPONSE_LABELS, calculateTaskStaffingStatus, countSlots } from "../src/utils/staffing";

type Item = StudioData["adminTasks"][number];
type GatheringItem = StudioData["adminGatherings"][number];

describe("Trenger oppfølging", () => {
  const now = new Date("2026-10-05T12:00:00.000Z").getTime();
  const hours = (h: number) => new Date(now + h * 60 * 60 * 1000).toISOString();
  const gathering = (id: string, startsAt: string, extra: Partial<Gathering> = {}): Gathering => ({
    id,
    groupId: "x",
    title: `Samling ${id}`,
    startsAt,
    visibility: "intern",
    ...extra,
  });

  // A task with its people, worked out by the same rules the admin uses
  const item = (id: string, on: Gathering | undefined, responses: Assignment["response"][], extra: Partial<Task> = {}): Item => {
    const task: Task = { id, gatheringId: on?.id ?? "", title: id, status: "open", neededCount: 1, ...extra };
    const assignments: Assignment[] = responses.map((response, i) => ({ id: `${id}-${i}`, taskId: id, personId: `p${i}`, response }));
    const staffing = calculateTaskStaffingStatus(task, assignments);
    const slots = countSlots(task, assignments);
    return {
      task,
      gathering: on,
      assignedPersonsList: assignments.map((assignment) => ({
        assignment,
        statusLabel: RESPONSE_LABELS[assignment.response],
        response: assignment.response,
      })),
      neededCount: slots.needed,
      confirmedCount: slots.confirmed,
      pendingCount: slots.pending,
      availableSpots: slots.free,
      isFullyCovered: staffing.isFullyCovered,
      missingCount: staffing.missingCount,
      taskStaffing: staffing,
    };
  };

  const soon = gathering("snart", hours(48));
  const ongoing = gathering("naa", hours(-2));
  const past = gathering("forrige", hours(-7 * 24));
  const later = gathering("senere", hours(10 * 7 * 24));

  const items = [
    item("om-to-dager", soon, ["withdrawn"]),
    item("pagaar-naa", ongoing, []),
    item("forrige-uke", past, []),
    item("uten-samling", undefined, []),
    item("dekket", soon, ["confirmed"]),
    item("venter", soon, ["pending"]),
    item("om-ti-uker", later, []),
  ];

  // 1. What is still to staff
  assert(
    stillToStaff(items, now).map((i) => i.task.id).join(",") === "om-to-dager,pagaar-naa,uten-samling,dekket,venter,om-ti-uker",
    "En oppgave på en samling som er over, trenger ikke oppfølging; en som pågår, gjør det"
  );

  // 2. The one rule
  assert(taskStateOf(items[0]) === "forfall", "En ledig plass etter et forfall er forfall");
  assert(taskStateOf(items[1]) === "ubesatt", "En plass ingen er spurt til, er ubesatt");
  assert(taskStateOf(items[5]) === "venter", "En plass der noen er spurt, venter på svar");
  assert(
    taskStateOf(item("akutt", soon, [], { status: "vacant" })) === "forfall",
    "En oppgave som står ledig etter et akutt forfall, er forfall også uten tildelingene"
  );

  assert(countUrgentTasks(items, now) === 4, "Det som må ordnes, er forfall og ubesatt på kommende og pågående samlinger");
  const notNeeded = item("trengs-ikke", soon, [], { status: "cancelled" });
  assert(countUrgentTasks([...items, notNeeded], now) === 4, "En oppgave som ikke trengs på arrangementet, telles ikke");

  // 3. The near weeks
  assert(
    withinWeeks(items, 4, now).map((i) => i.task.id).join(",") === "om-to-dager,pagaar-naa,dekket,venter",
    "De nærmeste fire ukene: pågående og kommende samlinger, ikke de langt fram og ikke de uten samling"
  );

  // 4. Per gathering, soonest first
  const groups = followUpGroups([...items, notNeeded], "ordnes", 4, now);
  assert(
    groups.map((g) => g.gathering?.id).join(",") === "naa,snart",
    "Oppfølgingen er gruppert per arrangement, det nærmeste først"
  );
  assert(groups[1].items.map((i) => i.task.id).join(",") === "om-to-dager", "«Må ordnes» viser forfall og ubesatt, ikke det som er dekket eller venter");
  assert(
    followUpGroups(items, "venter", 4, now).flatMap((g) => g.items).map((i) => i.task.id).join(",") === "venter",
    "«Venter på svar» viser det som venter"
  );
  const all = followUpGroups([...items, notNeeded], "alle", null, now);
  assert(
    all.map((g) => g.gathering?.id ?? "-").join(",") === "naa,snart,senere,-",
    "Uten tidsgrense er alt som kommer med, og oppgaver uten arrangement står sist"
  );
  assert(
    all[1].items.map((i) => i.task.id).join(",") === "om-to-dager,venter,dekket",
    "Innenfor et arrangement står forfall først, så det som venter og det som er dekket, og avlyste oppgaver er ute"
  );

  // 5. The overview opens with the next gatherings
  const asGathering = (g: Gathering): GatheringItem => ({ gathering: g }) as unknown as GatheringItem;
  const cancelled = gathering("avlyst", hours(24), { cancelled: true });
  const groupMeeting = gathering("husgruppe", hours(30), { type: "gruppesamling" });
  const next = upcomingGatherings(
    [later, soon, past, ongoing, cancelled, groupMeeting].map(asGathering),
    items,
    3,
    now
  );
  assert(
    next.map((n) => n.item.gathering.id).join(",") === "naa,snart,senere",
    "Oversikten viser de neste arrangementene, uten avlyste, gruppesamlinger og de som er holdt"
  );
  assert(
    next[1].staffing.forfall === 1 && next[1].staffing.venter === 1 && next[1].staffing.dekket === 1 && next[1].staffing.total === 3,
    "Hvert arrangement har bemanningen sin talt etter samme regel"
  );
});
