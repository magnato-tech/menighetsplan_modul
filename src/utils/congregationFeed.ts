import { DEMO } from "../demo";
import { DEMO_SITE } from "../demoSite";
import { publicCalendarFeedUrl } from "./calendarFeed";

/**
 * The address of the congregation's public calendar file, built from the address the visitor is
 * on. Null where there is no browser window to build it from.
 */
export function congregationFeedUrl(): string | null {
  if (typeof window === "undefined") return null;
  return publicCalendarFeedUrl(window.location.origin, DEMO_SITE, DEMO !== null);
}

/** The same address with webcal:// in place of https:// or http://, which the phone's calendar app opens. */
export function webcalUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "webcal://");
}
