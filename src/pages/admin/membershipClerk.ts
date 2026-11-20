import type { Person } from "../../types";
import type { StudioTab } from "./studio";

// What a protokollansvarlig (membership clerk) has of the admin: medlemskap, personer and help.

export const canManageMembershipApplications = (
  person: Pick<Person, "globalRole" | "membershipClerk"> | null | undefined
): boolean => person?.globalRole === "admin" || person?.membershipClerk === true;

export const MEMBERSHIP_CLERK_TABS: readonly StudioTab[] = [
  "dashboard",
  "planlegger-medlemskap",
  "planlegger-personer",
  "cms-hjelp",
];

export const membershipClerkMayOpen = (tab: StudioTab): boolean => MEMBERSHIP_CLERK_TABS.includes(tab);