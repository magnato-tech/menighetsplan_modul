import type { Assignment, Gathering, Group, Task } from "../types";
import { parseIsoToDateAndTime } from "./dates";

export interface DayLoad {
  assignmentId: string;
  taskId: string;
  taskTitle: string;
  gatheringId: string;
  gatheringTitle: string;
  startsAt: string;
  groupId?: string;
  groupName?: string;
}

/** personId -> that person's live assignments, each with the task, gathering and group it belongs to. */
export type DayLoads = Map<string, DayLoad[]>;

/** The local calendar date of a moment, as "2026-11-25". */
const dayKeyOf = (isoString: string) => parseIsoToDateAndTime(isoString).date;

export function buildDayLoads(input: {
  assignments: Assignment[];
  tasks: Task[];
  gatherings: Gathering[];
  groups: Group[];
}): DayLoads {
  const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
  const gatheringsById = new Map(input.gatherings.map((gathering) => [gathering.id, gathering]));
  const groupsById = new Map(input.groups.map((group) => [group.id, group]));
  const loads: DayLoads = new Map();

  for (const assignment of input.assignments) {
    // Declined and withdrawn assignments do not take up the person's time
    if (assignment.response !== "pending" && assignment.response !== "confirmed") continue;

    const task = tasksById.get(assignment.taskId);
    const gathering = task ? gatheringsById.get(task.gatheringId) : undefined;
    if (!task || !gathering) continue;

    const group = task.groupId ? groupsById.get(task.groupId) : undefined;
    const load: DayLoad = {
      assignmentId: assignment.id,
      taskId: task.id,
      taskTitle: task.title,
      gatheringId: gathering.id,
      gatheringTitle: gathering.title,
      startsAt: gathering.startsAt,
      groupId: task.groupId,
      groupName: group?.name,
    };

    const list = loads.get(assignment.personId) ?? [];
    list.push(load);
    loads.set(assignment.personId, list);
  }

  for (const list of loads.values()) {
    list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }
  return loads;
}

/** The other tasks the person already has on the same local calendar day as startsAt, excluding the task with excludeTaskId. */
export function otherLoadsSameDay(
  loads: DayLoads,
  personId: string,
  startsAt: string,
  excludeTaskId?: string
): DayLoad[] {
  const day = dayKeyOf(startsAt);
  if (!day) return [];
  return (loads.get(personId) ?? []).filter(
    (load) => load.taskId !== excludeTaskId && dayKeyOf(load.startsAt) === day
  );
}
