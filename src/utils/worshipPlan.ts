import type { Assignment, Gathering, Task, VolunteerRole } from "../types";
import { isOpenCommunityGathering, isWorshipService } from "./gatherings";

// Who does what at the next worship services, as Min side shows it to everyone in the register.
// Only those who have accepted are named, the same rule as the run sheet («Kjøreplan»).

const startOf = (g: Pick<Gathering, "startsAt">) => new Date(g.startsAt).getTime();
const NOT_IN_PROGRAMME = Number.MAX_SAFE_INTEGER;

/** The next worship services ahead, open to all and not cancelled, nearest first, at most `limit`. */
export function upcomingWorshipServices<T extends Gathering>(gatherings: readonly T[], now: number, limit: number): T[] {
  return gatherings
    .filter((g) => isWorshipService(g) && isOpenCommunityGathering(g) && !g.cancelled && startOf(g) >= now)
    .sort((a, b) => startOf(a) - startOf(b))
    .slice(0, Math.max(0, limit));
}

export interface WorshipPlanPerson {
  personId: string;
  name: string;
  isMe: boolean;
}

export interface WorshipPlanRow {
  taskId: string;
  /** The name of the volunteer role, or the task's own title when it has no role. */
  role: string;
  /** Those who have accepted, in the order they were assigned. Empty when nobody has. */
  people: WorshipPlanPerson[];
  /** The reader is on the task, as accepted. */
  isMine: boolean;
}

export interface WorshipPlanInput {
  gathering: Gathering;
  tasks: readonly Task[];
  assignments: readonly Assignment[];
  volunteerRoles: readonly VolunteerRole[];
  personName: (personId: string) => string | undefined;
  me: string;
}

/**
 * One row per task of a service, in the order of the programme when a programme item is linked to
 * the task, and otherwise in the order the tasks are stored. A cancelled task is left out, and a
 * person whose name is not known is left out too: an id is never shown.
 */
export function worshipPlanRows(input: WorshipPlanInput): WorshipPlanRow[] {
  const { gathering, tasks, assignments, volunteerRoles, personName, me } = input;
  const roles = new Map(volunteerRoles.map((role) => [role.id, role.name]));
  const programmeIndex = new Map<string, number>();
  (gathering.programSchedule ?? []).forEach((item, index) => {
    if (item.taskId && !programmeIndex.has(item.taskId)) programmeIndex.set(item.taskId, index);
  });

  const shown = tasks
    .filter((task) => task.gatheringId === gathering.id && task.status !== "cancelled")
    // Tasks without a programme item go last, in the order they are stored
    .sort((a, b) => (programmeIndex.get(a.id) ?? NOT_IN_PROGRAMME) - (programmeIndex.get(b.id) ?? NOT_IN_PROGRAMME));

  return shown.map((task) => {
    const people: WorshipPlanPerson[] = [];
    for (const assignment of assignments) {
      if (assignment.taskId !== task.id || assignment.response !== "confirmed") continue;
      const name = personName(assignment.personId) ?? assignment.personName;
      if (!name) continue;
      people.push({ personId: assignment.personId, name, isMe: assignment.personId === me });
    }
    const role = (task.volunteerRoleId && roles.get(task.volunteerRoleId)) || task.title;
    return { taskId: task.id, role, people, isMine: people.some((person) => person.isMe) };
  });
}
