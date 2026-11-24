import { DEMO } from "../demo";
import { areOwnVisitsExcluded } from "./ownVisits";
import { readPreviewModeFlags } from "./previewBridge";
import { mayStandIn } from "./session";

/**
 * Whether this opening of the website is a visit to count. The editor's preview is not, a
 * program reading the page is not, a copy of the website running on a developer's own machine
 * is not, and neither is a browser whose owner has asked to be left out.
 */
export function isVisitCounted(win: Window = window): boolean {
  if (win.parent !== win) return false;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(win.location.hostname)) return false;
  if (readPreviewModeFlags(win.location.search, false).preview) return false;
  // "bot" at the end of a word is a robot (Googlebot, bingbot). Inside a word it is a phone (CUBOT_X18).
  const robot =
    win.navigator.webdriver === true || /bot\b|crawl|spider|slurp|lighthouse|headless|pagespeed|prerender/i.test(win.navigator.userAgent);
  return !robot && !areOwnVisitsExcluded();
}

/**
 * Whether a sign-in or an opening of Min side is counted here: where the website's visits are,
 * and never where anyone can stand in for a person from the register (a developer's machine or
 * the demo, see mayStandIn).
 */
export function isLoginCounted(win: Window = window): boolean {
  return isVisitCounted(win) && !mayStandIn({ developerMachine: import.meta.env.DEV, demo: DEMO !== null });
}
