import type { Assignment, Gathering, Group, Person, Task } from "../types";
import { isInGroup } from "./groups";
import { taskStatusFor } from "./staffing";

// What deleting a person from the register means, worked out before anything is deleted.
//
// The person goes out of the register, out of the groups, and off the tasks that come, which
// become free again. What is over, stands: the tasks the person did, and the messages they wrote,
// keep the name they were stored with, so the history of the congregation is not rewritten.
//
// A leader or deputy leader is not deleted before the group has another, and nobody deletes
// themselves or the last administrator: then there would be nobody to let anyone in.

export interface PersonDeletion {
  /** Why the person cannot be deleted yet, in words for the administrator. Empty when they can. */
  blockedBy: string[];
  /** The groups the person is taken out of. */
  groups: Pick<Group, "id" | "name">[];
  /** The assignments that are deleted: asked or said yes, on events that come. */
  comingAssignmentIds: string[];
  /** Every event that has not been held. The person's answers to those are deleted; answers to what is held, stand. */
  upcomingGatheringIds: string[];
  /** The tasks that lose the person, each with the status it has afterwards. */
  taskStatuses: { taskId: string; status: Task["status"] }[];
  /** Tasks the person did on events that are held. They stand, with the name. */
  heldTasks: number;
}

export function personDeletion(
  person: Pick<Person, "id" | "globalRole">,
  data: {
    persons: readonly Pick<Person, "id" | "globalRole">[];
    groups: readonly Group[];
    gatherings: readonly Pick<Gathering, "id" | "startsAt">[];
    tasks: readonly Task[];
    assignments: readonly Assignment[];
    /** The administrator who is deleting. */
    administratorId: string;
  },
  now: number = Date.now()
): PersonDeletion {
  const blockedBy: string[] = [];
  if (person.id === data.administratorId) blockedBy.push("Du kan ikke slette deg selv. En annen administrator må gjøre det.");
  else if (person.globalRole === "admin" && data.persons.filter((other) => other.globalRole === "admin").length <= 1) {
    blockedBy.push("Dette er den eneste administratoren. Gi en annen person administratortilgang først.");
  }
  const leads = data.groups.filter((group) => group.leaderIds.includes(person.id) || (group.deputyLeaderIds ?? []).includes(person.id));
  if (leads.length > 0) {
    blockedBy.push(`Personen er leder eller nestleder i ${leads.map((group) => `«${group.name}»`).join(", ")}. Velg en annen på gruppens side først.`);
  }

  const startOf = new Map(data.gatherings.map((gathering) => [gathering.id, new Date(gathering.startsAt).getTime()]));
  const taskById = new Map(data.tasks.map((task) => [task.id, task]));
  const comingAssignmentIds: string[] = [];
  const touchedTasks = new Set<string>();
  let heldTasks = 0;
  for (const assignment of data.assignments) {
    if (assignment.personId !== person.id) continue;
    const task = taskById.get(assignment.taskId);
    const start = task ? startOf.get(task.gatheringId) : undefined;
    // An assignment whose task or event is gone, is a loose end, and goes with the person
    if (!task || start === undefined || Number.isNaN(start) || start >= now) {
      comingAssignmentIds.push(assignment.id);
      if (task) touchedTasks.add(task.id);
    } else if (assignment.response === "confirmed") heldTasks++;
  }

  const gone = new Set(comingAssignmentIds);
  const taskStatuses = [...touchedTasks].flatMap((taskId) => {
    const task = taskById.get(taskId)!;
    const status = taskStatusFor(task, data.assignments.filter((assignment) => assignment.taskId === taskId && !gone.has(assignment.id)));
    return status === task.status ? [] : [{ taskId, status }];
  });

  return {
    blockedBy,
    groups: data.groups.filter((group) => isInGroup(group, person.id)).map(({ id, name }) => ({ id, name })),
    comingAssignmentIds,
    upcomingGatheringIds: data.gatherings.filter((gathering) => !(new Date(gathering.startsAt).getTime() < now)).map((gathering) => gathering.id),
    taskStatuses,
    heldTasks,
  };
}
