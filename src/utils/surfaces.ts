import { DEMO } from "../demo";
import { SURFACES_RECORD } from "../data/settingsRecords";

/** Which flat surfaces are on, and URLs for the congregation's own site and iCal feed. */
export interface InstallationSurfaces {
  minSide: boolean;
  ownWebsite: boolean;
  externalSiteUrl: string;
  externalCalendarUrl: string;
  /** When on, new rows from the iCal feed are created with the proposed template at each sync. */
  importNewAutomatically: boolean;
  dismissedUids: string[];
  keptUids: string[];
}

export const defaultSurfaces = (): InstallationSurfaces => ({
  minSide: true,
  ownWebsite: true,
  externalSiteUrl: "",
  externalCalendarUrl: "",
  importNewAutomatically: false,
  dismissedUids: [],
  keptUids: [],
});

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
    };
  }
  if (data?.recordType !== SURFACES_RECORD) return base;
  return {
    minSide: data.minSide === false ? false : true,
    ownWebsite: data.ownWebsite === false ? false : true,
    externalSiteUrl: typeof data.externalSiteUrl === "string" ? data.externalSiteUrl : "",
    externalCalendarUrl: typeof data.externalCalendarUrl === "string" ? data.externalCalendarUrl : "",
    importNewAutomatically: data.importNewAutomatically === true,
    dismissedUids: strings(data.dismissedUids),
    keptUids: strings(data.keptUids),
  };
}
