// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { daysAfter, formatLoginLinkUntil, loginLinkEndSeconds } from "../src/utils/loginLink";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BATCH_SIZE, DEFAULT_FROM_ADDRESS, EMAIL_DOCUMENT, GROUPS, PERSONS, SEND_URL, SETTINGS_DOCUMENT, emailOfToken, sendEmail, senderOf } from "../server/emailSending";
import type { Fetch, RestFields, RestValue } from "../server/firestoreRest";
import { readLoginToken } from "../server/loginLinkToken";
import { readServiceAccount } from "../server/serviceAccount";
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID, COLLECTIONS } from "../src/data/collections";
import { EMAIL_DOC_ID, EMAIL_RECORD } from "../src/data/settingsRecords";
import { EMAIL_TEMPLATES, emailButtonUrl, emailDraftError, isPlanIdText, renderEmail, toEmailDraft } from "../src/utils/emailMessage";
import { semesterPlanPath } from "../src/utils/semesterPlan";
import { emailRecordOf, recentSameSending, stopMessage, withLogEntry, withRestSent, type EmailLogEntry, type EmailOutcome, type EmailRecord } from "../src/utils/emailOutcome";
import { audienceKey, audienceLabel, emailRecipients, isNewsletter, toEmailAudience, usableEmail } from "../src/utils/emailRecipients";
import type { Group, Person } from "../src/types";
import { TEST_UNSUBSCRIBE_TOKEN } from "../src/utils/newsletter";

// E-mail from the administration to leaders and volunteers. Every person here is made up.

const person = (id: string, name: string, email?: string, globalRole: Person["globalRole"] = "member"): Person => ({ id, name, email, globalRole });
const group = (id: string, name: string, category: Group["category"], leaderIds: string[], memberIds: string[], deputyLeaderIds: string[] = []): Group => ({ id, name, category, leaderIds, memberIds, deputyLeaderIds });

const persons: Person[] = [
  person("admin", "Astrid Admin", "astrid@example.org", "admin"),
  person("leder", "Lars Leder", "Lars@Example.org"),
  person("nest", "Nora Nestleder", "nora@example.org"),
  person("frivillig", "Frida Frivillig", "frida@example.org"),
  person("uten", "Ulf Uten"),
  person("feil", "Finn Feil", "finn(at)example.org"),
  person("ektefelle-1", "Else Delt", "familien@example.org"),
  person("ektefelle-2", "Erik Delt", "familien@example.org"),
  person("husgruppe", "Hanne Hus", "hanne@example.org"),
  person("utenfor", "Ole Utenfor", "ole@example.org"),
];
const groups: Group[] = [
  group("lyd", "Lyd og bilde", "tjenestegruppe", ["leder"], ["frivillig", "uten", "ektefelle-1", "ektefelle-2"], ["nest"]),
  // No category is a service group, as everywhere else in the app
  group("vert", "Møtevert", undefined, ["leder"], ["feil", "frivillig"]),
  group("hus", "Husgruppe øst", "husgruppe", ["husgruppe"], ["frivillig"]),
];

describe("Hvem en e-post går til", () => {
  test("lederne er ledere og nestledere i tjenestegruppene, hver én gang", () => {
    const { recipients, withoutEmail } = emailRecipients({ kind: "leaders" }, persons, groups);
    expect(recipients.map((recipient) => recipient.email)).toEqual(["lars@example.org", "nora@example.org"]);
    expect(recipients[0]).toEqual({ email: "lars@example.org", personIds: ["leder"], firstName: "Lars" });
    expect(withoutEmail).toEqual([]);
  });

  test("alle i tjenestegruppene får én e-post per adresse, og de uten brukbar adresse nevnes", () => {
    const { recipients, withoutEmail } = emailRecipients({ kind: "serviceGroups" }, persons, groups);
    expect(recipients.map((recipient) => recipient.email)).toEqual(["familien@example.org", "frida@example.org", "lars@example.org", "nora@example.org"]);
    // A shared address is greeted by nobody's name
    expect(recipients[0]).toEqual({ email: "familien@example.org", personIds: ["ektefelle-1", "ektefelle-2"], firstName: null });
    expect(withoutEmail.map((one) => one.id)).toEqual(["uten", "feil"]);
    // The leader of a house group, and someone in no group, get nothing
    expect(recipients.some((recipient) => ["hanne@example.org", "ole@example.org"].includes(recipient.email))).toBe(false);
  });

  test("én gruppe er alle i den gruppa, også når den ikke er en tjenestegruppe", () => {
    expect(emailRecipients({ kind: "group", groupId: "hus" }, persons, groups).recipients.map((recipient) => recipient.email)).toEqual(["frida@example.org", "hanne@example.org"]);
    expect(emailRecipients({ kind: "group", groupId: "finnes-ikke" }, persons, groups).recipients).toEqual([]);
  });

  test("de som gjenstår etter en stoppet utsending, er bare dem av mottakerne som er nevnt", () => {
    const rest = emailRecipients({ kind: "serviceGroups" }, persons, groups, ["nest", "utenfor", "ektefelle-2"]);
    expect(rest.recipients.map((recipient) => recipient.email)).toEqual(["familien@example.org", "nora@example.org"]);
  });

  test("personer som er nevnt, og ingen andre: e-post til alle på et arrangement, som ikke er et nyhetsbrev", () => {
    const named = emailRecipients({ kind: "persons" }, persons, groups, ["frivillig", "uten", "ektefelle-1", "finnes-ikke"]);
    expect(named.recipients.map((recipient) => recipient.email)).toEqual(["familien@example.org", "frida@example.org"]);
    expect(named.withoutEmail.map((one) => one.id)).toEqual(["uten"]);
    // Without a list, nobody: a «persons» audience is never the whole register
    expect(emailRecipients({ kind: "persons" }, persons, groups).recipients).toEqual([]);
    expect(toEmailAudience({ kind: "persons" })).toEqual({ kind: "persons" });
    expect(isNewsletter({ kind: "persons" })).toBe(false);
    expect(audienceLabel({ kind: "persons" }, groups)).toBe("Valgte personer");
  });

  test("adresser og mottakergrupper leses uten å stole på dem", () => {
    expect(usableEmail("  Kari@Example.ORG ")).toBe("kari@example.org");
    for (const wrong of ["", "kari", "kari@", "kari@example", "a b@example.org", "kari@example.org, ola@example.org", undefined, 7]) expect(usableEmail(wrong)).toBeNull();
    expect(toEmailAudience({ kind: "leaders" })).toEqual({ kind: "leaders" });
    expect(toEmailAudience({ kind: "group", groupId: "lyd", annet: 1 })).toEqual({ kind: "group", groupId: "lyd" });
    for (const wrong of [null, "leaders", { kind: "alle" }, { kind: "group" }, { kind: "group", groupId: " " }]) expect(toEmailAudience(wrong)).toBeNull();
    expect(audienceLabel({ kind: "group", groupId: "lyd" }, groups)).toBe("Lyd og bilde");
    expect(audienceKey({ kind: "group", groupId: "lyd" })).toBe("group:lyd");
  });
});

describe("E-posten slik den sendes", () => {
  const draft = { subject: "Nytt semester", text: "Første avsnitt.\n\nAndre <b>avsnitt</b> & mer\nmed linjeskift.", link: "leder" as const };

  test("de ferdige tekstene kan sendes som de står: til lederne, til de frivillige og som nyhetsbrev til medlemmene", () => {
    expect(EMAIL_TEMPLATES.map((template) => [template.audience.kind, template.link])).toEqual([
      ["leaders", "leder"],
      ["serviceGroups", "minside"],
      ["serviceGroups", "semesterplan"],
      ["members", "ingen"],
    ]);
    // The semester plan's template has no plan: the page fills it in, so one is given here
    for (const template of EMAIL_TEMPLATES) expect(emailDraftError({ planId: "semesterplan-1", ...template })).toBeNull();
  });

  test("hilsen, knapp og avsender legges til, og det som er skrevet, leses aldri som HTML", () => {
    const mail = renderEmail({ draft, churchName: "Fjellbygda menighet", siteUrl: "https://menigheten.example/", firstName: "Lars" });
    expect(mail.subject).toBe("Nytt semester");
    expect(mail.text.split("\n\n")[0]).toBe("Hei Lars!");
    expect(mail.text).toContain("Åpne gruppene mine: https://menigheten.example/minside?view=grupper");
    expect(mail.text).toContain("Hilsen Fjellbygda menighet");
    expect(mail.html).toContain('href="https://menigheten.example/minside?view=grupper"');
    expect(mail.html).toContain("Andre &lt;b&gt;avsnitt&lt;/b&gt; &amp; mer<br>med linjeskift.");
    expect(mail.html).not.toContain("<b>avsnitt");
    expect(renderEmail({ draft: { ...draft, link: "minside" }, churchName: "M", siteUrl: "https://m.example", firstName: null }).text).toMatch(/^Hei!\n\n[\s\S]*Åpne Min side: https:\/\/m\.example\/minside/);
  });

  test("et utkast uten emne eller tekst, eller med et emne over flere linjer, kan ikke sendes", () => {
    expect(emailDraftError({ ...draft, subject: " " })).toBe("E-posten må ha et emne.");
    expect(emailDraftError({ ...draft, subject: "En\nBcc: noen@example.org" })).toBe("Emnet kan ikke gå over flere linjer.");
    expect(emailDraftError({ ...draft, text: "" })).toBe("E-posten må ha en tekst.");
    expect(emailDraftError({ ...draft, link: "admin" })).toBe("Velg hvor knappen i e-posten skal føre.");
    expect(emailDraftError({ ...draft, subject: "x".repeat(121) })).toMatch(/lengre enn 120/);
    expect(toEmailDraft({ subject: " Emne ", text: " Tekst\r\nher ", link: "minside" })).toEqual({ subject: "Emne", text: "Tekst\nher", link: "minside" });
    expect(toEmailDraft({ subject: "", text: "x", link: "minside" })).toBeNull();
  });
});

// ---------- Where the e-mail is sent ----------

const env = {
  VITE_FIREBASE_API_KEY: "nokkel",
  VITE_FIREBASE_AUTH_DOMAIN: "menigheten.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "menigheten",
  VITE_FIREBASE_APP_ID: "app",
  RESEND_API_KEY: "re_hemmelig",
};
const tokenFor = (email: string) => `hode.${Buffer.from(JSON.stringify({ email, email_verified: true })).toString("base64url")}.signatur`;

const encode = (value: unknown): RestValue => {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === "object") return { mapValue: { fields: fieldsOf(value) } };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { nullValue: null };
};
const fieldsOf = (data: object): RestFields => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, encode(value)]));
const rowsOf = (collection: string, items: { id: string }[]) => items.map((item) => ({ document: { name: `projects/menigheten/databases/(default)/documents/${collection}/${item.id}`, fields: fieldsOf(item) } }));

interface World {
  persons?: Person[];
  groups?: Group[];
  replyTo?: string | null;
  /** What the database answers someone who is not an administrator with. */
  refusePersons?: number;
  /** What the e-mail service answers each request with: a status, or "down". */
  mail?: (number | "down")[];
  /** The semester plans the database has, by id. Any other cms_settings document is not a plan. */
  plans?: string[];
}

/** A database and an e-mail service that remember what they were asked. */
const world = ({ persons: people = persons, groups: all = groups, replyTo = "post@example.org", refusePersons, mail = [], plans: planIds = [] }: World = {}) => {
  const asked: { url: string; headers?: Record<string, string>; body?: unknown }[] = [];
  const mails: { from: string; to: string[]; reply_to: string; subject: string; html: string; text: string }[][] = [];
  const ask: Fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    asked.push({ url, headers: init?.headers, body });
    if (url === SEND_URL) {
      const answer = mail[mails.length] ?? 200;
      mails.push(body);
      if (answer === "down") throw new Error("ECONNRESET");
      return answer === 200
        ? { ok: true, status: 200, json: async () => ({ data: body.map((_: unknown, index: number) => ({ id: `e-${index}` })) }) }
        : { ok: false, status: answer, json: async () => ({ statusCode: answer, name: "daily_quota_exceeded", message: "You have reached your daily email sending quota." }) };
    }
    if (url.endsWith(":runQuery")) {
      const collection = body.structuredQuery.from[0].collectionId as string;
      if (collection === PERSONS && refusePersons) return { ok: false, status: refusePersons, json: async () => [{ error: { code: refusePersons } }] };
      return { ok: true, status: 200, json: async () => rowsOf(collection, collection === PERSONS ? people : all) };
    }
    if (planIds.some((id) => url.endsWith(`/${CMS_COLLECTIONS.SETTINGS}/${id}`))) return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ recordType: "semesterPlan", name: "Våren 2027" }) }) };
    if (url.endsWith(`/${EMAIL_DOCUMENT}`)) return replyTo ? { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ recordType: "email", replyTo }) }) } : { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ name: url, fields: fieldsOf({ churchName: "Fjellbygda menighet" }) }) };
  };
  return { ask, asked, mails, sentTo: () => mails.flat().map((mail) => mail.to[0]) };
};

const template = EMAIL_TEMPLATES[0];
const request = (extra: object = {}) => ({ mode: "send", audience: { kind: "leaders" }, subject: template.subject, text: template.text, link: template.link, ...extra });
const send = (place: ReturnType<typeof world>, body: unknown, more: Partial<Parameters<typeof sendEmail>[0]> = {}) =>
  sendEmail({ env, siteUrl: "https://menigheten.example", idToken: tokenFor("astrid@example.org"), body, ask: place.ask, wait: async () => undefined, ...more });

describe("Utsendingen der installasjonen kjører", () => {
  beforeEach(() => vi.stubGlobal("console", { ...console, error: vi.fn() }));
  afterEach(() => vi.unstubAllGlobals());

  test("navnene er de samme som appen bruker", () => {
    expect(PERSONS).toBe(COLLECTIONS.PERSONS);
    expect(GROUPS).toBe(COLLECTIONS.GROUPS);
    expect(SETTINGS_DOCUMENT).toBe(`${CMS_COLLECTIONS.SETTINGS}/${CMS_SETTINGS_DOC_ID}`);
    expect(EMAIL_DOCUMENT).toBe(`${CMS_COLLECTIONS.SETTINGS}/${EMAIL_DOC_ID}`);
    expect(EMAIL_RECORD).toBe("email");
  });

  test("en administrator sender til lederne: én e-post hver, fra menigheten, med svar til menighetens adresse", async () => {
    const place = world();
    const { status, body } = await send(place, request());
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, mode: "send", sent: 2, withoutEmail: 0, stopped: null, remainingPersonIds: [], loginLinks: 0 });

    expect(place.mails).toHaveLength(1);
    expect(place.sentTo()).toEqual(["lars@example.org", "nora@example.org"]);
    const [first] = place.mails[0];
    expect(first.from).toBe(`"Fjellbygda menighet" <${DEFAULT_FROM_ADDRESS}>`);
    expect(first.reply_to).toBe("post@example.org");
    expect(first.to).toEqual(["lars@example.org"]);
    expect(first.text).toContain("Hei Lars!");
    expect(first.html).toContain('href="https://menigheten.example/minside?view=grupper"');

    // The register is read as the one who asks, and the key goes only to the e-mail service
    const database = place.asked.filter((question) => question.url.includes("firestore.googleapis.com"));
    expect(database.every((question) => question.headers?.Authorization === `Bearer ${tokenFor("astrid@example.org")}`)).toBe(true);
    expect(JSON.stringify(database)).not.toContain("re_hemmelig");
    expect(place.asked.find((question) => question.url === SEND_URL)?.headers?.Authorization).toBe("Bearer re_hemmelig");
  });

  test("nettleseren kan ikke si hvem e-posten skal til: adresser i forespørselen brukes ikke", async () => {
    const place = world();
    await send(place, request({ to: ["fremmed@example.com"], recipients: ["fremmed@example.com"], replyTo: "fremmed@example.com", from: "fremmed@example.com" }));
    expect(JSON.stringify(place.mails)).not.toContain("fremmed@example.com");
  });

  test("prøven går bare til den som ber om den", async () => {
    const place = world();
    const { body } = await send(place, { mode: "test", subject: "Prøve", text: "Hei", link: "minside" });
    expect(body).toMatchObject({ ok: true, mode: "test", sent: 1 });
    expect(place.sentTo()).toEqual(["astrid@example.org"]);
    expect(place.mails[0][0].text).toContain("Hei Astrid!");
  });

  test("prøven kan gå til en annen adresse, som er den eneste som får den, og hilses med fornavn bare når den står i registeret", async () => {
    const outside = world();
    const { body } = await send(outside, { mode: "test", subject: "Prøve", text: "Hei", link: "minside", to: " Kari@Example.org " });
    expect(body).toMatchObject({ ok: true, mode: "test", sent: 1, stopped: null });
    expect(outside.sentTo()).toEqual(["kari@example.org"]);
    expect(outside.mails[0][0].to).toEqual(["kari@example.org"]);
    expect(outside.mails[0][0].text).toMatch(/^Hei!\n/);

    const inside = world();
    await send(inside, { mode: "test", subject: "Prøve", text: "Hei", link: "minside", to: "frida@example.org" });
    expect(inside.sentTo()).toEqual(["frida@example.org"]);
    expect(inside.mails[0][0].text).toMatch(/^Hei Frida!\n/);

    // An administrator's own test to someone else's address is still an administrator's test: the one who asks must be admin
    const notAdmin = world();
    expect((await send(notAdmin, { mode: "test", subject: "Prøve", text: "Hei", link: "minside", to: "kari@example.org" }, { idToken: tokenFor("lars@example.org") })).status).toBe(403);
    expect(notAdmin.mails).toEqual([]);
  });

  test("en prøve til en adresse som ikke er brukbar, sendes ikke, og registeret leses ikke", async () => {
    const place = world();
    for (const to of ["", "ikke en adresse", "kari@example.org, ola@example.org", 7, null]) {
      expect((await send(place, { mode: "test", subject: "Prøve", text: "Hei", link: "minside", to })).body).toMatchObject({ ok: false, reason: "bad-request" });
    }
    expect(place.asked).toEqual([]);
    expect(place.mails).toEqual([]);
  });

  test("en prøve til en annen adresse, til et nyhetsbrev, får avmeldingslenken for prøver", async () => {
    const place = world();
    await send(place, { mode: "test", audience: { kind: "members" }, subject: "Nyhetsbrev", text: "Hei alle", link: "ingen", to: "kari@example.org" });
    expect(place.sentTo()).toEqual(["kari@example.org"]);
    expect(place.mails[0][0]).toMatchObject({ headers: { "List-Unsubscribe": expect.stringContaining(TEST_UNSUBSCRIBE_TOKEN) } });
  });

  test("den som ikke er administrator, får nei, og ingenting sendes", async () => {
    // The database refuses to list the register for anyone but an administrator
    const refused = world({ refusePersons: 403 });
    expect((await send(refused, request(), { idToken: tokenFor("lars@example.org") })).body).toMatchObject({ ok: false, reason: "not-admin" });
    expect(refused.mails).toEqual([]);

    // And were the register open, the one who asks must still stand in it as an administrator
    const open = world();
    expect((await send(open, request(), { idToken: tokenFor("lars@example.org") })).status).toBe(403);
    expect((await send(open, request(), { idToken: tokenFor("fremmed@example.com") })).status).toBe(403);
    expect(open.mails).toEqual([]);

    const expired = world({ refusePersons: 401 });
    expect((await send(expired, request())).body).toMatchObject({ ok: false, reason: "not-signed-in" });
    for (const idToken of [null, "", "ikke-et-token", "a.b.c"]) expect((await send(world(), request(), { idToken })).status).toBe(401);
  });

  test("demoen sender aldri, og en installasjon uten nøkkel sier at e-post ikke er satt opp", async () => {
    const place = world();
    expect((await send(place, request(), { env: { ...env, VITE_DEMO: "true" } })).body).toMatchObject({ ok: false, reason: "demo" });
    expect((await send(place, request(), { env: { ...env, RESEND_API_KEY: "" } })).body).toMatchObject({ ok: false, reason: "not-configured" });
    expect((await send(place, request(), { siteUrl: undefined })).status).toBe(503);
    expect(place.asked).toEqual([]);
  });

  test("uten svaradresse, uten mottakere eller med et utkast som ikke holder, sendes ingenting", async () => {
    const noReply = world({ replyTo: null });
    expect((await send(noReply, request())).body).toMatchObject({ ok: false, reason: "no-reply-to" });
    const nobody = world();
    expect((await send(nobody, request({ audience: { kind: "group", groupId: "finnes-ikke" } }))).body).toMatchObject({ ok: false, reason: "no-recipients" });
    const bad = world();
    for (const body of [null, "tekst", request({ mode: "alle" }), request({ subject: "" }), request({ audience: { kind: "hele-registeret" } }), request({ subject: "A\nBcc: x@example.org" })]) {
      expect((await send(bad, body)).body).toMatchObject({ ok: false, reason: "bad-request" });
    }
    expect([...noReply.mails, ...nobody.mails, ...bad.mails]).toEqual([]);
  });

  test("til bestemte personer går e-posten bare til dem som er nevnt, uten avmelding og banner", async () => {
    const place = world();
    const { body } = await send(place, request({ audience: { kind: "persons" }, onlyPersonIds: ["frivillig", "uten", "ole-finnes-ikke"] }));
    expect(body).toMatchObject({ ok: true, mode: "send", sent: 1, withoutEmail: 1, stopped: null });
    expect(place.sentTo()).toEqual(["frida@example.org"]);
    expect("headers" in place.mails[0][0]).toBe(false);

    // Nobody named: nothing is sent, and the whole register is not
    const none = world();
    expect((await send(none, request({ audience: { kind: "persons" } }))).body).toMatchObject({ ok: false, reason: "no-recipients" });
    expect(none.mails).toHaveLength(0);
  });

  test("mange mottakere sendes i bolker, og stopper tjenesten, sies det hvem som gjenstår", async () => {
    const many = Array.from({ length: BATCH_SIZE + 30 }, (_, index) => person(`p${String(index).padStart(3, "0")}`, `Person ${index}`, `p${String(index).padStart(3, "0")}@example.org`));
    const everyone = [persons[0], ...many];
    const big = [group("stor", "Stor gruppe", "tjenestegruppe", [], many.map((one) => one.id))];
    const waits: number[] = [];

    const fine = world({ persons: everyone, groups: big });
    const whole = await send(fine, request({ audience: { kind: "serviceGroups" } }), { wait: async (ms) => void waits.push(ms) });
    expect(whole.body).toMatchObject({ ok: true, sent: BATCH_SIZE + 30, stopped: null, remainingPersonIds: [] });
    expect(fine.mails.map((batch) => batch.length)).toEqual([BATCH_SIZE, 30]);
    expect(waits).toEqual([600]);

    const full = world({ persons: everyone, groups: big, mail: [200, 429] });
    const half = (await send(full, request({ audience: { kind: "serviceGroups" } }))).body as Extract<EmailOutcome, { ok: true }>;
    expect(half).toMatchObject({ ok: true, sent: BATCH_SIZE, stopped: "quota", detail: "You have reached your daily email sending quota." });
    expect(half.remainingPersonIds).toEqual(many.slice(BATCH_SIZE).map((one) => one.id));

    // The day after: only those who are left get it
    const after = world({ persons: everyone, groups: big });
    const rest = await send(after, request({ audience: { kind: "serviceGroups" }, onlyPersonIds: half.remainingPersonIds }));
    expect(rest.body).toMatchObject({ ok: true, sent: 30 });
    expect(after.sentTo()).toEqual(many.slice(BATCH_SIZE).map((one) => one.email));

    const down = world({ mail: ["down"] });
    expect((await send(down, request())).body).toMatchObject({ ok: true, sent: 0, stopped: "unreachable", remainingPersonIds: ["leder", "nest"] });
  });

  test("adressen leses av tokenet, og avsenderen tåler et navn med tegn som ikke hører hjemme der", () => {
    expect(emailOfToken(tokenFor("Astrid@Example.org"))).toBe("astrid@example.org");
    expect(emailOfToken("tull")).toBeNull();
    // An account made with someone else's address, never confirmed, is nobody
    const unconfirmed = `hode.${Buffer.from(JSON.stringify({ email: "astrid@example.org", email_verified: false })).toString("base64url")}.signatur`;
    expect(emailOfToken(unconfirmed)).toBeNull();
    expect(emailOfToken(`hode.${Buffer.from(JSON.stringify({ email: "astrid@example.org" })).toString("base64url")}.signatur`)).toBeNull();
    expect(senderOf('Kirken "på" <haugen>', "ikke-svar@example.org")).toBe('"Kirken på haugen" <ikke-svar@example.org>');
    expect(senderOf("", "ikke-svar@example.org")).toBe("ikke-svar@example.org");
  });

  // That api/epost.js is packed from the source as it is now, is tested in tests/public-calendar-function.test.ts
  test("nøkkelen leses bare der funksjonen kjører, og ingenting av Firebase-klienten er pakket inn", () => {
    const packed = readFileSync("api/epost.js", "utf8");
    expect(packed).not.toContain("firebase/");
    expect(packed).toContain("RESEND_API_KEY");
    expect(readFileSync("src/services/email.ts", "utf8")).not.toContain("RESEND");
  });
});

// ---------- The log ----------

describe("Loggen over det som er sendt", () => {
  const entry = (id: string, sentAt: string, more: Partial<EmailLogEntry> = {}): EmailLogEntry => ({
    id,
    sentAt,
    audience: { kind: "leaders" },
    audienceLabel: "Ledere og nestledere i tjenestegruppene",
    subject: "Nytt semester",
    sent: 4,
    withoutEmail: 0,
    stopped: null,
    remainingPersonIds: [],
    ...more,
  });
  const now = new Date("2026-10-14T12:00:00.000Z");

  test("det som er lagret, leses uten å stole på det", () => {
    expect(emailRecordOf(undefined)).toEqual({ replyTo: "", log: [] });
    const good = entry("a", "2026-10-14T08:00:00.000Z");
    const record = emailRecordOf({ replyTo: " Post@Example.org ", log: [good, { id: "b" }, null, { ...good, id: "c", audience: { kind: "alle" } }, { ...good, id: "d", stopped: "tull", sent: -3 }] });
    expect(record.replyTo).toBe("post@example.org");
    expect(record.log.map((one) => one.id)).toEqual(["a", "d"]);
    expect(record.log[1]).toMatchObject({ stopped: null, sent: 0 });
    expect(emailRecordOf({ replyTo: "ikke en adresse" }).replyTo).toBe("");
  });

  test("den nyeste står først, og resten av en stoppet utsending tømmer listen over dem som gjenstår", () => {
    const stopped = entry("a", "2026-10-14T08:00:00.000Z", { stopped: "quota", remainingPersonIds: ["p1", "p2"] });
    const log = withLogEntry([stopped], entry("b", "2026-10-14T09:00:00.000Z"));
    expect(log.map((one) => one.id)).toEqual(["b", "a"]);
    expect(withRestSent(log, "a", [], null)[1]).toMatchObject({ remainingPersonIds: [], stopped: null });
    expect(withLogEntry(Array.from({ length: 60 }, (_, index) => entry(`e${index}`, "2026-10-01T08:00:00.000Z")), entry("ny", "2026-10-14T09:00:00.000Z"))).toHaveLength(50);
  });

  test("samme emne til de samme innen et døgn er en dobbeltsending; ellers ikke", () => {
    const log = [entry("a", "2026-10-14T08:00:00.000Z")];
    const same = (audience: Parameters<typeof audienceKey>[0], subject: string, at = now) => recentSameSending(log, audienceKey, audience, subject, at);
    expect(same({ kind: "leaders" }, " nytt SEMESTER ")?.id).toBe("a");
    expect(same({ kind: "serviceGroups" }, "Nytt semester")).toBeNull();
    expect(same({ kind: "leaders" }, "Noe annet")).toBeNull();
    expect(same({ kind: "leaders" }, "Nytt semester", new Date("2026-10-15T09:00:00.000Z"))).toBeNull();
    // A sending nobody got, is not one
    expect(recentSameSending([entry("b", "2026-10-14T08:00:00.000Z", { sent: 0 })], audienceKey, { kind: "leaders" }, "Nytt semester", now)).toBeNull();
  });

  test("en stoppet utsending forklares, med hvor mange som gjenstår", () => {
    expect(stopMessage("quota", 30)).toContain("30 personer gjenstår");
    expect(stopMessage("quota", 30)).toContain("i morgen");
    expect(stopMessage("unreachable", 1)).toContain("1 person gjenstår");
    expect(stopMessage("rejected", 2, "The domain is not verified")).toContain("«The domain is not verified»");
  });
});

// ---------- The button to a semester plan ----------

describe("Knappen som fører til en semesterplan", () => {
  beforeEach(() => vi.stubGlobal("console", { ...console, error: vi.fn() }));
  afterEach(() => vi.unstubAllGlobals());

  test("knappen heter «Planlegg semesteret» og går til planen, i både HTML og ren tekst", () => {
    const rendered = renderEmail({ draft: { subject: "Semester", text: "Hei der", link: "semesterplan", planId: "semesterplan-1" }, churchName: "Fjellbygda menighet", siteUrl: "https://a.no/", firstName: "Lars" });
    expect(rendered.html).toContain('href="https://a.no/minside/semesterplan/semesterplan-1"');
    expect(rendered.html).toContain("Planlegg semesteret");
    expect(rendered.text).toContain("Planlegg semesteret: https://a.no/minside/semesterplan/semesterplan-1");
  });

  test("lenken er samme sti som semesterPlanPath", () => {
    expect(emailButtonUrl({ link: "semesterplan", planId: "semesterplan-1" }, "https://a.no")).toBe("https://a.no" + semesterPlanPath("semesterplan-1"));
    expect(emailButtonUrl({ link: "semesterplan", planId: "semesterplan-1" }, "https://a.no")).toBe("https://a.no/minside/semesterplan/semesterplan-1");
  });

  test("en plan-id med andre tegn enn bokstaver, tall, «-» og «_» godtas ikke, og det sies hva som mangler", () => {
    expect(isPlanIdText("semesterplan-1")).toBe(true);
    expect(isPlanIdText("")).toBe(false);
    expect(isPlanIdText("../annen")).toBe(false);
    expect(emailDraftError({ subject: "Emne", text: "Tekst", link: "semesterplan" })).toBe("Velg hvilken semesterplan knappen skal åpne.");
    expect(emailDraftError({ subject: "Emne", text: "Tekst", link: "semesterplan", planId: "../annen" })).toBe("Velg hvilken semesterplan knappen skal åpne.");
    expect(emailDraftError({ subject: "Emne", text: "Tekst", link: "semesterplan", planId: "semesterplan-1" })).toBeNull();
    expect(emailButtonUrl({ link: "semesterplan", planId: "../annen" }, "https://a.no")).toBeNull();
  });

  test("bare knappen til en semesterplan har en plan: andre knapper får ingen", () => {
    expect(toEmailDraft({ subject: "Emne", text: "Tekst", link: "minside", planId: "semesterplan-1" })).toEqual({ subject: "Emne", text: "Tekst", link: "minside" });
    expect(toEmailDraft({ subject: "Emne", text: "Tekst", link: "semesterplan", planId: "semesterplan-1" })).toEqual({ subject: "Emne", text: "Tekst", link: "semesterplan", planId: "semesterplan-1" });
  });

  test("malen for de frivillige velger knappen til semesterplanen, og ligger etter «Oppgavene er klare»", () => {
    const ids = EMAIL_TEMPLATES.map((template) => template.id);
    expect(ids).toContain("semesterplan-frivillige");
    expect(ids.indexOf("semesterplan-frivillige")).toBe(ids.indexOf("oppgaver-klare") + 1);
    expect(EMAIL_TEMPLATES.find((template) => template.id === "semesterplan-frivillige")?.link).toBe("semesterplan");
  });

  test("planen må finnes: då sendes e-posten med knappen til den, i både prøve og utsending", async () => {
    const place = world({ plans: ["semesterplan-1"] });
    const { body } = await send(place, request({ link: "semesterplan", planId: "semesterplan-1" }));
    expect(body).toMatchObject({ ok: true, mode: "send", sent: 2 });
    expect(place.mails[0][0].html).toContain("/minside/semesterplan/semesterplan-1");
    expect(place.mails[0][0].text).toContain("Planlegg semesteret: https://menigheten.example/minside/semesterplan/semesterplan-1");

    const prove = await send(place, { mode: "test", subject: "Prøve", text: "Hei", link: "semesterplan", planId: "semesterplan-1" });
    expect(prove.body).toMatchObject({ ok: true, mode: "test", sent: 1 });
  });

  test("finnes ikke planen, sendes ingenting, og det sies hvorfor, i både prøve og utsending", async () => {
    const place = world({ plans: [] });
    const { status, body } = await send(place, request({ link: "semesterplan", planId: "borte" }));
    expect(status).toBe(400);
    expect(body).toEqual({ ok: false, reason: "no-plan", message: "Semesterplanen som knappen skal åpne, finnes ikke lenger. Velg en annen plan." });
    const prove = await send(place, { mode: "test", subject: "Prøve", text: "Hei", link: "semesterplan", planId: "borte" });
    expect(prove.body).toMatchObject({ ok: false, reason: "no-plan" });
    expect(place.mails).toHaveLength(0);
  });
});

// ---------- The page in admin ----------

const service = vi.hoisted(() => ({
  record: { replyTo: "post@example.org", log: [] } as EmailRecord,
  requestEmail: vi.fn(),
  saveEmailLog: vi.fn(async (_log: unknown[]) => undefined),
  saveReplyTo: vi.fn(async () => undefined),
}));
vi.mock("../src/services/email", () => ({
  requestEmail: service.requestEmail,
  saveEmailLog: service.saveEmailLog,
  saveReplyTo: service.saveReplyTo,
  subscribeEmailRecord: (onChange: (record: EmailRecord) => void) => {
    onChange(service.record);
    return () => undefined;
  },
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ settings: { churchName: "Fjellbygda menighet" } }) }));
// The semester plans the page offers to the button: set per test (see the page's describe)
const semester = vi.hoisted(() => ({ plans: [] as unknown[] }));
vi.mock("../src/services/semesterPlans", () => ({
  subscribeSemesterPlans: (onChange: (plans: unknown[]) => void) => {
    onChange(semester.plans);
    return () => undefined;
  },
  subscribeMySemesterAnswers: () => () => undefined,
  subscribeAllSemesterAnswers: () => () => undefined,
  saveSemesterPlan: vi.fn(async () => true),
  deleteSemesterPlan: vi.fn(async () => true),
  saveAnswerStep: vi.fn(async () => true),
  restartAnswer: vi.fn(async () => true),
}));
// Open today (14 October 2026, see `now` below), and answered by the end of November
const OPEN_PLAN = { id: "semesterplan-1", name: "Våren 2027", firstDay: "2026-10-01", lastDay: "2026-12-31", answerBy: "2026-11-30", opensAt: "2026-10-01T08:00:00.000Z", createdAt: "2026-09-01T00:00:00.000Z" };
// The newsletter's stores: nobody has unsubscribed, and there is no banner (tests/newsletter.test.tsx has the rest)
vi.mock("../src/services/newsletter", () => ({
  subscribeNewsletterOptOuts: (onChange: (keys: string[]) => void) => {
    onChange([]);
    return () => undefined;
  },
  subscribeNewsletterBanner: (onChange: (banner: string | null) => void) => {
    onChange(null);
    return () => undefined;
  },
  optBackIn: vi.fn(),
  saveNewsletterBanner: vi.fn(),
  removeNewsletterBanner: vi.fn(),
}));

import { EmailTab } from "../src/pages/admin/tabs/EmailTab";

// ---------- Innloggingslenker i e-posten ----------

const loginKey = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } }).privateKey;
const keyFile = JSON.stringify({ type: "service_account", project_id: "menigheten", client_email: "tjeneste@menigheten.iam.example", private_key: loginKey });
const loginEnv = { ...env, FIREBASE_SERVICE_ACCOUNT: keyFile };
const loginAccount = readServiceAccount(loginEnv)!;
/** The address of the login link in the html of an e-mail, or null when there is none. */
const linkIn = (html: string): string | null => html.match(/href="(https:\/\/menigheten\.example\/lenke[^"]*)"/)?.[1] ?? null;

describe("Innloggingslenker i e-posten", () => {
  beforeEach(() => vi.stubGlobal("console", { ...console, error: vi.fn() }));
  afterEach(() => vi.unstubAllGlobals());
  const sendWith = (place: ReturnType<typeof world>, body: unknown, more: Partial<Parameters<typeof sendEmail>[0]> = {}) => send(place, body, { env: loginEnv, ...more });

  test("en medlem får en knapp som logger vedkommende inn, og de andre får vanlig knapp", async () => {
    const place = world();
    const { body } = await sendWith(place, request({ audience: { kind: "serviceGroups" }, link: "minside", loginLinks: true }));
    expect(body).toMatchObject({ ok: true, sent: 4, loginLinks: 3 });

    const byAddress = new Map(place.mails.flat().map((mail) => [mail.to[0], mail]));
    const frida = byAddress.get("frida@example.org")!;
    const link = linkIn(frida.html)!;
    expect(link).toMatch(/^https:\/\/menigheten\.example\/lenke\?til=%2Fminside#/);
    expect(frida.html).toContain("Knappen logger deg rett inn og virker i 14 dager. Ikke send e-posten videre.");
    expect(frida.text).toContain("Knappen logger deg rett inn og virker i 14 dager.");
    expect(frida.text).toContain(`Åpne Min side: ${link}`);

    // The link carries the one it is for, and nothing that shows the address
    const url = new URL(link);
    expect(url.searchParams.get("til")).toBe("/minside");
    expect(readLoginToken(loginAccount, url.hash.slice(1), Math.floor(Date.now() / 1000))).toMatchObject({ personId: "frivillig" });
    expect(link).not.toContain("frida");

    // A shared address gets the ordinary button, as it is shared
    expect(byAddress.get("familien@example.org")!.html).not.toContain("/lenke");
    expect(byAddress.get("familien@example.org")!.html).toContain('href="https://menigheten.example/minside"');
    expect(byAddress.get("lars@example.org")!.html).toContain("/lenke?til=");
  });

  test("lenken kan virke til og med en valgt dag, og e-posten sier hvilken", async () => {
    const place = world();
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
    const until = daysAfter(today, 60);
    const { body } = await sendWith(place, request({ audience: { kind: "serviceGroups" }, link: "minside", loginLinks: true, loginLinkUntil: until }));
    expect(body).toMatchObject({ ok: true, loginLinks: 3 });
    const frida = place.mails.flat().find((mail) => mail.to[0] === "frida@example.org")!;
    expect(frida.html).toContain(`virker til og med ${formatLoginLinkUntil(until)}. Ikke send e-posten videre.`);
    const token = new URL(linkIn(frida.html)!).hash.slice(1);
    expect(readLoginToken(loginAccount, token, loginLinkEndSeconds(until) - 1)).toMatchObject({ personId: "frivillig" });
    expect(readLoginToken(loginAccount, token, loginLinkEndSeconds(until))).toBe("expired");
  });

  test("en dag mer enn 120 dager fram, eller før i dag, nektes", async () => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
    const tooLate = await sendWith(world(), request({ audience: { kind: "serviceGroups" }, link: "minside", loginLinks: true, loginLinkUntil: daysAfter(today, 121) }));
    expect(tooLate.body).toMatchObject({ ok: false, reason: "bad-request", message: "Innloggingslenken kan virke i høyst 120 dager. Velg en tidligere dato." });
    const past = await sendWith(world(), request({ audience: { kind: "serviceGroups" }, link: "minside", loginLinks: true, loginLinkUntil: daysAfter(today, -1) }));
    expect(past.body).toMatchObject({ ok: false, reason: "bad-request" });
  });

  test("en administrator og en nettredaktør får vanlig knapp, også når de står i gruppen", async () => {
    const place = world({
      persons: [...persons, person("redaktor", "Rolf Redaktør", "rolf@example.org", "nettredaktor")],
      groups: [...groups, group("styret", "Styret", "tjenestegruppe", [], ["admin", "redaktor"])],
    });
    const { body } = await sendWith(place, request({ audience: { kind: "group", groupId: "styret" }, link: "minside", loginLinks: true }));
    expect(body).toMatchObject({ ok: true, sent: 2, loginLinks: 0 });
    for (const mail of place.mails.flat()) expect(mail.html).not.toContain("/lenke");
  });

  test("nyhetsbrev, og en e-post uten knapp, får ikke innloggingslenker", async () => {
    const place = world();
    expect((await sendWith(place, request({ audience: { kind: "members" }, link: "minside", loginLinks: true }))).body).toMatchObject({ ok: false, reason: "bad-request" });
    expect((await sendWith(place, request({ link: "ingen", loginLinks: true }))).body).toMatchObject({ ok: false, reason: "bad-request" });
    expect((await sendWith(place, request({ loginLinks: "ja" }))).body).toMatchObject({ ok: false, reason: "bad-request" });
    expect(place.mails).toEqual([]);
  });

  test("uten tjenestekonto, eller med en konto fra et annet prosjekt, sies det at lenkene ikke er satt opp", async () => {
    const place = world();
    expect((await sendWith(place, request({ loginLinks: true }), { env })).body).toMatchObject({ ok: false, reason: "no-login-links" });
    const other = JSON.stringify({ ...JSON.parse(keyFile), project_id: "annet" });
    expect((await sendWith(place, request({ loginLinks: true }), { env: { ...env, FIREBASE_SERVICE_ACCOUNT: other } })).status).toBe(503);
    expect(place.mails).toEqual([]);
    // Without the wish for login links, the e-mail goes as before
    expect((await send(place, request(), { env })).body).toMatchObject({ ok: true, loginLinks: 0 });
  });

  test("en prøve med innloggingslenke går til den som er nevnt, og til ingen andre", async () => {
    const place = world();
    const { body } = await sendWith(place, { mode: "test", subject: "Prøve", text: "Hei", link: "minside", to: "frida@example.org", loginLinks: true });
    expect(body).toMatchObject({ ok: true, mode: "test", sent: 1, loginLinks: 1 });
    expect(place.sentTo()).toEqual(["frida@example.org"]);
    expect(place.mails[0][0].html).toContain("/lenke?til=%2Fminside#");
  });

  test("en utsending som stoppes, teller bare dem som fikk e-posten", async () => {
    const place = world({ mail: [429] });
    const { body } = await sendWith(place, request({ audience: { kind: "serviceGroups" }, link: "minside", loginLinks: true }));
    expect(body).toMatchObject({ ok: true, sent: 0, stopped: "quota", loginLinks: 0 });
  });
});

describe("Siden «Send e-post» i admin", () => {
  const showFeedback = vi.fn();
  const studio = { adminPersons: persons.map((one) => ({ person: one })), adminGroups: groups.map((one) => ({ group: one })) } as unknown as Parameters<typeof EmailTab>[0]["studio"];
  const show = (canSend = true) => render(<EmailTab studio={studio} showFeedback={showFeedback} canSend={canSend} now={() => new Date("2026-10-14T12:00:00.000Z")} />);
  const sent = (outcome: Partial<Extract<EmailOutcome, { ok: true }>> = {}): EmailOutcome => ({ ok: true, mode: "send", sent: 2, withoutEmail: 0, stopped: null, remainingPersonIds: [], ...outcome });

  beforeEach(() => {
    service.record = { replyTo: "post@example.org", log: [] };
    service.requestEmail.mockReset();
    service.saveEmailLog.mockClear();
    service.saveReplyTo.mockClear();
    semester.plans = [OPEN_PLAN];
    showFeedback.mockClear();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("siden åpner med teksten til lederne, sier hvor mange som får den, og viser hvordan den ser ut", () => {
    show();
    expect((screen.getByLabelText("Emne") as HTMLInputElement).value).toBe(EMAIL_TEMPLATES[0].subject);
    expect((screen.getByLabelText("Hvem skal ha den") as HTMLSelectElement).value).toBe("leaders");
    expect(document.getElementById("email-recipient-count")?.textContent).toBe("2 personer får e-posten.");
    expect(screen.getByRole("button", { name: "Send til 2 personer" })).toBeTruthy();
    expect(document.getElementById("email-preview")?.getAttribute("srcdoc")).toContain("Hei Kari!");
    expect(document.getElementById("email-preview")?.getAttribute("srcdoc")).toContain("Hilsen Fjellbygda menighet");
    expect(screen.getByText("Ingen e-post er sendt herfra ennå.")).toBeTruthy();
  });

  test("teksten til de frivillige velger alle i tjenestegruppene, og de uten e-postadresse nevnes ved navn", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: EMAIL_TEMPLATES[1].label }));
    expect((screen.getByLabelText("Hvem skal ha den") as HTMLSelectElement).value).toBe("serviceGroups");
    expect(document.getElementById("email-recipient-count")?.textContent).toBe("5 personer får e-posten (4 e-postadresser). 2 personer mangler e-postadresse og får den ikke: Ulf Uten, Finn Feil.");
    expect((screen.getByLabelText("Knappen fører til") as HTMLSelectElement).value).toBe("minside");

    fireEvent.change(screen.getByLabelText("Hvem skal ha den"), { target: { value: "group:hus" } });
    expect(screen.getByRole("button", { name: "Send til 2 personer" })).toBeTruthy();
  });

  test("prøven sendes uten spørsmål, og føres ikke i loggen", async () => {
    service.requestEmail.mockResolvedValue(sent({ mode: "test", sent: 1 }));
    show();
    fireEvent.click(screen.getByRole("button", { name: "Send prøve til meg" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Prøven er sendt"));
    expect(service.requestEmail).toHaveBeenCalledWith({ mode: "test", subject: EMAIL_TEMPLATES[0].subject, text: EMAIL_TEMPLATES[0].text, link: "leder" });
    expect(confirm).not.toHaveBeenCalled();
    expect(service.saveEmailLog).not.toHaveBeenCalled();
  });

  test("innloggingslenkene er et valg for en vanlig e-post med knapp, sendes bare når det er krysset av, og tas med i svaret", async () => {
    service.requestEmail.mockResolvedValueOnce(sent()).mockResolvedValueOnce(sent({ loginLinks: 2 }));
    show();
    const box = screen.getByLabelText("Logg mottakerne rett inn med knappen") as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("E-posten er sendt til 2 personer."));
    expect(service.requestEmail.mock.calls[0][0]).not.toHaveProperty("loginLinks");

    fireEvent.click(box);
    expect(document.getElementById("email-preview")?.getAttribute("srcdoc")).toMatch(/Knappen logger deg rett inn og virker til og med \d+\. \p{L}+ \d{4}\. Ikke send e-posten videre\./u);
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    await waitFor(() => expect(service.requestEmail).toHaveBeenCalledTimes(2));
    expect(service.requestEmail.mock.calls[1][0]).toMatchObject({ mode: "send", loginLinks: true });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("E-posten er sendt til 2 personer. 2 av dem fikk knapp som logger dem rett inn."));
  });

  test("valget vises ikke for et nyhetsbrev eller en e-post uten knapp", () => {
    show();
    expect(screen.queryByLabelText("Logg mottakerne rett inn med knappen")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Knappen fører til"), { target: { value: "ingen" } });
    expect(screen.queryByLabelText("Logg mottakerne rett inn med knappen")).toBeNull();
    fireEvent.change(screen.getByLabelText("Knappen fører til"), { target: { value: "minside" } });
    fireEvent.change(screen.getByLabelText("Hvem skal ha den"), { target: { value: "members" } });
    expect(screen.queryByLabelText("Logg mottakerne rett inn med knappen")).toBeNull();
  });

  test("en utsending må bekreftes med antallet, og føres i loggen uten navn og adresser", async () => {
    service.requestEmail.mockResolvedValue(sent());
    show();
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    expect(vi.mocked(confirm).mock.calls[0][0]).toBe(`Du sender «${EMAIL_TEMPLATES[0].subject}» til 2 personer (Ledere og nestledere i tjenestegruppene). Vil du sende?`);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("E-posten er sendt til 2 personer."));
    expect(service.requestEmail).toHaveBeenCalledWith(expect.objectContaining({ mode: "send", audience: { kind: "leaders" } }));
    expect(service.requestEmail.mock.calls[0][0]).not.toHaveProperty("to");

    const log = service.saveEmailLog.mock.calls[0][0] as EmailLogEntry[];
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ sentAt: "2026-10-14T12:00:00.000Z", audience: { kind: "leaders" }, subject: EMAIL_TEMPLATES[0].subject, sent: 2, remainingPersonIds: [] });
    expect(JSON.stringify(log)).not.toMatch(/example\.org|Lars|Nora/);
  });

  test("sier administratoren nei i spørsmålet, sendes ingenting", () => {
    vi.mocked(confirm).mockReturnValue(false);
    show();
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    expect(service.requestEmail).not.toHaveBeenCalled();
  });

  test("samme e-post til de samme innen et døgn gir et ekstra spørsmål først", () => {
    service.record = {
      replyTo: "post@example.org",
      log: [{ id: "a", sentAt: "2026-10-14T08:00:00.000Z", audience: { kind: "leaders" }, audienceLabel: "Ledere og nestledere i tjenestegruppene", subject: EMAIL_TEMPLATES[0].subject, sent: 2, withoutEmail: 0, stopped: null, remainingPersonIds: [] }],
    };
    vi.mocked(confirm).mockReturnValue(false);
    show();
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    expect(vi.mocked(confirm).mock.calls).toHaveLength(1);
    expect(vi.mocked(confirm).mock.calls[0][0]).toMatch(/^Denne e-posten ble sendt til «Ledere og nestledere i tjenestegruppene» .* Vil du sende den en gang til\?$/);
    expect(service.requestEmail).not.toHaveBeenCalled();
  });

  test("stopper utsendingen, står det hvem som gjenstår, og de kan få den etterpå", async () => {
    service.requestEmail.mockResolvedValueOnce(sent({ sent: 1, stopped: "quota", remainingPersonIds: ["nest"] }));
    show();
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("1 person fikk e-posten."));
    expect(screen.getByRole("status").textContent).toContain("1 person gjenstår");
    expect((service.saveEmailLog.mock.calls[0][0] as EmailLogEntry[])[0]).toMatchObject({ sent: 1, stopped: "quota", remainingPersonIds: ["nest"] });
    cleanup();

    service.record = { replyTo: "post@example.org", log: service.saveEmailLog.mock.calls[0][0] as EmailLogEntry[] };
    service.requestEmail.mockResolvedValueOnce(sent({ sent: 1 }));
    show();
    const logged = screen.getByRole("region", { name: "Sendt" });
    expect(within(logged).getByText("Stoppet før alle hadde fått den: 1 person gjenstår.")).toBeTruthy();
    fireEvent.click(within(logged).getByRole("button", { name: "Send til dem som gjenstår" }));
    await waitFor(() => expect(service.requestEmail).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "send", audience: { kind: "leaders" }, onlyPersonIds: ["nest"] })));
    await waitFor(() => expect((service.saveEmailLog.mock.calls[1][0] as EmailLogEntry[])[0]).toMatchObject({ sent: 2, stopped: null, remainingPersonIds: [] }));
  });

  test("et nei fra utsendingen vises som det er, og føres ikke i loggen", async () => {
    service.requestEmail.mockResolvedValue({ ok: false, reason: "not-configured", message: "E-post er ikke satt opp for denne installasjonen ennå." });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("E-post er ikke satt opp for denne installasjonen ennå."));
    expect(service.saveEmailLog).not.toHaveBeenCalled();
  });

  test("uten lagret svaradresse eller uten emne sendes ingenting", () => {
    service.record = { replyTo: "", log: [] };
    show();
    expect(screen.getByText("Ingen adresse er lagret ennå.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send prøve til meg" }));
    expect(screen.getByRole("alert").textContent).toBe("Lagre adressen svar skal gå til, før du sender.");

    fireEvent.change(screen.getByLabelText("Svar går til"), { target: { value: "ikke en adresse" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));
    expect(service.saveReplyTo).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Svar går til"), { target: { value: " Post@Example.org " } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));
    expect(service.saveReplyTo).toHaveBeenCalledWith("post@example.org");
    expect(service.requestEmail).not.toHaveBeenCalled();
    cleanup();

    service.record = { replyTo: "post@example.org", log: [] };
    show();
    fireEvent.click(screen.getByRole("button", { name: "Tom e-post" }));
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    expect(screen.getByRole("alert").textContent).toBe("E-posten må ha et emne.");
    expect(service.requestEmail).not.toHaveBeenCalled();
  });

  test("nyhetsbrevet går til medlemmene, prøven ser ut som det, og knappene over teksten skriver merkene", async () => {
    service.requestEmail.mockResolvedValue(sent({ mode: "test", sent: 1 }));
    show();
    fireEvent.click(screen.getByRole("button", { name: "Nyhetsbrev" }));
    expect((screen.getByLabelText("Hvem skal ha den") as HTMLSelectElement).value).toBe("members");
    expect((screen.getByLabelText("Knappen fører til") as HTMLSelectElement).value).toBe("ingen");
    // Nobody among the made-up persons here is marked as a member of the congregation
    expect(document.getElementById("email-recipient-count")?.textContent).toBe("0 personer får e-posten.");
    fireEvent.change(screen.getByLabelText("Hvem skal ha den"), { target: { value: "everyone" } });
    expect(document.getElementById("email-recipient-count")?.textContent).toMatch(/^8 personer får e-posten \(7 e-postadresser\)\. 2 personer mangler e-postadresse/);
    expect(document.getElementById("email-preview")?.getAttribute("srcdoc")).toContain("Meld deg av");

    const field = screen.getByLabelText("Tekst") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Kom på fest" } });
    field.setSelectionRange(7, 11);
    fireEvent.click(screen.getByRole("button", { name: "Fet" }));
    expect(field.value).toBe("Kom på **fest**");

    fireEvent.click(screen.getByRole("button", { name: "Send prøve til meg" }));
    await waitFor(() => expect(service.requestEmail).toHaveBeenCalledWith(expect.objectContaining({ mode: "test", audience: { kind: "everyone" }, link: "ingen" })));
  });

  test("testboksen sender til adressen som er skrevet, sier det i boksen og føres i loggen; en ugyldig adresse sendes ikke", async () => {
    service.requestEmail.mockResolvedValue(sent({ mode: "test", sent: 1 }));
    show();
    const box = screen.getByRole("region", { name: "Test e-postutsendingen" });
    const address = within(box).getByLabelText("Send prøve til") as HTMLInputElement;
    expect(address.value).toBe("");

    fireEvent.change(address, { target: { value: "ikke en adresse" } });
    fireEvent.click(within(box).getByRole("button", { name: "Send testen" }));
    expect(within(box).getByRole("alert").textContent).toBe("Skriv en gyldig e-postadresse.");
    expect(service.requestEmail).not.toHaveBeenCalled();

    fireEvent.change(address, { target: { value: " Kari@Example.org " } });
    fireEvent.click(within(box).getByRole("button", { name: "Send testen" }));
    await waitFor(() => expect(within(box).getByRole("status").textContent).toMatch(/^Sendt til kari@example\.org kl\. \d\d:\d\d\. Utsendingen virker\. Kom den ikke fram, sjekk søppelposten\.$/));
    expect(service.requestEmail).toHaveBeenCalledWith({ subject: EMAIL_TEMPLATES[0].subject, text: EMAIL_TEMPLATES[0].text, link: "leder", mode: "test", to: "kari@example.org" });
    expect(confirm).not.toHaveBeenCalled();
    // The page's own result is not touched by the box
    expect(screen.queryByText(/Prøven er sendt/)).toBeNull();

    const log = service.saveEmailLog.mock.calls[0][0] as EmailLogEntry[];
    expect(log[0]).toMatchObject({ sentAt: "2026-10-14T12:00:00.000Z", audience: { kind: "persons" }, audienceLabel: "Test til én adresse", subject: EMAIL_TEMPLATES[0].subject, sent: 1, remainingPersonIds: [] });
  });

  test("testboksen sier hva som hindrer en prøve, og viser det som utsendingen svarer", async () => {
    show(false);
    const box = screen.getByRole("region", { name: "Test e-postutsendingen" });
    expect((within(box).getByRole("button", { name: "Send testen" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    service.requestEmail.mockResolvedValueOnce({ ok: false, reason: "rules-outdated", message: "Databasen har ikke fått reglene for nyhetsbrev ennå." });
    show();
    const again = screen.getByRole("region", { name: "Test e-postutsendingen" });
    fireEvent.change(within(again).getByLabelText("Send prøve til"), { target: { value: "kari@example.org" } });
    fireEvent.click(within(again).getByRole("button", { name: "Send testen" }));
    await waitFor(() => expect(within(again).getByRole("alert").textContent).toBe("Databasen har ikke fått reglene for nyhetsbrev ennå."));
    expect(service.saveEmailLog).not.toHaveBeenCalled();
  });

  test("i demoen vises siden, men ingenting kan sendes", () => {
    show(false);
    expect(screen.getByRole("note").textContent).toContain("Demoen sender ikke e-post");
    expect((screen.getByRole("button", { name: "Send prøve til meg" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Send til 2 personer" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("knappen kan føre til en semesterplan: planen velges i en egen liste, og e-posten sendes med den", async () => {
    service.requestEmail.mockResolvedValue(sent());
    show();
    expect(screen.getByRole("option", { name: "Semesterplan" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Knappen fører til"), { target: { value: "semesterplan" } });
    const plan = screen.getByLabelText("Hvilken plan") as HTMLSelectElement;
    expect(plan.value).toBe("semesterplan-1");
    expect(within(plan).getByRole("option", { name: "Våren 2027 (Åpen)" })).toBeTruthy();
    expect(document.getElementById("email-preview")?.getAttribute("srcdoc")).toContain("/minside/semesterplan/semesterplan-1");

    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    await waitFor(() => expect(service.requestEmail).toHaveBeenCalledWith(expect.objectContaining({ mode: "send", link: "semesterplan", planId: "semesterplan-1" })));
  });

  test("malen for semesterplanen velger knappen og planen av seg selv", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: EMAIL_TEMPLATES.find((template) => template.id === "semesterplan-frivillige")!.label }));
    expect((screen.getByLabelText("Knappen fører til") as HTMLSelectElement).value).toBe("semesterplan");
    expect((screen.getByLabelText("Hvilken plan") as HTMLSelectElement).value).toBe("semesterplan-1");
  });

  test("uten en plan som kan velges, sies det hvordan den lages, og ingen e-post går ut", () => {
    semester.plans = [];
    show();
    fireEvent.change(screen.getByLabelText("Knappen fører til"), { target: { value: "semesterplan" } });
    expect(screen.queryByLabelText("Hvilken plan")).toBeNull();
    expect(screen.getByText("Det finnes ingen åpen eller planlagt semesterplan. Lag en under Semesterplan først.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send til 2 personer" }));
    expect(screen.getByRole("alert").textContent).toBe("Velg hvilken semesterplan knappen skal åpne.");
    expect(service.requestEmail).not.toHaveBeenCalled();
  });
});

// ---------- Flere e-postadresser på én person ----------

describe("Ekstra e-postadresser i utsendingen", () => {
  beforeEach(() => vi.stubGlobal("console", { ...console, error: vi.fn() }));
  afterEach(() => vi.unstubAllGlobals());

  const kari: Person = { ...person("kari", "Kari Kopi", "kari@example.org"), extraEmails: [{ address: "kari.jobb@example.org", copy: true, login: true }] };
  const ola: Person = { ...person("ola", "Ola Kopi", "ola@example.org"), extraEmails: [{ address: "ola.kopi@example.org", copy: true, login: false }] };
  const uten: Person = { ...person("uten", "Ulf Uten"), extraEmails: [{ address: "uten.kopi@example.org", copy: true, login: false }] };

  test("en kopiadresse får e-posten, den som bare har kopi, har ikke ingen adresse, og bare den med innlogging får innloggingsknappen", async () => {
    const place = world({ persons: [person("admin", "Astrid Admin", "astrid@example.org", "admin"), kari, ola, uten], groups: [] });
    const { body } = await send(place, request({ audience: { kind: "persons" }, onlyPersonIds: ["kari", "ola", "uten"], link: "minside", loginLinks: true }), { env: loginEnv });
    expect(body).toMatchObject({ ok: true, sent: 5, withoutEmail: 0, loginLinks: 3 });

    const byAddress = new Map(place.mails.flat().map((mail) => [mail.to[0], mail]));
    expect(new Set(byAddress.keys())).toEqual(new Set(["kari@example.org", "kari.jobb@example.org", "ola@example.org", "ola.kopi@example.org", "uten.kopi@example.org"]));
    // The copy address with login signs in its own person
    const link = linkIn(byAddress.get("kari.jobb@example.org")!.html)!;
    expect(readLoginToken(loginAccount, new URL(link).hash.slice(1), Math.floor(Date.now() / 1000))).toMatchObject({ personId: "kari" });
    // A copy address without login gets the ordinary button
    expect(byAddress.get("ola.kopi@example.org")!.html).not.toContain("/lenke");
    expect(byAddress.get("uten.kopi@example.org")!.html).not.toContain("/lenke");
  });

  test("emailRecipients: kopiadressen kommer med, uten kopi kommer den ikke, og samme adresse to ganger blir én", () => {
    const found = emailRecipients({ kind: "persons" }, [kari, ola], [], ["kari", "ola"]);
    expect(found.recipients.map((recipient) => recipient.email).sort()).toEqual(["kari.jobb@example.org", "kari@example.org", "ola.kopi@example.org", "ola@example.org"].sort());

    const noCopy: Person = { ...person("kari", "Kari", "kari@example.org"), extraEmails: [{ address: "kari.jobb@example.org", copy: false, login: true }] };
    expect(emailRecipients({ kind: "persons" }, [noCopy], [], ["kari"]).recipients.map((recipient) => recipient.email)).toEqual(["kari@example.org"]);

    const same: Person = { ...person("kari", "Kari", "kari@example.org"), extraEmails: [{ address: "Kari@example.org", copy: true, login: false }] };
    expect(emailRecipients({ kind: "persons" }, [same], [], ["kari"]).recipients).toEqual([{ email: "kari@example.org", personIds: ["kari"], firstName: "Kari" }]);

    // Two persons with the same copy address: one e-mail, both named on it
    const twin: Person = { ...person("ola", "Ola", "ola@example.org"), extraEmails: [{ address: "kari.jobb@example.org", copy: true, login: false }] };
    const shared = emailRecipients({ kind: "persons" }, [kari, twin], [], ["kari", "ola"]).recipients.find((recipient) => recipient.email === "kari.jobb@example.org");
    expect(shared).toEqual({ email: "kari.jobb@example.org", personIds: ["kari", "ola"], firstName: null });
  });

  test("en nyhetsbrevmottaker som har meldt seg av, mister alle adressene sine, hoved og kopi", () => {
    const found = emailRecipients({ kind: "everyone" }, [kari, ola], [], undefined, new Set(["kari"]));
    expect(found.recipients.map((recipient) => recipient.email).sort()).toEqual(["ola.kopi@example.org", "ola@example.org"]);
    expect(found.optedOut.map((one) => one.id)).toEqual(["kari"]);
  });

  test("den som bare har en kopiadresse, er ikke uten e-postadresse", () => {
    const found = emailRecipients({ kind: "persons" }, [uten], [], ["uten"]);
    expect(found.withoutEmail).toEqual([]);
    expect(found.recipients.map((recipient) => recipient.email)).toEqual(["uten.kopi@example.org"]);
  });
});
