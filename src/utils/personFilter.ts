import { GROUP_CATEGORIES } from "../data/groupOptions";
import type { Group, GroupCategory, Person } from "../types";
import { isInGroup } from "./groups";
import { isServiceGroup } from "./personDirectory";

// The filter on the «Personer» tab, and the e-mail lists that are saved from it (utils/emailLists.ts).
// A person matches when every condition holds. The role and the group type or group are one condition:
// they must hold in the same group. A person who leads a service group and is a member of a house group
// is therefore not a house-group leader.

export type GroupRole = "leader" | "deputy" | "member";

export interface PersonFilter {
  /** The role in a group. Empty or absent: any role. */
  roles?: GroupRole[];
  /** The types of group. Empty or absent: any type. A group stored without a type is a service group. */
  categories?: GroupCategory[];
  /** One group. */
  groupId?: string;
  /** The three checkboxes of the tab. Absent or false: not asked. */
  congregationMember?: true;
  denominationMember?: true;
  withoutService?: true;
}

type GroupOfRegister = Pick<Group, "id" | "name" | "category" | "memberIds" | "leaderIds" | "deputyLeaderIds">;

/** The roles in the order they are shown. */
export const ROLE_ORDER: GroupRole[] = ["leader", "deputy", "member"];
export const ROLE_LABEL: Record<GroupRole, string> = { leader: "Leder", deputy: "Nestleder", member: "Deltaker" };

/** The types in the order they are shown. */
export const CATEGORY_ORDER: GroupCategory[] = ["tjenestegruppe", "husgruppe", "ledergruppe", "strategigruppe", "interessegruppe"];

/** The name of a type, shortened to its first word: «Husgruppe» for «Husgruppe (Husfellesskap i hjemmene)». */
export const categoryLabel = (category: GroupCategory): string => (GROUP_CATEGORIES.find((option) => option.id === category)?.label ?? category).split(" ")[0];

/** The type a group has. One stored without a type is a service group, as everywhere in the app. */
const categoryOf = (group: Pick<Group, "category">): GroupCategory => group.category ?? "tjenestegruppe";

/** Whether the person has the role in the group: leader, deputy leader, or a member who is neither. */
function hasRole(group: GroupOfRegister, personId: string, role: GroupRole): boolean {
  const leader = group.leaderIds.includes(personId);
  const deputy = group.deputyLeaderIds?.includes(personId) ?? false;
  if (role === "leader") return leader;
  if (role === "deputy") return deputy;
  return group.memberIds.includes(personId) && !leader && !deputy;
}

/** Whether the group is one the filter's type and group allow. */
function groupAllowed(group: GroupOfRegister, filter: PersonFilter): boolean {
  if (filter.groupId && group.id !== filter.groupId) return false;
  if (filter.categories?.length && !filter.categories.includes(categoryOf(group))) return false;
  return true;
}

/** Whether a role, a type or a group is asked for at all. Without one, the filter says nothing about groups. */
function asksAboutGroups(filter: PersonFilter): boolean {
  return (filter.roles?.length ?? 0) > 0 || (filter.categories?.length ?? 0) > 0 || Boolean(filter.groupId);
}

/** Whether the person is in at least one service group, as participant, leader or deputy leader. The same rule as isInServiceGroup in personDirectory.ts. */
function servesInServiceGroup(personId: string, groups: readonly GroupOfRegister[]): boolean {
  return groups.some((group) => isServiceGroup(group) && isInGroup(group, personId));
}

/**
 * The persons who match the filter, in the order they came. A person matches when there is a group that
 * passes the type and the group, in which the person has one of the roles (any role in the group, when no
 * role is asked for). Then the three checkboxes must hold too.
 */
export function personsMatching(persons: readonly Person[], groups: readonly GroupOfRegister[], filter: PersonFilter): Person[] {
  return persons.filter((person) => {
    if (filter.congregationMember && person.congregationMember !== true) return false;
    if (filter.denominationMember && person.denominationMember !== true) return false;
    if (filter.withoutService && servesInServiceGroup(person.id, groups)) return false;
    if (asksAboutGroups(filter)) {
      const inSome = groups.some((group) => {
        if (!groupAllowed(group, filter)) return false;
        if (!filter.roles?.length) return isInGroup(group, person.id);
        return filter.roles.some((role) => hasRole(group, person.id, role));
      });
      if (!inSome) return false;
    }
    return true;
  });
}

/** Whether nothing is asked for: the tab then shows the whole register. */
export function isEmptyFilter(filter: PersonFilter): boolean {
  return !asksAboutGroups(filter) && !filter.congregationMember && !filter.denominationMember && !filter.withoutService;
}

/**
 * What the filter asks for, in words, for the tab and for the lists: «Leder · Husgruppe»,
 * «Leder, nestleder · Tjenestegruppe», «Gruppe: Menighetsråd», «Medlem i menigheten». Empty when nothing is asked.
 */
export function describeFilter(filter: PersonFilter, groups: readonly Pick<Group, "id" | "name">[]): string {
  const parts: string[] = [];

  const roles = ROLE_ORDER.filter((role) => filter.roles?.includes(role)).map((role) => ROLE_LABEL[role]);
  const roleText = roles.map((label, index) => (index === 0 ? label : label.toLocaleLowerCase("nb"))).join(", ");
  let target = "";
  if (filter.groupId) target = `Gruppe: ${groups.find((group) => group.id === filter.groupId)?.name ?? "ukjent gruppe"}`;
  else if (filter.categories?.length) target = CATEGORY_ORDER.filter((category) => filter.categories?.includes(category)).map(categoryLabel).join(", ");
  const groupText = [roleText, target].filter(Boolean).join(" · ");
  if (groupText) parts.push(groupText);

  if (filter.congregationMember) parts.push("Medlem i menigheten");
  if (filter.denominationMember) parts.push("Medlem i kirkesamfunnet");
  if (filter.withoutService) parts.push("Ikke i noen tjenestegruppe");
  return parts.join(" · ");
}

/** The filter as it is stored: only what is asked for. */
export function cleanFilter(filter: PersonFilter): PersonFilter {
  const clean: PersonFilter = {};
  if (filter.roles?.length) clean.roles = ROLE_ORDER.filter((role) => filter.roles?.includes(role));
  if (filter.categories?.length) clean.categories = CATEGORY_ORDER.filter((category) => filter.categories?.includes(category));
  if (filter.groupId) clean.groupId = filter.groupId;
  if (filter.congregationMember) clean.congregationMember = true;
  if (filter.denominationMember) clean.denominationMember = true;
  if (filter.withoutService) clean.withoutService = true;
  return clean;
}
