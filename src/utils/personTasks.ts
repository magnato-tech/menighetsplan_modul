import type { Assignment, Gathering, Task, VolunteerRole } from "../types";

// What one person has taken on: the tasks they have said yes to, by role, on the events that
// come and on those held the last three months. As on the analysis board, only a yes counts.
// A task the person is asked about and has not answered, is listed, and not counted.

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back "held" goes: the same three months as the analysis board's middle period. */
export const HELD_DAYS = 91;

export interface PersonTaskRow {
  assignmentId: string;
  taskId: string;
  gatheringId: string;
  /** The role the task is for, or the task's own title when it has no role. */
  role: string;
  gatheringTitle: string;
  startsAt: string;
  /** The person has said yes, or is asked and has not answered. */
  response: "confirmed" | "pending";
}

export interface PersonTaskOverview {
  /** Tasks on events that come, the nearest first: those said yes to, and those asked about. */
  coming: PersonTaskRow[];
  /** Tasks said yes to on events held the last three months, the latest first. */
  held: PersonTaskRow[];
  /** One line per role, the one with most first. Counts only what the person has said yes to. */
  byRole: { role: string; coming: number; held: number }[];
  comingCount: number;
  heldCount: number;
  /** Asked about, on events that come, and not answered. */
  askedCount: number;
}

export function personTaskOverview(
  personId: string,
  data: {
    assignments: readonly Assignment[];
    tasks: readonly Task[];
    gatherings: readonly Gathering[];
    roles: readonly Pick<VolunteerRole, "id" | "name">[];
  },
  now: number = Date.now()
): PersonTaskOverview {
  const taskById = new Map(data.tasks.map((task) => [task.id, task]));
  const gatheringById = new Map(data.gatherings.map((gathering) => [gathering.id, gathering]));
  const roleName = new Map(data.roles.map((role) => [role.id, role.name]));

  const coming: PersonTaskRow[] = [];
  const held: PersonTaskRow[] = [];
  for (const assignment of data.assignments) {
    if (assignment.personId !== personId) continue;
    if (assignment.response !== "confirmed" && assignment.response !== "pending") continue;
    const task = taskById.get(assignment.taskId);
    const gathering = task && gatheringById.get(task.gatheringId);
    if (!task || !gathering || task.status === "cancelled" || gathering.cancelled) continue;
    const at = new Date(gathering.startsAt).getTime();
    if (Number.isNaN(at)) continue;
    const row: PersonTaskRow = {
      assignmentId: assignment.id,
      taskId: task.id,
      gatheringId: gathering.id,
      role: (task.volunteerRoleId && roleName.get(task.volunteerRoleId)) || task.title,
      gatheringTitle: gathering.title,
      startsAt: gathering.startsAt,
      response: assignment.response,
    };
    if (at >= now) coming.push(row);
    // Being asked about something that is over, is nothing the person did
    else if (assignment.response === "confirmed" && at >= now - HELD_DAYS * DAY_MS) held.push(row);
  }
  const byDate = (a: PersonTaskRow, b: PersonTaskRow) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() || a.role.localeCompare(b.role, "nb");
  coming.sort(byDate);
  held.sort((a, b) => byDate(b, a));

  const roles = new Map<string, { role: string; coming: number; held: number }>();
  const lineOf = (role: string) => roles.get(role) ?? roles.set(role, { role, coming: 0, held: 0 }).get(role)!;
  for (const row of coming) if (row.response === "confirmed") lineOf(row.role).coming++;
  for (const row of held) lineOf(row.role).held++;

  const said = coming.filter((row) => row.response === "confirmed").length;
  return {
    coming,
    held,
    byRole: [...roles.values()].sort((a, b) => b.coming + b.held - (a.coming + a.held) || a.role.localeCompare(b.role, "nb")),
    comingCount: said,
    heldCount: held.length,
    askedCount: coming.length - said,
  };
}
