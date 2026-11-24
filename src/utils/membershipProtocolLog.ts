import type { MembershipApplication, MembershipClerkTask, Person } from "../types";
import {
  canCompleteDateCorrectionTask,
  canCompleteWithdrawalTask,
  clerkTaskHeadline,
  enrollmentCorrectionDateValid,
} from "./membershipClerkTasks";
import { membershipApplicationAdminPath } from "../services/membershipApplications";
import { formatBirthDate } from "./birthDate";
import { withdrawalAttestationDelivered } from "./withdrawalAttestationDelivery";

export type ProtocolLogPeriod = { kind: "rolling12" } | { kind: "year"; year: number };

export type ProtocolLogCategoryFilter = "all" | "A" | "G";

export interface ProtocolLogRow {
  id: string;
  personId: string;
  name: string;
  event: string;
  category: "A" | "G" | "–";
  effectiveDate: string;
  document: string;
  documentHref?: string;
  completedAt: string;
  personHref: string;
}

const eventLabel = (task: MembershipClerkTask, application?: MembershipApplication): string =>
  clerkTaskHeadline(task, application);

const effectiveDateOf = (task: MembershipClerkTask): string => {
  if (task.kind === "withdrawal") return task.withdrawalDate ?? task.createdAt.slice(0, 10);
  if (task.kind === "correctEnrollmentDate") return task.correctedEnrollmentDate ?? task.createdAt.slice(0, 10);
  return task.createdAt.slice(0, 10);
};

const documentOf = (
  task: MembershipClerkTask,
  application: MembershipApplication | undefined
): { text: string; href?: string } => {
  if (task.kind === "application" && task.applicationId) {
    return { text: "Skjema", href: membershipApplicationAdminPath(task.applicationId) };
  }
  if (task.kind === "withdrawal") {
    if (task.attestationEmailedAt) return { text: "E-post" };
    if (task.attestationPosted) return { text: "Brev" };
    return { text: "–" };
  }
  if (application) return { text: "Skjema", href: membershipApplicationAdminPath(application.id) };
  return { text: "–" };
};

const categoryOf = (person: Person | undefined): "A" | "G" | "–" => {
  if (person?.denominationEnrollmentType === "A" || person?.denominationEnrollmentType === "G") {
    return person.denominationEnrollmentType;
  }
  return "–";
};

export function periodContains(doneAt: string, period: ProtocolLogPeriod, today: Date = new Date()): boolean {
  const day = doneAt.slice(0, 10);
  if (period.kind === "year") return day.startsWith(String(period.year));
  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() - 12);
  const cut = cutoff.toISOString().slice(0, 10);
  return day >= cut;
}

export function protocolLogRows(
  tasks: readonly MembershipClerkTask[],
  persons: readonly Person[],
  applications: readonly MembershipApplication[],
  period: ProtocolLogPeriod,
  categoryFilter: ProtocolLogCategoryFilter,
  today?: Date
): ProtocolLogRow[] {
  const byPerson = new Map(persons.map((p) => [p.id, p]));
  const appById = new Map(applications.map((a) => [a.id, a]));

  return tasks
    // A sign-in that was stopped belongs to no person, so it is not in the protocol
    .filter((t) => t.kind !== "loginUnknownEmail" && t.status === "done" && t.doneAt && periodContains(t.doneAt, period, today))
    .map((task) => {
      const person = byPerson.get(task.personId);
      const app = task.applicationId ? appById.get(task.applicationId) : undefined;
      const doc = documentOf(task, app);
      return {
        id: task.id,
        personId: task.personId,
        name: task.personName,
        event: eventLabel(task, app),
        category: categoryOf(person),
        effectiveDate: effectiveDateOf(task),
        document: doc.text,
        documentHref: doc.href,
        completedAt: task.doneAt!,
        personHref: `/admin/person/${task.personId}`,
      };
    })
    .filter((row) => categoryFilter === "all" || row.category === categoryFilter)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export function filterProtocolLogRows(rows: readonly ProtocolLogRow[], query: string): ProtocolLogRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) => `${row.name} ${row.event} ${row.category}`.toLowerCase().includes(q));
}

export function protocolLogCsv(rows: readonly ProtocolLogRow[]): string {
  const header = ["Navn", "Hendelse", "Kat.", "Virkningsdato", "Dokument", "Utført dato"];
  const lines = rows.map((row) =>
    [row.name, row.event, row.category, formatBirthDate(row.effectiveDate), row.document, formatBirthDate(row.completedAt.slice(0, 10))]
      .map((cell) => `"${cell.replace(/"/g, '""')}"`)
      .join(";")
  );
  return [header.join(";"), ...lines].join("\r\n");
}

/** Whether step 2 is satisfied for display in workflow (reuse for validation). */
export function clerkTaskStep2Ready(
  task: MembershipClerkTask,
  correctedDate: string,
  application: MembershipApplication | null
): boolean {
  if (task.kind === "withdrawal") return withdrawalAttestationDelivered(task);
  if (task.kind === "correctEnrollmentDate") {
    return enrollmentCorrectionDateValid(correctedDate);
  }
  if (task.kind === "application" && application) {
    return task.applicationArchiveConfirmed === true;
  }
  return false;
}

export function cornerstoneDoneForTask(
  task: MembershipClerkTask,
  application: MembershipApplication | null
): boolean {
  if (task.kind === "application" && application) {
    return application.status === "cornerstoneDone" || application.status === "completed";
  }
  return task.cornerstoneUpdated === true;
}

export function canCompleteClerkTask(
  task: MembershipClerkTask,
  correctedDate: string,
  application: MembershipApplication | null
): { ok: true } | { ok: false; reason: string } {
  if (!cornerstoneDoneForTask(task, application)) {
    return { ok: false, reason: "Bekreft at Cornerstone er oppdatert." };
  }
  if (task.kind === "withdrawal") return canCompleteWithdrawalTask(task);
  if (task.kind === "correctEnrollmentDate") {
    const date = canCompleteDateCorrectionTask(correctedDate);
    if (!date.ok) return date;
    return { ok: true };
  }
  if (task.kind === "application") {
    if (!application) return { ok: false, reason: "Mangler søknad." };
    if (task.applicationArchiveConfirmed !== true) {
      return { ok: false, reason: "Bekreft at signert skjema ligger i arkivet." };
    }
    if (application.kind === "denominationGToA") {
      return { ok: false, reason: "Fullfør G→A med datoer på arkivsiden." };
    }
    if (application.status !== "cornerstoneDone") {
      return { ok: false, reason: "Fullfør Cornerstone først." };
    }
    return { ok: true };
  }
  return { ok: false, reason: "Ukjent oppgave." };
}

export const effectiveDateForOpenTask = (task: MembershipClerkTask): string => {
  if (task.kind === "withdrawal") return task.withdrawalDate ?? "–";
  if (task.kind === "correctEnrollmentDate") return task.enrollmentField === "congregationJoinedAt" ? "Menighet" : "Kirkesamfunn";
  return formatBirthDate(task.createdAt.slice(0, 10));
};