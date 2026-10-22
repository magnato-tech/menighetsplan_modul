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

export const GATHERING_TEMPLATE_RECORD = "gatheringTemplate";

/** A template for events (see utils/gatheringTemplates.ts), in the form it is stored in. */
export function gatheringTemplateFields<T extends { id: string }>(template: T): T & { recordType: string } {
  return { ...template, recordType: GATHERING_TEMPLATE_RECORD };
}

/** An earlier version of a page or a news article (see utils/contentVersions.ts). */
export const CONTENT_VERSION_RECORD = "contentVersion";

export function contentVersionFields<T extends { id: string }>(version: T): T & { recordType: string } {
  return { ...version, recordType: CONTENT_VERSION_RECORD };
}

export const HEADCOUNT_RECORD = "gatheringHeadcount";

export function headcountFields(count: GatheringHeadcount): GatheringHeadcount & { recordType: string } {
  return { ...count, recordType: HEADCOUNT_RECORD };
}

export function isHeadcountRecord(data: { recordType?: unknown }): boolean {
  return data.recordType === HEADCOUNT_RECORD;
}

/** The congregation's annual wheel: one document that holds the whole wheel (see services/yearWheel.ts). */
export const YEAR_WHEEL_RECORD = "yearWheel";
export const YEAR_WHEEL_DOC_ID = "year-wheel";

/** What the page «Send e-post» keeps: where answers go, and the log of what has been sent (see services/email.ts). */
export const EMAIL_RECORD = "email";
export const EMAIL_DOC_ID = "email";

/**
 * The banner at the top of the newsletter (see utils/newsletter.ts): its own document, readable by
 * anyone, since the inbox of everyone the newsletter goes to fetches it. Not in the settings
 * themselves, which every visit to the website reads.
 */
export const NEWSLETTER_BANNER_RECORD = "newsletterBanner";
export const NEWSLETTER_BANNER_DOC_ID = "newsletter-banner";

export type OperatingMode = "demo" | "production";

export const OPERATING_MODE_RECORD = "operatingMode";
export const OPERATING_MODE_DOC_ID = "operating-mode";

/** The mode a stored document says. A database without the document, or with anything else in it, is in demo. */
export const operatingModeOf = (data: { recordType?: unknown; mode?: unknown } | undefined): OperatingMode =>
  data?.recordType === OPERATING_MODE_RECORD && data.mode === "production" ? "production" : "demo";
