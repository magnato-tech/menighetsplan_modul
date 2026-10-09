import type { GatheringHeadcount, VolunteerRole } from "../types";

// The documents that live in cms_settings beside the settings themselves. Each is marked with a
// recordType, so it can be asked for on its own and told apart from the others. Why each of them
// is stored there is told where it is read and written: services/volunteerRoles.ts,
// services/headcounts.ts and services/operatingMode.ts.
//
// This file knows nothing of the database, so a script outside the app (scripts/reset-demo.ts)
// stores a document in exactly the form the app does.

export const VOLUNTEER_ROLE_RECORD = "volunteerRole";

export function volunteerRoleFields(role: VolunteerRole): VolunteerRole & { recordType: string } {
  return { ...role, recordType: VOLUNTEER_ROLE_RECORD };
}

export const HEADCOUNT_RECORD = "gatheringHeadcount";

export function headcountFields(count: GatheringHeadcount): GatheringHeadcount & { recordType: string } {
  return { ...count, recordType: HEADCOUNT_RECORD };
}

export function isHeadcountRecord(data: { recordType?: unknown }): boolean {
  return data.recordType === HEADCOUNT_RECORD;
}

export type OperatingMode = "demo" | "production";

export const OPERATING_MODE_RECORD = "operatingMode";
export const OPERATING_MODE_DOC_ID = "operating-mode";

/** The mode a stored document says. A database without the document, or with anything else in it, is in demo. */
export const operatingModeOf = (data: { recordType?: unknown; mode?: unknown } | undefined): OperatingMode =>
  data?.recordType === OPERATING_MODE_RECORD && data.mode === "production" ? "production" : "demo";
