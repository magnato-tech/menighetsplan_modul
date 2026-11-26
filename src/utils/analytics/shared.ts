import type { CmsNewsArticle, CmsPage, CmsSermon } from "../../data/cmsData";
import type { Assignment, Gathering, GatheringAttendance, GatheringHeadcount, Group, GroupMessage, Person, Task, VolunteerRole } from "../../types";
import { isGroupGathering, isWorshipService } from "../gatherings";
import type { VisitCounting } from "../siteTraffic";
import { countSlots } from "../staffing";

export const DAY_MS = 24 * 60 * 60 * 1000;
export interface ChurchData {
  persons: Person[];
  groups: Group[];
  gatherings: Gathering[];
  tasks: Task[];
  assignments: Assignment[];
  attendances: GatheringAttendance[];
  headcounts: GatheringHeadcount[];
  messages: GroupMessage[];
  volunteerRoles: VolunteerRole[];
  pages: CmsPage[];
  news: CmsNewsArticle[];
  sermons: CmsSermon[];
  /** Whether visits to the website are counted (see utils/siteTraffic.ts). Not counted unless said. */
  websiteVisits?: VisitCounting;
}

export const timeOf = (iso: string | undefined): number => (iso ? new Date(iso).getTime() : NaN);
export const within = (ms: number, from: number, to: number) => !Number.isNaN(ms) && ms >= from && ms <= to;
export const before = (ms: number, from: number, to: number) => !Number.isNaN(ms) && ms >= from && ms < to;
export const share = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);
export const average = (values: number[]): number | null =>
  values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;

/** Gatherings that took place: started in the window and not cancelled. */
export function heldIn(gatherings: Gathering[], from: number, to: number, inclusiveEnd = true): Gathering[] {
  return gatherings
    .filter((g) => !g.cancelled && (inclusiveEnd ? within : before)(timeOf(g.startsAt), from, to))
    .sort((a, b) => timeOf(a.startsAt) - timeOf(b.startsAt));
}

/** The role a task fills: its name in the role library, or else the task's own title. */
export function roleNameOf(task: Task, roleNameById: Map<string, string>): string {
  return (task.volunteerRoleId && roleNameById.get(task.volunteerRoleId)) || task.title;
}

export function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

/** One person saying yes to one task on a gathering that was held. */
export interface Serving {
  personId: string;
  task: Task;
  gathering: Gathering;
}

/** Every confirmed task on the gatherings, a cancelled task left out. */
export function servingsOn(gatherings: Gathering[], data: Pick<ChurchData, "tasks" | "assignments">): Serving[] {
  const gatheringById = new Map(gatherings.map((g) => [g.id, g]));
  const taskById = new Map(
    data.tasks.filter((t) => gatheringById.has(t.gatheringId) && t.status !== "cancelled").map((t) => [t.id, t])
  );
  return data.assignments.flatMap((a) => {
    const task = taskById.get(a.taskId);
    if (a.response !== "confirmed" || !task) return [];
    return [{ personId: a.personId, task, gathering: gatheringById.get(task.gatheringId)! }];
  });
}

export interface GatheringStaffing {
  gathering: Gathering;
  isWorship: boolean;
  needed: number;
  filled: number;
  missing: number;
  /** Every slot on every task is filled by someone who said yes. */
  full: boolean;
}

export function staffingPerGathering(
  gatherings: Gathering[],
  data: Pick<ChurchData, "tasks" | "assignments">
): GatheringStaffing[] {
  const tasksByGathering = groupBy(
    data.tasks.filter((t) => t.status !== "cancelled"),
    (t) => t.gatheringId
  );
  const assignmentsByTask = groupBy(data.assignments, (a) => a.taskId);
  return gatherings.flatMap((gathering) => {
    const tasks = tasksByGathering.get(gathering.id) ?? [];
    if (tasks.length === 0) return [];
    let needed = 0;
    let filled = 0;
    for (const task of tasks) {
      const slots = countSlots(task, assignmentsByTask.get(task.id) ?? []);
      needed += slots.needed;
      filled += Math.min(slots.confirmed, slots.needed);
    }
    const isWorship = !isGroupGathering(gathering) && isWorshipService(gathering);
    return [{ gathering, isWorship, needed, filled, missing: needed - filled, full: filled === needed }];
  });
}
