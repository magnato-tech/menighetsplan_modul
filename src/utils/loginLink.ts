// The personal link in an e-mail that signs the one who gets it in: /lenke, with the address to go
// to after signing in, and the token in the fragment. A fragment is never sent to the server in a
// request, nor in a Referer, so the token stays out of the server's logs. The token is made and
// checked on the server (server/loginLinkToken.ts). Here is only what both sides agree on.

/** How long a login link works when nothing else is chosen. */
export const LOGIN_LINK_DAYS = 14;

/** The longest a login link may work, counted from the day it is sent. */
export const LOGIN_LINK_MAX_DAYS = 120;

const DATE_TEXT = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar day `days` after `day` ("2026-11-24"), as the same kind of text. */
export function daysAfter(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Why a login link cannot be made to work through `until` when sent on `today`, or null when it
 * can: the day must be a real day, not before today, and at most LOGIN_LINK_MAX_DAYS ahead.
 */
export function loginLinkUntilError(until: unknown, today: string): string | null {
  if (typeof until !== "string" || !DATE_TEXT.test(until) || Number.isNaN(Date.parse(`${until}T12:00:00Z`))) return "Velg hvor lenge innloggingslenken skal virke.";
  if (until < today) return "Innloggingslenken kan ikke slutte å virke før i dag.";
  if (until > daysAfter(today, LOGIN_LINK_MAX_DAYS)) return `Innloggingslenken kan virke i høyst ${LOGIN_LINK_MAX_DAYS} dager. Velg en tidligere dato.`;
  return null;
}

/** The moment a link chosen to work through `until` runs out: the end of that day, Norwegian winter time. */
export function loginLinkEndSeconds(until: string): number {
  return Math.floor(Date.parse(`${until}T23:59:59+01:00`) / 1000);
}

/** The day as it is written in the e-mail: «31. januar 2027». */
export function formatLoginLinkUntil(until: string): string {
  return new Date(`${until}T12:00:00Z`).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** The page the link opens. Not behind sign-in: the token is the proof. */
export const LOGIN_LINK_PATH = "/lenke";

const DESTINATION_MAX = 300;
const FALLBACK_DESTINATION = "/minside";

/**
 * Where to go after the link has signed someone in: an address in the app, given as a path. Anything
 * else, such as an address on another website, is answered with Min side.
 */
export function safeDestination(value: unknown): string {
  if (typeof value !== "string" || value.length > DESTINATION_MAX) return FALLBACK_DESTINATION;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return FALLBACK_DESTINATION;
  return value;
}

/** The address of a login link: the installation's address, the page, the destination and the token. */
export function loginLinkUrl(siteUrl: string, destinationPath: string, token: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}${LOGIN_LINK_PATH}?til=${encodeURIComponent(destinationPath)}#${token}`;
}
