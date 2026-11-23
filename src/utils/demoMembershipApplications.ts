import type { MembershipApplication, Person } from "../types";
import {
  buildDemoMembershipApplication,
  DEMO_APPLICATION_SPECS,
  DEMO_MEMBERSHIP_SUBMITTED_AT,
} from "./demoMembershipClerkSeed";

export {
  buildDemoMembershipApplication,
  demoApplicationClerkTask,
  DEMO_APPLICATION_SPECS,
  DEMO_MEMBERSHIP_APPLICATION_PERSON_IDS,
  DEMO_MEMBERSHIP_SUBMITTED_AT,
  demoMembershipApplicationId,
  DEMO_CLERK_BOARD_TASK_COUNT,
  expectedDemoClerkTaskIds,
} from "./demoMembershipClerkSeed";

/** @deprecated Bruk buildDemoMembershipApplication med DEMO_APPLICATION_SPECS */
export function buildDemoCongregationMembershipApplication(
  person: Pick<Person, "id" | "name" | "email" | "phone">,
  churchName: string,
  submittedAt: string = DEMO_MEMBERSHIP_SUBMITTED_AT
): MembershipApplication {
  const spec = DEMO_APPLICATION_SPECS.find((s) => s.personId === person.id) ?? {
    personId: person.id,
    kind: "congregationApply" as const,
    alsoDenomination: false,
    submittedAt,
  };
  return buildDemoMembershipApplication(person, churchName, { ...spec, submittedAt });
}