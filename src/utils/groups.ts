import type { Group } from "../types";

export type GroupRoles = Pick<Group, "memberIds" | "leaderIds" | "deputyLeaderIds">;

/** Whether the person belongs to the group in any role: member, leader or deputy leader. */
export function isInGroup(group: GroupRoles, personId: string): boolean {
  return (
    group.memberIds.includes(personId) ||
    group.leaderIds.includes(personId) ||
    (group.deputyLeaderIds?.includes(personId) ?? false)
  );
}

/** Whether the person leads the group as leader or deputy. Being an administrator does not count. */
export function leadsGroup(group: GroupRoles, personId: string): boolean {
  return group.leaderIds.includes(personId) || (group.deputyLeaderIds?.includes(personId) ?? false);
}

/**
 * The list of members with those who lead the group in it. A leader is a member, and the list
 * is stored so: a group whose leader is missing from it, is put right the next time it is saved.
 */
export function withLeaders(memberIds: readonly string[], leaders: readonly (string | undefined)[]): string[] {
  return Array.from(new Set([...memberIds, ...leaders.filter((id): id is string => Boolean(id))]));
}

/**
 * The leaders and deputies who are missing from their own group's list of members: what has to
 * be written for the stored lists to be whole (see hooks/useLeadersAsMembers.ts).
 */
export function leadersMissingAsMembers(groups: readonly (GroupRoles & { id: string })[]): { groupId: string; personId: string }[] {
  return groups.flatMap((group) =>
    Array.from(new Set([...group.leaderIds, ...(group.deputyLeaderIds ?? [])]))
      .filter((personId) => personId !== "" && !group.memberIds.includes(personId))
      .map((personId) => ({ groupId: group.id, personId }))
  );
}

/** Everyone in the group, each person once, whatever their role. */
export function allGroupPersonIds(group: GroupRoles): string[] {
  return Array.from(new Set([...group.memberIds, ...group.leaderIds, ...(group.deputyLeaderIds ?? [])]));
}
