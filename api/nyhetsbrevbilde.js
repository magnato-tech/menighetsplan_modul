// Laget av `npm run build:api` fra server/vercel/nyhetsbrevbilde.ts. Ikke rediger denne filen: endre kilden og kjør kommandoen.

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

// src/utils/newsletter.ts
var NEWSLETTER_BANNER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
function newsletterBannerOf(imageUrl) {
  if (typeof imageUrl !== "string") return null;
  const value = imageUrl.trim();
  const stored = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (stored) return NEWSLETTER_BANNER_TYPES.includes(stored[1]) ? { kind: "stored", contentType: stored[1], base64: stored[2] } : null;
  if (/^https:\/\/[^\s"'<>]+$/.test(value) || /^\/(?!\/)[^\s"'<>]*$/.test(value)) return { kind: "address", url: value };
  return null;
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

// server/newsletterBanner.ts
var NEWSLETTER_BANNER_DOCUMENT = "cms_settings/newsletter-banner";
var missing = { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body: "Nyhetsbrevet har ikke noe toppbilde." };
async function newsletterBanner({ env, siteUrl, ask }) {
  const installation = readInstallationConfig(env);
  if (!installation) return missing;
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const record = await readDocument(database, NEWSLETTER_BANNER_DOCUMENT, ask).catch(() => null);
  const banner = newsletterBannerOf(record?.imageUrl);
  if (!banner) return missing;
  const kept = "public, max-age=86400";
  if (banner.kind === "stored") return { status: 200, headers: { "Content-Type": banner.contentType, "Cache-Control": kept }, body: Buffer.from(banner.base64, "base64") };
  const url = banner.url.startsWith("/") ? siteUrl ? `${siteUrl.replace(/\/+$/, "")}${banner.url}` : null : banner.url;
  return url ? { status: 302, headers: { Location: url, "Cache-Control": kept }, body: "" } : missing;
}

// server/vercel/nyhetsbrevbilde.ts
var first = (value) => Array.isArray(value) ? value[0] : value;
async function handler(request, response) {
  const host = first(request.headers["x-forwarded-host"]) || request.headers.host;
  const banner = await newsletterBanner({ env: process.env, siteUrl: host ? `https://${host}` : void 0, ask: fetch });
  response.statusCode = banner.status;
  for (const [name, value] of Object.entries(banner.headers)) response.setHeader(name, value);
  response.end(banner.body);
}
export {
  handler as default
};
