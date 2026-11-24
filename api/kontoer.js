// Laget av `npm run build:api` fra server/vercel/kontoer.ts. Ikke rediger denne filen: endre kilden og kjør kommandoen.

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
function decodeDocument(document2) {
  const data = decodeFields(document2.fields);
  const stored = typeof data.id === "string" && data.id ? data.id : null;
  return { ...data, id: stored ?? document2.name.slice(document2.name.lastIndexOf("/") + 1) };
}
var signedInAs = (idToken) => ({ Authorization: `Bearer ${idToken}` });
var wholeCollectionQuery = (collectionId) => ({ structuredQuery: { from: [{ collectionId }] } });
async function readAll(database, collectionId, ask, headers = {}) {
  const response = await ask(`${documentsOf(database)}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(wholeCollectionQuery(collectionId))
  });
  if (!response.ok) throw new FirestoreRestError(`Databasen svarte ${response.status} for ${collectionId}`, response.status);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new FirestoreRestError(`Databasen svarte ikke med en liste for ${collectionId}`, 502);
  const failed = rows.find((row) => row.error);
  if (failed?.error) throw new FirestoreRestError(failed.error.message || `Databasen svarte med en feil for ${collectionId}`, failed.error.code ?? 502);
  return rows.flatMap((row) => row.document ? [decodeDocument(row.document)] : []);
}

// src/utils/emailMessage.ts
var EMAIL_TEMPLATES = [
  {
    id: "semesterstart-ledere",
    label: "Semesterstart: til lederne",
    audience: { kind: "leaders" },
    link: "leder",
    subject: "Nytt semester: legg inn oppgavene for gruppa di",
    text: [
      "Planen for det nye semesteret er lagt inn, og nå er det din tur.",
      "Gå inn på gruppa di og se over arrangementene framover. Legg inn oppgavene som trengs, og spør dem du ønsker å ha med. Det du lar stå åpent, kan de frivillige ta selv når vi gir dem beskjed.",
      "Du logger inn med e-postadressen denne e-posten kom til."
    ].join("\n\n")
  },
  {
    id: "oppgaver-klare",
    label: "Oppgavene er klare: til de frivillige",
    audience: { kind: "serviceGroups" },
    link: "minside",
    subject: "Oppgavene for semesteret er klare",
    text: [
      "Nå ligger oppgavene for semesteret ute.",
      "Gå inn på Min side. Der ser du forespørsler som venter på svar fra deg, og ledige oppgaver i gruppene du er med i. Ta de dagene som passer for deg.",
      "Du logger inn med e-postadressen denne e-posten kom til."
    ].join("\n\n")
  },
  {
    id: "semesterplan-frivillige",
    label: "Semesterplanen er åpen: til de frivillige",
    audience: { kind: "serviceGroups" },
    link: "semesterplan",
    subject: "Semesterplanen er klar: velg oppgavene dine",
    text: [
      "Semesterplanen er klar. Gå gjennom arrangementene ett og ett, og ta oppgavene som passer for deg. Er det en dag du ikke kan, trykker du «Kan ikke».",
      "Du logger inn med e-postadressen denne e-posten kom til."
    ].join("\n\n")
  },
  {
    id: "nyhetsbrev",
    label: "Nyhetsbrev",
    audience: { kind: "members" },
    link: "ingen",
    subject: "Nyhetsbrev",
    text: ["## Kjære alle sammen!", "Skriv nyhetsbrevet her.", "## Hva skjer", "- Første punkt\n- Andre punkt"].join("\n\n")
  }
];

// server/serviceAccount.ts
import { createSign } from "node:crypto";
var SERVICE_ACCOUNT_SETTING = "FIREBASE_SERVICE_ACCOUNT";
var TOKEN_URL = "https://oauth2.googleapis.com/token";
var CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
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

// src/utils/withdrawalAttestation.ts
var CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[i] = c;
  }
  return table;
})();

// server/emailSending.ts
var PERSONS = "persons";
function emailOfToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    if (payload.email_verified !== true) return null;
    return usableEmail(payload.email);
  } catch {
    return null;
  }
}

// server/accountList.ts
var BATCH_URL = "https://identitytoolkit.googleapis.com/v1/projects";
var PAGE_SIZE = 1e3;
var MAX_PAGES = 20;
var MESSAGES = {
  demo: [409, "Demoen har ingen ekte kontoer. Oversikten virker i menighetens egen installasjon."],
  "not-configured": [503, "Innlogging er ikke satt opp for denne installasjonen ennå."],
  "not-signed-in": [401, "Du må være logget inn for å se innloggingene."],
  "no-service-account": [503, "Tjenestenøkkelen FIREBASE_SERVICE_ACCOUNT mangler hos Vercel. Uten den kan oversikten ikke hente kontoene."],
  "not-admin": [403, "Bare en administrator kan se innloggingene."],
  database: [502, "Registeret kunne ikke leses akkurat nå. Prøv igjen."],
  google: [502, "Firebase svarte ikke. Prøv igjen om litt."]
};
var refuse = (reason) => ({
  status: MESSAGES[reason][0],
  body: { ok: false, reason, message: MESSAGES[reason][1] }
});
var textOf2 = (value) => {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  return text === "" ? null : text;
};
var isoOf = (value) => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const time = new Date(Number(value));
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
};
function rowOf(user) {
  const email = textOf2(user.email);
  const providers = Array.isArray(user.providerUserInfo) ? user.providerUserInfo : [];
  const provider = providers.some((info) => info?.providerId === "google.com") ? "google" : email !== null ? "e-postlenke" : "annet";
  return {
    email,
    emailVerified: user.emailVerified === true,
    disabled: user.disabled === true,
    provider,
    createdAt: isoOf(user.createdAt),
    lastLoginAt: isoOf(user.lastLoginAt)
  };
}
async function accountsOf(account, ask, nowSeconds) {
  const token = await accessToken(account, ask, nowSeconds);
  const rows = [];
  let pageToken = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const next = pageToken === null ? "" : `&nextPageToken=${encodeURIComponent(pageToken)}`;
    const response = await ask(`${BATCH_URL}/${encodeURIComponent(account.project_id)}/accounts:batchGet?maxResults=${PAGE_SIZE}${next}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Identity Toolkit svarte ${response.status}`);
    const answer = await response.json() ?? {};
    if (Array.isArray(answer.users)) {
      for (const user of answer.users) if (user && typeof user === "object") rows.push(rowOf(user));
    }
    if (typeof answer.nextPageToken !== "string" || answer.nextPageToken === "") break;
    pageToken = answer.nextPageToken;
  }
  return rows;
}
async function listAccounts({ env, idToken, ask, now = () => Date.now() }) {
  if (readDemoInstallation(env) !== null) return refuse("demo");
  const installation = readInstallationConfig(env);
  if (!installation) return refuse("not-configured");
  const caller = idToken ? emailOfToken(idToken) : null;
  if (!idToken || !caller) return refuse("not-signed-in");
  const account = readServiceAccount(env);
  if (!account || account.project_id !== installation.projectId) return refuse("no-service-account");
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  try {
    const persons = await readAll(database, PERSONS, ask, signedInAs(idToken));
    const me = persons.find((person) => usableEmail(person.email) === caller);
    if (me?.globalRole !== "admin") return refuse("not-admin");
  } catch (error) {
    const status = error instanceof FirestoreRestError ? error.status : 0;
    if (status === 401) return refuse("not-signed-in");
    if (status === 403 || status === 7) return refuse("not-admin");
    console.error("Innloggingsoversikten fikk ikke lest registeret:", error instanceof Error ? error.message : error);
    return refuse("database");
  }
  try {
    const accounts = await accountsOf(account, ask, Math.floor(now() / 1e3));
    return { status: 200, body: { ok: true, accounts, fetchedAt: new Date(now()).toISOString() } };
  } catch (error) {
    console.error("Innloggingsoversikten fikk ikke hentet kontoene:", error instanceof Error ? error.message : error);
    return refuse("google");
  }
}

// server/vercel/kontoer.ts
var first = (value) => Array.isArray(value) ? value[0] : value;
async function handler(request, response) {
  const answer = (status, body) => {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(body));
  };
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return answer(405, { ok: false, message: "Innloggingsoversikten hentes med GET." });
  }
  const authorization = first(request.headers.authorization) ?? "";
  const result = await listAccounts({
    env: process.env,
    idToken: /^Bearer\s+\S/.test(authorization) ? authorization.replace(/^Bearer\s+/, "").trim() : null,
    ask: fetch
  });
  answer(result.status, result.body);
}
export {
  handler as default
};
