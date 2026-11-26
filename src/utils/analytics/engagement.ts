import type { Person } from "../../types";
import { isGroupGathering, isWorshipService } from "../gatherings";
import { allGroupPersonIds } from "../groups";
import type { AnalyticsPeriod } from "./periods";
import { DAY_MS, groupBy, heldIn, servingsOn, share, staffingPerGathering, timeOf } from "./shared";
import type { ChurchData } from "./shared";

/** Bands for "how many in a month": 0, 1, 2 … 7, and 8 or more. */
export const MONTH_BANDS = ["0", "1", "2", "3", "4", "5", "6", "7", "8 eller flere"] as const;

export interface MonthBand {
  label: (typeof MONTH_BANDS)[number];
  /** Share of the person register with this many in a typical month. */
  share: number;
  /** About how many people that is in a typical month. */
  people: number;
}

export interface PersonEngagement {
  person: Person;
  tasks: number;
  gatheringsServed: number;
  worshipServed: number;
  /** Of the worship services held in the period, the share where the person had a task. */
  worshipShare: number | null;
  /** Gatherings where the person had two or more tasks. */
  multiTaskTimes: number;
  serviceGroups: number;
  otherGroups: number;
  /** Group meetings the person answered «Kommer» to. */
  meetingsAttending: number;
  /** Tasks and group meetings per month (30 days), one decimal. */
  activitiesPerMonth: number;
}

export interface EngagementSummary {
  /** The period counted in months of 30 days, at least one. */
  months: number;
  /** How many days such a month is in this period: 28 for the last four weeks, else about 30. */
  monthDays: number;
  worshipHeld: number;
  /** Everyone in the register, most tasks first. */
  people: PersonEngagement[];
  /** Null when no gathering in the period had tasks: then nobody could have had one. */
  tasksPerMonth: MonthBand[] | null;
  /** Tasks and group meetings answered «Kommer». Null when there were neither. */
  activitiesPerMonth: MonthBand[] | null;
  withoutTasks: number | null;
  withoutTasksShare: number | null;
  /** In no group and without a task in the period. Null when no gathering had tasks. */
  withoutTasksOrGroups: Person[] | null;
}

const MONTH_MS = 30 * DAY_MS;

/** The share of the congregation, and about how many people, with at least `from` in a typical month. */
export function atLeastPerMonth(bands: MonthBand[], from: number): { share: number; people: number } {
  const rest = bands.slice(Math.min(from, bands.length));
  return {
    share: rest.reduce((sum, b) => sum + b.share, 0),
    people: Math.round(rest.reduce((sum, b) => sum + b.people, 0) * 10) / 10,
  };
}

function bandsOf(perPersonAndMonth: number[][], personCount: number, months: number): MonthBand[] {
  const counts = MONTH_BANDS.map(() => 0);
  for (const perMonth of perPersonAndMonth) for (const n of perMonth) counts[Math.min(n, MONTH_BANDS.length - 1)]++;
  return MONTH_BANDS.map((label, i) => ({
    label,
    share: counts[i] / (personCount * months),
    people: Math.round((counts[i] / months) * 10) / 10,
  }));
}

export function summarizeEngagement(
  data: Pick<ChurchData, "persons" | "groups" | "gatherings" | "tasks" | "assignments" | "attendances">,
  period: AnalyticsPeriod
): EngagementSummary {
  const held = heldIn(data.gatherings, period.from, period.to);
  const months = Math.max(1, Math.round((period.to - period.from) / MONTH_MS));
  const monthLength = (period.to - period.from) / months;
  const monthOf = (iso: string) => Math.min(months - 1, Math.max(0, Math.floor((timeOf(iso) - period.from) / monthLength)));

  const servingsByPerson = groupBy(servingsOn(held, data), (s) => s.personId);
  const meetingIds = new Set(held.filter(isGroupGathering).map((g) => g.id));
  const meetingById = new Map(held.map((g) => [g.id, g]));
  // A meeting the person already has a task on is one activity, not two
  const servedOn = new Set(servingsOn(held, data).map((s) => `${s.personId}|${s.gathering.id}`));
  const meetingsByPerson = groupBy(
    data.attendances.filter(
      (a) => a.status === "attending" && meetingIds.has(a.gatheringId) && !servedOn.has(`${a.personId}|${a.gatheringId}`)
    ),
    (a) => a.personId
  );
  const worshipHeld = held.filter((g) => !isGroupGathering(g) && isWorshipService(g)).length;

  const taskMonths: number[][] = [];
  const activityMonths: number[][] = [];
  const people: PersonEngagement[] = data.persons.map((person) => {
    const servings = servingsByPerson.get(person.id) ?? [];
    const meetings = meetingsByPerson.get(person.id) ?? [];
    const tasksPerMonth = Array.from({ length: months }, () => 0);
    for (const s of servings) tasksPerMonth[monthOf(s.gathering.startsAt)]++;
    const activitiesPerMonth = [...tasksPerMonth];
    for (const a of meetings) activitiesPerMonth[monthOf(meetingById.get(a.gatheringId)!.startsAt)]++;
    taskMonths.push(tasksPerMonth);
    activityMonths.push(activitiesPerMonth);

    const tasksByGathering = groupBy(servings, (s) => s.gathering.id);
    const worshipServed = [...tasksByGathering.values()].filter((list) => {
      const g = list[0].gathering;
      return !isGroupGathering(g) && isWorshipService(g);
    }).length;
    const groupsOfPerson = data.groups.filter((g) => allGroupPersonIds(g).includes(person.id));
    const serviceGroups = groupsOfPerson.filter((g) => g.category === "tjenestegruppe").length;
    return {
      person,
      tasks: servings.length,
      gatheringsServed: tasksByGathering.size,
      worshipServed,
      worshipShare: share(worshipServed, worshipHeld),
      multiTaskTimes: [...tasksByGathering.values()].filter((list) => new Set(list.map((s) => s.task.id)).size >= 2).length,
      serviceGroups,
      otherGroups: groupsOfPerson.length - serviceGroups,
      meetingsAttending: meetings.length,
      activitiesPerMonth: Math.round(((servings.length + meetings.length) / months) * 10) / 10,
    };
  });
  people.sort(
    (a, b) => b.tasks - a.tasks || b.activitiesPerMonth - a.activitiesPerMonth || a.person.name.localeCompare(b.person.name, "nb")
  );

  const hadTasks = staffingPerGathering(held, data).length > 0;
  const hadActivities = hadTasks || meetingIds.size > 0;
  const withoutTasks = people.filter((p) => p.tasks === 0).length;
  const count = data.persons.length;
  return {
    months,
    monthDays: Math.round(monthLength / DAY_MS),
    worshipHeld,
    people,
    tasksPerMonth: hadTasks && count > 0 ? bandsOf(taskMonths, count, months) : null,
    activitiesPerMonth: hadActivities && count > 0 ? bandsOf(activityMonths, count, months) : null,
    withoutTasks: hadTasks ? withoutTasks : null,
    withoutTasksShare: hadTasks ? share(withoutTasks, count) : null,
    withoutTasksOrGroups: hadTasks
      ? people
          .filter((p) => p.tasks === 0 && p.serviceGroups + p.otherGroups === 0)
          .map((p) => p.person)
          .sort((a, b) => a.name.localeCompare(b.name, "nb"))
      : null,
  };
}
