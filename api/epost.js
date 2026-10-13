// Laget av `npm run build:api` fra server/vercel/epost.ts. Ikke rediger denne filen: endre kilden og kjør kommandoen.

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

// src/utils/emailMessage.ts
var EMAIL_LINKS = {
  leder: { path: "/leder", button: "Åpne gruppene mine", label: "Gruppelederens side" },
  minside: { path: "/minside", button: "Åpne Min side", label: "Min side" }
};
var EMAIL_SUBJECT_MAX = 120;
var EMAIL_TEXT_MAX = 3e3;
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
  }
];
function emailDraftError(draft) {
  const subject = typeof draft.subject === "string" ? draft.subject.trim() : "";
  const text = typeof draft.text === "string" ? draft.text.trim() : "";
  if (subject === "") return "E-posten må ha et emne.";
  if (/[\r\n]/.test(subject)) return "Emnet kan ikke gå over flere linjer.";
  if (subject.length > EMAIL_SUBJECT_MAX) return `Emnet kan ikke være lengre enn ${EMAIL_SUBJECT_MAX} tegn.`;
  if (text === "") return "E-posten må ha en tekst.";
  if (text.length > EMAIL_TEXT_MAX) return `Teksten kan ikke være lengre enn ${EMAIL_TEXT_MAX} tegn.`;
  if (draft.link !== "leder" && draft.link !== "minside") return "Velg hvor knappen i e-posten skal føre.";
  return null;
}
function toEmailDraft(value) {
  if (emailDraftError(value) !== null) return null;
  return { subject: value.subject.trim(), text: value.text.trim().replace(/\r\n/g, "\n"), link: value.link };
}
var escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
var paragraphsOf = (text) => text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
function renderEmail({ draft, churchName, siteUrl, firstName }) {
  const link = EMAIL_LINKS[draft.link];
  const url = siteUrl.replace(/\/+$/, "") + link.path;
  const greeting = firstName ? `Hei ${firstName}!` : "Hei!";
  const paragraphs = paragraphsOf(draft.text);
  const footer = `Du får denne e-posten fordi du står i en gruppe i ${churchName}. Du kan svare på den hvis du lurer på noe.`;
  const text = [greeting, ...paragraphs, `${link.button}: ${url}`, `Hilsen ${churchName}`, footer].join("\n\n");
  const html = `<!doctype html>
<html lang="nb">
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<tr><td style="padding:24px 28px 8px 28px;font-size:13px;font-weight:bold;color:#047857;">${escapeHtml(churchName)}</td></tr>
<tr><td style="padding:0 28px 8px 28px;font-size:16px;line-height:24px;">
<p style="margin:12px 0;">${escapeHtml(greeting)}</p>
${paragraphs.map((paragraph) => `<p style="margin:12px 0;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("\n")}
</td></tr>
<tr><td style="padding:8px 28px 24px 28px;">
<a href="${escapeHtml(url)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 22px;border-radius:10px;">${escapeHtml(link.button)}</a>
</td></tr>
<tr><td style="padding:0 28px 24px 28px;font-size:16px;line-height:24px;">Hilsen ${escapeHtml(churchName)}</td></tr>
<tr><td style="padding:16px 28px 22px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;">${escapeHtml(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject: draft.subject, html, text };
}

// src/utils/personDirectory.ts
var isServiceGroup = (group) => (group.category ?? "tjenestegruppe") === "tjenestegruppe";

// src/utils/emailRecipients.ts
var ADDRESS = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
function usableEmail(value) {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return address.length <= 254 && ADDRESS.test(address) ? address : null;
}
var leadersOf = (group) => [...group.leaderIds ?? [], ...group.deputyLeaderIds ?? []];
var everyoneIn = (group) => [...group.memberIds ?? [], ...leadersOf(group)];
function audiencePersonIds(audience, groups) {
  const serviceGroups = groups.filter(isServiceGroup);
  const ids = audience.kind === "leaders" ? serviceGroups.flatMap(leadersOf) : audience.kind === "serviceGroups" ? serviceGroups.flatMap(everyoneIn) : groups.filter((group) => group.id === audience.groupId).flatMap(everyoneIn);
  return [...new Set(ids)];
}
function emailRecipients(audience, persons, groups, onlyPersonIds) {
  const only = onlyPersonIds ? new Set(onlyPersonIds) : null;
  const wanted = new Set(audiencePersonIds(audience, groups).filter((id) => !only || only.has(id)));
  const byAddress = /* @__PURE__ */ new Map();
  const withoutEmail = [];
  for (const person of persons) {
    if (!wanted.has(person.id)) continue;
    const address = usableEmail(person.email);
    if (!address) withoutEmail.push(person);
    else byAddress.set(address, [...byAddress.get(address) ?? [], person]);
  }
  const recipients = [...byAddress.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([email, people]) => ({
    email,
    personIds: people.map((person) => person.id),
    firstName: people.length === 1 ? firstNameOf(people[0].name) : null
  }));
  return { recipients, withoutEmail };
}
function firstNameOf(name) {
  const first2 = (name ?? "").trim().split(/\s+/)[0];
  return first2 ? first2 : null;
}
function toEmailAudience(value) {
  if (!value || typeof value !== "object") return null;
  const { kind, groupId } = value;
  if (kind === "leaders" || kind === "serviceGroups") return { kind };
  if (kind === "group" && typeof groupId === "string" && groupId.trim() !== "") return { kind, groupId };
  return null;
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
async function readDocument(database, path, ask, headers) {
  const response = await ask(`${documentsOf(database)}/${path}`, headers ? { headers } : void 0);
  if (!response.ok) return null;
  return decodeDocument(await response.json());
}

// server/emailSending.ts
var PERSONS = "persons";
var GROUPS = "groups";
var SETTINGS_DOCUMENT = "cms_settings/global";
var EMAIL_DOCUMENT = "cms_settings/email";
var EMAIL_SETTINGS = {
  /** The key to the e-mail service. Only where the installation is hosted, never in the browser. */
  apiKey: "RESEND_API_KEY",
  /** The address the e-mail is sent from. Its domain must be approved at the e-mail service. */
  from: "EMAIL_FROM_ADDRESS"
};
var DEFAULT_FROM_ADDRESS = "ikke-svar@menighetsplan.no";
var SEND_URL = "https://api.resend.com/emails/batch";
var BATCH_SIZE = 100;
var MESSAGES = {
  demo: [403, "Demoen sender ikke e-post."],
  "not-configured": [503, "E-post er ikke satt opp for denne installasjonen ennå."],
  "not-signed-in": [401, "Du må være logget inn for å sende e-post."],
  "not-admin": [403, "Bare en administrator kan sende e-post."],
  "bad-request": [400, "E-posten kan ikke sendes slik den er."],
  "no-reply-to": [400, "Legg inn adressen svar skal gå til, før du sender."],
  "no-recipients": [400, "Ingen av mottakerne har en e-postadresse."],
  database: [502, "Registeret kunne ikke leses akkurat nå. Prøv igjen."]
};
var refuse = (reason, message) => ({
  status: MESSAGES[reason][0],
  body: { ok: false, reason, message: message ?? MESSAGES[reason][1] }
});
var settingOf = (env, name) => {
  const value = env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
};
function emailOfToken(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    return usableEmail(payload.email);
  } catch {
    return null;
  }
}
function senderOf(churchName, address) {
  const name = churchName.replace(/["<>\r\n]/g, "").trim();
  return name ? `"${name}" <${address}>` : address;
}
var pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function sendEmail({ env, siteUrl, idToken, body, ask, wait = pause }) {
  if (readDemoInstallation(env) !== null) return refuse("demo");
  const installation = readInstallationConfig(env);
  const apiKey = settingOf(env, EMAIL_SETTINGS.apiKey);
  if (!installation || !apiKey || !siteUrl) return refuse("not-configured");
  const caller = idToken ? emailOfToken(idToken) : null;
  if (!idToken || !caller) return refuse("not-signed-in");
  const request = body && typeof body === "object" ? body : {};
  const mode = request.mode === "test" ? "test" : request.mode === "send" ? "send" : null;
  const draft = toEmailDraft(request);
  const audience = toEmailAudience(request.audience);
  const only = Array.isArray(request.onlyPersonIds) ? request.onlyPersonIds.filter((id) => typeof id === "string") : void 0;
  if (!mode || !draft || mode === "send" && !audience) return refuse("bad-request");
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const as = signedInAs(idToken);
  let persons;
  let groups;
  try {
    persons = await readAll(database, PERSONS, ask, as);
    const me = persons.find((person) => usableEmail(person.email) === caller);
    if (me?.globalRole !== "admin") return refuse("not-admin");
    groups = mode === "send" ? await readAll(database, GROUPS, ask, as) : [];
  } catch (error) {
    const status = error instanceof FirestoreRestError ? error.status : 0;
    if (status === 401) return refuse("not-signed-in");
    if (status === 403 || status === 7) return refuse("not-admin");
    console.error("E-postutsendingen fikk ikke lest registeret:", error instanceof Error ? error.message : error);
    return refuse("database");
  }
  const [settings, record] = await Promise.all([
    readDocument(database, SETTINGS_DOCUMENT, ask, as).catch(() => null),
    readDocument(database, EMAIL_DOCUMENT, ask, as).catch(() => null)
  ]);
  const churchName = typeof settings?.churchName === "string" && settings.churchName.trim() || "Menigheten";
  const replyTo = usableEmail(record?.replyTo);
  if (!replyTo) return refuse("no-reply-to");
  let recipients;
  let withoutEmail = 0;
  if (mode === "test") {
    const me = persons.find((person) => usableEmail(person.email) === caller);
    recipients = [{ email: caller, personIds: me ? [me.id] : [], firstName: firstNameOf(me?.name) }];
  } else {
    const found = emailRecipients(audience, persons, groups, only);
    recipients = found.recipients;
    withoutEmail = found.withoutEmail.length;
    if (recipients.length === 0) return refuse("no-recipients");
  }
  const from = senderOf(churchName, settingOf(env, EMAIL_SETTINGS.from) ?? DEFAULT_FROM_ADDRESS);
  let sent = 0;
  let stopped = null;
  let detail;
  for (let start = 0; start < recipients.length; start += BATCH_SIZE) {
    if (start > 0) await wait(600);
    const batch = recipients.slice(start, start + BATCH_SIZE).map((recipient) => {
      const rendered = renderEmail({ draft, churchName, siteUrl, firstName: recipient.firstName });
      return { from, to: [recipient.email], reply_to: replyTo, subject: rendered.subject, html: rendered.html, text: rendered.text };
    });
    try {
      const response = await ask(SEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch)
      });
      if (!response.ok) {
        const answer = await response.json().catch(() => null);
        stopped = response.status === 429 ? "quota" : "rejected";
        detail = typeof answer?.message === "string" ? answer.message.slice(0, 300) : void 0;
        console.error("E-posttjenesten tok ikke imot utsendingen:", response.status, detail ?? "");
        break;
      }
      sent += batch.length;
    } catch (error) {
      stopped = "unreachable";
      console.error("E-posttjenesten svarte ikke:", error instanceof Error ? error.message : error);
      break;
    }
  }
  const remainingPersonIds = stopped ? recipients.slice(sent).flatMap((recipient) => recipient.personIds) : [];
  return { status: 200, body: { ok: true, mode, sent, withoutEmail, stopped, remainingPersonIds, ...detail ? { detail } : {} } };
}

// server/vercel/epost.ts
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
    if (size > 1e5) return null;
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
    return answer(405, { ok: false, reason: "bad-request", message: "E-post sendes fra admin." });
  }
  const host = first(request.headers["x-forwarded-host"]) || request.headers.host;
  const authorization = first(request.headers.authorization) ?? "";
  const result = await sendEmail({
    env: process.env,
    siteUrl: host ? `https://${host}` : void 0,
    idToken: /^Bearer\s+\S/.test(authorization) ? authorization.replace(/^Bearer\s+/, "").trim() : null,
    body: await bodyOf(request),
    ask: fetch
  });
  answer(result.status, result.body);
}
export {
  handler as default
};
