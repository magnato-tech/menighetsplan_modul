import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "vitest";
import { sendSignInEmail } from "../server/signInEmail";
import type { Fetch } from "../server/firestoreRest";
import { LOGIN_REQUESTS_COLLECTION } from "../src/data/collections";

// The sign-in link sent with the congregation's own e-mail service. Google's answers, the register,
// the log and the e-mail service are faked by `ask`. Every person, address and link here is made up.

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const keyFile = JSON.stringify({ type: "service_account", project_id: "menigheten", client_email: "tjeneste@menigheten.iam.example", private_key: privateKey });
const env = {
  VITE_FIREBASE_API_KEY: "nokkel",
  VITE_FIREBASE_AUTH_DOMAIN: "menigheten.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "menigheten",
  VITE_FIREBASE_APP_ID: "app",
  FIREBASE_SERVICE_ACCOUNT: keyFile,
  RESEND_API_KEY: "re_hemmelig",
  EMAIL_FROM_ADDRESS: "innlogging@menigheten.example",
};

const SITE = "https://menigheten.example";
const NOW = new Date("2026-11-24T10:00:00.000Z");
const OOB = "https://menigheten.firebaseapp.com/__/auth/action?oobCode=kode1";
const BODY = { email: " Ola@Eksempel.no ", returnTo: `${SITE}/logg-inn?neste=%2Fminside` };
const FAILED = "E-posten kunne ikke sendes akkurat nå. Prøv igjen om litt.";

interface Stored {
  id: string;
  fields: Record<string, Record<string, unknown>>;
}

/** The register (only the addresses given have a login), the log, and the answers of Google and the e-mail service. */
function serve({ logins = ["ola@eksempel.no"], log = [] as Stored[], resendStatus = 200 }: { logins?: string[]; log?: Stored[]; resendStatus?: number } = {}) {
  const asked: { url: string; method?: string; headers?: Record<string, string>; body?: any }[] = [];
  const logStore: Stored[] = log.map((row) => ({ ...row, fields: { ...row.fields } }));
  let nextId = 0;
  const json = (value: unknown, ok = true, status = 200) => ({ ok, status, json: async () => value });
  const ask: Fetch = async (url, init) => {
    const body = init?.body && init.headers?.["Content-Type"] === "application/json" ? JSON.parse(init.body) : undefined;
    asked.push({ url, method: init?.method, headers: init?.headers, body });
    if (url === "https://oauth2.googleapis.com/token") return json({ access_token: "tilgang" });
    if (url.includes("/documents/logins/")) {
      const address = decodeURIComponent(url.split("/documents/logins/")[1]);
      return logins.includes(address) ? json({ name: `projects/menigheten/databases/(default)/documents/logins/${address}`, fields: { personId: { stringValue: "ola" } } }) : json({ error: { code: 404 } }, false, 404);
    }
    if (url.endsWith("/documents/cms_settings/global")) return json({ name: "projects/menigheten/databases/(default)/documents/cms_settings/global", fields: { churchName: { stringValue: "Lillesand Misjonskirke" } } });
    if (url.endsWith(":runQuery")) {
      const filter = body.structuredQuery.where.fieldFilter;
      const field = filter.field.fieldPath as string;
      const value = filter.value.stringValue as string;
      const found = logStore.filter((row) => {
        const stored = row.fields[field]?.stringValue as string;
        if (filter.op === "EQUAL") return stored === value;
        if (filter.op === "GREATER_THAN_OR_EQUAL") return stored >= value;
        return stored < value;
      });
      const limit = body.structuredQuery.limit as number | undefined;
      return json(found.slice(0, limit).map((row) => ({ document: { name: `projects/menigheten/databases/(default)/documents/loginRequests/${row.id}`, fields: row.fields } })));
    }
    if (url.endsWith("/documents/loginRequests")) {
      nextId += 1;
      logStore.push({ id: `ny${nextId}`, fields: body.fields });
      return json({ name: `loginRequests/ny${nextId}` });
    }
    if (url.endsWith(":commit")) {
      for (const write of body.writes as { delete?: string }[]) {
        const id = write.delete?.split("/").pop();
        const index = logStore.findIndex((row) => row.id === id);
        if (index >= 0) logStore.splice(index, 1);
      }
      return json({ writeResults: [] });
    }
    if (url === "https://identitytoolkit.googleapis.com/v1/projects/menigheten/accounts:sendOobCode") return json({ oobLink: OOB });
    if (url === "https://api.resend.com/emails") return json(resendStatus === 200 ? { id: "e-post-1" } : { message: "Avsenderen er ikke godkjent" }, resendStatus === 200, resendStatus);
    return json({}, false, 404);
  };
  return { ask, asked, logStore };
}

const sentMail = (asked: { url: string; body?: any }[]) => asked.filter((call) => call.url === "https://api.resend.com/emails");
const logWrites = (asked: { url: string; body?: any }[]) => asked.filter((call) => call.url.endsWith("/documents/loginRequests"));

describe("Lenken på e-post, sendt av menigheten selv", () => {
  test("sender ikke e-post der installasjonen ikke kan det, og ber om ingenting: da sender Firebase som før", async () => {
    for (const setting of [{ VITE_DEMO: "true" }, { FIREBASE_SERVICE_ACCOUNT: undefined }, { RESEND_API_KEY: undefined }]) {
      const { ask, asked } = serve();
      const result = await sendSignInEmail({ env: { ...env, ...setting }, siteUrl: SITE, body: BODY, ask, now: NOW });
      expect(result).toEqual({ status: 503, body: { ok: false, reason: "not-available" } });
      expect(asked).toEqual([]);
    }
  });

  test("en adresse som ikke ser ut som en, gir en melding og ingen lenke", async () => {
    const { ask, asked } = serve();
    const result = await sendSignInEmail({ env, siteUrl: SITE, body: { email: "ikke-en-adresse", returnTo: `${SITE}/minside` }, ask, now: NOW });
    expect(result).toEqual({ status: 400, body: { ok: false, reason: "bad-email", message: "E-postadressen ser ikke riktig ut." } });
    expect(asked).toEqual([]);
  });

  test("en adresse i registeret får lenken fra Firebase i en e-post fra menigheten, og loggen sier at den ble sendt", async () => {
    const { ask, asked } = serve();
    const result = await sendSignInEmail({ env, siteUrl: SITE, body: BODY, ask, now: NOW });

    expect(result).toEqual({ status: 200, body: { ok: true } });
    const link = asked.find((call) => call.url.endsWith("/accounts:sendOobCode"));
    expect(link?.headers?.Authorization).toBe("Bearer tilgang");
    expect(link?.body).toEqual({
      requestType: "EMAIL_SIGNIN",
      email: "ola@eksempel.no",
      continueUrl: `${SITE}/logg-inn?neste=%2Fminside`,
      canHandleCodeInApp: true,
      returnOobLink: true,
    });

    const mails = sentMail(asked);
    expect(mails).toHaveLength(1);
    const mail = mails[0].body as { from: string; to: string[]; subject: string; html: string; text: string };
    expect(mail.from).toBe(`"Lillesand Misjonskirke" <innlogging@menigheten.example>`);
    expect(mail.to).toEqual(["ola@eksempel.no"]);
    expect(mail.subject).toBe("Logg inn på Min side – Lillesand Misjonskirke");
    expect(mail.html).toContain(`href="${OOB}"`);
    expect(mail.text).toContain(`Logg inn: ${OOB}`);

    const written = logWrites(asked);
    expect(written).toHaveLength(1);
    expect(written[0].body.fields).toEqual({
      email: { stringValue: "ola@eksempel.no" },
      at: { stringValue: NOW.toISOString() },
      inRegister: { booleanValue: true },
      result: { stringValue: "sent" },
    });
  });

  test("en adresse som ikke står i registeret får ingen lenke, men beskjed om det, og loggen sier at den ikke står der", async () => {
    const { ask, asked } = serve({ logins: [] });
    const result = await sendSignInEmail({ env, siteUrl: SITE, body: BODY, ask, now: NOW });

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(asked.some((call) => call.url.endsWith("/accounts:sendOobCode"))).toBe(false);
    const mail = sentMail(asked)[0].body as { subject: string; html: string; text: string };
    expect(mail.subject).toBe("Vi fant ikke adressen din – Lillesand Misjonskirke");
    expect(mail.html).not.toContain("oobCode");
    expect(mail.html).toContain(`href="${SITE}"`);
    expect(mail.text).toContain("Til nettsiden: https://menigheten.example");
    expect(logWrites(asked)[0].body.fields).toMatchObject({ inRegister: { booleanValue: false }, result: { stringValue: "sent" } });
  });

  test("den fjerde forespørselen fra samme adresse innen en time sendes ikke, men svarer likevel ja, og loggen sier «stoppet»", async () => {
    const earlier = [1, 2, 3].map((minutes) => ({
      id: `tidligere-${minutes}`,
      fields: {
        email: { stringValue: "ola@eksempel.no" },
        at: { stringValue: new Date(NOW.getTime() - minutes * 60_000).toISOString() },
        inRegister: { booleanValue: true },
        result: { stringValue: "sent" },
      },
    }));
    const { ask, asked } = serve({ log: earlier });
    const result = await sendSignInEmail({ env, siteUrl: SITE, body: BODY, ask, now: NOW });

    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(sentMail(asked)).toHaveLength(0);
    expect(asked.some((call) => call.url.endsWith("/accounts:sendOobCode"))).toBe(false);
    expect(logWrites(asked)[0].body.fields.result).toEqual({ stringValue: "limited" });
  });

  test("når e-posttjenesten svikter, svarer den 502 med en melding, og loggen sier «feilet»", async () => {
    const { ask, asked } = serve({ resendStatus: 500 });
    const result = await sendSignInEmail({ env, siteUrl: SITE, body: BODY, ask, now: NOW });

    expect(result).toEqual({ status: 502, body: { ok: false, reason: "failed", message: FAILED } });
    expect(logWrites(asked)[0].body.fields.result).toEqual({ stringValue: "failed" });
  });

  test("en returnTo på en annen side erstattes med Min side på menighetens egen adresse", async () => {
    const { ask, asked } = serve();
    await sendSignInEmail({ env, siteUrl: SITE, body: { email: "ola@eksempel.no", returnTo: "https://annen.example/logg-inn" }, ask, now: NOW });

    expect(asked.find((call) => call.url.endsWith("/accounts:sendOobCode"))?.body.continueUrl).toBe(`${SITE}/minside`);
  });

  test("forespørsler eldre enn 90 dager slettes når en ny kommer", async () => {
    const old = {
      id: "gammel",
      fields: {
        email: { stringValue: "fremmed@eksempel.no" },
        at: { stringValue: new Date(NOW.getTime() - 91 * 24 * 60 * 60 * 1000).toISOString() },
        inRegister: { booleanValue: false },
        result: { stringValue: "sent" },
      },
    };
    const { ask, asked, logStore } = serve({ log: [old] });
    await sendSignInEmail({ env, siteUrl: SITE, body: BODY, ask, now: NOW });

    expect(asked.find((call) => call.url.endsWith(":commit"))?.body).toEqual({
      writes: [{ delete: "projects/menigheten/databases/(default)/documents/loginRequests/gammel" }],
    });
    expect(logStore.some((row) => row.id === "gammel")).toBe(false);
  });

  test("kan ikke registeret leses, sendes ingen beskjed om at adressen mangler: Firebase tar e-posten som før", async () => {
    const { ask: inner, asked } = serve();
    const ask: Fetch = async (url, init) => (url.includes("/documents/logins/") ? { ok: false, status: 500, json: async () => ({}) } : inner(url, init));
    const result = await sendSignInEmail({ env, siteUrl: SITE, body: BODY, ask, now: NOW });
    expect(result).toMatchObject({ status: 503, body: { ok: false, reason: "not-available" } });
    expect(asked.some((call) => call.url.includes("api.resend.com"))).toBe(false);
  });

  test("loggen heter det samme i serveren som i appen", () => {
    expect(LOGIN_REQUESTS_COLLECTION).toBe("loginRequests");
  });
});
