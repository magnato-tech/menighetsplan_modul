// Laget av `npm run build:api` fra server/vercel/innloggingsepost.ts. Ikke rediger denne filen: endre kilden og kjør kommandoen.

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

// src/utils/loginLink.ts
var DESTINATION_MAX = 300;
var FALLBACK_DESTINATION = "/minside";
function safeDestination(value) {
  if (typeof value !== "string" || value.length > DESTINATION_MAX) return FALLBACK_DESTINATION;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return FALLBACK_DESTINATION;
  return value;
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
var escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// src/utils/signInEmailMessage.ts
var BUTTON_STYLE = "display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 22px;border-radius:10px;";
function renderSignInEmail({ subject, churchName, parts }) {
  const text = parts.map((part) => "text" in part ? part.text : `${part.button.label}: ${part.button.url}`).join("\n\n");
  const body = parts.map(
    (part) => "text" in part ? `<p style="margin:12px 0;">${escapeHtml(part.text)}</p>` : `<p style="margin:16px 0;"><a href="${escapeHtml(part.button.url)}" style="${BUTTON_STYLE}">${escapeHtml(part.button.label)}</a></p>`
  ).join("\n");
  const html = `<!doctype html>
<html lang="nb">
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<tr><td style="padding:24px 28px 8px 28px;font-size:13px;font-weight:bold;color:#047857;">${escapeHtml(churchName)}</td></tr>
<tr><td style="padding:12px 28px 24px 28px;font-size:16px;line-height:24px;">
${body}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, html, text };
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
var documentNameOf = ({ projectId, databaseId }, path) => `projects/${projectId}/databases/${databaseId || "(default)"}/documents/${path}`;
async function readDocument(database, path, ask, headers) {
  const response = await ask(`${documentsOf(database)}/${path}`, headers ? { headers } : void 0);
  if (!response.ok) return null;
  return decodeDocument(await response.json());
}
async function documentExists(database, path, ask, headers) {
  const response = await ask(`${documentsOf(database)}/${path}`, headers ? { headers } : void 0);
  if (response.status === 404) return false;
  if (!response.ok) throw new FirestoreRestError(`Dokumentet kunne ikke leses (${response.status})`, response.status);
  return true;
}
function filterQuery(collectionId, filter, limit) {
  return {
    structuredQuery: {
      from: [{ collectionId }],
      where: { fieldFilter: { field: { fieldPath: filter.field }, op: filter.op, value: { stringValue: filter.value } } },
      ...limit ? { limit } : {}
    }
  };
}
async function queryDocuments(database, collectionId, filter, ask, headers = {}, limit) {
  const response = await ask(`${documentsOf(database)}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(filterQuery(collectionId, filter, limit))
  });
  if (!response.ok) throw new FirestoreRestError(`Databasen svarte ${response.status} for ${collectionId}`, response.status);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new FirestoreRestError(`Databasen svarte ikke med en liste for ${collectionId}`, 502);
  const failed = rows.find((row) => row.error);
  if (failed?.error) throw new FirestoreRestError(failed.error.message || `Databasen svarte med en feil for ${collectionId}`, failed.error.code ?? 502);
  return rows.flatMap((row) => row.document ? [decodeDocument(row.document)] : []);
}
async function addDocument(database, collectionId, fields, ask, headers = {}) {
  const encoded = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, typeof value === "boolean" ? { booleanValue: value } : { stringValue: value }]));
  const response = await ask(`${documentsOf(database)}/${collectionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ fields: encoded })
  });
  if (!response.ok) throw new FirestoreRestError(`Databasen svarte ${response.status} da ${collectionId} skulle få et dokument`, response.status);
}
async function deleteDocuments(database, paths, ask, headers = {}) {
  if (paths.length === 0) return;
  const response = await ask(`${documentsOf(database)}:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ writes: paths.map((path) => ({ delete: documentNameOf(database, path) })) })
  });
  if (!response.ok) throw new FirestoreRestError(`Databasen svarte ${response.status} på slettingen`, response.status);
}

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
async function identityRequest(url, token, body, ask) {
  const response = await ask(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Identity Toolkit svarte ${response.status}`);
  return await response.json() ?? {};
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
var SETTINGS_DOCUMENT = "cms_settings/global";
var EMAIL_SETTINGS = {
  /** The key to the e-mail service. Only where the installation is hosted, never in the browser. */
  apiKey: "RESEND_API_KEY",
  /** The address the e-mail is sent from. Its domain must be approved at the e-mail service. */
  from: "EMAIL_FROM_ADDRESS"
};
var DEFAULT_FROM_ADDRESS = "ikke-svar@menighetsplan.no";
var settingOf = (env, name) => {
  const value = env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
};
function senderOf(churchName, address) {
  const name = churchName.replace(/["<>\r\n]/g, "").trim();
  return name ? `"${name}" <${address}>` : address;
}

// server/signInEmail.ts
var LOGINS = "logins";
var LOGIN_REQUESTS = "loginRequests";
var ONE_EMAIL_URL = "https://api.resend.com/emails";
var IDENTITY_URL = "https://identitytoolkit.googleapis.com/v1/projects";
var REQUESTS_PER_ADDRESS_PER_HOUR = 3;
var REQUESTS_PER_DAY = 300;
var KEEP_DAYS = 90;
var DELETE_PER_CALL = 50;
var HOUR_MS = 60 * 60 * 1e3;
var DAY_MS = 24 * HOUR_MS;
var FAILED = "E-posten kunne ikke sendes akkurat nå. Prøv igjen om litt.";
var unavailable = () => ({ status: 503, body: { ok: false, reason: "not-available" } });
var refuse = (status, reason, message) => ({ status, body: { ok: false, reason, message } });
function continueUrlOf(site, returnTo) {
  const fallback = `${site.origin}/minside`;
  if (typeof returnTo !== "string") return fallback;
  try {
    const target = new URL(returnTo);
    if (target.origin !== site.origin) return fallback;
    return `${site.origin}${safeDestination(target.pathname + target.search)}`;
  } catch {
    return fallback;
  }
}
async function isLimited(database, address, now, ask, headers) {
  const hourAgo = new Date(now.getTime() - HOUR_MS).toISOString();
  const mine = await queryDocuments(database, LOGIN_REQUESTS, { field: "email", op: "EQUAL", value: address }, ask, headers);
  if (mine.filter((row) => String(row.at) >= hourAgo).length >= REQUESTS_PER_ADDRESS_PER_HOUR) return true;
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString();
  const today = await queryDocuments(database, LOGIN_REQUESTS, { field: "at", op: "GREATER_THAN_OR_EQUAL", value: dayAgo }, ask, headers, REQUESTS_PER_DAY);
  return today.length >= REQUESTS_PER_DAY;
}
async function logRequest(database, address, at, inRegister, result, ask, headers) {
  try {
    await addDocument(database, LOGIN_REQUESTS, { email: address, at: at.toISOString(), inRegister, result }, ask, headers);
  } catch (error) {
    console.error("Forespørselen om innloggingslenke fikk ikke blitt logget:", error instanceof Error ? error.message : error);
  }
  try {
    const cutoff = new Date(at.getTime() - KEEP_DAYS * DAY_MS).toISOString();
    const old = await queryDocuments(database, LOGIN_REQUESTS, { field: "at", op: "LESS_THAN", value: cutoff }, ask, headers, DELETE_PER_CALL);
    await deleteDocuments(database, old.map((row) => `${LOGIN_REQUESTS}/${row.id}`), ask, headers);
  } catch {
  }
}
async function deliver({ ask, database, bearer, projectId, apiKey, fromAddress, address, inRegister, continueUrl, siteOrigin }) {
  try {
    const settings = await readDocument(database, SETTINGS_DOCUMENT, ask, { Authorization: `Bearer ${bearer}` });
    const churchName = typeof settings?.churchName === "string" && settings.churchName.trim() || "Menigheten";
    let subject;
    let parts;
    if (inRegister) {
      const answer = await identityRequest(
        `${IDENTITY_URL}/${encodeURIComponent(projectId)}/accounts:sendOobCode`,
        bearer,
        { requestType: "EMAIL_SIGNIN", email: address, continueUrl, canHandleCodeInApp: true, returnOobLink: true },
        ask
      );
      const link = typeof answer.oobLink === "string" ? answer.oobLink : "";
      if (link === "") throw new Error("Identity Toolkit ga ingen innloggingslenke");
      subject = `Logg inn på Min side – ${churchName}`;
      parts = [
        { text: "Hei!" },
        { text: `Trykk på knappen for å logge inn på Min side hos ${churchName}. Du trenger ikke passord.` },
        { button: { label: "Logg inn", url: link } },
        { text: "Lenken virker bare én gang og bare en kort stund. Har du ikke bedt om den, kan du se bort fra denne e-posten." },
        { text: `Vennlig hilsen ${churchName}` }
      ];
    } else {
      subject = `Vi fant ikke adressen din – ${churchName}`;
      parts = [
        { text: "Hei!" },
        { text: `Noen ba om å logge inn på Min side hos ${churchName} med denne adressen, men den står ikke i menighetens register.` },
        { text: "Kanskje er du registrert med en annen e-postadresse? Prøv den, eller ta kontakt med menigheten, så hjelper vi deg." },
        { button: { label: "Til nettsiden", url: siteOrigin } },
        { text: `Vennlig hilsen ${churchName}` }
      ];
    }
    const rendered = renderSignInEmail({ subject, churchName, parts });
    const response = await ask(ONE_EMAIL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: senderOf(churchName, fromAddress), to: [address], subject: rendered.subject, html: rendered.html, text: rendered.text })
    });
    if (!response.ok) {
      console.error("E-posttjenesten tok ikke imot innloggingsepost:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Innloggingsepost fikk ikke blitt laget eller sendt:", error instanceof Error ? error.message : error);
    return false;
  }
}
async function sendSignInEmail({ env, siteUrl, body, ask, now = /* @__PURE__ */ new Date() }) {
  const installation = readDemoInstallation(env) === null ? readInstallationConfig(env) : null;
  const account = readServiceAccount(env);
  const apiKey = settingOf(env, EMAIL_SETTINGS.apiKey);
  let site;
  try {
    site = new URL(siteUrl ?? "");
  } catch {
    return unavailable();
  }
  if (!installation || !account || account.project_id !== installation.projectId || !apiKey) return unavailable();
  const request = body && typeof body === "object" ? body : {};
  const address = usableEmail(request.email);
  if (!address) return refuse(400, "bad-email", "E-postadressen ser ikke riktig ut.");
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const continueUrl = continueUrlOf(site, request.returnTo);
  const fromAddress = settingOf(env, EMAIL_SETTINGS.from) ?? DEFAULT_FROM_ADDRESS;
  try {
    const bearer = await accessToken(account, ask, Math.floor(now.getTime() / 1e3));
    const headers = { Authorization: `Bearer ${bearer}` };
    const inRegister = await documentExists(database, `${LOGINS}/${encodeURIComponent(address)}`, ask, headers);
    const limited = await isLimited(database, address, now, ask, headers);
    const sent = limited ? false : await deliver({ ask, database, bearer, projectId: installation.projectId, apiKey, fromAddress, address, inRegister, continueUrl, siteOrigin: site.origin });
    const result = limited ? "limited" : sent ? "sent" : "failed";
    await logRequest(database, address, now, inRegister, result, ask, headers);
    return sent || limited ? { status: 200, body: { ok: true } } : refuse(502, "failed", FAILED);
  } catch (error) {
    console.error("Innloggingsepost fikk ikke sjekket registeret eller Google:", error instanceof Error ? error.message : error);
    return unavailable();
  }
}

// server/vercel/innloggingsepost.ts
var first = (value) => Array.isArray(value) ? value[0] : value;
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
    return answer(405, { ok: false, reason: "bad-request", message: "Innloggingslenken sendes fra innloggingssiden." });
  }
  const host = first(request.headers["x-forwarded-host"]) || request.headers.host;
  const result = await sendSignInEmail({
    env: process.env,
    siteUrl: host ? `https://${host}` : void 0,
    body: await bodyOf(request),
    ask: fetch
  });
  answer(result.status, result.body);
}
export {
  handler as default
};
