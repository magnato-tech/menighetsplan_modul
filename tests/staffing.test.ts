import { describe } from "vitest";
import { assert } from "./assert";
import {
  applyAssignmentChange,
  calculateTaskStaffingStatus,
  countSlots,
  describeAssignments,
  getStaffingStatus,
  holdsSlot,
  isAcuteForfall,
  taskStatusFor,
} from "../src/utils/staffing";
import { initialAssignments, initialTasks } from "../src/data/mockData";
import type { Task, Assignment } from "../src/types";

describe("Bemanningsstatus", () => {
  const task = (id: string, neededCount: number, status: Task["status"] = "open"): Task => ({
    id,
    gatheringId: "gathering-1",
    groupId: "group-1",
    title: "Lyd",
    status,
    neededCount,
  });
  let nextAssignment = 0;
  const assignment = (taskId: string, response: Assignment["response"]): Assignment => ({
    id: `assign-${++nextAssignment}`,
    taskId,
    personId: `person-${nextAssignment}`,
    response,
  });
  const responses = (taskId: string, ...list: Assignment["response"][]) => list.map((r) => assignment(taskId, r));

  // 1. The rules listed above calculateTaskStaffingStatus, one by one
  const full = calculateTaskStaffingStatus(task("t", 2), responses("t", "confirmed", "confirmed"));
  assert(full.color === "green" && full.statusText === "Dekket" && full.isFullyCovered, "2/2 bekreftet er grønn og dekket");
  assert(full.missingCount === 0, "En dekket oppgave mangler ingen");

  const half = calculateTaskStaffingStatus(task("t", 2), responses("t", "confirmed"));
  assert(half.color === "red" && half.statusText === "Mangler 1", "1/2 bekreftet er rød og mangler 1");
  assert(half.confirmedCount === 1 && half.neededCount === 2, "Tellingen viser 1 av 2");

  const asked = calculateTaskStaffingStatus(task("t", 2), responses("t", "pending", "pending"));
  assert(asked.color === "yellow" && asked.statusText === "Venter på svar", "0/2 bekreftet med ubesvarte forespørsler er gul");
  assert(asked.pendingCount === 2 && asked.missingCount === 2, "Ubesvarte forespørsler dekker ingen plass");

  const halfAndAsked = calculateTaskStaffingStatus(task("t", 2), responses("t", "confirmed", "pending"));
  assert(halfAndAsked.color === "red" && halfAndAsked.statusText === "Mangler 1", "1/2 bekreftet + 1 ubesvart er fortsatt rød");

  const withdrawn = calculateTaskStaffingStatus(task("t", 1), responses("t", "withdrawn"));
  assert(withdrawn.color === "red" && withdrawn.hasForfall, "Forfall som åpner en plass er rød");

  const withdrawnAndAsked = calculateTaskStaffingStatus(task("t", 1), responses("t", "withdrawn", "pending"));
  assert(withdrawnAndAsked.color === "red", "Forfall + ny forespørsel er rød til plassen er dekket");

  const replaced = calculateTaskStaffingStatus(task("t", 1), responses("t", "withdrawn", "confirmed"));
  assert(replaced.color === "green" && replaced.isFullyCovered, "Forfall som er erstattet av en bekreftet person er grønn");

  // Forfall means someone dropped out, or the task is marked vacant. Being short of people is not forfall.
  assert(!half.hasForfall, "1/2 bekreftet uten at noen har trukket seg er ikke forfall");
  assert(!halfAndAsked.hasForfall, "1/2 bekreftet + ubesvart forespørsel er ikke forfall");
  const halfWithWithdrawal = calculateTaskStaffingStatus(task("t", 2), responses("t", "confirmed", "withdrawn"));
  assert(halfWithWithdrawal.color === "red" && halfWithWithdrawal.hasForfall, "1/2 bekreftet der én har meldt forfall er forfall");
  const markedVacant = calculateTaskStaffingStatus(task("t", 2, "vacant"), responses("t", "confirmed"));
  assert(markedVacant.hasForfall, "Oppgave med status 'vacant' er forfall også uten en tilbaketrukket tildeling");
  assert(!replaced.hasForfall, "Et forfall som er dekket inn igjen er ikke lenger forfall");

  // 2. Edges the list does not spell out
  const untouched = calculateTaskStaffingStatus(task("t", 3), []);
  assert(untouched.color === "red" && untouched.statusText === "Mangler 3", "Åpen oppgave uten tildelinger mangler hele behovet");

  const declined = calculateTaskStaffingStatus(task("t", 1), responses("t", "declined"));
  assert(declined.color === "red" && declined.missingCount === 1, "Bare avslag dekker ingen plass");

  const over = calculateTaskStaffingStatus(task("t", 1), responses("t", "confirmed", "confirmed"));
  assert(over.color === "green" && over.missingCount === 0, "Flere bekreftede enn behovet gir ikke negativ mangel");

  // 3. A gathering takes the most serious colour among its tasks
  const none = getStaffingStatus([], []);
  assert(none.color === "green" && none.label === "Ingen oppgaver", "Samling uten oppgaver er grønn");

  const lyd = task("lyd", 1);
  const kaffe = task("kaffe", 2);
  const vert = task("vert", 1);

  const allCovered = getStaffingStatus([lyd, kaffe], [
    ...responses("lyd", "confirmed"),
    ...responses("kaffe", "confirmed", "confirmed"),
  ]);
  assert(allCovered.color === "green" && allCovered.coveredCount === 2 && !allCovered.needsAttention, "Alle oppgaver dekket gir grønn samling");

  const waiting = getStaffingStatus([lyd, vert], [...responses("lyd", "confirmed"), ...responses("vert", "pending")]);
  assert(waiting.color === "yellow" && waiting.label === "Venter på svar", "Dekket + ubesvart gir gul samling");
  assert(!waiting.needsAttention, "Gul samling krever ikke oppfølging");

  const missing = getStaffingStatus([lyd, kaffe, vert], [
    ...responses("lyd", "confirmed"),
    ...responses("kaffe", "confirmed"),
    ...responses("vert", "pending"),
  ]);
  assert(missing.color === "red" && missing.needsAttention, "Én rød oppgave gjør hele samlingen rød");
  assert(missing.missingPeopleCount === 2 && missing.label === "Mangler 2", "Samlingen summerer manglende personer på tvers av oppgaver");
  assert(missing.totalTasks === 3 && missing.coveredCount === 1, "Samlingen teller oppgaver og dekkede oppgaver");
  assert(missing.vacantCount === 0 && missing.openCount === 2, "Oppgaver som mangler folk uten forfall telles som åpne, ikke som forfall");

  const withForfall = getStaffingStatus([lyd, kaffe], [
    ...responses("lyd", "withdrawn"),
    ...responses("kaffe", "confirmed"),
  ]);
  assert(withForfall.vacantCount === 1 && withForfall.openCount === 1, "Samlingen skiller forfall fra oppgaver som bare mangler folk");

  // 4. The equation: Ledige plasser = Behov − Bekreftet − Venter
  const slots = (needed: number | undefined, ...list: Assignment["response"][]) =>
    countSlots({ neededCount: needed }, responses("t", ...list));
  assert(slots(2, "confirmed").free === 1, "2 behov − 1 bekreftet − 0 venter = 1 ledig plass");
  assert(slots(3, "confirmed", "pending").free === 1, "3 behov − 1 bekreftet − 1 venter = 1 ledig plass");
  assert(slots(2, "confirmed", "confirmed").free === 0, "Fullt dekket gir ingen ledige plasser");
  assert(slots(1, "pending").free === 0, "En ubesvart forespørsel holder plassen");
  assert(slots(1, "withdrawn", "declined").free === 1, "Forfall og avslag holder ingen plass");
  assert(slots(1, "confirmed", "confirmed").free === 0, "Flere enn behovet gir ikke negativt antall ledige");
  assert(slots(undefined).needed === 1 && slots(undefined).free === 1, "Uten oppgitt behov trengs én person");
  assert(holdsSlot({ response: "confirmed" }) && holdsSlot({ response: "pending" }), "Bekreftet og forespurt står på oppgaven");
  assert(!holdsSlot({ response: "declined" }) && !holdsSlot({ response: "withdrawn" }), "Avslått og forfall står ikke på oppgaven");

  // 5. The status stored on a task follows from its assignments
  const statusOf = (needed: number, status: Task["status"], acute: boolean, ...list: Assignment["response"][]) =>
    taskStatusFor(task("t", needed, status), responses("t", ...list), acute);
  assert(statusOf(1, "open", false) === "open", "Uten tildelinger er oppgaven ledig");
  assert(statusOf(1, "open", false, "confirmed") === "confirmed", "Én bekreftet på en oppgave for én er dekket");
  assert(statusOf(1, "open", false, "pending") === "assigned", "En forespørsel som holder siste plass gir 'assigned'");
  assert(statusOf(2, "open", false, "confirmed") === "open", "1 av 2 bekreftet har fortsatt en ledig plass");
  assert(statusOf(2, "open", false, "confirmed", "pending") === "assigned", "1 bekreftet + 1 forespurt av 2 venter på svar");
  assert(statusOf(2, "open", false, "confirmed", "confirmed") === "confirmed", "2 av 2 bekreftet er dekket");
  assert(statusOf(1, "confirmed", false, "withdrawn") === "open", "Forfall i god tid gjør oppgaven ledig");
  assert(statusOf(1, "confirmed", true, "withdrawn") === "vacant", "Akutt forfall gir 'vacant'");
  assert(statusOf(1, "assigned", true, "declined") === "vacant", "Et nei tett på samlingen gir også 'vacant'");
  assert(statusOf(2, "vacant", false, "confirmed") === "vacant", "En akutt ledig oppgave er akutt til alle plassene er fylt");
  assert(statusOf(1, "vacant", false, "withdrawn", "confirmed") === "confirmed", "En vikar som sier ja dekker oppgaven igjen");
  assert(statusOf(1, "vacant", false, "withdrawn", "pending") === "assigned", "En forespurt vikar holder plassen til svaret kommer");
  assert(statusOf(1, "confirmed", true, "confirmed") === "confirmed", "Et akutt forfall på en plass som alt er dekket endrer ingenting");
  assert(statusOf(1, "cancelled", false, "confirmed") === "cancelled", "En avlyst oppgave forblir avlyst");

  // 6. Acute: less than 48 hours before the gathering starts
  const start = "2026-11-01T10:00:00.000Z";
  assert(isAcuteForfall(start, new Date("2026-10-31T10:00:00.000Z")), "24 timer før er akutt");
  assert(isAcuteForfall(start, new Date("2026-10-30T10:00:01.000Z")), "Ett sekund innenfor 48 timer er akutt");
  assert(!isAcuteForfall(start, new Date("2026-10-30T10:00:00.000Z")), "Nøyaktig 48 timer før er ikke akutt");
  assert(!isAcuteForfall(start, new Date("2026-10-01T10:00:00.000Z")), "En måned før er ikke akutt");
  assert(isAcuteForfall(start, new Date("2026-11-01T10:30:00.000Z")), "Etter at samlingen har startet er det akutt");
  assert(!isAcuteForfall(undefined, new Date()) && !isAcuteForfall("ikke en dato", new Date()), "Uten gyldig starttid er ingenting akutt");

  // 7. A change to the assignments, applied to the list the status is worked out from
  const [first, second] = responses("t", "confirmed", "pending");
  const added = assignment("t", "pending");
  const changed = applyAssignmentChange([first, second], {
    add: added,
    update: [{ id: second.id, fields: { response: "declined", respondedAt: "2026-10-01T10:00:00.000Z" } }],
    remove: first.id,
  });
  assert(changed.length === 2 && changed[0].id === second.id && changed[1].id === added.id, "Endringen fjerner, oppdaterer og legger til");
  assert(changed[0].response === "declined" && changed[0].respondedAt !== undefined, "Den oppdaterte tildelingen får de nye feltene");
  assert(second.response === "pending", "applyAssignmentChange endrer ikke tildelingene den får inn");
  assert(applyAssignmentChange([first], {}).length === 1, "En tom endring endrer ingenting");

  // 8. How an answer reads, in one place
  const described = describeAssignments(responses("t", "pending", "confirmed", "declined", "withdrawn"), (id) => ({
    id,
    name: `Person ${id}`,
    globalRole: "member",
  }));
  assert(
    described.map((d) => d.statusLabel).join(",") === "Forespurt,Bekreftet,Avslått,Forfall",
    "Svarene heter Forespurt, Bekreftet, Avslått og Forfall"
  );
  assert(
    described.every((d) => d.response === d.assignment.response && d.person?.id === d.assignment.personId),
    "Hver rad viser tildelingens eget svar og person"
  );
  assert(
    describeAssignments(responses("t", "confirmed"), () => undefined)[0].person === undefined,
    "En tildeling til en slettet person tåles"
  );

  // 9. The demo data follows the same rule, so a freshly filled database starts out consistent
  const inconsistent = initialTasks.filter(
    (t) => taskStatusFor(t, initialAssignments.filter((a) => a.taskId === t.id)) !== t.status
  );
  assert(
    inconsistent.length === 0,
    `Statusen på hver demooppgave følger av tildelingene (avvik: ${inconsistent.map((t) => t.id).join(", ") || "ingen"})`
  );
});
