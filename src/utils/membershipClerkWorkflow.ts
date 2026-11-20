import type { MembershipApplication, MembershipApplicationStatus } from "../types";
import { membershipApplicationKindLabel } from "./membershipApplication";
import { formatBirthDate } from "./birthDate";

export const MEMBERSHIP_APPLICATION_OPEN_STATUSES: readonly MembershipApplicationStatus[] = [
  "submitted",
  "received",
  "cornerstoneDone",
];

export function isMembershipApplicationOpen(app: Pick<MembershipApplication, "status">): boolean {
  return MEMBERSHIP_APPLICATION_OPEN_STATUSES.includes(app.status);
}

export function openMembershipApplications(apps: readonly MembershipApplication[]): MembershipApplication[] {
  return apps.filter(isMembershipApplicationOpen).sort(compareApplications);
}

export function compareApplications(a: MembershipApplication, b: MembershipApplication): number {
  return a.submittedAt.localeCompare(b.submittedAt);
}

export function applicantLabel(app: Pick<MembershipApplication, "firstNames" | "lastName" | "childFirstNames" | "childLastName" | "kind">): string {
  if (app.kind === "denominationChildEnroll" && app.childFirstNames && app.childLastName) {
    return `${app.childFirstNames} ${app.childLastName}`.trim();
  }
  return `${app.firstNames} ${app.lastName}`.trim();
}

export const membershipApplicationStatusLabel: Record<MembershipApplicationStatus, string> = {
  submitted: "Ny søknad",
  received: "Mottatt",
  cornerstoneDone: "Ført i Cornerstone",
  completed: "Ferdig",
  dismissed: "Avvist",
};

export function membershipWorkflowSteps(
  app: MembershipApplication
): { id: "received" | "cornerstone" | "completed"; label: string; done: boolean; at?: string }[] {
  return [
    {
      id: "received",
      label: "Merk som mottatt",
      done: app.status !== "submitted",
      at: app.receivedAt,
    },
    {
      id: "cornerstone",
      label: "Ført inn i Cornerstone",
      done: app.status === "cornerstoneDone" || app.status === "completed",
      at: app.cornerstoneAt,
    },
    {
      id: "completed",
      label: "Bekreftet i Menighetsplan",
      done: app.status === "completed",
      at: app.completedAt,
    },
  ];
}

export function membershipApplicationSummaryLine(app: MembershipApplication): string {
  const when = formatBirthDate(app.submittedAt.slice(0, 10));
  return `${membershipApplicationKindLabel[app.kind]} · ${applicantLabel(app)} · ${when}`;
}