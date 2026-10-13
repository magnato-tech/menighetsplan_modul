// Laget av `npm run build:api` fra server/vercel/kalender.ts. Ikke rediger denne filen: endre kilden og kjør kommandoen.

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

// src/utils/visibility.ts
function visibilityOf(g) {
  if (g.visibility) return g.visibility === "offentlig" || g.visibility === "fremhevet" ? g.visibility : "intern";
  return g.isPublic === false ? "intern" : "offentlig";
}
function isPubliclyVisible(g) {
  return visibilityOf(g) !== "intern";
}

// src/utils/gatherings.ts
var DEFAULT_LOCATION = "Kirken";
function locationOf(g) {
  return g.location?.trim() || DEFAULT_LOCATION;
}
function isGroupGathering(g) {
  return g.type === "gruppesamling";
}
function isOpenCommunityGathering(g) {
  return isPubliclyVisible(g) && !isGroupGathering(g);
}
var ONGOING_MS = 4 * 60 * 60 * 1e3;

// src/utils/gatheringPresentation.ts
var eventPath = (id) => `/arrangement/${encodeURIComponent(id)}`;

// src/utils/calendarFeed.ts
var DEFAULT_DURATION_MS = 90 * 60 * 1e3;
var FEED_PAST_MS = 30 * 24 * 60 * 60 * 1e3;
var FEED_FUTURE_MS = 365 * 24 * 60 * 60 * 1e3;
function escapeIcal(text2) {
  return text2.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function formatIcalUtc(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
var startOf = (g) => new Date(g.startsAt).getTime();
function gatheringsForCalendarFeed(gatherings, now = /* @__PURE__ */ new Date()) {
  const from = now.getTime() - FEED_PAST_MS;
  const to = now.getTime() + FEED_FUTURE_MS;
  return gatherings.filter((g) => isOpenCommunityGathering(g) && startOf(g) >= from && startOf(g) <= to).sort((a, b) => startOf(a) - startOf(b));
}
function eventLines(g, now, siteUrl) {
  const start = new Date(g.startsAt);
  const end = g.endsAt ? new Date(g.endsAt) : new Date(start.getTime() + DEFAULT_DURATION_MS);
  const theme = [g.theme, g.bibleText].filter(Boolean).join(" — ");
  const description = [g.summary?.trim(), theme].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VEVENT",
    `UID:${g.id}@menighetsplan`,
    `DTSTAMP:${formatIcalUtc(now)}`,
    `DTSTART:${formatIcalUtc(start)}`,
    `DTEND:${formatIcalUtc(end)}`,
    `SUMMARY:${escapeIcal(g.title || "Samling")}`,
    `LOCATION:${escapeIcal(locationOf(g))}`,
    ...description ? [`DESCRIPTION:${escapeIcal(description)}`] : [],
    ...siteUrl ? [`URL:${siteUrl.replace(/\/+$/, "")}${eventPath(g.id)}`] : [],
    ...g.cancelled ? ["STATUS:CANCELLED"] : [],
    "END:VEVENT"
  ];
}
function calendarOf(events, options) {
  const now = options.now || /* @__PURE__ */ new Date();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Menighetsplan//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(options.calendarName || "Menighetsplan")}`,
    ...events.flatMap((event) => eventLines(event, now, options.siteUrl)),
    "END:VCALENDAR"
  ].join("\r\n");
}
function toIcalendar(gatherings, options = {}) {
  return calendarOf(gatheringsForCalendarFeed(gatherings, options.now || /* @__PURE__ */ new Date()), options);
}

// src/utils/demoSite.ts
var SITE_ID = /^[a-z0-9]{1,24}$/;
function parseDemoSiteId(value) {
  return typeof value === "string" && SITE_ID.test(value) ? value : null;
}
var collectionPrefixOf = (site) => site ? `${site}-` : "";

// src/utils/validation.ts
var ValidationError = class extends Error {
  constructor(message, field, invalidData) {
    super(message);
    this.field = field;
    this.invalidData = invalidData;
    this.name = "ValidationError";
  }
};
function validateEvent(data) {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Arrangement-data må være et gyldig objekt", void 0, data);
  }
  const record = data;
  if (!record.id || typeof record.id !== "string" || !record.id.trim()) {
    throw new ValidationError("Arrangement mangler gyldig ID", "id", data);
  }
  if (!record.title || typeof record.title !== "string" || !record.title.trim()) {
    throw new ValidationError("Arrangement mangler tittel", "title", data);
  }
  if (!record.startsAt || typeof record.startsAt !== "string" || isNaN(Date.parse(record.startsAt))) {
    throw new ValidationError("Arrangement mangler gyldig dato (startsAt)", "startsAt", data);
  }
  const validVisibilities = ["intern", "offentlig", "fremhevet"];
  if (record.visibility && !validVisibilities.includes(record.visibility)) {
    throw new ValidationError(
      `Ugyldig synlighet '${record.visibility}'. Må være 'intern', 'offentlig' eller 'fremhevet'`,
      "visibility",
      data
    );
  }
  return data;
}

// server/firestoreRest.ts
var FirestoreRestError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "FirestoreRestError";
  }
};
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
function whereTrueQuery(collectionId, field) {
  return {
    structuredQuery: {
      from: [{ collectionId }],
      where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { booleanValue: true } } }
    }
  };
}
async function readWhereTrue(database, collectionId, field, ask) {
  const response = await ask(`${documentsOf(database)}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(whereTrueQuery(collectionId, field))
  });
  if (!response.ok) throw new FirestoreRestError(`Databasen svarte ${response.status} for ${collectionId}`, response.status);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new FirestoreRestError(`Databasen svarte ikke med en liste for ${collectionId}`, 502);
  const failed = rows.find((row) => row.error);
  if (failed?.error) throw new FirestoreRestError(failed.error.message || `Databasen svarte med en feil for ${collectionId}`, failed.error.code ?? 502);
  return rows.flatMap((row) => row.document ? [decodeDocument(row.document)] : []);
}
async function readDocument(database, path, ask) {
  const response = await ask(`${documentsOf(database)}/${path}`);
  if (!response.ok) return null;
  return decodeDocument(await response.json());
}

// server/publicCalendarFeed.ts
var GATHERINGS = "gatherings";
var SETTINGS_DOCUMENT = "cms_settings/global";
var text = (status, body) => ({
  status,
  headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  body
});
function siteOfRequest(env, site) {
  if (readDemoInstallation(env) === null) return null;
  return site === "eksempel" ? null : parseDemoSiteId(site);
}
async function publicCalendarFeed({ env, site, siteUrl, ask, now = /* @__PURE__ */ new Date() }) {
  const installation = readInstallationConfig(env);
  if (!installation) return text(500, "Kalenderen er ikke satt opp: installasjonen mangler innstillingene sine.");
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const prefix = collectionPrefixOf(siteOfRequest(env, site));
  let documents;
  try {
    documents = await readWhereTrue(database, prefix + GATHERINGS, "isPublic", ask);
  } catch (error) {
    const status = error instanceof FirestoreRestError ? error.status : 0;
    console.error("Kalenderabonnementet fikk ikke lest arrangementene:", error instanceof Error ? error.message : error, status);
    return text(502, "Kalenderen kunne ikke hentes akkurat nå. Prøv igjen senere.");
  }
  const gatherings = [];
  for (const document of documents) {
    try {
      gatherings.push(validateEvent(document));
    } catch {
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
      "Cache-Control": "public, max-age=300, s-maxage=300"
    },
    body: toIcalendar(gatherings, { calendarName: churchName || "Menighetsplan", now, siteUrl })
  };
}

// server/vercel/kalender.ts
var first = (value) => Array.isArray(value) ? value[0] : value;
async function handler(request, response) {
  const host = first(request.headers["x-forwarded-host"]) || request.headers.host;
  const site = new URL(request.url || "/", "http://localhost").searchParams.get("menighet");
  const feed = await publicCalendarFeed({
    env: process.env,
    site,
    siteUrl: host ? `https://${host}` : void 0,
    ask: fetch
  });
  response.statusCode = feed.status;
  for (const [name, value] of Object.entries(feed.headers)) response.setHeader(name, value);
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.end(feed.body);
}
export {
  handler as default
};
