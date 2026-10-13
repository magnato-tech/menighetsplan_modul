import type { Group, Person } from "../types";

// What stands by a person in the register. «Frivillig» is said of the one who is in a service
// group, not of everybody who may sign in: then the list shows who serves, and who can be asked.
export type PersonAccess = "administrator" | "gruppeleder" | "nestleder" | "medlem" | "ingen";

export type PersonSortKey = "name" | "access" | "groups" | "email" | "phone";

export type SortDirection = "asc" | "desc";

export interface PersonDirectoryRow {
  person: Person;
  groups: Group[];
  leaderInGroups: Group[];
  deputyInGroups: Group[];
}

const ACCESS_ORDER: Record<PersonAccess, number> = {
  administrator: 0,
  gruppeleder: 1,
  nestleder: 2,
  medlem: 3,
  ingen: 4,
};

export const PERSON_ACCESS_LABEL: Record<PersonAccess, string> = {
  administrator: "Administrator",
  gruppeleder: "Gruppeleder",
  nestleder: "Nestleder",
  medlem: "Frivillig",
  ingen: "",
};

/** A group people serve in. A group stored before groups had a category, is one. House groups and the other kinds are not. */
export const isServiceGroup = (group: Pick<Group, "category">): boolean => (group.category ?? "tjenestegruppe") === "tjenestegruppe";

/** Whether the person is in at least one service group, as participant, leader or deputy leader. */
export function isInServiceGroup(row: Pick<PersonDirectoryRow, "groups" | "leaderInGroups" | "deputyInGroups">): boolean {
  return [...row.groups, ...row.leaderInGroups, ...row.deputyInGroups].some(isServiceGroup);
}

export function personAccess(row: PersonDirectoryRow): PersonAccess {
  if (row.person.globalRole === "admin") return "administrator";
  if (row.leaderInGroups.length > 0) return "gruppeleder";
  if (row.deputyInGroups.length > 0) return "nestleder";
  return isInServiceGroup(row) ? "medlem" : "ingen";
}

export function personGroupNames(row: PersonDirectoryRow): string[] {
  const byId = new Map<string, string>();
  for (const group of [...row.groups, ...row.leaderInGroups, ...row.deputyInGroups]) {
    byId.set(group.id, group.name);
  }
  return Array.from(byId.values()).sort((a, b) => a.localeCompare(b, "nb"));
}

export function matchesPersonSearch(row: PersonDirectoryRow, rawTerm: string): boolean {
  const term = rawTerm.toLowerCase().trim();
  if (!term) return true;
  const person = row.person;
  const haystack = [
    person.name,
    person.email,
    person.phone,
    person.staffRole,
    person.publicTitle,
    PERSON_ACCESS_LABEL[personAccess(row)],
    ...personGroupNames(row),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "nb", { sensitivity: "base" });
}

export function sortPersonRows(
  rows: PersonDirectoryRow[],
  key: PersonSortKey,
  direction: SortDirection
): PersonDirectoryRow[] {
  const sorted = [...rows].sort((a, b) => {
    let result = 0;
    switch (key) {
      case "name":
        result = compareText(a.person.name, b.person.name);
        break;
      case "access":
        result = ACCESS_ORDER[personAccess(a)] - ACCESS_ORDER[personAccess(b)];
        if (result === 0) result = compareText(a.person.name, b.person.name);
        break;
      case "groups":
        result = compareText(personGroupNames(a).join(", "), personGroupNames(b).join(", "));
        break;
      case "email":
        result = compareText(a.person.email || "", b.person.email || "");
        break;
      case "phone":
        result = compareText(a.person.phone || "", b.person.phone || "");
        break;
    }
    return direction === "asc" ? result : -result;
  });
  return sorted;
}

export function nextSort(
  currentKey: PersonSortKey,
  currentDirection: SortDirection,
  clickedKey: PersonSortKey
): { key: PersonSortKey; direction: SortDirection } {
  if (currentKey === clickedKey) {
    return { key: clickedKey, direction: currentDirection === "asc" ? "desc" : "asc" };
  }
  return { key: clickedKey, direction: "asc" };
}
