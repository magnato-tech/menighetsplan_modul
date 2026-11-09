import type { Assignment, Gathering, Task } from "../types";
import { leadsGroup, type GroupRoles } from "./groups";
import { getStaffingStatus, type StaffingStatusResult } from "./staffing";

// The groups a person leads, first on Min side. Order within each part is kept.
export function withLedGroupsFirst<G extends GroupRoles>(groups: readonly G[], personId: string): G[] {
  const led = groups.filter((group) => leadsGroup(group, personId));
  const others = groups.filter((group) => !leadsGroup(group, personId));
  return [...led, ...others];
}

// The next activity of a group: a gathering of the group, or one with one of its tasks.
export function nextLedActivity(input: {
  groupId: string;
  gatherings: readonly Gathering[];
  tasks: readonly Task[];
  assignments: readonly Assignment[];
  now: number;
}): { gathering: Gathering; staffing: StaffingStatusResult; hasTasks: boolean } | null {
  const { groupId, gatherings, tasks, assignments, now } = input;
  // Cancelled tasks and gatherings are not something to staff
  const groupTasks = tasks.filter((task) => task.groupId === groupId && task.status !== "cancelled");
  const taskGatheringIds = new Set(groupTasks.map((task) => task.gatheringId));

  const next = gatherings
    .filter((g) => !g.cancelled && (g.groupId === groupId || taskGatheringIds.has(g.id)))
    .filter((g) => new Date(g.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  if (!next) return null;

  // Only the group's own tasks on that gathering count
  const onGathering = groupTasks.filter((task) => task.gatheringId === next.id);
  const taskIds = new Set(onGathering.map((task) => task.id));
  const staffing = getStaffingStatus(onGathering, assignments.filter((a) => taskIds.has(a.taskId)));
  return { gathering: next, staffing, hasTasks: onGathering.length > 0 };
}
