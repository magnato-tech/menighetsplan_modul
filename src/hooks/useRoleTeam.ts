import { useCallback } from "react";
import type { Group, Task, VolunteerRole } from "../types";
import { moveRoleTasksToTeam, patchVolunteerRole, updateTaskTeams } from "../services/volunteerRoles";
import { isUndistributed, roleTeamFields, roleTeamIds } from "../utils/roleTeams";

/** What is said after a role is saved with its team: the tasks that followed it, if any. */
function teamFeedback(roleName: string, teamName: string | null, movedCount: number): string {
  if (movedCount === 0) return `«${roleName}» er oppdatert.`;
  const tasks = `${movedCount} ${movedCount === 1 ? "oppgave" : "oppgaver"}`;
  if (teamName) return `${roleName} er knyttet til ${teamName}. ${tasks} ble flyttet til gruppen.`;
  return `${roleName} er ikke lenger knyttet til et team. ${tasks} er uten team nå.`;
}

/** Norwegian list: «A», «A og B», «A, B og C». */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} og ${names[names.length - 1]}`;
}

export interface RoleTeamResult {
  /** The sentence to show the admin. */
  text: string;
  /** How many tasks followed the role to its new team. */
  moved: number;
}

export interface ShareRoleResult {
  /** The sentence to show the admin. */
  text: string;
}

export interface RemoveTeamResult {
  /** The sentence to show the admin. */
  text: string;
  /** How many tasks changed team. */
  moved: number;
}

/**
 * Saves the team of a role and moves the tasks of the role to that team. The tasks already on the team
 * are left as they are, and a role whose team does not change moves nothing. `extra` is saved with the
 * role in the same update (the instruction, when the dialog saves both).
 *
 * A shared role whose team the dialog did not change only gets `extra` saved, so its teams stay as they are.
 */
export function useRoleTeam(tasks: readonly Task[], groups: readonly Group[]) {
  return useCallback(
    async (
      role: VolunteerRole,
      groupId: string | undefined,
      extra: Partial<Pick<VolunteerRole, "instruction" | "name" | "sortOrder">> = {}
    ): Promise<RoleTeamResult> => {
      const team = groupId || undefined;
      const shared = roleTeamIds(role).length > 1;
      const teamChanged = (role.groupId || undefined) !== team;
      const teamName = team ? groups.find((g) => g.id === team)?.name || "Ukjent team" : null;

      if (shared && !teamChanged) {
        await patchVolunteerRole(role.id, extra);
        return { text: teamFeedback(role.name, teamName, 0), moved: 0 };
      }

      // Setting one team replaces the shared teams, so groupIds is cleared
      await patchVolunteerRole(role.id, { ...extra, ...roleTeamFields(team ? [team] : []) });
      if (!teamChanged) return { text: teamFeedback(role.name, teamName, 0), moved: 0 };

      // The tasks of the role follow its team; tasks already on the same team are left as they are
      const moving = tasks.filter(
        (task) => task.volunteerRoleId === role.id && (task.groupId || undefined) !== team
      );
      // Tasks not given out yet also lose their list of teams
      const withChoices = moving.filter((task) => (task.teamChoices?.length ?? 0) > 0).map((task) => task.id);
      const plain = moving.filter((task) => !(task.teamChoices?.length ?? 0)).map((task) => task.id);
      if (plain.length > 0) await moveRoleTasksToTeam(team, plain);
      if (withChoices.length > 0) {
        await updateTaskTeams(withChoices.map((taskId) => ({ taskId, groupId: team, teamChoices: undefined })));
      }
      const movedCount = moving.length;
      return { text: teamFeedback(role.name, teamName, movedCount), moved: movedCount };
    },
    [tasks, groups]
  );
}

/**
 * Adds a team to a role that has teams already. Existing tasks keep their team; tasks not given out yet
 * may also go to the new team. A role without a team gets the team the same way as setRoleTeam.
 */
export function useSharedRoleTeams(tasks: readonly Task[], groups: readonly Group[]) {
  const setTeam = useRoleTeam(tasks, groups);

  const shareRole = useCallback(
    async (role: VolunteerRole, groupId: string): Promise<ShareRoleResult> => {
      const before = roleTeamIds(role);
      if (before.length === 0) {
        const outcome = await setTeam(role, groupId);
        return { text: outcome.text };
      }
      const teams = before.includes(groupId) ? before : [...before, groupId];
      await patchVolunteerRole(role.id, roleTeamFields(teams));

      const undistributed = tasks.filter((task) => task.volunteerRoleId === role.id && isUndistributed(task));
      if (undistributed.length > 0) {
        await updateTaskTeams(
          undistributed.map((task) => ({
            taskId: task.id,
            groupId: undefined,
            teamChoices: [...new Set([...(task.teamChoices ?? []), groupId])],
          }))
        );
      }

      const names = teams.map((id) => groups.find((g) => g.id === id)?.name || "Ukjent team");
      return {
        text: `${role.name} deles nå av ${joinNames(names)}. Nye gudstjenester får oppgaven som «Ikke fordelt», og lederne fordeler den.`,
      };
    },
    [tasks, groups, setTeam]
  );

  const removeTeamFromRole = useCallback(
    async (role: VolunteerRole, groupId: string): Promise<RemoveTeamResult> => {
      const remaining = roleTeamIds(role).filter((id) => id !== groupId);
      await patchVolunteerRole(role.id, roleTeamFields(remaining));

      const changes = tasks
        .filter(
          (task) =>
            task.volunteerRoleId === role.id &&
            task.status !== "cancelled" &&
            (task.groupId === groupId || (isUndistributed(task) && (task.teamChoices ?? []).includes(groupId)))
        )
        .map((task) => {
          if (remaining.length === 1) return { taskId: task.id, groupId: remaining[0], teamChoices: undefined };
          if (remaining.length > 1) return { taskId: task.id, groupId: undefined, teamChoices: remaining };
          return { taskId: task.id, groupId: undefined, teamChoices: undefined };
        });
      if (changes.length > 0) await updateTaskTeams(changes);

      const removedName = groups.find((g) => g.id === groupId)?.name || "Ukjent team";
      const moved = changes.length;
      let text = `${role.name} hører ikke lenger til ${removedName}.`;
      if (moved > 0) {
        const tasksText = `${moved} ${moved === 1 ? "oppgave" : "oppgaver"}`;
        if (remaining.length === 1) {
          const onlyName = groups.find((g) => g.id === remaining[0])?.name || "Ukjent team";
          text += ` ${tasksText} går nå til ${onlyName}.`;
        } else if (remaining.length > 1) {
          text += ` ${tasksText} er «Ikke fordelt» mellom ${joinNames(remaining.map((id) => groups.find((g) => g.id === id)?.name || "Ukjent team"))}.`;
        } else {
          text += ` ${tasksText} er uten team nå.`;
        }
      }
      return { text, moved };
    },
    [tasks, groups]
  );

  return { shareRole, removeTeamFromRole };
}
