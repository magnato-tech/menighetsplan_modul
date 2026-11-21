import type { Assignment, Group, Person } from "../types";
import {
  DEMO_LEGACY_PROTOCOL_PERSON_IDS,
  DEMO_MEMBERSHIP_APPLICATION_PERSON_IDS,
} from "./demoMembershipClerkSeed";
import { ageOn } from "./birthDate";
import { allGroupPersonIds } from "./groups";
import { isServiceGroup } from "./personDirectory";

/** Calendar day used as innmeldingsdato in demo seed (before DEMO_CONTENT_WEEK). */
export const DEMO_MEMBERSHIP_JOINED = "2019-04-12";

/** Demo persons with only congregation or only denomination membership; not overwritten by volunteer seed. */
/** Voksen med G i demo (skal kunne teste G→A på Min side). */
export const DEMO_G_ADULT_CONFIRMATION_IDS = new Set(["person-76"]);

export {
  DEMO_LEGACY_PROTOCOL_PERSON_IDS,
  DEMO_WITHDRAWAL_TASK_PERSON_IDS,
  DEMO_MEMBERSHIP_APPLICATION_PERSON_IDS,
} from "./demoMembershipClerkSeed";

export const DEMO_PARTIAL_MEMBERSHIP_IDS = new Set([
  "person-65",
  "person-66",
  "person-67",
  "person-68",
  "person-69",
  "person-70",
  "person-71",
  "person-72",
  "person-73",
  "person-74",
]);

/** Who gets congregation and denomination membership in the demo register. */
export function personIdsWithMockMembership(
  groups: readonly Group[],
  assignments: readonly Assignment[]
): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const id of group.leaderIds) ids.add(id);
    for (const id of group.deputyLeaderIds ?? []) ids.add(id);
    if (isServiceGroup(group)) {
      for (const id of allGroupPersonIds(group)) ids.add(id);
    }
  }
  for (const assignment of assignments) ids.add(assignment.personId);
  for (const id of DEMO_G_ADULT_CONFIRMATION_IDS) ids.add(id);
  return ids;
}

/** Enrich persons with membership fields for leaders and service volunteers in the mock data. */
export function withMockMembership(
  persons: Person[],
  groups: readonly Group[],
  assignments: readonly Assignment[],
  today: string
): Person[] {
  const enrolled = personIdsWithMockMembership(groups, assignments);
  return persons.map((person) => {
    if (DEMO_LEGACY_PROTOCOL_PERSON_IDS.has(person.id)) return person;
    if (DEMO_PARTIAL_MEMBERSHIP_IDS.has(person.id)) return person;
    if (DEMO_MEMBERSHIP_APPLICATION_PERSON_IDS.has(person.id)) return person;
    if (DEMO_G_ADULT_CONFIRMATION_IDS.has(person.id)) {
      return {
        ...person,
        congregationMember: true,
        denominationMember: true,
        congregationJoinedAt: DEMO_MEMBERSHIP_JOINED,
        denominationJoinedAt: DEMO_MEMBERSHIP_JOINED,
        denominationEnrollmentType: "G",
      };
    }
    if (!enrolled.has(person.id)) return person;
    const years = ageOn(person.birthDate, today);
    const denominationEnrollmentType = DEMO_G_ADULT_CONFIRMATION_IDS.has(person.id)
      ? ("G" as const)
      : years !== null && years < 15
        ? ("G" as const)
        : ("A" as const);
    return {
      ...person,
      congregationMember: true,
      denominationMember: true,
      congregationJoinedAt: DEMO_MEMBERSHIP_JOINED,
      denominationJoinedAt: DEMO_MEMBERSHIP_JOINED,
      denominationEnrollmentType,
    };
  });
}