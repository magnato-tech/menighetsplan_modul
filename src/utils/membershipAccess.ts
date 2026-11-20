import type { Person } from "../types";
import type { GroupRoles } from "./groups";

/** Whether «Mitt medlemskap» is available. Every person in the register may open their own page. */
export function canOpenMyMembership(
  _person: Pick<Person, "id" | "globalRole" | "membershipClerk">,
  _groups: GroupRoles[]
): boolean {
  return true;
}