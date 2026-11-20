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
  leder: { path: "/minside?view=grupper", button: "Åpne gruppene mine", label: "Mine grupper" },
  minside: { path: "/minside", button: "Åpne Min side", label: "Min side" },
  ingen: { path: null, button: "", label: "Ingen knapp" }
};
var EMAIL_SUBJECT_MAX = 120;
var EMAIL_TEXT_MAX = 1e4;
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
    id: "nyhetsbrev",
    label: "Nyhetsbrev",
    audience: { kind: "members" },
    link: "ingen",
    subject: "Nyhetsbrev",
    text: ["## Kjære alle sammen!", "Skriv nyhetsbrevet her.", "## Hva skjer", "- Første punkt\n- Andre punkt"].join("\n\n")
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
  if (typeof draft.link !== "string" || !Object.keys(EMAIL_LINKS).includes(draft.link)) return "Velg hvor knappen i e-posten skal føre.";
  return null;
}
function toEmailDraft(value) {
  if (emailDraftError(value) !== null) return null;
  return { subject: value.subject.trim(), text: value.text.trim().replace(/\r\n/g, "\n"), link: value.link };
}
var escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
var HEADING = /^##\s+(.*)$/;
var POINT = /^[-*]\s+(.*)$/;
function emailBlocksOf(text) {
  const blocks = [];
  let open = null;
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const heading = HEADING.exec(line);
    const point = POINT.exec(line);
    if (line === "") open = null;
    else if (heading) {
      blocks.push({ kind: "heading", text: heading[1].trim() });
      open = null;
    } else if (point) {
      if (open?.kind !== "list") blocks.push(open = { kind: "list", items: [] });
      open.items.push(point[1].trim());
    } else {
      if (open?.kind !== "paragraph") blocks.push(open = { kind: "paragraph", lines: [] });
      open.lines.push(line);
    }
  }
  return blocks;
}
var LINK = /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g;
var BOLD = /\*\*([^*\n]+?)\*\*/g;
var LINK_STYLE = "color:#047857;text-decoration:underline;";
function inlineHtml(line) {
  return escapeHtml(line).replace(LINK, (_, text, url) => `<a href="${url}" style="${LINK_STYLE}">${text}</a>`).replace(BOLD, "<strong>$1</strong>");
}
var inlineText = (line) => line.replace(LINK, (_, text, url) => `${text} (${url.replace(/^mailto:/, "")})`).replace(BOLD, "$1");
var blockHtml = (block) => {
  if (block.kind === "heading") return `<h2 style="margin:22px 0 8px 0;font-size:20px;line-height:26px;color:#0f172a;">${inlineHtml(block.text)}</h2>`;
  if (block.kind === "list") return `<ul style="margin:12px 0;padding-left:22px;">${block.items.map((item) => `<li style="margin:4px 0;">${inlineHtml(item)}</li>`).join("")}</ul>`;
  return `<p style="margin:12px 0;">${block.lines.map(inlineHtml).join("<br>")}</p>`;
};
var blockText = (block) => {
  if (block.kind === "heading") return inlineText(block.text).toLocaleUpperCase("nb");
  if (block.kind === "list") return block.items.map((item) => `- ${inlineText(item)}`).join("\n");
  return block.lines.map(inlineText).join("\n");
};
function renderEmail({ draft, churchName, siteUrl, firstName, newsletter }) {
  const link = EMAIL_LINKS[draft.link];
  const url = link.path ? siteUrl.replace(/\/+$/, "") + link.path : null;
  const greeting = newsletter ? null : firstName ? `Hei ${firstName}!` : "Hei!";
  const closing = newsletter ? null : `Hilsen ${churchName}`;
  const blocks = emailBlocksOf(draft.text);
  const footer = newsletter ? `Du får dette nyhetsbrevet fra ${churchName}.` : `Du får denne e-posten fordi du står i en gruppe i ${churchName}. Du kan svare på den hvis du lurer på noe.`;
  const text = [
    greeting,
    ...blocks.map(blockText),
    url ? `${link.button}: ${url}` : null,
    closing,
    newsletter ? `${footer} Meld deg av: ${newsletter.unsubscribeUrl}` : footer
  ].filter((part) => part !== null).join("\n\n");
  const header = newsletter?.bannerUrl ? `<tr><td style="padding:0;"><img src="${escapeHtml(newsletter.bannerUrl)}" alt="${escapeHtml(churchName)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:16px 16px 0 0;"></td></tr>` : `<tr><td style="padding:24px 28px 8px 28px;font-size:13px;font-weight:bold;color:#047857;">${escapeHtml(churchName)}</td></tr>`;
  const html = `<!doctype html>
<html lang="nb">
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${newsletter ? 600 : 520}px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
${header}
<tr><td style="padding:${newsletter ? "12px" : "0"} 28px 8px 28px;font-size:16px;line-height:24px;">
${greeting ? `<p style="margin:12px 0;">${escapeHtml(greeting)}</p>
` : ""}${blocks.map(blockHtml).join("\n")}
</td></tr>
${url ? `<tr><td style="padding:8px 28px 24px 28px;">
<a href="${escapeHtml(url)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 22px;border-radius:10px;">${escapeHtml(link.button)}</a>
</td></tr>
` : ""}${closing ? `<tr><td style="padding:0 28px 24px 28px;font-size:16px;line-height:24px;">${escapeHtml(closing)}</td></tr>
` : ""}<tr><td style="padding:16px 28px 22px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;">${escapeHtml(footer)}${newsletter ? ` <a href="${escapeHtml(newsletter.unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Meld deg av</a>` : ""}</td></tr>
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
var isNewsletter = (audience) => audience.kind === "members" || audience.kind === "everyone";
var leadersOf = (group) => [...group.leaderIds ?? [], ...group.deputyLeaderIds ?? []];
var everyoneIn = (group) => [...group.memberIds ?? [], ...leadersOf(group)];
function audiencePersonIds(audience, groups, persons) {
  if (audience.kind === "persons") return [];
  if (audience.kind === "members") return persons.filter((person) => person.congregationMember === true).map((person) => person.id);
  if (audience.kind === "everyone") return persons.map((person) => person.id);
  const serviceGroups = groups.filter(isServiceGroup);
  const ids = audience.kind === "leaders" ? serviceGroups.flatMap(leadersOf) : audience.kind === "serviceGroups" ? serviceGroups.flatMap(everyoneIn) : groups.filter((group) => group.id === audience.groupId).flatMap(everyoneIn);
  return [...new Set(ids)];
}
function emailRecipients(audience, persons, groups, onlyPersonIds, optedOutPersonIds2 = /* @__PURE__ */ new Set()) {
  const named = audience.kind === "persons" ? onlyPersonIds ?? [] : audiencePersonIds(audience, groups, persons);
  const only = audience.kind === "persons" || !onlyPersonIds ? null : new Set(onlyPersonIds);
  const wanted = new Set(named.filter((id) => !only || only.has(id)));
  const byAddress = /* @__PURE__ */ new Map();
  const withoutEmail = [];
  for (const person of persons) {
    if (!wanted.has(person.id)) continue;
    const address = usableEmail(person.email);
    if (!address) withoutEmail.push(person);
    else byAddress.set(address, [...byAddress.get(address) ?? [], person]);
  }
  const optedOut = [];
  if (isNewsletter(audience)) {
    const unsubscribed = new Set(persons.filter((person) => optedOutPersonIds2.has(person.id)).map((person) => usableEmail(person.email)));
    for (const [address, people] of byAddress) {
      if (!unsubscribed.has(address)) continue;
      optedOut.push(...people);
      byAddress.delete(address);
    }
  }
  const recipients = [...byAddress.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([email, people]) => ({
    email,
    personIds: people.map((person) => person.id),
    firstName: people.length === 1 ? firstNameOf(people[0].name) : null
  }));
  return { recipients, withoutEmail, optedOut };
}
function firstNameOf(name) {
  const first2 = (name ?? "").trim().split(/\s+/)[0];
  return first2 ? first2 : null;
}
function toEmailAudience(value) {
  if (!value || typeof value !== "object") return null;
  const { kind, groupId } = value;
  if (kind === "leaders" || kind === "serviceGroups" || kind === "members" || kind === "everyone" || kind === "persons") return { kind };
  if (kind === "group" && typeof groupId === "string" && groupId.trim() !== "") return { kind, groupId };
  return null;
}

// src/utils/newsletter.ts
var UNSUBSCRIBE_PATH = "/avmelding";
var TEST_UNSUBSCRIBE_TOKEN = "prove";
var NEWSLETTER_TOKEN = /^[A-Za-z0-9_-]{32}$/;
var isNewsletterToken = (value) => typeof value === "string" && NEWSLETTER_TOKEN.test(value);
var KEY_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function newNewsletterToken(random = (bytes) => globalThis.crypto.getRandomValues(bytes)) {
  return Array.from(random(new Uint8Array(32)), (byte) => KEY_LETTERS[byte % 64]).join("");
}
var unsubscribeUrlOf = (siteUrl, token) => `${siteUrl.replace(/\/+$/, "")}${UNSUBSCRIBE_PATH}/${encodeURIComponent(token)}`;
function optedOutPersonIds(persons, unsubscribedTokens) {
  const tokens = new Set(unsubscribedTokens);
  return new Set(persons.filter((person) => person.newsletterToken !== void 0 && tokens.has(person.newsletterToken)).map((person) => person.id));
}
var NEWSLETTER_BANNER_PATH = "/api/nyhetsbrevbilde";
var NEWSLETTER_BANNER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
function newsletterBannerOf(imageUrl) {
  if (typeof imageUrl !== "string") return null;
  const value = imageUrl.trim();
  const stored = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (stored) return NEWSLETTER_BANNER_TYPES.includes(stored[1]) ? { kind: "stored", contentType: stored[1], base64: stored[2] } : null;
  if (/^https:\/\/[^\s"'<>]+$/.test(value) || /^\/(?!\/)[^\s"'<>]*$/.test(value)) return { kind: "address", url: value };
  return null;
}
var newsletterBannerUrlOf = (siteUrl, version) => `${siteUrl.replace(/\/+$/, "")}${NEWSLETTER_BANNER_PATH}?v=${encodeURIComponent(version)}`;

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
var documentNameOf = ({ projectId, databaseId }, path) => `projects/${projectId}/databases/${databaseId || "(default)"}/documents/${path}`;
async function setTextFields(database, changes, ask, headers = {}) {
  if (changes.length === 0) return;
  const writes = changes.map(({ path, fields }) => ({
    update: { name: documentNameOf(database, path), fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { stringValue: value }])) },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: { exists: true }
  }));
  const response = await ask(`${documentsOf(database)}:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ writes })
  });
  if (!response.ok) throw new FirestoreRestError(`Databasen svarte ${response.status} på skrivingen`, response.status);
}
async function readDocument(database, path, ask, headers) {
  const response = await ask(`${documentsOf(database)}/${path}`, headers ? { headers } : void 0);
  if (!response.ok) return null;
  return decodeDocument(await response.json());
}

// src/utils/birthDate.ts
var DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
var MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
function partsOf(value) {
  const match = (value ?? "").match(DAY);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day } : null;
}
function formatBirthDate(birthDate) {
  const born = partsOf(birthDate);
  return born ? `${born.day}. ${MONTHS[born.month - 1]} ${born.year}` : "";
}

// src/utils/withdrawalAttestation.ts
var escapeXml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function buildWithdrawalAttestationDocx(input) {
  const scope = [
    input.withdrawCongregation ? "menigheten" : null,
    input.withdrawDenomination ? "trossamfunnet" : null
  ].filter(Boolean).join(" og ");
  const birth = input.person.birthDate ? formatBirthDate(input.person.birthDate) : "–";
  const withdrawn = formatBirthDate(input.withdrawalDate);
  const lines = [
    "Utmeldingsattest",
    "",
    input.churchName,
    "",
    `Navn: ${input.person.name}`,
    `Fødselsdato: ${birth}`,
    "",
    `Meldt ut av ${scope} med virkning fra ${withdrawn}.`,
    "",
    "Bekreftelse og attest bør sendes til vedkommende. Brev er sterkt anbefalt.",
    "",
    `Sted, dato: _______________________`,
    "",
    `Signatur protokollansvarlig: _______________________`
  ];
  const body = lines.map(
    (line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
  ).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  return buildDocxZip({
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rels,
    "word/document.xml": documentXml
  });
}
function buildDocxZip(files) {
  const parts = [];
  for (const [name, content] of Object.entries(files)) {
    parts.push({ name, data: new TextEncoder().encode(content) });
  }
  return new Blob([zipStore(parts)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}
function zipStore(files) {
  const chunks = [];
  let offset = 0;
  const central = [];
  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + nameBytes.length + file.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 67324752, true);
    view.setUint16(4, 20, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint32(18, crc, true);
    view.setUint32(22, file.data.length, true);
    view.setUint32(14, file.data.length, true);
    local.set(nameBytes, 30);
    local.set(file.data, 30 + nameBytes.length);
    chunks.push(local);
    offset += local.length;
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cview = new DataView(centralHeader.buffer);
    cview.setUint32(0, 33639248, true);
    cview.setUint16(4, 20, true);
    cview.setUint16(6, 20, true);
    cview.setUint16(28, nameBytes.length, true);
    cview.setUint32(20, crc, true);
    cview.setUint32(24, file.data.length, true);
    cview.setUint32(16, file.data.length, true);
    cview.setUint32(42, offset - local.length, true);
    centralHeader.set(nameBytes, 46);
    central.push(centralHeader);
  }
  const centralSize = central.reduce((n, part) => n + part.length, 0);
  const end = new Uint8Array(22);
  const eview = new DataView(end.buffer);
  eview.setUint32(0, 101010256, true);
  eview.setUint16(8, files.length, true);
  eview.setUint16(10, files.length, true);
  eview.setUint32(12, centralSize, true);
  eview.setUint32(16, offset, true);
  const total = new Uint8Array(offset + centralSize + 22);
  let pos = 0;
  for (const chunk of chunks) {
    total.set(chunk, pos);
    pos += chunk.length;
  }
  for (const chunk of central) {
    total.set(chunk, pos);
    pos += chunk.length;
  }
  total.set(end, pos);
  return total;
}
var CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[i] = c;
  }
  return table;
})();
function crc32(data) {
  let c = 4294967295;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
async function withdrawalAttestationDocxBase64(input) {
  const blob = buildWithdrawalAttestationDocx(input);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
var withdrawalAttestationEmailSubject = (personName) => `Utmeldingsattest – ${personName}`;
function withdrawalAttestationEmailText(churchName) {
  return [
    "Hei,",
    "",
    "Vedlagt følger utmeldingsattest.",
    "",
    "Ta kontakt med menigheten hvis noe skulle være feil.",
    "",
    `Med vennlig hilsen`,
    churchName
  ].join("\n");
}

// server/withdrawalAttestationEmail.ts
var MEMBERSHIP_CLERK_TASKS = "membershipClerkTasks";
var pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function sendWithdrawalAttestationEmail({
  env,
  siteUrl,
  idToken,
  body,
  ask,
  wait = pause
}) {
  const refuse2 = (reason, message, status = 400) => ({ status, body: { ok: false, reason, message } });
  if (readDemoInstallation(env) !== null) {
    return { status: 403, body: { ok: false, reason: "demo", message: "Demoen sender ikke e-post." } };
  }
  const installation = readInstallationConfig(env);
  const apiKey = typeof env[EMAIL_SETTINGS.apiKey] === "string" ? env[EMAIL_SETTINGS.apiKey].trim() : "";
  if (!installation || !apiKey || !siteUrl) {
    return { status: 503, body: { ok: false, reason: "not-configured", message: "E-post er ikke satt opp for denne installasjonen ennå." } };
  }
  const caller = idToken ? emailOfToken(idToken) : null;
  if (!idToken || !caller) {
    return { status: 401, body: { ok: false, reason: "not-signed-in", message: "Du må være logget inn for å sende attest." } };
  }
  const request = body && typeof body === "object" ? body : {};
  const taskId = typeof request.taskId === "string" ? request.taskId.trim() : "";
  if (!taskId) return refuse2("bad-request", "Mangler oppgave å sende for.");
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const as = signedInAs(idToken);
  let task;
  let member;
  try {
    const login = await readDocument(database, `logins/${caller}`, ask, as).catch(() => null);
    const clerkPersonId = typeof login?.personId === "string" ? login.personId : null;
    if (!clerkPersonId) return { status: 401, body: { ok: false, reason: "not-signed-in", message: "Fant ikke innloggingen din." } };
    const clerk = await readDocument(database, `${PERSONS}/${clerkPersonId}`, ask, as);
    if (!clerk) return refuse2("bad-request", "Fant ikke deg i registeret.");
    const maySend = clerk.globalRole === "admin" || clerk.membershipClerk === true;
    if (!maySend) {
      return {
        status: 403,
        body: { ok: false, reason: "not-admin", message: "Bare protokollansvarlig eller administrator kan sende attest." }
      };
    }
    const rawTask = await readDocument(database, `${MEMBERSHIP_CLERK_TASKS}/${taskId}`, ask, as);
    if (!rawTask) return refuse2("bad-request", "Fant ikke oppgaven.");
    task = rawTask;
    if (task.kind !== "withdrawal" || task.status !== "open") return refuse2("bad-request", "Oppgaven er ikke en åpen utmelding.");
    if (task.cornerstoneUpdated !== true) return refuse2("bad-request", "Bekreft at Cornerstone er oppdatert først.");
    if (task.attestationEmailedAt) return refuse2("bad-request", "Attest er allerede sendt på e-post.");
    member = await readDocument(database, `${PERSONS}/${task.personId}`, ask, as) ?? void 0;
    if (!member) return refuse2("bad-request", "Fant ikke personen.");
  } catch (error) {
    const status = error instanceof FirestoreRestError ? error.status : 0;
    if (status === 401 || status === 403) {
      return { status, body: { ok: false, reason: status === 401 ? "not-signed-in" : "not-admin", message: "Ingen tilgang." } };
    }
    console.error("Utmeldingsattest fikk ikke lest databasen:", error instanceof Error ? error.message : error);
    return { status: 502, body: { ok: false, reason: "database", message: "Registeret kunne ikke leses akkurat nå. Prøv igjen." } };
  }
  const to = usableEmail(member.email);
  if (!to) return refuse2("no-recipients", "Personen har ingen e-postadresse i registeret.");
  const [settings, record] = await Promise.all([
    readDocument(database, SETTINGS_DOCUMENT, ask, as).catch(() => null),
    readDocument(database, EMAIL_DOCUMENT, ask, as).catch(() => null)
  ]);
  const churchName = typeof settings?.churchName === "string" && settings.churchName.trim() || "Menigheten";
  const replyTo = usableEmail(record?.replyTo) ?? usableEmail(typeof settings?.email === "string" ? settings.email : void 0);
  if (!replyTo) {
    return {
      status: 400,
      body: { ok: false, reason: "no-reply-to", message: "Legg inn svaradresse under Send e-post før du sender attest." }
    };
  }
  const attestationInput = {
    churchName,
    person: { name: task.personName, birthDate: member.birthDate },
    withdrawCongregation: task.withdrawCongregation === true,
    withdrawDenomination: task.withdrawDenomination === true,
    withdrawalDate: task.withdrawalDate ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
  };
  let attachmentBase64;
  try {
    attachmentBase64 = await withdrawalAttestationDocxBase64(attestationInput);
  } catch (error) {
    console.error("Kunne ikke lage attest:", error instanceof Error ? error.message : error);
    return { status: 500, body: { ok: false, reason: "unreachable", message: "Attesten kunne ikke lages." } };
  }
  const fromAddress = typeof env[EMAIL_SETTINGS.from] === "string" && env[EMAIL_SETTINGS.from].trim() || DEFAULT_FROM_ADDRESS;
  const from = senderOf(churchName, fromAddress);
  const subject = withdrawalAttestationEmailSubject(task.personName);
  const text = withdrawalAttestationEmailText(churchName);
  const filename = `utmeldingsattest-${task.personName.replace(/\s+/g, "-")}.docx`;
  const payload = {
    from,
    to: [to],
    cc: [replyTo],
    reply_to: replyTo,
    subject,
    text,
    attachments: [{ filename, content: attachmentBase64 }]
  };
  await wait(0);
  try {
    const response = await ask(SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify([payload])
    });
    if (!response.ok) {
      const answer = await response.json().catch(() => null);
      const detail = typeof answer?.message === "string" ? answer.message.slice(0, 300) : void 0;
      console.error("E-posttjenesten tok ikke imot utmeldingsattest:", response.status, detail ?? "");
      return {
        status: 200,
        body: {
          ok: false,
          reason: "unreachable",
          message: detail ? `E-posten ble ikke sendt: ${detail}` : "E-posten ble ikke sendt. Prøv igjen."
        }
      };
    }
  } catch (error) {
    console.error("E-posttjenesten svarte ikke på utmeldingsattest:", error instanceof Error ? error.message : error);
    return { status: 200, body: { ok: false, reason: "unreachable", message: "Fikk ikke kontakt med e-postutsendingen." } };
  }
  return {
    status: 200,
    body: { ok: true, mode: "send", sent: 1, withoutEmail: 0, to, copyTo: replyTo }
  };
}

// server/emailSending.ts
var PERSONS = "persons";
var GROUPS = "groups";
var SETTINGS_DOCUMENT = "cms_settings/global";
var EMAIL_DOCUMENT = "cms_settings/email";
var NEWSLETTER_BANNER_DOCUMENT = "cms_settings/newsletter-banner";
var NEWSLETTER_BANNER_RECORD = "newsletterBanner";
var NEWSLETTER_OPT_OUTS = "newsletterOptOuts";
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
  database: [502, "Registeret kunne ikke leses akkurat nå. Prøv igjen."],
  "rules-outdated": [409, "Databasen har ikke fått reglene for nyhetsbrev ennå. Lim inn de nye reglene i Firebase, og prøv igjen."]
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
    if (payload.email_verified !== true) return null;
    return usableEmail(payload.email);
  } catch {
    return null;
  }
}
function senderOf(churchName, address) {
  const name = churchName.replace(/["<>\r\n]/g, "").trim();
  return name ? `"${name}" <${address}>` : address;
}
var pause2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function sendEmail({ env, siteUrl, idToken, body, ask, wait = pause2 }) {
  if (readDemoInstallation(env) !== null) return refuse("demo");
  const installation = readInstallationConfig(env);
  const apiKey = settingOf(env, EMAIL_SETTINGS.apiKey);
  if (!installation || !apiKey || !siteUrl) return refuse("not-configured");
  const caller = idToken ? emailOfToken(idToken) : null;
  if (!idToken || !caller) return refuse("not-signed-in");
  const request = body && typeof body === "object" ? body : {};
  if (request.mode === "withdrawalAttestation") {
    return sendWithdrawalAttestationEmail({ env, siteUrl, idToken, body: request, ask, wait });
  }
  const mode = request.mode === "test" ? "test" : request.mode === "send" ? "send" : null;
  const draft = toEmailDraft(request);
  const audience = toEmailAudience(request.audience);
  const newsletter = audience !== null && isNewsletter(audience);
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
  let unsubscribed = /* @__PURE__ */ new Set();
  let bannerUrl = null;
  if (newsletter) {
    try {
      const optOuts = mode === "send" ? await readAll(database, NEWSLETTER_OPT_OUTS, ask, as) : [];
      unsubscribed = optedOutPersonIds(persons, optOuts.map((optOut) => optOut.id));
    } catch (error) {
      const status = error instanceof FirestoreRestError ? error.status : 0;
      if (status === 403 || status === 7) return refuse("rules-outdated");
      console.error("Nyhetsbrevet fikk ikke lest hvem som har meldt seg av:", error instanceof Error ? error.message : error);
      return refuse("database");
    }
    const banner = await readDocument(database, NEWSLETTER_BANNER_DOCUMENT, ask, as).catch(() => null);
    if (banner?.recordType === NEWSLETTER_BANNER_RECORD && newsletterBannerOf(banner.imageUrl)) {
      bannerUrl = newsletterBannerUrlOf(siteUrl, typeof banner.updatedAt === "string" ? banner.updatedAt : "1");
    }
  }
  let recipients;
  let withoutEmail = 0;
  if (mode === "test") {
    const me = persons.find((person) => usableEmail(person.email) === caller);
    recipients = [{ email: caller, personIds: me ? [me.id] : [], firstName: firstNameOf(me?.name) }];
  } else {
    const found = emailRecipients(audience, persons, groups, only, unsubscribed);
    recipients = found.recipients;
    withoutEmail = found.withoutEmail.length;
    if (recipients.length === 0) return refuse("no-recipients");
  }
  const tokens = /* @__PURE__ */ new Map();
  if (newsletter) {
    const byId = new Map(persons.map((person) => [person.id, person]));
    const missing = [];
    for (const recipient of recipients) {
      if (mode === "test") {
        tokens.set(recipient.email, TEST_UNSUBSCRIBE_TOKEN);
        continue;
      }
      const owner = recipient.personIds.map((id) => byId.get(id)).find((person) => isNewsletterToken(person?.newsletterToken));
      const token = owner?.newsletterToken ?? newNewsletterToken();
      if (!owner) missing.push({ path: `${PERSONS}/${recipient.personIds[0]}`, fields: { newsletterToken: token } });
      tokens.set(recipient.email, token);
    }
    try {
      for (let start = 0; start < missing.length; start += 400) await setTextFields(database, missing.slice(start, start + 400), ask, as);
    } catch (error) {
      console.error("Nyhetsbrevet fikk ikke lagret lenkene til avmelding:", error instanceof Error ? error.message : error);
      return refuse("database");
    }
  }
  const from = senderOf(churchName, settingOf(env, EMAIL_SETTINGS.from) ?? DEFAULT_FROM_ADDRESS);
  let sent = 0;
  let stopped = null;
  let detail;
  for (let start = 0; start < recipients.length; start += BATCH_SIZE) {
    if (start > 0) await wait(600);
    const batch = recipients.slice(start, start + BATCH_SIZE).map((recipient) => {
      const unsubscribeUrl = newsletter ? unsubscribeUrlOf(siteUrl, tokens.get(recipient.email)) : null;
      const rendered = renderEmail({ draft, churchName, siteUrl, firstName: recipient.firstName, ...unsubscribeUrl ? { newsletter: { unsubscribeUrl, bannerUrl } } : {} });
      return {
        from,
        to: [recipient.email],
        reply_to: replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } } : {}
      };
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
