import type {
  MembershipApplication,
  MembershipApplicationStatus,
  MembershipClerkTask,
  MembershipClerkTaskKind,
  Person,
} from "../types";

type ClerkTaskHeadlineInput = Pick<
  MembershipClerkTask,
  "kind" | "enrollmentField" | "withdrawCongregation" | "withdrawDenomination"
>;
type ApplicationHeadlineInput = Pick<MembershipApplication, "kind" | "alsoDenomination">;
import { membershipApplicationKindLabel } from "./membershipApplication";
import { membershipApplicationStatusLabel } from "./membershipClerkWorkflow";
import { newId } from "./id";
import { withdrawalAttestationDelivered } from "./withdrawalAttestationDelivery";

/** Legacy placeholder date when the congregation moved to a digital protocol. */
export const DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE = "2010-12-31";

export const DATE_CORRECTION_INSTRUCTION = "Oppdater Cornerstone med riktig innmeldingsdato.";

export function enrollmentDateCorrectionNeeded(
  person: Pick<Person, "congregationJoinedAt" | "denominationJoinedAt">
): Array<"congregationJoinedAt" | "denominationJoinedAt"> {
  const fields: Array<"congregationJoinedAt" | "denominationJoinedAt"> = [];
  if (person.congregationJoinedAt === DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE) {
    fields.push("congregationJoinedAt");
  }
  if (person.denominationJoinedAt === DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE) {
    fields.push("denominationJoinedAt");
  }
  return fields;
}

export function dateCorrectionTaskId(personId: string, field: "congregationJoinedAt" | "denominationJoinedAt"): string {
  return `enroll-fix-${personId}-${field === "congregationJoinedAt" ? "cong" : "denom"}`;
}

export function applicationTaskId(applicationId: string): string {
  return `app-task-${applicationId}`;
}

export function applicationTaskInstruction(app: Pick<MembershipApplication, "kind" | "status">): string {
  const kind = membershipApplicationKindLabel[app.kind];
  const step = membershipApplicationStatusLabel[app.status];
  return `${kind}: ${step}. Behandle søknaden og oppdater Cornerstone og registeret.`;
}

export const WITHDRAWAL_INSTRUCTION =
  "Oppdater Cornerstone, send bekreftelse og utmeldingsattest til vedkommende.";

export function buildDateCorrectionTask(
  person: Pick<Person, "id" | "name" | "congregationJoinedAt" | "denominationJoinedAt">,
  field: "congregationJoinedAt" | "denominationJoinedAt",
  createdAt: string
): MembershipClerkTask {
  const label = field === "congregationJoinedAt" ? "menigheten" : "trossamfunnet";
  return {
    id: dateCorrectionTaskId(person.id, field),
    kind: "correctEnrollmentDate",
    status: "open",
    createdAt,
    personId: person.id,
    personName: person.name,
    instruction: `${DATE_CORRECTION_INSTRUCTION} Innmeldingsdatoen er registrert som ${formatLegacyDate()} for ${label}.`,
    enrollmentField: field,
  };
}

function formatLegacyDate(): string {
  const [y, m, d] = DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE.split("-");
  return `${d}.${m}.${y}`;
}

export function buildApplicationTask(app: MembershipApplication, createdAt: string): MembershipClerkTask {
  return {
    id: applicationTaskId(app.id),
    kind: "application",
    status: "open",
    createdAt,
    personId: app.personId,
    personName: app.applicantName,
    instruction: applicationTaskInstruction(app),
    applicationId: app.id,
  };
}

export function buildWithdrawalTask(
  person: Pick<Person, "id" | "name">,
  opts: {
    withdrawCongregation: boolean;
    withdrawDenomination: boolean;
    withdrawalDate: string;
    comment?: string;
    createdAt: string;
  }
): MembershipClerkTask {
  return {
    id: newId("withdraw"),
    kind: "withdrawal",
    status: "open",
    createdAt: opts.createdAt,
    personId: person.id,
    personName: person.name,
    instruction: WITHDRAWAL_INSTRUCTION,
    comment: opts.comment,
    withdrawCongregation: opts.withdrawCongregation,
    withdrawDenomination: opts.withdrawDenomination,
    withdrawalDate: opts.withdrawalDate,
    cornerstoneUpdated: false,
    attestationPosted: false,
  };
}

export function isOpenClerkTask(task: Pick<MembershipClerkTask, "status">): boolean {
  return task.status === "open";
}

export function openClerkTasks(tasks: readonly MembershipClerkTask[]): MembershipClerkTask[] {
  return tasks.filter(isOpenClerkTask).sort(compareClerkTasks);
}

export function compareClerkTasks(a: MembershipClerkTask, b: MembershipClerkTask): number {
  const da = a.kind === "correctEnrollmentDate" ? DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE : a.createdAt.slice(0, 10);
  const db = b.kind === "correctEnrollmentDate" ? DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE : b.createdAt.slice(0, 10);
  if (da !== db) return da.localeCompare(db);
  return a.createdAt.localeCompare(b.createdAt);
}

export function enrollmentCorrectionDateValid(correctedDate: string | undefined): boolean {
  if (!correctedDate?.trim()) return false;
  return correctedDate !== DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE;
}

export function canCompleteDateCorrectionTask(
  correctedDate: string | undefined,
  cornerstoneUpdated?: boolean
): { ok: true } | { ok: false; reason: string } {
  if (cornerstoneUpdated !== true) return { ok: false, reason: "Bekreft at Cornerstone er oppdatert." };
  if (!enrollmentCorrectionDateValid(correctedDate)) {
    if (!correctedDate?.trim()) return { ok: false, reason: "Skriv riktig innmeldingsdato." };
    return { ok: false, reason: "Datoen kan ikke være 31.12.2010." };
  }
  return { ok: true };
}

export function canCompleteWithdrawalTask(
  task: Pick<MembershipClerkTask, "cornerstoneUpdated" | "attestationEmailedAt" | "attestationPosted" | "attestationSent">
): { ok: true } | { ok: false; reason: string } {
  if (!task.cornerstoneUpdated) return { ok: false, reason: "Bekreft at Cornerstone er oppdatert." };
  if (!withdrawalAttestationDelivered(task)) {
    return { ok: false, reason: "Send attest på e-post eller kryss av for brevpost." };
  }
  return { ok: true };
}

export function applicationSettled(status: MembershipApplicationStatus): boolean {
  return status === "completed" || status === "dismissed";
}

export function clerkTaskKindLabel(kind: MembershipClerkTaskKind): string {
  const map: Record<MembershipClerkTaskKind, string> = {
    correctEnrollmentDate: "Innmeldingsdato",
    application: "Søknad / innmelding",
    withdrawal: "Utmelding",
  };
  return map[kind];
}

/** Tydelig overskrift for hva oppgaven gjelder (innboks, kort og logg). */
export function clerkTaskHeadline(
  task: ClerkTaskHeadlineInput,
  application?: ApplicationHeadlineInput | null
): string {
  if (task.kind === "correctEnrollmentDate") {
    if (task.enrollmentField === "congregationJoinedAt") return "Feil innmeldingsdato (menighet)";
    if (task.enrollmentField === "denominationJoinedAt") return "Feil innmeldingsdato (kirkesamfunn)";
    return "Feil innmeldingsdato";
  }
  if (task.kind === "withdrawal") {
    const menighet = task.withdrawCongregation === true;
    const kirke = task.withdrawDenomination === true;
    if (menighet && kirke) return "Utmelding (menighet og kirkesamfunn)";
    if (menighet) return "Utmelding (menighet)";
    if (kirke) return "Utmelding (kirkesamfunn)";
    return "Utmelding";
  }
  if (task.kind === "application" && application) {
    if (application.kind === "congregationApply") {
      return application.alsoDenomination === true
        ? "Innmelding (menighet og kirkesamfunn)"
        : "Innmelding (menighet)";
    }
    if (application.kind === "denominationAdultEnroll") return "Selvstendig innmelding i kirkesamfunn";
    if (application.kind === "denominationChildEnroll") return "Barn innmeldt i kirkesamfunn";
    if (application.kind === "denominationGToA") return "Bekreftelse voksenmedlemskap (G → A)";
  }
  return clerkTaskKindLabel(task.kind);
}

export const clerkTaskStatusLabel: Record<MembershipClerkTask["status"], string> = {
  open: "Ikke utført",
  done: "Utført",
};