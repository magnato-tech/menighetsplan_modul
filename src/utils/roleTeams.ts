import type { Task, VolunteerRole } from "../types";

/**
 * Teams that share a role, and the tasks that have not been given to one of them yet.
 *
 * A role may belong to several teams (two lovsangsteam). Each task still has one team: a new task of
 * a shared role starts «Ikke fordelt», with the teams it may go to in teamChoices, and one of the
 * teams takes it. A role with one team works as before.
 */

/** Every team of the role, in the order they were added. */
export function roleTeamIds(role: Pick<VolunteerRole, "groupId" | "groupIds"> | undefined): string[] {
  if (!role) return [];
  if (role.groupIds && role.groupIds.length > 0) return [...role.groupIds];
  return role.groupId ? [role.groupId] : [];
}

/** Whether the role belongs to the team (one of its teams, when it is shared). */
export function roleHasTeam(role: Pick<VolunteerRole, "groupId" | "groupIds">, groupId: string): boolean {
  return roleTeamIds(role).includes(groupId);
}

/** The fields a role is saved with for these teams: groupId is the first, groupIds only when shared. */
export function roleTeamFields(teamIds: readonly string[]): Pick<VolunteerRole, "groupId" | "groupIds"> {
  const unique = [...new Set(teamIds.filter(Boolean))];
  return { groupId: unique[0], groupIds: unique.length > 1 ? unique : undefined };
}

/** The team fields a new task of the role gets: the team when there is one, «Ikke fordelt» when shared. */
export function newTaskTeamFields(role: Pick<VolunteerRole, "groupId" | "groupIds"> | undefined): Pick<Task, "groupId" | "teamChoices"> {
  const teams = roleTeamIds(role);
  if (teams.length > 1) return { groupId: undefined, teamChoices: teams };
  return { groupId: teams[0], teamChoices: undefined };
}

/** A task no team has taken yet, among teams that share its role. */
export function isUndistributed(task: Pick<Task, "groupId" | "teamChoices" | "status">): boolean {
  return !task.groupId && (task.teamChoices?.length ?? 0) > 0 && task.status !== "cancelled";
}

/** The teams whose members may see the task: its team, or every team it may go to while not given out. */
export function taskTeamIds(task: Pick<Task, "groupId" | "teamChoices">): string[] {
  if (task.groupId) return [task.groupId];
  return [...(task.teamChoices ?? [])];
}

/** The fields that give the task to a team. Only groupId is written, which is what the rules allow a leader or member. */
export function takeForTeam(groupId: string): Pick<Task, "groupId"> {
  return { groupId };
}

/**
 * The fields that give the task back, so the teams that share the role may take it. The role's
 * teams now are used, so a team added since the task was made can take it too.
 */
export function giveBack(sharedTeams: readonly string[]): Pick<Task, "groupId" | "teamChoices"> {
  return { groupId: undefined, teamChoices: [...sharedTeams] };
}

/** Whether a team may give the task back: it has the task, and its role is shared with another team. */
export function canGiveBack(task: Pick<Task, "groupId" | "status">, sharedTeams: readonly string[]): boolean {
  return Boolean(task.groupId) && sharedTeams.length > 1 && sharedTeams.includes(task.groupId!) && task.status !== "cancelled";
}
