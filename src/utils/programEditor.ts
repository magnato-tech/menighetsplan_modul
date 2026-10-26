import type { Assignment, Gathering, ProgramItem, Task, VolunteerRole } from "../types";

// Who may change the programme of a gathering from Min side, without being an administrator or the
// leader of its group: the one who has said yes to leading that very gathering. No setting is needed;
// the role's name decides. firestore.rules holds the same list and checks the same things.

/** The roles that lead a gathering. Written exactly as in the role library and in firestore.rules. */
export const PROGRAM_EDITOR_ROLES = ["Møteleder", "Gudstjenesteleder"] as const;

/** A gathering without an end time is counted as over this long after it starts. */
const ASSUMED_LENGTH_MS = 3 * 60 * 60 * 1000;

/** The name a task goes by: its role's name when it has one, else its own title. */
export function taskRoleName(task: Pick<Task, "volunteerRoleId" | "title">, roles: readonly VolunteerRole[]): string {
  const role = task.volunteerRoleId ? roles.find((entry) => entry.id === task.volunteerRoleId) : undefined;
  return (role?.name ?? task.title).trim();
}

export function leadsGatheringRole(name: string): boolean {
  return (PROGRAM_EDITOR_ROLES as readonly string[]).includes(name.trim());
}

/** Whether the gathering is over, so its programme is history and can no longer be changed here. */
export function gatheringIsOver(gathering: Pick<Gathering, "startsAt" | "endsAt">, now = Date.now()): boolean {
  const end = gathering.endsAt ? new Date(gathering.endsAt).getTime() : new Date(gathering.startsAt).getTime() + ASSUMED_LENGTH_MS;
  return Number.isFinite(end) && now > end;
}

/**
 * The assignment that lets this person change the gathering's programme, or null. It must be their
 * own, confirmed, on a task of this gathering that is not cancelled and whose role leads the gathering,
 * and the gathering must not be over.
 */
export function programEditorAssignment(
  gathering: Pick<Gathering, "id" | "startsAt" | "endsAt">,
  tasks: readonly Task[],
  assignments: readonly Assignment[],
  roles: readonly VolunteerRole[],
  personId: string | undefined,
  now = Date.now()
): Assignment | null {
  if (!personId || gatheringIsOver(gathering, now)) return null;
  for (const assignment of assignments) {
    if (assignment.personId !== personId || assignment.response !== "confirmed") continue;
    const task = tasks.find((entry) => entry.id === assignment.taskId);
    if (!task || task.gatheringId !== gathering.id || task.status === "cancelled") continue;
    if (leadsGatheringRole(taskRoleName(task, roles))) return assignment;
  }
  return null;
}

/** A post tied to a task can be moved but not deleted, so the task stays on the run sheet. */
export function canDeleteProgramItem(item: Pick<ProgramItem, "taskId">): boolean {
  return !item.taskId;
}
