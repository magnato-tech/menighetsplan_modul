import type { Assignment, Gathering, Group, Task, VolunteerRole } from "../types";
import { allGroupPersonIds, isInGroup } from "./groups";
import { countSlots, holdsSlot } from "./staffing";
import { parseIsoToDateAndTime } from "./dates";

// The semester plan: an administrator releases the planning of a semester, and everyone in a team
// with tasks in it goes through the events one card at a time: takes a task, says they cannot, or
// goes on. Everything here is worked out from the plan and the planning data; nothing is copied.
//
// Which events and tasks a plan holds is worked out when it is looked at, not when it is released:
// an event put into the calendar later, within the plan's days, comes with by itself. Changing the
// days changes only which events are shown; the answers stay as they are.
//
// A plan is open from the moment it opens to the end of its answer day, and closed after. Opened
// again, with a new opening, it is a new round: everyone gets the flag again and starts from the
// first card. What they said they cannot, is kept, for it is about the event.
//
// Plans do not overlap: one plan holds a given day. Two can be open at once, side by side.

/** A semester plan as an administrator releases it. The days are calendar days, "2027-01-10". */
export interface SemesterPlan {
  id: string;
  name: string;
  firstDay: string;
  lastDay: string;
  /** The day the answers are wanted by. The plan closes when it is over. */
  answerBy: string;
  /** When the plan shows on Min side: an exact moment (see combineDateAndTimeToIso). A new one starts a new round. */
  opensAt: string;
  createdAt: string;
  updatedAt?: string;
}

/** One person's way through one plan: the events gone past, those they cannot, and whether they are done. */
export interface SemesterAnswer {
  id: string;
  planId: string;
  personId: string;
  /** Events the person has gone past, by «Neste», «Kan ikke» or by taking a task. */
  passed: string[];
  /** Events the person has said they cannot. */
  declined: string[];
  /** When the person reached the end. Absent while they are on their way. */
  finishedAt?: string;
  /** The round the way through belongs to: the plan's opening when it was written. */
  round?: string;
  updatedAt?: string;
}

/**
 * The answer as it counts in the plan's present round. From an earlier round only what the person
 * cannot is kept: the way through starts from the beginning, and nothing is finished.
 */
export function answerInRound(plan: Pick<SemesterPlan, "opensAt">, answer: SemesterAnswer | null | undefined): SemesterAnswer | null {
  if (!answer) return null;
  if (answer.round === plan.opensAt) return answer;
  return { id: answer.id, planId: answer.planId, personId: answer.personId, passed: [], declined: answer.declined, round: plan.opensAt };
}

/** The id of a person's answer to a plan: one per plan and person, so a second save replaces the first. */
export const semesterAnswerId = (planId: string, personId: string): string => `semester-answer-${planId}-${personId}`;

/** Where a volunteer goes through the plan: the link «Kopier lenke» gives. */
export const semesterPlanPath = (planId: string): string => `/minside/semesterplan/${planId}`;

/** The calendar day an event is on, for the person looking: "2027-01-10". */
const dayOf = (gathering: Pick<Gathering, "startsAt">): string => parseIsoToDateAndTime(gathering.startsAt).date;

const isTeamTask = (task: Task): boolean => Boolean(task.groupId) && task.status !== "cancelled";

const byStart = (a: Gathering, b: Gathering) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

/** The events in the plan: between the first and the last day, not cancelled, and with at least one task for a team. */
export function planGatherings(
  plan: Pick<SemesterPlan, "firstDay" | "lastDay">,
  gatherings: readonly Gathering[],
  tasks: readonly Task[]
): Gathering[] {
  if (!plan.firstDay || !plan.lastDay || plan.firstDay > plan.lastDay) return [];
  const withTeamTasks = new Set(tasks.filter(isTeamTask).map((task) => task.gatheringId));
  return gatherings
    .filter((gathering) => !gathering.cancelled && withTeamTasks.has(gathering.id))
    .filter((gathering) => {
      const day = dayOf(gathering);
      return day !== "" && day >= plan.firstDay && day <= plan.lastDay;
    })
    .sort(byStart);
}

/** Everyone who gets the flag: those in a team that has a task on one of the plan's events. */
export function planPersonIds(
  plan: Pick<SemesterPlan, "firstDay" | "lastDay">,
  gatherings: readonly Gathering[],
  tasks: readonly Task[],
  groups: readonly Group[]
): string[] {
  const inPlan = new Set(planGatherings(plan, gatherings, tasks).map((gathering) => gathering.id));
  const teamIds = new Set(tasks.filter((task) => isTeamTask(task) && inPlan.has(task.gatheringId)).map((task) => task.groupId!));
  const people = new Set<string>();
  for (const group of groups) if (teamIds.has(group.id)) for (const personId of allGroupPersonIds(group)) people.add(personId);
  return [...people];
}

/** What the admin shows under a plan: how many events, and how many people get the flag. */
export function planSummary(
  plan: Pick<SemesterPlan, "firstDay" | "lastDay">,
  gatherings: readonly Gathering[],
  tasks: readonly Task[],
  groups: readonly Group[]
): { gatheringCount: number; personCount: number } {
  return {
    gatheringCount: planGatherings(plan, gatherings, tasks).length,
    personCount: planPersonIds(plan, gatherings, tasks, groups).length,
  };
}

/** One task on a card, as the person going through the plan sees it. */
export interface CardTask {
  task: Task;
  /** What the task is called on the card: the role's name where it has one, else the task's title. */
  label: string;
  free: number;
  /** The person's own assignment on the task, whatever its answer. */
  mine?: Assignment;
  /** Whether the person holds a place on the task (asked or said yes). */
  holdsPlace: boolean;
}

/** One card: an event, and the tasks on it for the teams the person is in. */
export interface PlanCard {
  gathering: Gathering;
  tasks: CardTask[];
}

/** What a task is called on a card: the name of its role where it has one. */
export function taskLabel(task: Pick<Task, "title" | "volunteerRoleId">, roles: readonly Pick<VolunteerRole, "id" | "name">[]): string {
  return roles.find((role) => role.id === task.volunteerRoleId)?.name || task.title;
}

/**
 * The cards a person goes through: every event in the plan with at least one task for a team the
 * person is in, the earliest first. The tasks of all the person's teams stand on the same card.
 */
export function cardsFor(
  plan: Pick<SemesterPlan, "firstDay" | "lastDay">,
  personId: string,
  data: {
    gatherings: readonly Gathering[];
    tasks: readonly Task[];
    groups: readonly Group[];
    assignments: readonly Assignment[];
    roles?: readonly Pick<VolunteerRole, "id" | "name">[];
  }
): PlanCard[] {
  const myTeams = new Set(data.groups.filter((group) => isInGroup(group, personId)).map((group) => group.id));
  if (myTeams.size === 0) return [];
  return planGatherings(plan, data.gatherings, data.tasks)
    .map((gathering) => ({
      gathering,
      tasks: data.tasks
        .filter((task) => task.gatheringId === gathering.id && isTeamTask(task) && myTeams.has(task.groupId!))
        .map((task) => {
          const taskAssignments = data.assignments.filter((assignment) => assignment.taskId === task.id);
          const mine = taskAssignments.find((assignment) => assignment.personId === personId);
          return {
            task,
            label: taskLabel(task, data.roles ?? []),
            free: countSlots(task, taskAssignments).free,
            mine,
            holdsPlace: mine ? holdsSlot(mine) : false,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, "nb")),
    }))
    .filter((card) => card.tasks.length > 0);
}

/** Whether the person can still take a task on the card: one they do not hold, with a place free. */
export const canTakeMore = (card: PlanCard): boolean => card.tasks.some((item) => !item.holdsPlace && item.free > 0);

/** The card to start on: the first one not yet gone past. All gone past gives the number of cards (the end). */
export function nextCardIndex(cards: readonly PlanCard[], answer: Pick<SemesterAnswer, "passed"> | null | undefined): number {
  const passed = new Set(answer?.passed ?? []);
  const index = cards.findIndex((card) => !passed.has(card.gathering.id));
  return index === -1 ? cards.length : index;
}

export type PlanStatus = "planlagt" | "apen" | "lukket";

/** Planlagt before it opens, Åpen from then to the end of its answer day, Lukket after. */
export function planStatus(plan: Pick<SemesterPlan, "opensAt" | "answerBy">, now: Date): PlanStatus {
  if (now.getTime() < new Date(plan.opensAt).getTime()) return "planlagt";
  const today = parseIsoToDateAndTime(now.toISOString()).date;
  return today > plan.answerBy ? "lukket" : "apen";
}

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  planlagt: "Planlagt",
  apen: "Åpen",
  lukket: "Lukket",
};

/** A plan a person has to go through now: open, with cards for them, and not finished in this round. */
export function waitsForAnswer(plan: SemesterPlan, cards: readonly PlanCard[], answer: SemesterAnswer | null | undefined, now: Date): boolean {
  return planStatus(plan, now) === "apen" && cards.length > 0 && !answerInRound(plan, answer)?.finishedAt;
}

/** The tasks the person holds a place on in the plan, in the order of the cards. */
export function myPlanTasks(cards: readonly PlanCard[]): { card: PlanCard; item: CardTask }[] {
  return cards.flatMap((card) => card.tasks.filter((item) => item.holdsPlace).map((item) => ({ card, item })));
}

// ---------------------------------------------------------------- The form in the admin

export interface SemesterPlanForm {
  name: string;
  firstDay: string;
  lastDay: string;
  answerBy: string;
  opensDate: string;
  opensTime: string;
}

/** The plan among `others` whose days meet the form's, if any. */
export function overlappingPlan(
  form: Pick<SemesterPlanForm, "firstDay" | "lastDay">,
  others: readonly Pick<SemesterPlan, "name" | "firstDay" | "lastDay">[]
): Pick<SemesterPlan, "name" | "firstDay" | "lastDay"> | undefined {
  if (!form.firstDay || !form.lastDay) return undefined;
  return others.find((other) => form.firstDay <= other.lastDay && other.firstDay <= form.lastDay);
}

/**
 * What is wrong with the form, as the administrator reads it. Empty when it can be saved.
 * `others` are the other plans, which the days may not meet.
 */
export function planFormProblems(form: SemesterPlanForm, others: readonly Pick<SemesterPlan, "name" | "firstDay" | "lastDay">[] = []): string[] {
  const problems: string[] = [];
  if (!form.name.trim()) problems.push("Gi planen et navn.");
  if (!form.firstDay || !form.lastDay) problems.push("Velg første og siste dag.");
  else if (form.firstDay > form.lastDay) problems.push("Første dag må komme før siste dag.");
  else {
    const other = overlappingPlan(form, others);
    if (other) problems.push(`Dagene går inn i ${other.name} (${formatDay(other.firstDay)}–${formatDay(other.lastDay)}). Semesterplaner kan ikke overlappe.`);
  }
  if (!form.answerBy) problems.push("Velg svarfrist.");
  if (!form.opensDate || !form.opensTime) problems.push("Velg når planen åpner.");
  if (form.answerBy && form.opensDate && form.answerBy < form.opensDate) problems.push("Svarfristen må komme etter at planen åpner.");
  return problems;
}

/** "2027-01-10" as "10.01.2027". */
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  return year && month && date ? `${date}.${month}.${year}` : day;
}

const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

/** "2026-12-01" as "1. desember". */
export function formatDayLong(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return month && date ? `${date}. ${MONTHS[month - 1]}` : day;
}

const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

/** An event's day as a volunteer's list shows it: "søndag 10. januar". */
export function formatEventDay(startsAt: string): string {
  const date = new Date(startsAt);
  if (isNaN(date.getTime())) return startsAt;
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}. ${MONTHS[date.getMonth()]}`;
}
