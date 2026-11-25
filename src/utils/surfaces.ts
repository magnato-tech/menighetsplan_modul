import { DEMO } from "../demo";
import { SURFACES_RECORD } from "../data/settingsRecords";
import { isPublicPath } from "./routes";

/** Why an event from the congregation's calendar is not in the planner any more, and what it was called. */
export interface CalendarNote {
  reason: "avvist" | "slettet";
  /** ISO moment it was turned away or deleted. */
  at: string;
  title: string;
  startsAt: string;
}

/** The values from kirkens kalender that the admin chose to keep in the app («La være»). */
export interface CalendarDeclined {
  title: string;
  startsAt: string;
  location: string;
  cancelled: boolean;
}

/** Which flat surfaces are on, and URLs for the congregation's own site and iCal feed. */
export interface InstallationSurfaces {
  minSide: boolean;
  ownWebsite: boolean;
  externalSiteUrl: string;
  /** Where «Tilbake til nettsiden» on the sign-in page leads, when it is not the website here. Empty: as the other links. */
  signInBackUrl: string;
  externalCalendarUrl: string;
  /** When on, new rows from the iCal feed are created with the proposed template at each sync. */
  importNewAutomatically: boolean;
  dismissedUids: string[];
  keptUids: string[];
  /** Notes on turned away and deleted feed events, keyed by `calendarNoteKey(uid)`. */
  calendarNotes?: Record<string, CalendarNote>;
  /** Google values the admin declined for a linked event, keyed by `calendarNoteKey(uid)`. */
  calendarDeclined?: Record<string, CalendarDeclined>;
}

export const defaultSurfaces = (): InstallationSurfaces => ({
  minSide: true,
  ownWebsite: true,
  externalSiteUrl: "",
  signInBackUrl: "",
  externalCalendarUrl: "",
  importNewAutomatically: false,
  dismissedUids: [],
  keptUids: [],
  calendarNotes: {},
  calendarDeclined: {},
});

/**
 * The key a feed uid's note is stored under. Uids hold «@» and «.», and a dot would be read as a
 * nested field path, so the uid is encoded and the dots are encoded too.
 */
export function calendarNoteKey(uid: string): string {
  return encodeURIComponent(uid).replace(/\./g, "%2E");
}

/** The note kept for a feed uid, when there is one. */
export function calendarNoteFor(surfaces: Pick<InstallationSurfaces, "calendarNotes">, uid: string): CalendarNote | undefined {
  return surfaces.calendarNotes?.[calendarNoteKey(uid)];
}

/** The Google values declined for a feed uid, when there are any. */
export function calendarDeclinedFor(surfaces: Pick<InstallationSurfaces, "calendarDeclined">, uid: string): CalendarDeclined | undefined {
  return surfaces.calendarDeclined?.[calendarNoteKey(uid)];
}

function parseCalendarDeclined(value: unknown): Record<string, CalendarDeclined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const declined: Record<string, CalendarDeclined> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    declined[key] = {
      title: typeof item.title === "string" ? item.title : "",
      startsAt: typeof item.startsAt === "string" ? item.startsAt : "",
      location: typeof item.location === "string" ? item.location : "",
      cancelled: item.cancelled === true,
    };
  }
  return declined;
}

function parseCalendarNotes(value: unknown): Record<string, CalendarNote> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const notes: Record<string, CalendarNote> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const note = raw as Record<string, unknown>;
    if (note.reason !== "avvist" && note.reason !== "slettet") continue;
    notes[key] = {
      reason: note.reason,
      at: typeof note.at === "string" ? note.at : "",
      title: typeof note.title === "string" ? note.title : "",
      startsAt: typeof note.startsAt === "string" ? note.startsAt : "",
    };
  }
  return notes;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];

/** Accepts https URLs and webcal:// converted to https. Empty string when invalid. */
export function validHttpsUrl(value: string | undefined): string {
  const trimmed = String(value || "")
    .trim()
    .replace(/^webcal:\/\//i, "https://");
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed;
}

/**
 * Google Calendar embed/iframe links return HTML, not iCal. Turn them into a public basic.ics feed when we can.
 */
export function normalizeExternalCalendarUrl(value: string): string {
  let raw = String(value || "").trim();
  if (!raw) return "";

  const iframeSrc = /src=["']([^"']+)["']/i.exec(raw);
  if (iframeSrc) raw = iframeSrc[1].trim();

  if (!/^https?:\/\//i.test(raw) && !/^webcal:\/\//i.test(raw)) {
    raw = raw.startsWith("calendar.google.com") ? `https://${raw}` : raw;
  }

  raw = raw.replace(/^webcal:\/\//i, "https://");

  if (/calendar\.google\.com\/calendar\/embed/i.test(raw)) {
    try {
      const url = new URL(raw);
      const src = url.searchParams.get("src");
      if (src) {
        return `https://calendar.google.com/calendar/ical/${encodeURIComponent(src)}/public/basic.ics`;
      }
    } catch {
      /* keep raw */
    }
  }

  return raw;
}

export function churchSiteUrl(surfaces: InstallationSurfaces): string | null {
  const url = validHttpsUrl(surfaces.externalSiteUrl);
  return url || null;
}

/** The address «Tilbake til nettsiden» on the sign-in page leads to, when one is set; else null and the link is as the others. */
export function signInBackUrl(surfaces: Pick<InstallationSurfaces, "signInBackUrl">): string | null {
  return validHttpsUrl(surfaces.signInBackUrl) || null;
}

export function icalFeedUrl(surfaces: InstallationSurfaces): string | null {
  const url = validHttpsUrl(normalizeExternalCalendarUrl(surfaces.externalCalendarUrl));
  return url || null;
}

/** iCal import runs only when our public website is off and a feed URL is set. */
export function icalImportOn(surfaces: InstallationSurfaces): boolean {
  return !surfaces.ownWebsite && icalFeedUrl(surfaces) !== null;
}

export function parseSurfaces(data: Record<string, unknown> | undefined): InstallationSurfaces {
  const base = defaultSurfaces();
  if (DEMO) {
    return {
      ...base,
      externalSiteUrl: typeof data?.externalSiteUrl === "string" ? data.externalSiteUrl : "",
      externalCalendarUrl: typeof data?.externalCalendarUrl === "string" ? data.externalCalendarUrl : "",
      dismissedUids: strings(data?.dismissedUids),
      keptUids: strings(data?.keptUids),
      calendarNotes: parseCalendarNotes(data?.calendarNotes),
      calendarDeclined: parseCalendarDeclined(data?.calendarDeclined),
    };
  }
  if (data?.recordType !== SURFACES_RECORD) return base;
  return {
    minSide: data.minSide === false ? false : true,
    ownWebsite: data.ownWebsite === false ? false : true,
    externalSiteUrl: typeof data.externalSiteUrl === "string" ? data.externalSiteUrl : "",
    signInBackUrl: typeof data.signInBackUrl === "string" ? data.signInBackUrl : "",
    externalCalendarUrl: typeof data.externalCalendarUrl === "string" ? data.externalCalendarUrl : "",
    importNewAutomatically: data.importNewAutomatically === true,
    dismissedUids: strings(data.dismissedUids),
    keptUids: strings(data.keptUids),
    calendarNotes: parseCalendarNotes(data.calendarNotes),
    calendarDeclined: parseCalendarDeclined(data.calendarDeclined),
  };
}

/** Where a public address leads: our website, or into the app when our website is off. */
export type PublicEntry = "render" | "minside" | "admin";

/**
 * Our website is the congregation's only website as far as the app is concerned. When it is off, a
 * public address leads into the app: to Min side, or to admin when Min side is off too. Sign-in in
 * front of both is the gate's job (SessionGate). Admin, Min side, sign-in, unsubscribe and /api are
 * never asked about.
 */
export function decidePublicEntry(surfaces: Pick<InstallationSurfaces, "ownWebsite" | "minSide">, pathname: string): PublicEntry {
  if (!isPublicPath(pathname) || surfaces.ownWebsite) return "render";
  return surfaces.minSide ? "minside" : "admin";
}

/** Whether there is a website to link to: ours, or the congregation's own address. */
export function hasChurchSite(surfaces: InstallationSurfaces): boolean {
  return surfaces.ownWebsite || churchSiteUrl(surfaces) !== null;
}

/**
 * Why the choice of homepage cannot be saved, or null when it can. When the homepage is another website, its
 * address must be a valid https (or http) address: the links «Til nettsiden» go there.
 */
export function homepageError(surfaces: Pick<InstallationSurfaces, "ownWebsite" | "externalSiteUrl">): string | null {
  if (surfaces.ownWebsite) return null;
  if (validHttpsUrl(surfaces.externalSiteUrl) !== "") return null;
  return "Skriv inn adressen til hjemmesiden, som begynner med https://";
}
