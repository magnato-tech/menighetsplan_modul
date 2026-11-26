import type { Person } from "../../types";
import { parseIsoToDateAndTime } from "../dates";
import { POLICE_CERTIFICATE_WARNING_DAYS } from "./periods";
import type { ChurchData } from "./shared";
import { DAY_MS } from "./shared";

// ============================================================================
// The person register
// ============================================================================

export interface PeopleSummary {
  total: number;
  admins: number;
  staff: number;
  /** Shown on the website with a registered consent. */
  publicProfiles: number;
  policeCertificates: { registered: number; valid: number; expiringSoon: Person[]; expired: Person[] };
  unavailableNow: number;
}

/** "YYYY-MM-DD" for the moment, in the time zone of the person looking. */
function dayOf(ms: number): string {
  return parseIsoToDateAndTime(new Date(ms).toISOString()).date;
}

export function summarizePeople(data: Pick<ChurchData, "persons">, now: number): PeopleSummary {
  const today = dayOf(now);
  const warnUntil = dayOf(now + POLICE_CERTIFICATE_WARNING_DAYS * DAY_MS);
  const withCertificate = data.persons.filter((p) => p.policeCertificateValidUntil);
  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, "nb");
  const expired = withCertificate.filter((p) => p.policeCertificateValidUntil! < today).sort(byName);
  const expiringSoon = withCertificate
    .filter((p) => p.policeCertificateValidUntil! >= today && p.policeCertificateValidUntil! <= warnUntil)
    .sort(byName);
  return {
    total: data.persons.length,
    admins: data.persons.filter((p) => p.globalRole === "admin").length,
    staff: data.persons.filter((p) => p.isStaff).length,
    publicProfiles: data.persons.filter((p) => p.isPublicProfile && p.consentToPublishGivenAt).length,
    policeCertificates: {
      registered: withCertificate.length,
      valid: withCertificate.length - expired.length - expiringSoon.length,
      expiringSoon,
      expired,
    },
    unavailableNow: data.persons.filter((p) => (p.unavailablePeriods ?? []).some((u) => u.from <= today && today <= u.to)).length,
  };
}
