import { DEMO } from "../demo";
import { SURFACES_RECORD } from "../data/settingsRecords";

/** Which flat surfaces are on, and URLs for the congregation's own site and iCal feed. */
export interface InstallationSurfaces {
  minSide: boolean;
  ownWebsite: boolean;
  externalSiteUrl: string;
  externalCalendarUrl: string;
  dismissedUids: string[];
  keptUids: string[];
}

export const defaultSurfaces = (): InstallationSurfaces => ({
  minSide: true,
  ownWebsite: true,
  externalSiteUrl: "",
  externalCalendarUrl: "",
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

export function churchSiteUrl(surfaces: InstallationSurfaces): string | null {
  const url = validHttpsUrl(surfaces.externalSiteUrl);
  return url || null;
}

export function icalFeedUrl(surfaces: InstallationSurfaces): string | null {
  const url = validHttpsUrl(surfaces.externalCalendarUrl);
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
    dismissedUids: strings(data.dismissedUids),
    keptUids: strings(data.keptUids),
  };
}
