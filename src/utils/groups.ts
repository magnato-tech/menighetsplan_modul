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

/** Everyone in the group, each person once, whatever their role. */
export function allGroupPersonIds(group: GroupRoles): string[] {
  return Array.from(new Set([...group.memberIds, ...group.leaderIds, ...(group.deputyLeaderIds ?? [])]));
}
