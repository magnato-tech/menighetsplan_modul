// Laget av `npm run build:api` fra server/vercel/kalender-innhold.ts. Ikke rediger denne filen: endre kilden og kjør kommandoen.

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
  dismissedUids: [],
  keptUids: []
});
var strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim() !== "") : [];
function validHttpsUrl(value) {
  const trimmed = String(value || "").trim().replace(/^webcal:\/\//i, "https://");
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed;
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
async function externalCalendarIcs({
  env,
  ask,
  httpFetch
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
  const feedUrl = validHttpsUrl(surfaces.externalCalendarUrl);
  if (!feedUrl) return plain(404, "Ingen iCal-adresse er lagret.");
  let response;
  try {
    response = await httpFetch(feedUrl, { headers: { Accept: "text/calendar,*/*" } });
  } catch (error) {
    console.error("Kunne ikke hente ekstern kalender:", error);
    return plain(502, "Kunne ikke nå kirkens kalender.");
  }
  const text = await response.text();
  if (!response.ok) return plain(502, `Kirkens kalender svarte ${response.status}.`);
  if (!text.includes("BEGIN:VCALENDAR")) return plain(502, "Svaret var ikke en gyldig kalenderfil.");
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
