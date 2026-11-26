import type { Gathering, Person } from "../../types";
import { normalizeClock } from "../runSheet";
import type { AnalyticsPeriod } from "./periods";
import type { ChurchData, GatheringStaffing } from "./shared";
import { groupBy, heldIn, roleNameOf, servingsOn, share, staffingPerGathering, timeOf } from "./shared";

// ============================================================================
// The congregation's health: full staffing, several tasks at once, how often each takes part
// ============================================================================

export interface FullStaffingSummary {
  /** Held gatherings that had tasks, oldest first. A gathering without tasks has nothing to staff. */
  gatherings: GatheringStaffing[];
  full: number;
  rate: number | null;
  previousRate: number | null;
  worship: { withTasks: number; full: number; rate: number | null };
  /** Not fully staffed, newest first. */
  notFull: GatheringStaffing[];
  /** Slots that were not filled, on all the gatherings together. */
  missingSlots: number;
}

export function summarizeFullStaffing(
  data: Pick<ChurchData, "gatherings" | "tasks" | "assignments">,
  period: AnalyticsPeriod
): FullStaffingSummary {
  const gatherings = staffingPerGathering(heldIn(data.gatherings, period.from, period.to), data);
  const previous = staffingPerGathering(heldIn(data.gatherings, period.previousFrom, period.from, false), data);
  const full = gatherings.filter((g) => g.full).length;
  const worship = gatherings.filter((g) => g.isWorship);
  const worshipFull = worship.filter((g) => g.full).length;
  return {
    gatherings,
    full,
    rate: share(full, gatherings.length),
    previousRate: share(previous.filter((g) => g.full).length, previous.length),
    worship: { withTasks: worship.length, full: worshipFull, rate: share(worshipFull, worship.length) },
    notFull: gatherings.filter((g) => !g.full).reverse(),
    missingSlots: gatherings.reduce((sum, g) => sum + g.missing, 0),
  };
}

export interface MultiTaskOccurrence {
  person: Person;
  gathering: Gathering;
  /** The roles, in alphabetical order. */
  roles: string[];
  /**
   * The run sheet puts two of the tasks at the same clock time. Null when the run sheet does
   * not give a time for at least two of them: then it cannot be said.
   */
  sameTime: boolean | null;
}

export interface MultiTaskSummary {
  /** A person with two or more tasks on the same gathering, newest first. */
  occurrences: MultiTaskOccurrence[];
  people: number;
  /** Gatherings where at least one person had several tasks. */
  gatherings: number;
  /** Of all the times someone served on a gathering, the share where they had two or more tasks. */
  shareOfServings: number | null;
  /** The role combinations, most common first: "Bilde + Møteleder". */
  combinations: { roles: string; count: number }[];
  byPerson: { person: Person; times: number; mostTasks: number }[];
  /** How many of the occurrences the run sheet shows at the same time. Null when it cannot tell for any of them. */
  sameTimeCount: number | null;
  /** False when no gathering in the period had tasks: then nobody could have had several. */
  hadTasks: boolean;
}

export function summarizeMultiTasks(
  data: Pick<ChurchData, "persons" | "gatherings" | "tasks" | "assignments" | "volunteerRoles">,
  period: AnalyticsPeriod
): MultiTaskSummary {
  const personById = new Map(data.persons.map((p) => [p.id, p]));
  const roleNameById = new Map(data.volunteerRoles.map((r) => [r.id, r.name]));
  const byPersonAndGathering = groupBy(
    servingsOn(heldIn(data.gatherings, period.from, period.to), data).filter((s) => personById.has(s.personId)),
    (s) => `${s.personId}|${s.gathering.id}`
  );

  const occurrences: MultiTaskOccurrence[] = [];
  for (const servings of byPersonAndGathering.values()) {
    const tasks = [...new Map(servings.map((s) => [s.task.id, s.task])).values()];
    if (tasks.length < 2) continue;
    const gathering = servings[0].gathering;
    // Every time a task has in the run sheet, read the way the run sheet reads it ("9.30" is "09:30")
    const timesOfTask = new Map<string, Set<string>>();
    for (const item of gathering.programSchedule ?? []) {
      const time = item.time ? normalizeClock(item.time) : "";
      if (!item.taskId || !time) continue;
      const set = timesOfTask.get(item.taskId) ?? new Set<string>();
      set.add(time);
      timesOfTask.set(item.taskId, set);
    }
    const timed = tasks.filter((t) => timesOfTask.has(t.id));
    const tasksAtTime = new Map<string, number>();
    for (const t of timed) for (const time of timesOfTask.get(t.id)!) tasksAtTime.set(time, (tasksAtTime.get(time) ?? 0) + 1);
    occurrences.push({
      person: personById.get(servings[0].personId)!,
      gathering,
      roles: tasks.map((t) => roleNameOf(t, roleNameById)).sort((a, b) => a.localeCompare(b, "nb")),
      sameTime: timed.length < 2 ? null : [...tasksAtTime.values()].some((n) => n >= 2),
    });
  }
  occurrences.sort((a, b) => timeOf(b.gathering.startsAt) - timeOf(a.gathering.startsAt) || a.person.name.localeCompare(b.person.name, "nb"));

  const combinations = [...groupBy(occurrences, (o) => o.roles.join(" + ")).entries()]
    .map(([roles, list]) => ({ roles, count: list.length }))
    .sort((a, b) => b.count - a.count || a.roles.localeCompare(b.roles, "nb"));
  const byPerson = [...groupBy(occurrences, (o) => o.person.id).values()]
    .map((list) => ({ person: list[0].person, times: list.length, mostTasks: Math.max(...list.map((o) => o.roles.length)) }))
    .sort((a, b) => b.times - a.times || a.person.name.localeCompare(b.person.name, "nb"));

  return {
    occurrences,
    people: byPerson.length,
    gatherings: new Set(occurrences.map((o) => o.gathering.id)).size,
    shareOfServings: share(occurrences.length, byPersonAndGathering.size),
    combinations,
    byPerson,
    sameTimeCount: occurrences.some((o) => o.sameTime !== null) ? occurrences.filter((o) => o.sameTime).length : null,
    hadTasks: staffingPerGathering(heldIn(data.gatherings, period.from, period.to), data).length > 0,
  };
}
