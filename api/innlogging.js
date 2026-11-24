// Laget av `npm run build:api` fra server/vercel/innlogging.ts. Ikke rediger denne filen: endre kilden og kjør kommandoen.

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

// src/utils/emailRecipients.ts
var ADDRESS = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
function usableEmail(value) {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return address.length <= 254 && ADDRESS.test(address) ? address : null;
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

// server/loginLinkToken.ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
var TOKEN_MAX = 1e3;
var keyOf = (account) => createHash("sha256").update(`menighetsplan-innloggingslenke:${account.private_key}`).digest();
var sign = (key, text) => createHmac("sha256", key).update(text, "utf8").digest("base64url");
var emailHashOf = (email) => createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("base64url").slice(0, 22);
function readLoginToken(account, token, nowSeconds) {
  if (typeof token !== "string" || token.length > TOKEN_MAX) return "invalid";
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") return "invalid";
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(keyOf(account), payload), "utf8");
  const given = Buffer.from(signature, "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "invalid";
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return "invalid";
  }
  const { p, e, x } = data ?? {};
  if (typeof p !== "string" || p === "" || typeof e !== "string" || typeof x !== "number" || !Number.isFinite(x)) return "invalid";
  if (nowSeconds >= x) return "expired";
  return { personId: p, emailHash: e };
}

// server/serviceAccount.ts
import { createSign } from "node:crypto";
var SERVICE_ACCOUNT_SETTING = "FIREBASE_SERVICE_ACCOUNT";
var CUSTOM_TOKEN_AUDIENCE = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
var TOKEN_URL = "https://oauth2.googleapis.com/token";
var CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
var IDENTITY_URL = "https://identitytoolkit.googleapis.com/v1/projects";
var HOUR_SECONDS = 3600;
var textOf = (value) => typeof value === "string" && value.trim() !== "" ? value : null;
function readServiceAccount(env) {
  const raw = textOf(env[SERVICE_ACCOUNT_SETTING]);
  if (raw === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const fields = parsed;
  const projectId = textOf(fields.project_id);
  const clientEmail = textOf(fields.client_email);
  const privateKey = textOf(fields.private_key);
  if (projectId === null || clientEmail === null || privateKey === null) return null;
  return { project_id: projectId, client_email: clientEmail, private_key: privateKey.replace(/\\n/g, "\n") };
}
var base64url = (value) => Buffer.from(value, "utf8").toString("base64url");
function signJwt(account, claims) {
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key).toString("base64url");
  return `${unsigned}.${signature}`;
}
function customToken(account, uid, nowSeconds) {
  return signJwt(account, {
    iss: account.client_email,
    sub: account.client_email,
    aud: CUSTOM_TOKEN_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + HOUR_SECONDS,
    uid
  });
}
async function accessToken(account, ask, nowSeconds) {
  const assertion = signJwt(account, {
    iss: account.client_email,
    scope: CLOUD_SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + HOUR_SECONDS
  });
  const response = await ask(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`
  });
  if (!response.ok) throw new Error(`Google svarte ${response.status} ved innlogging av tjenestekontoen`);
  const answer = await response.json();
  if (typeof answer.access_token !== "string") throw new Error("Google ga ingen tilgangsnøkkel");
  return answer.access_token;
}
async function identityRequest(url, token, body, ask) {
  const response = await ask(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Identity Toolkit svarte ${response.status}`);
  return await response.json() ?? {};
}
async function findUserByEmail(projectId, email, token, ask) {
  const answer = await identityRequest(`${IDENTITY_URL}/${encodeURIComponent(projectId)}/accounts:lookup`, token, { email: [email] }, ask);
  const user = Array.isArray(answer.users) ? answer.users[0] : void 0;
  const localId = textOf(user?.localId);
  if (!user || localId === null) return null;
  const providers = Array.isArray(user.providerUserInfo) ? user.providerUserInfo : [];
  const hasPassword = typeof user.passwordHash === "string" || providers.some((provider) => provider?.providerId === "password");
  return { localId, emailVerified: user.emailVerified === true, disabled: user.disabled === true, hasPassword };
}
async function createUser(projectId, email, token, ask) {
  const answer = await identityRequest(`${IDENTITY_URL}/${encodeURIComponent(projectId)}/accounts`, token, { email, emailVerified: true }, ask);
  const localId = textOf(answer.localId);
  if (localId === null) throw new Error("Identity Toolkit ga ingen konto-id");
  return localId;
}
async function markEmailVerified(projectId, localId, token, ask) {
  await identityRequest(`${IDENTITY_URL}/${encodeURIComponent(projectId)}/accounts:update`, token, { localId, emailVerified: true }, ask);
}

// server/loginLinkRedeem.ts
var PERSONS = "persons";
var LOGIN_LINK_NOT_SET_UP = "Innloggingslenker er ikke satt opp for denne installasjonen ennå.";
var INVALID = "Lenken er ikke gyldig. Logg inn på vanlig måte.";
var EXPIRED = "Lenken er gått ut. Logg inn på vanlig måte, eller be om en ny e-post.";
var NO_LONGER = "Denne lenken kan ikke brukes lenger. Logg inn på vanlig måte.";
var DISABLED = "Kontoen er sperret. Ta kontakt med menigheten.";
var UNREACHABLE = "Innloggingen kunne ikke fullføres akkurat nå. Prøv igjen.";
var refuse = (status, message) => ({ status, body: { ok: false, message } });
async function redeemLoginLink({ env, body, ask, now = /* @__PURE__ */ new Date() }) {
  if (readDemoInstallation(env) !== null) return refuse(403, "Demoen har ikke innloggingslenker.");
  const installation = readInstallationConfig(env);
  const account = readServiceAccount(env);
  if (!installation || !account || account.project_id !== installation.projectId) return refuse(503, LOGIN_LINK_NOT_SET_UP);
  const nowSeconds = Math.floor(now.getTime() / 1e3);
  const token = body && typeof body === "object" ? body.token : void 0;
  const link = readLoginToken(account, token, nowSeconds);
  if (link === "invalid") return refuse(400, INVALID);
  if (link === "expired") return refuse(410, EXPIRED);
  try {
    const bearer = await accessToken(account, ask, nowSeconds);
    const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
    const person = await readDocument(database, `${PERSONS}/${link.personId}`, ask, { Authorization: `Bearer ${bearer}` });
    const email = usableEmail(person?.email);
    if (!person || !email || emailHashOf(email) !== link.emailHash) return refuse(403, NO_LONGER);
    if (person.globalRole === "admin" || person.globalRole === "nettredaktor") return refuse(403, NO_LONGER);
    const found = await findUserByEmail(installation.projectId, email, bearer, ask);
    if (found?.disabled) return refuse(403, DISABLED);
    if (found && !found.emailVerified && found.hasPassword) return refuse(403, NO_LONGER);
    const localId = found ? found.localId : await createUser(installation.projectId, email, bearer, ask);
    if (found && !found.emailVerified) await markEmailVerified(installation.projectId, localId, bearer, ask);
    return { status: 200, body: { ok: true, customToken: customToken(account, localId, nowSeconds) } };
  } catch (error) {
    console.error("Innloggingslenken fikk ikke logget inn:", error instanceof Error ? error.message : error);
    return refuse(502, UNREACHABLE);
  }
}

// server/vercel/innlogging.ts
async function bodyOf(request) {
  if (request.body !== void 0) {
    if (typeof request.body !== "string") return request.body;
    try {
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }
  const parts = [];
  let size = 0;
  for await (const part of request) {
    const piece = typeof part === "string" ? Buffer.from(part) : part;
    size += piece.length;
    if (size > 1e4) return null;
    parts.push(piece);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    return null;
  }
}
async function handler(request, response) {
  const answer = (status, body) => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(body));
  };
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return answer(405, { ok: false, message: "Innloggingen gjøres fra lenken i e-posten." });
  }
  const result = await redeemLoginLink({ env: process.env, body: await bodyOf(request), ask: fetch });
  answer(result.status, result.body);
}
export {
  handler as default
};
