// Laget av `npm run build:api` fra server/vercel/kalender-innhold.ts. Ikke rediger denne filen: endre kilden og kjør kommandoen.

// server/icalImport.ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// src/installation.ts
var REQUIRED_SETTINGS = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  appId: "VITE_FIREBASE_APP_ID"
};
var OPTIONAL_SETTINGS = {
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  firestoreDatabaseId: "VITE_FIREBASE_DATABASE_ID",
  tenantId: "VITE_TENANT_ID"
};
var DEMO_SETTINGS = {
  demo: "VITE_DEMO",
  signUpUrl: "VITE_DEMO_SIGNUP_URL",
  salesSiteUrl: "VITE_DEMO_SALES_URL",
  ownerCodeHash: "VITE_DEMO_OWNER_CODE_HASH"
};
var valueOf = (env, name) => {
  const value = env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
};
function missingInstallationSettings(env) {
  return Object.values(REQUIRED_SETTINGS).filter((name) => valueOf(env, name) === void 0);
}
function readInstallationConfig(env) {
  if (missingInstallationSettings(env).length > 0) return null;
  const config = {
    apiKey: valueOf(env, REQUIRED_SETTINGS.apiKey),
    authDomain: valueOf(env, REQUIRED_SETTINGS.authDomain),
    projectId: valueOf(env, REQUIRED_SETTINGS.projectId),
    appId: valueOf(env, REQUIRED_SETTINGS.appId)
  };
  for (const [key, name] of Object.entries(OPTIONAL_SETTINGS)) {
    const value = valueOf(env, name);
    if (value !== void 0) config[key] = value;
  }
  return config;
}
var webAddressOf = (env, name) => {
  const value = valueOf(env, name);
  return value !== void 0 && /^https:\/\/[^\s/]+\.[^\s]+$/.test(value) ? value : void 0;
};
function readDemoInstallation(env) {
  if (valueOf(env, DEMO_SETTINGS.demo) !== "true") return null;
  const demo = {};
  const signUpUrl = webAddressOf(env, DEMO_SETTINGS.signUpUrl);
  const salesSiteUrl = webAddressOf(env, DEMO_SETTINGS.salesSiteUrl);
  if (signUpUrl !== void 0) demo.signUpUrl = signUpUrl;
  if (salesSiteUrl !== void 0) demo.salesSiteUrl = salesSiteUrl;
  const ownerCodeHash = valueOf(env, DEMO_SETTINGS.ownerCodeHash)?.toLowerCase();
  if (ownerCodeHash !== void 0 && /^[0-9a-f]{64}$/.test(ownerCodeHash)) demo.ownerCodeHash = ownerCodeHash;
  return demo;
}

// src/data/settingsRecords.ts
var SURFACES_RECORD = "surfaces";

// src/demo.ts
var DEMO = readDemoInstallation(import.meta.env ?? {});

// src/utils/surfaces.ts
var defaultSurfaces = () => ({
  minSide: true,
  ownWebsite: true,
  externalSiteUrl: "",
  externalCalendarUrl: "",
  importNewAutomatically: false,
  dismissedUids: [],
  keptUids: []
});
var strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim() !== "") : [];
function validHttpsUrl(value) {
  const trimmed = String(value || "").trim().replace(/^webcal:\/\//i, "https://");
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed;
}
function normalizeExternalCalendarUrl(value) {
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
    }
  }
  return raw;
}
function icalFeedUrl(surfaces) {
  const url = validHttpsUrl(normalizeExternalCalendarUrl(surfaces.externalCalendarUrl));
  return url || null;
}
function parseSurfaces(data) {
  const base = defaultSurfaces();
  if (DEMO) {
    return {
      ...base,
      externalSiteUrl: typeof data?.externalSiteUrl === "string" ? data.externalSiteUrl : "",
      externalCalendarUrl: typeof data?.externalCalendarUrl === "string" ? data.externalCalendarUrl : "",
      dismissedUids: strings(data?.dismissedUids),
      keptUids: strings(data?.keptUids)
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
    keptUids: strings(data.keptUids)
  };
}

// server/firestoreRest.ts
var documentsOf = ({ projectId, databaseId }) => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId || "(default)")}/documents`;
function decodeValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) return decodeFields(value.mapValue.fields);
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ("referenceValue" in value) return value.referenceValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("bytesValue" in value) return value.bytesValue;
  return void 0;
}
function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([key, value]) => [key, decodeValue(value)]));
}
function decodeDocument(document) {
  const data = decodeFields(document.fields);
  const stored = typeof data.id === "string" && data.id ? data.id : null;
  return { ...data, id: stored ?? document.name.slice(document.name.lastIndexOf("/") + 1) };
}
async function readDocument(database, path, ask, headers) {
  const response = await ask(`${documentsOf(database)}/${path}`, headers ? { headers } : void 0);
  if (!response.ok) return null;
  return decodeDocument(await response.json());
}

// server/icalImport.ts
var SURFACES_PATH = "cms_settings/surfaces";
var lookupAll = async (host) => (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);
var FEED_TIMEOUT_MS = 1e4;
var FEED_MAX_BYTES = 5 * 1024 * 1024;
var FEED_MAX_REDIRECTS = 3;
var ipv4Parts = (ip) => {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
};
function isInternalAddress(ip) {
  const address = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (mapped) return isInternalAddress(mapped[1]);
  const v4 = ipv4Parts(address);
  if (v4) {
    const [a, b] = v4;
    return a === 0 || a === 10 || a === 127 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 192 && b === 0 || a === 198 && (b === 18 || b === 19) || a >= 224;
  }
  if (isIP(address) !== 6) return true;
  if (address.startsWith("::")) return true;
  const first = parseInt(address.split(":")[0] || "0", 16);
  return (first & 65024) === 64512 || (first & 65472) === 65152 || (first & 65280) === 65280;
}
async function feedAddressRefusal(feedUrl, lookupHost = lookupAll) {
  let url;
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
  let addresses;
  try {
    addresses = await lookupHost(host);
  } catch {
    return "Fant ikke adressen.";
  }
  if (addresses.length === 0) return "Fant ikke adressen.";
  return addresses.some(isInternalAddress) ? "Adressen peker inn i et lukket nett." : null;
}
async function limitedText(response) {
  const declared = Number(response.headers?.get?.("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > FEED_MAX_BYTES) return null;
  const text = await response.text();
  return Buffer.byteLength(text, "utf8") > FEED_MAX_BYTES ? null : text;
}
async function externalCalendarIcs({
  env,
  ask,
  httpFetch,
  lookupHost = lookupAll
}) {
  const plain = (status, body) => ({
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    body
  });
  const installation = readInstallationConfig(env);
  if (!installation) return plain(500, "Kalenderimporten er ikke satt opp: installasjonen mangler innstillingene sine.");
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const doc = await readDocument(database, SURFACES_PATH, ask);
  const surfaces = parseSurfaces(doc && doc.recordType === SURFACES_RECORD ? doc : void 0);
  if (surfaces.ownWebsite) return plain(404, "Kalenderimport er bare når vår nettside er av.");
  const feedUrl = icalFeedUrl(surfaces);
  if (!feedUrl) return plain(404, "Ingen iCal-adresse er lagret.");
  let response = null;
  let address = feedUrl;
  for (let hop = 0; hop <= FEED_MAX_REDIRECTS; hop++) {
    const refusal = await feedAddressRefusal(address, lookupHost);
    if (refusal) return plain(400, `Kalenderadressen kan ikke brukes: ${refusal}`);
    try {
      response = await httpFetch(address, {
        headers: { Accept: "text/calendar,*/*" },
        redirect: "manual",
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS)
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

// server/vercel/kalender-innhold.ts
async function handler(_request, response) {
  const feed = await externalCalendarIcs({
    env: process.env,
    ask: fetch,
    httpFetch: fetch
  });
  response.statusCode = feed.status;
  for (const [name, value] of Object.entries(feed.headers)) response.setHeader(name, value);
  response.end(feed.body);
}
export {
  handler as default
};
