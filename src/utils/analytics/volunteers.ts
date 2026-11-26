import type { Assignment, Gathering, Person, Task } from "../../types";
import { allGroupPersonIds } from "../groups";
import { countSlots, isAcuteForfall } from "../staffing";
import { highLoadThreshold, UPCOMING_DAYS } from "./periods";
import type { AnalyticsPeriod } from "./periods";
import { DAY_MS, heldIn, share, timeOf } from "./shared";
import type { ChurchData } from "./shared";

// ============================================================================
// Volunteers: who serves, and how the staffing went
// ============================================================================

export interface RoleFill {
  name: string;
  needed: number;
  filled: number;
  rate: number | null;
}

export interface LoadBucket {
  label: string;
  people: number;
}

export interface StaffingWindow {
  slotsNeeded: number;
  slotsFilled: number;
  fillRate: number | null;
  /** People who served (said yes) on at least one of the gatherings. */
  volunteers: Set<string>;
}

export interface VolunteerSummary {
  slotsNeeded: number;
  slotsFilled: number;
  fillRate: number | null;
  previousFillRate: number | null;
  /**
   * The counts below are null when no gathering in the period had tasks to staff:
   * then nobody could have served, and a zero would say something the data does not.
   */
  activeVolunteers: number | null;
  previousActiveVolunteers: number | null;
  /** Active volunteers as a share of everyone in the person register. */
  shareOfRegister: number | null;
  withdrawals: number | null;
  acuteWithdrawals: number | null;
  declines: number | null;
  /** Median time from being asked to answering, in hours. Null without answered requests. */
  medianResponseHours: number | null;
  load: LoadBucket[];
  highLoadThreshold: number;
  /** People who served on more gatherings than the threshold, most first. */
  highLoad: { person: Person; gatherings: number }[];
  /** Roles with the lowest share of filled slots first. */
  roles: RoleFill[];
  /** Members of a service team (tjenestegruppe) who did not serve in the period. */
  unused: Person[];
  upcoming: { slotsNeeded: number; slotsFilled: number; fillRate: number | null; openSlots: number };
}

function staffingOf(gatherings: Gathering[], tasks: Task[], assignmentsByTask: Map<string, Assignment[]>): StaffingWindow {
  const ids = new Set(gatherings.map((g) => g.id));
  let slotsNeeded = 0;
  let slotsFilled = 0;
  const volunteers = new Set<string>();
  for (const task of tasks) {
    if (!ids.has(task.gatheringId) || task.status === "cancelled") continue;
    const taskAssignments = assignmentsByTask.get(task.id) ?? [];
    const slots = countSlots(task, taskAssignments);
    slotsNeeded += slots.needed;
    slotsFilled += Math.min(slots.confirmed, slots.needed);
    for (const a of taskAssignments) if (a.response === "confirmed") volunteers.add(a.personId);
  }
  return { slotsNeeded, slotsFilled, fillRate: share(slotsFilled, slotsNeeded), volunteers };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarizeVolunteers(
  data: Pick<ChurchData, "persons" | "groups" | "gatherings" | "tasks" | "assignments" | "volunteerRoles">,
  period: AnalyticsPeriod
): VolunteerSummary {
  const assignmentsByTask = new Map<string, Assignment[]>();
  for (const a of data.assignments) {
    const list = assignmentsByTask.get(a.taskId) ?? [];
    list.push(a);
    assignmentsByTask.set(a.taskId, list);
  }

  const held = heldIn(data.gatherings, period.from, period.to);
  const current = staffingOf(held, data.tasks, assignmentsByTask);
  const previous = staffingOf(heldIn(data.gatherings, period.previousFrom, period.from, false), data.tasks, assignmentsByTask);
  const upcomingGatherings = data.gatherings.filter(
    (g) => !g.cancelled && timeOf(g.startsAt) > period.now && timeOf(g.startsAt) <= period.now + UPCOMING_DAYS * DAY_MS
  );
  const upcoming = staffingOf(upcomingGatherings, data.tasks, assignmentsByTask);

  const gatheringById = new Map(held.map((g) => [g.id, g]));
  const periodTasks = data.tasks.filter((t) => gatheringById.has(t.gatheringId) && t.status !== "cancelled");
  const periodAssignments = periodTasks.flatMap((t) => assignmentsByTask.get(t.id) ?? []);
  const taskById = new Map(periodTasks.map((t) => [t.id, t]));

  let withdrawals = 0;
  let acuteWithdrawals = 0;
  let declines = 0;
  const responseHours: number[] = [];
  const servedGatherings = new Map<string, Set<string>>();
  for (const a of periodAssignments) {
    const gathering = gatheringById.get(taskById.get(a.taskId)?.gatheringId ?? "");
    if (a.response === "withdrawn") {
      withdrawals++;
      const at = timeOf(a.respondedAt);
      if (!Number.isNaN(at) && isAcuteForfall(gathering?.startsAt, new Date(at))) acuteWithdrawals++;
    }
    if (a.response === "declined") declines++;
    if ((a.response === "confirmed" || a.response === "declined") && a.assignedAt && a.respondedAt) {
      const hours = (timeOf(a.respondedAt) - timeOf(a.assignedAt)) / (60 * 60 * 1000);
      if (Number.isFinite(hours) && hours >= 0) responseHours.push(hours);
    }
    if (a.response === "confirmed" && gathering) {
      const set = servedGatherings.get(a.personId) ?? new Set<string>();
      set.add(gathering.id);
      servedGatherings.set(a.personId, set);
    }
  }

  const timesServed = [...servedGatherings.values()].map((s) => s.size);
  const load: LoadBucket[] = [
    { label: "1 gang", people: timesServed.filter((n) => n === 1).length },
    { label: "2–3 ganger", people: timesServed.filter((n) => n >= 2 && n <= 3).length },
    { label: "4–6 ganger", people: timesServed.filter((n) => n >= 4 && n <= 6).length },
    { label: "7 ganger eller mer", people: timesServed.filter((n) => n >= 7).length },
  ];

  const personById = new Map(data.persons.map((p) => [p.id, p]));
  const threshold = highLoadThreshold(period);
  const highLoad = [...servedGatherings.entries()]
    .filter(([, set]) => set.size >= threshold)
    .map(([personId, set]) => ({ person: personById.get(personId), gatherings: set.size }))
    .filter((row): row is { person: Person; gatherings: number } => row.person !== undefined)
    .sort((a, b) => b.gatherings - a.gatherings || a.person.name.localeCompare(b.person.name, "nb"));

  const roleNameById = new Map(data.volunteerRoles.map((r) => [r.id, r.name]));
  const roles = new Map<string, RoleFill>();
  for (const task of periodTasks) {
    const name = (task.volunteerRoleId && roleNameById.get(task.volunteerRoleId)) || task.title;
    const slots = countSlots(task, assignmentsByTask.get(task.id) ?? []);
    const row = roles.get(name) ?? { name, needed: 0, filled: 0, rate: null };
    row.needed += slots.needed;
    row.filled += Math.min(slots.confirmed, slots.needed);
    roles.set(name, row);
  }
  const roleRows = [...roles.values()]
    .map((row) => ({ ...row, rate: share(row.filled, row.needed) }))
    .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1) || b.needed - a.needed || a.name.localeCompare(b.name, "nb"));

  const teamMembers = new Set(
    data.groups.filter((g) => g.category === "tjenestegruppe").flatMap((g) => allGroupPersonIds(g))
  );
  const unused = [...teamMembers]
    .filter((id) => !current.volunteers.has(id))
    .map((id) => personById.get(id))
    .filter((p): p is Person => p !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));

  const staffed = current.slotsNeeded > 0;
  const whenStaffed = (value: number) => (staffed ? value : null);
  return {
    slotsNeeded: current.slotsNeeded,
    slotsFilled: current.slotsFilled,
    fillRate: current.fillRate,
    previousFillRate: previous.fillRate,
    activeVolunteers: whenStaffed(current.volunteers.size),
    previousActiveVolunteers: previous.slotsNeeded > 0 ? previous.volunteers.size : null,
    shareOfRegister: staffed ? share(current.volunteers.size, data.persons.length) : null,
    withdrawals: whenStaffed(withdrawals),
    acuteWithdrawals: whenStaffed(acuteWithdrawals),
    declines: whenStaffed(declines),
    medianResponseHours: median(responseHours),
    load,
    highLoadThreshold: threshold,
    highLoad,
    roles: roleRows,
    unused,
    upcoming: {
      slotsNeeded: upcoming.slotsNeeded,
      slotsFilled: upcoming.slotsFilled,
      fillRate: upcoming.fillRate,
      openSlots: upcoming.slotsNeeded - upcoming.slotsFilled,
    },
  };
}
