import type {
  MembershipApplication,
  MembershipApplicationStatus,
  MembershipLogEntry,
  MembershipLogKind,
} from "../types";
import { membershipApplicationKindLabel } from "./membershipApplication";

const EXTRA_KIND_LABEL: Record<"withdrawal" | "enrollmentDateCorrection", string> = {
  withdrawal: "Utmelding (protokoll)",
  enrollmentDateCorrection: "Rettet innmeldingsdato",
};

export function membershipLogEntryLabel(kind: MembershipLogKind): string {
  if (kind === "withdrawal" || kind === "enrollmentDateCorrection") return EXTRA_KIND_LABEL[kind];
  return membershipApplicationKindLabel[kind];
}

export function newMembershipLogEntry(
  application: Pick<MembershipApplication, "id" | "kind" | "submittedAt" | "status">
): MembershipLogEntry {
  return {
    applicationId: application.id,
    kind: application.kind,
    submittedAt: application.submittedAt,
    status: application.status,
    updatedAt: application.submittedAt,
  };
}

export function newClerkMembershipLogEntry(entry: Omit<MembershipLogEntry, "updatedAt"> & { updatedAt?: string }): MembershipLogEntry {
  const updatedAt = entry.updatedAt ?? entry.submittedAt;
  return { ...entry, updatedAt, status: entry.status ?? "completed" };
}

export function membershipLogWithStatus(
  log: MembershipLogEntry[] | undefined,
  application: Pick<MembershipApplication, "id" | "kind" | "submittedAt">,
  status: MembershipApplicationStatus,
  updatedAt: string
): MembershipLogEntry[] {
  const list = log ?? [];
  const hit = list.some((entry) => entry.applicationId === application.id);
  if (!hit) {
    return [
      ...list,
      {
        applicationId: application.id,
        kind: application.kind,
        submittedAt: application.submittedAt,
        status,
        updatedAt,
      },
    ];
  }
  return list.map((entry) =>
    entry.applicationId === application.id ? { ...entry, status, updatedAt } : entry
  );
}