// The public calendar as a file a calendar app can subscribe to, made where the installation is
// hosted (see server/vercel/kalender.ts). It holds what a visitor sees in the calendar on the
// website: the events marked public, read without being signed in.

import { readDemoInstallation, readInstallationConfig, type InstallationEnv } from "../src/installation";
import { toIcalendar } from "../src/utils/calendarFeed";
import { collectionPrefixOf, parseDemoSiteId } from "../src/utils/demoSite";
import { validateEvent } from "../src/utils/validation";
import type { Gathering } from "../src/types";
import { FirestoreRestError, readDocument, readWhereTrue, type Fetch } from "./firestoreRest";

// The names in src/data/collections.ts, written out: that file is the browser's
// (tests/public-calendar-function.test.ts holds the two together)
export const GATHERINGS = "gatherings";
export const SETTINGS_DOCUMENT = "cms_settings/global";

export interface FeedRequest {
  /** The installation's settings: `process.env` where it is hosted. */
  env: InstallationEnv;
  /** `?menighet=` in the address. Only the demo has more than one congregation. */
  site?: string | null;
  /** Where the website is, "https://menigheten.example". Each event carries the address of its own page. */
  siteUrl?: string;
  ask: Fetch;
  now?: Date;
}

export interface FeedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const text = (status: number, body: string): FeedResponse => ({
  status,
  headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  body,
});

/** The congregation in the demo the address asks for. A congregation's own installation has only itself. */
export function siteOfRequest(env: InstallationEnv, site: string | null | undefined): string | null {
  if (readDemoInstallation(env) === null) return null;
  return site === "eksempel" ? null : parseDemoSiteId(site);
}

export async function publicCalendarFeed({ env, site, siteUrl, ask, now = new Date() }: FeedRequest): Promise<FeedResponse> {
  const installation = readInstallationConfig(env);
  if (!installation) return text(500, "Kalenderen er ikke satt opp: installasjonen mangler innstillingene sine.");

  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const prefix = collectionPrefixOf(siteOfRequest(env, site));

  let documents: Record<string, unknown>[];
  try {
    documents = await readWhereTrue(database, prefix + GATHERINGS, "isPublic", ask);
  } catch (error) {
    const status = error instanceof FirestoreRestError ? error.status : 0;
    console.error("Kalenderabonnementet fikk ikke lest arrangementene:", error instanceof Error ? error.message : error, status);
    return text(502, "Kalenderen kunne ikke hentes akkurat nå. Prøv igjen senere.");
  }

  const gatherings: Gathering[] = [];
  for (const document of documents) {
    try {
      gatherings.push(validateEvent(document));
    } catch {
      // An event the app itself would not show, is left out rather than stopping the whole calendar
    }
  }

  const settings = await readDocument(database, prefix + SETTINGS_DOCUMENT, ask).catch(() => null);
  const churchName = typeof settings?.churchName === "string" ? settings.churchName.trim() : "";

  return {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kalender.ics"',
      // Five minutes, also at the hosting's edge: a calendar app asks a few times a day at most
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
    body: toIcalendar(gatherings, { calendarName: churchName || "Menighetsplan", now, siteUrl }),
  };
}
