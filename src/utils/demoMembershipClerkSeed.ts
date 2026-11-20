import type { MembershipApplication, MembershipApplicationKind, MembershipClerkTask, Person } from "../types";
import { splitRegisteredName } from "./membershipApplication";
import {
  applicationTaskId,
  buildApplicationTask,
  buildDateCorrectionTask,
  buildWithdrawalTask,
  dateCorrectionTaskId,
  DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE,
} from "./membershipClerkTasks";
import { newMembershipLogEntry } from "./membershipLog";

/** Demo register rows with legacy enrollment date 2010-12-31 (twelve persons, twelve correction tasks). */
export const DEMO_LEGACY_PROTOCOL_PERSON_IDS = new Set([
  "person-77",
  "person-78",
  "person-79",
  "person-80",
  "person-81",
  "person-82",
  "person-83",
  "person-84",
  "person-85",
  "person-86",
  "person-87",
  "person-88",
]);

/** Open withdrawal demo tasks are seeded for these persons when the clerk board is opened. */
export const DEMO_WITHDRAWAL_TASK_PERSON_IDS = new Set(["person-69", "person-70"]);

export const DEMO_MEMBERSHIP_SUBMITTED_AT = "2019-04-08T09:30:00.000Z";

export function demoMembershipApplicationId(personId: string): string {
  return `demo-membership-app-${personId}`;
}

export function demoApplicationLogEntry(application: MembershipApplication) {
  return newMembershipLogEntry(application);
}

export const DEMO_CLERK_BOARD_TASK_COUNT = 20;

const DEMO_WITHDRAWAL_SEED_PREFIX = "demo-withdrawal-seed";

/** Én datokorrigering per legacy-person i demoregisteret (fast felt uavhengig av live data). */
export const DEMO_LEGACY_DATE_FIELDS: Record<
  string,
  Array<"congregationJoinedAt" | "denominationJoinedAt">
> = {
  "person-77": ["congregationJoinedAt"],
  "person-78": ["denominationJoinedAt"],
  "person-79": ["congregationJoinedAt"],
  "person-80": ["denominationJoinedAt"],
  "person-81": ["congregationJoinedAt"],
  "person-82": ["denominationJoinedAt"],
  "person-83": ["congregationJoinedAt"],
  "person-84": ["denominationJoinedAt"],
  "person-85": ["congregationJoinedAt"],
  "person-86": ["denominationJoinedAt"],
  "person-87": ["congregationJoinedAt"],
  "person-88": ["denominationJoinedAt"],
};

export type DemoApplicationSpec = {
  personId: string;
  kind: MembershipApplicationKind;
  alsoDenomination?: boolean;
  submittedAt?: string;
};

/** Seks nye demo-brukere med søknad sendt fra Min side (2+2+2). */
export const DEMO_APPLICATION_SPECS: readonly DemoApplicationSpec[] = [
  { personId: "person-91", kind: "denominationAdultEnroll", submittedAt: "2019-04-08T09:30:00.000Z" },
  { personId: "person-92", kind: "denominationAdultEnroll", submittedAt: "2019-04-09T10:15:00.000Z" },
  { personId: "person-93", kind: "congregationApply", alsoDenomination: false, submittedAt: "2019-04-10T11:00:00.000Z" },
  { personId: "person-94", kind: "congregationApply", alsoDenomination: false, submittedAt: "2019-04-11T13:20:00.000Z" },
  { personId: "person-95", kind: "congregationApply", alsoDenomination: true, submittedAt: "2019-04-12T14:45:00.000Z" },
  { personId: "person-96", kind: "congregationApply", alsoDenomination: true, submittedAt: "2019-04-13T08:50:00.000Z" },
];

export const DEMO_MEMBERSHIP_APPLICATION_PERSON_IDS = new Set(DEMO_APPLICATION_SPECS.map((s) => s.personId));

/** Alle personer som trengs for 20 protokolloppgaver i demoen. */
export const DEMO_MEMBERSHIP_CLERK_PERSON_IDS = new Set<string>([
  ...DEMO_LEGACY_PROTOCOL_PERSON_IDS,
  ...DEMO_MEMBERSHIP_APPLICATION_PERSON_IDS,
  ...DEMO_WITHDRAWAL_TASK_PERSON_IDS,
]);

export function demoWithdrawalTaskId(personId: string): string {
  return `${DEMO_WITHDRAWAL_SEED_PREFIX}-${personId}`;
}

export function openDemoClerkTaskFields(): Partial<MembershipClerkTask> {
  return {
    status: "open",
    cornerstoneUpdated: false,
    applicationArchiveConfirmed: false,
    doneAt: undefined,
    doneBy: undefined,
    correctedEnrollmentDate: undefined,
    attestationPosted: false,
    attestationEmailedAt: undefined,
    attestationEmailedBy: undefined,
    attestationSent: false,
    comment: undefined,
  };
}

export function buildDemoMembershipApplication(
  person: Pick<Person, "id" | "name" | "email" | "phone">,
  churchName: string,
  spec: DemoApplicationSpec
): MembershipApplication {
  const { lastName, firstNames } = splitRegisteredName(person.name);
  const id = demoMembershipApplicationId(person.id);
  const submittedAt = spec.submittedAt ?? DEMO_MEMBERSHIP_SUBMITTED_AT;
  const nationalIdByPerson: Record<string, string> = {
    "person-91": "11038812345",
    "person-92": "12049598765",
    "person-93": "13068811223",
    "person-94": "14079233445",
    "person-95": "15089355667",
    "person-96": "16099477889",
  };
  const alsoDenomination =
    spec.kind === "denominationAdultEnroll" ? true : spec.alsoDenomination === true;
  return {
    id,
    kind: spec.kind,
    personId: person.id,
    submittedAt,
    status: "submitted",
    applicantName: person.name,
    lastName,
    firstNames,
    address: "Storgata 12",
    phone: person.phone ?? "900 00 000",
    email: person.email ?? "demo@eksempel.no",
    nationalId: nationalIdByPerson[person.id] ?? "01018012345",
    baptized: true,
    baptizedDate: "2012-06-17",
    congregationName: churchName,
    alsoDenomination,
    notOtherDenomination: true,
    childrenToEnroll: false,
    signaturePlace: "Sted",
    signatureDate: submittedAt.slice(0, 10),
  };
}

export function demoApplicationClerkTask(application: MembershipApplication): MembershipClerkTask {
  return { ...buildApplicationTask(application, application.submittedAt), ...openDemoClerkTaskFields() };
}

export function expectedDemoClerkTaskIds(persons: readonly Person[]): string[] {
  const ids: string[] = [];
  for (const personId of DEMO_LEGACY_PROTOCOL_PERSON_IDS) {
    if (!persons.some((p) => p.id === personId)) continue;
    for (const field of DEMO_LEGACY_DATE_FIELDS[personId] ?? []) {
      ids.push(dateCorrectionTaskId(personId, field));
    }
  }
  for (const spec of DEMO_APPLICATION_SPECS) {
    if (!persons.some((p) => p.id === spec.personId)) continue;
    ids.push(applicationTaskId(demoMembershipApplicationId(spec.personId)));
  }
  let withdrawals = 0;
  for (const person of persons) {
    if (!DEMO_WITHDRAWAL_TASK_PERSON_IDS.has(person.id)) continue;
    ids.push(demoWithdrawalTaskId(person.id));
    withdrawals++;
    if (withdrawals >= 2) break;
  }
  return ids;
}

/** Oppdater demoseed når en forventet oppgave mangler eller er fullført. */
export function demoClerkBoardNeedsReseed(tasks: readonly MembershipClerkTask[], persons: readonly Person[]): boolean {
  const expected = expectedDemoClerkTaskIds(persons);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const openExpected = expected.filter((id) => byId.get(id)?.status === "open").length;
  if (expected.length < DEMO_CLERK_BOARD_TASK_COUNT) {
    return openExpected < expected.length || expected.length < DEMO_CLERK_BOARD_TASK_COUNT;
  }
  return expected.some((id) => {
    const hit = byId.get(id);
    return !hit || hit.status === "done";
  });
}

export function demoDateCorrectionTasksForSeed(
  person: Person,
  createdAt: string
): Array<{ task: MembershipClerkTask; field: "congregationJoinedAt" | "denominationJoinedAt" }> {
  const fields = DEMO_LEGACY_DATE_FIELDS[person.id];
  if (!fields) return [];
  return fields.map((field) => ({
    field,
    task: {
      ...buildDateCorrectionTask(person, field, createdAt),
      ...openDemoClerkTaskFields(),
    },
  }));
}

export function demoLegacyDateResetForField(
  field: "congregationJoinedAt" | "denominationJoinedAt"
): Partial<Person> {
  return { [field]: DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE };
}

export function demoWithdrawalTasksForSeed(
  persons: readonly Person[],
  createdAt: string
): MembershipClerkTask[] {
  const targets = persons.filter((p) => DEMO_WITHDRAWAL_TASK_PERSON_IDS.has(p.id)).slice(0, 2);
  return targets.map((person) => ({
    ...buildWithdrawalTask(person, {
      withdrawCongregation: person.congregationMember === true,
      withdrawDenomination: person.denominationMember === true,
      withdrawalDate: createdAt.slice(0, 10),
      comment: "Demo: manuelt opprettet utmeldingsoppgave.",
      createdAt,
    }),
    id: demoWithdrawalTaskId(person.id),
    ...openDemoClerkTaskFields(),
  }));
}
