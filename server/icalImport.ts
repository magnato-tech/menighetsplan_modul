import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { readInstallationConfig, type InstallationEnv } from "../src/installation";
import { SURFACES_RECORD } from "../src/data/settingsRecords";
import { parseSurfaces, icalFeedUrl } from "../src/utils/surfaces";
import { readDocument, type Fetch } from "./firestoreRest";

const SURFACES_PATH = "cms_settings/surfaces";

export type HttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The addresses a host name stands for. Replaced in tests. */
export type Lookup = (host: string) => Promise<string[]>;

const lookupAll: Lookup = async (host) => (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);

/** How long the church's calendar may take to answer, and how much of it is read. */
export const FEED_TIMEOUT_MS = 10_000;
export const FEED_MAX_BYTES = 5 * 1024 * 1024;
/** How many times the calendar may send us on to another address. Each one is checked like the first. */
export const FEED_MAX_REDIRECTS = 3;

const ipv4Parts = (ip: string): number[] | null => {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
};

/**
 * Whether an IP address is one inside a network rather than on the open internet: the machine
 * itself, a private network, a link-local address (where a cloud keeps its secrets), and the like.
 * The address in the settings is fetched by the hosting, so it must never lead there.
 */
export function isInternalAddress(ip: string): boolean {
  const address = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (mapped) return isInternalAddress(mapped[1]);
  const v4 = ipv4Parts(address);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(address) !== 6) return true; // Not an address we can read: not trusted
  // The unspecified address, the machine itself, and IPv4 written as IPv6 (::ffff:7f00:1)
  if (address.startsWith("::")) return true;
  const first = parseInt(address.split(":")[0] || "0", 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00;
}

/** Why an address may not be fetched, or null when it may. The host is looked up, so a name for an inside address is refused too. */
export async function feedAddressRefusal(feedUrl: string, lookupHost: Lookup = lookupAll): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(feedUrl);
  } catch {
    return "Adressen kan ikke leses.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Adressen må begynne med https://.";
  if (url.username || url.password) return "Adressen kan ikke ha brukernavn eller passord i seg.";
  if (url.port && url.port !== "443" && url.port !== "80") return "Adressen kan ikke ha et eget portnummer.";
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || /\.(localhost|local|internal|lan|home|intranet)$/.test(host)) return "Adressen peker inn i et lukket nett.";
  if (isIP(host)) return isInternalAddress(host) ? "Adressen peker inn i et lukket nett." : null;
  let addresses: string[];
  try {
    addresses = await lookupHost(host);
  } catch {
    return "Fant ikke adressen.";
  }
  if (addresses.length === 0) return "Fant ikke adressen.";
  return addresses.some(isInternalAddress) ? "Adressen peker inn i et lukket nett." : null;
}

/** The text of an answer, but no more than FEED_MAX_BYTES of it; null when it is larger. */
async function limitedText(response: Response): Promise<string | null> {
  const declared = Number(response.headers?.get?.("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > FEED_MAX_BYTES) return null;
  const text = await response.text();
  return Buffer.byteLength(text, "utf8") > FEED_MAX_BYTES ? null : text;
}

export interface IcalImportResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Loads the congregation's iCal feed using the URL in cms_settings/surfaces. Ignores query parameters. */
export async function externalCalendarIcs({
  env,
  ask,
  httpFetch,
  lookupHost = lookupAll,
}: {
  env: InstallationEnv;
  ask: Fetch;
  httpFetch: HttpFetch;
  lookupHost?: Lookup;
}): Promise<IcalImportResult> {
  const plain = (status: number, body: string): IcalImportResult => ({
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    body,
  });

  const installation = readInstallationConfig(env);
  if (!installation) return plain(500, "Kalenderimporten er ikke satt opp: installasjonen mangler innstillingene sine.");

  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const doc = await readDocument(database, SURFACES_PATH, ask);
  const surfaces = parseSurfaces(doc && doc.recordType === SURFACES_RECORD ? (doc as Record<string, unknown>) : undefined);

  if (surfaces.ownWebsite) return plain(404, "Kalenderimport er bare når vår nettside er av.");
  const feedUrl = icalFeedUrl(surfaces);
  if (!feedUrl) return plain(404, "Ingen iCal-adresse er lagret.");

  // The address is fetched from here, so it is checked first, and again at each redirect
  let response: Response | null = null;
  let address = feedUrl;
  for (let hop = 0; hop <= FEED_MAX_REDIRECTS; hop++) {
    const refusal = await feedAddressRefusal(address, lookupHost);
    if (refusal) return plain(400, `Kalenderadressen kan ikke brukes: ${refusal}`);
    try {
      response = await httpFetch(address, {
        headers: { Accept: "text/calendar,*/*" },
        redirect: "manual",
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
    } catch (error) {
      console.error("Kunne ikke hente ekstern kalender:", error);
      return plain(502, "Kunne ikke nå kirkens kalender.");
    }
    const next = response.status >= 300 && response.status < 400 ? response.headers?.get?.("location") : null;
    if (!next) break;
    address = new URL(next, address).toString();
    response = null;
  }
  if (!response) return plain(502, "Kirkens kalender sendte oss videre for mange ganger.");

  if (!response.ok) return plain(502, `Kirkens kalender svarte ${response.status}.`);
  const text = await limitedText(response);
  if (text === null) return plain(502, "Kirkens kalender er for stor til å hentes.");
  if (!text.includes("BEGIN:VCALENDAR")) {
    if (/^\s*<!doctype html/i.test(text) || /CalendarEmbed/i.test(text)) {
      return plain(
        502,
        "Adressen peker på innbygging (HTML), ikke iCal. Lim inn iCal-adressen (…/basic.ics), ikke embed-lenken."
      );
    }
    return plain(502, "Svaret var ikke en gyldig kalenderfil.");
  }
  return plain(200, text);
}
