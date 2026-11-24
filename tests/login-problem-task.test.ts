import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { Fetch } from "../server/firestoreRest";
import { noticeNewApplication } from "../server/applicationNotice";
import { reportLoginProblem } from "../server/loginProblemReport";
import { recordLoginProblem } from "../server/loginProblemTask";
import { noticeNewTask } from "../server/taskNotice";
import { sendSignInEmail } from "../server/signInEmail";

// The board's tasks for sign-ins that were stopped, the notice e-mail and the application notice. The
// register, the tasks, Google and the e-mail service are one fake database, served by `ask`. Every
// person, address and token here is made up.

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
const ROOT = "https://firestore.googleapis.com/v1/projects/menigheten/databases/(default)/documents";
const NAME_ROOT = "projects/menigheten/databases/(default)/documents/";
const OOB = "https://menigheten.firebaseapp.com/__/auth/action?oobCode=kode1";

type Plain = Record<string, string | number | boolean>;
type Encoded = Record<string, Record<string, unknown>>;

const encode = (value: unknown): Record<string, unknown> => {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  return { stringValue: String(value) };
};
const encodeAll = (plain: Plain): Encoded => Object.fromEntries(Object.entries(plain).map(([key, value]) => [key, encode(value)]));

interface Token {
  email: string;
  emailVerified: boolean;
}

/** The register, the tasks and the log as documents by path, with what Google and the e-mail service answer. */
function serve({ docs = {}, token = null, resendStatus = 200 }: { docs?: Record<string, Plain>; token?: Token | null; resendStatus?: number } = {}) {
  const store = new Map<string, Encoded>(Object.entries(docs).map(([path, plain]) => [path, encodeAll(plain)]));
  const asked: { url: string; method?: string; headers?: Record<string, string>; body?: any }[] = [];
  const mails: { to: string[]; subject: string; html: string; text: string; from: string }[] = [];
  let nextId = 0;
  const json = (value: unknown, ok = true, status = 200) => ({ ok, status, json: async () => value });

  const ask: Fetch = async (url, init) => {
    const body = init?.body && init.headers?.["Content-Type"] === "application/json" ? JSON.parse(init.body) : undefined;
    asked.push({ url, method: init?.method, headers: init?.headers, body });

    if (url === "https://oauth2.googleapis.com/token") return json({ access_token: "tilgang" });
    if (url.startsWith("https://identitytoolkit.googleapis.com/v1/accounts:lookup")) {
      if (!token || body?.idToken !== "godt") return json({ error: { code: 400 } }, false, 400);
      return json({ users: [{ email: token.email, emailVerified: token.emailVerified }] });
    }
    if (url === "https://identitytoolkit.googleapis.com/v1/projects/menigheten/accounts:sendOobCode") return json({ oobLink: OOB });
    if (url === "https://api.resend.com/emails" || url === "https://api.resend.com/emails/batch") {
      const list = Array.isArray(body) ? body : [body];
      if (resendStatus !== 200) return json({ message: "Avsenderen er ikke godkjent" }, false, resendStatus);
      for (const mail of list) mails.push({ to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, from: mail.from });
      return json({ data: list.map((_, index) => ({ id: `e-${index}` })) });
    }

    if (url === `${ROOT}:runQuery`) {
      const query = body.structuredQuery;
      const collection = query.from[0].collectionId as string;
      const filter = query.where?.fieldFilter as { field: { fieldPath: string }; op: string; value: Record<string, unknown> } | undefined;
      const rows = [...store.entries()].filter(([path, fields]) => {
        if (!path.startsWith(`${collection}/`) || path.slice(collection.length + 1).includes("/")) return false;
        if (!filter) return true;
        const stored = fields[filter.field.fieldPath];
        if (!stored) return false;
        const wanted = filter.value.stringValue ?? filter.value.booleanValue;
        const have = (stored.stringValue ?? stored.booleanValue) as string | boolean;
        if (filter.op === "EQUAL") return have === wanted;
        if (filter.op === "GREATER_THAN_OR_EQUAL") return String(have) >= String(wanted);
        return String(have) < String(wanted);
      });
      const limited = query.limit ? rows.slice(0, query.limit) : rows;
      return json(limited.map(([path, fields]) => ({ document: { name: `${NAME_ROOT}${path}`, fields } })));
    }
    if (url === `${ROOT}:commit`) {
      for (const write of body.writes as { update?: { name: string; fields: Encoded }; updateMask?: { fieldPaths: string[] }; currentDocument?: { exists: boolean }; delete?: string }[]) {
        if (write.delete) {
          store.delete(write.delete.slice(NAME_ROOT.length));
          continue;
        }
        const path = write.update!.name.slice(NAME_ROOT.length);
        if (write.currentDocument?.exists && !store.has(path)) return json({ error: { code: 404 } }, false, 404);
        const current = store.get(path) ?? {};
        const fields = write.updateMask ? Object.fromEntries(write.updateMask.fieldPaths.map((key) => [key, write.update!.fields[key]])) : write.update!.fields;
        store.set(path, { ...current, ...fields });
      }
      return json({ writeResults: [] });
    }
    if (url === `${ROOT}/loginRequests` && init?.method === "POST") {
      nextId += 1;
      store.set(`loginRequests/ny${nextId}`, body.fields);
      return json({ name: `loginRequests/ny${nextId}` });
    }
    if (url.startsWith(`${ROOT}/`) && (!init?.method || init.method === "GET")) {
      const path = decodeURIComponent(url.slice(ROOT.length + 1));
      const fields = store.get(path);
      return fields ? json({ name: `${NAME_ROOT}${path}`, fields }) : json({ error: { code: 404 } }, false, 404);
    }
    return json({}, false, 404);
  };

  const pathsIn = (collection: string) => [...store.keys()].filter((path) => path.startsWith(`${collection}/`));
  const plainOf = (path: string): Plain => {
    const fields = store.get(path) ?? {};
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, (value.stringValue ?? value.booleanValue ?? Number(value.integerValue)) as string | number | boolean]));
  };
  return { ask, asked, mails, store, pathsIn, plainOf };
}

const headers = { Authorization: "Bearer tilgang" };
const database = { projectId: "menigheten" };
const persons = (list: Record<string, Plain>) => Object.fromEntries(Object.entries(list).map(([id, plain]) => [`persons/${id}`, plain]));

describe("Oppgaven for en innlogging som ble stoppet", () => {
  test("en ny adresse får en oppgave med feltene, og et nytt forsøk teller opp den som er åpen", async () => {
    const world = serve();
    const first = await recordLoginProblem({ database, address: "ukjent@eksempel.no", reason: "noMatch", now: NOW, ask: world.ask, headers, env, siteUrl: SITE });
    expect(first).toEqual({ created: true });

    const [path] = world.pathsIn("membershipClerkTasks");
    expect(world.plainOf(path)).toMatchObject({
      kind: "loginUnknownEmail",
      status: "open",
      createdAt: NOW.toISOString(),
      lastAttemptAt: NOW.toISOString(),
      attempts: 1,
      loginAddress: "ukjent@eksempel.no",
      loginReason: "noMatch",
      personId: "",
      personName: "",
    });
    expect(world.plainOf(path).instruction).toBe("ukjent@eksempel.no prøvde å logge inn, men adressen står ikke i registeret. Finn ut hvem det er, og legg til adressen på personen.");

    const later = new Date("2026-11-24T10:05:00.000Z");
    const second = await recordLoginProblem({ database, address: "ukjent@eksempel.no", reason: "noMatch", now: later, ask: world.ask, headers, env, siteUrl: SITE });
    expect(second).toEqual({ created: false });
    expect(world.pathsIn("membershipClerkTasks")).toHaveLength(1);
    expect(world.plainOf(path)).toMatchObject({ attempts: 2, lastAttemptAt: later.toISOString() });
  });

  test("en oppgave som er utført, gir en ny når adressen prøver igjen", async () => {
    const world = serve({
      docs: {
        "membershipClerkTasks/gammel": { id: "gammel", kind: "loginUnknownEmail", status: "done", createdAt: "2026-11-20T08:00:00.000Z", loginAddress: "ola@eksempel.no", loginReason: "noMatch", personId: "", personName: "", instruction: "x" },
      },
    });
    const result = await recordLoginProblem({ database, address: "ola@eksempel.no", reason: "noMatch", now: NOW, ask: world.ask, headers, env, siteUrl: SITE });
    expect(result).toEqual({ created: true });
    expect(world.pathsIn("membershipClerkTasks")).toHaveLength(2);
  });

  test("en delt adresse får sin egen instruks", async () => {
    const world = serve();
    await recordLoginProblem({ database, address: "familie@eksempel.no", reason: "shared", now: NOW, ask: world.ask, headers, env, siteUrl: SITE });
    const [path] = world.pathsIn("membershipClerkTasks");
    expect(world.plainOf(path)).toMatchObject({ loginReason: "shared" });
    expect(world.plainOf(path).instruction).toBe("familie@eksempel.no prøvde å logge inn, men adressen står på flere personer. Gi hver av dem sin egen adresse.");
  });

  test("feiler databasen, kastes ingenting, og ingen oppgave er laget", async () => {
    const failing: Fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const result = await recordLoginProblem({ database, address: "ola@eksempel.no", reason: "noMatch", now: NOW, ask: failing, headers, env, siteUrl: SITE });
    expect(result).toEqual({ created: false });
  });
});

describe("Rapport fra innloggingssiden", () => {
  test("503 uten tjenestekonto, og ingenting spørres", async () => {
    const world = serve({ token: { email: "ola@eksempel.no", emailVerified: true } });
    const result = await reportLoginProblem({ env: { ...env, FIREBASE_SERVICE_ACCOUNT: undefined }, idToken: "godt", ask: world.ask, now: NOW, siteUrl: SITE });
    expect(result).toEqual({ status: 503, body: { ok: false } });
    expect(world.asked).toEqual([]);
  });

  test("401 når Google ikke kjenner tokenet, og 401 når adressen ikke er bekreftet", async () => {
    const unknown = serve({ token: { email: "ola@eksempel.no", emailVerified: true } });
    expect((await reportLoginProblem({ env, idToken: "falsk", ask: unknown.ask, now: NOW, siteUrl: SITE })).status).toBe(401);
    expect(unknown.pathsIn("membershipClerkTasks")).toEqual([]);

    const unverified = serve({ token: { email: "ola@eksempel.no", emailVerified: false } });
    expect((await reportLoginProblem({ env, idToken: "godt", ask: unverified.ask, now: NOW, siteUrl: SITE })).status).toBe(401);
    expect(unverified.pathsIn("membershipClerkTasks")).toEqual([]);
  });

  test("en adresse i registeret skriver ingenting", async () => {
    const world = serve({ token: { email: "ola@eksempel.no", emailVerified: true }, docs: { "logins/ola@eksempel.no": { personId: "ola" } } });
    const result = await reportLoginProblem({ env, idToken: "godt", ask: world.ask, now: NOW, siteUrl: SITE });
    expect(result).toEqual({ status: 200, body: { ok: true, inRegister: true } });
    expect(world.pathsIn("membershipClerkTasks")).toEqual([]);
  });

  test("en ukjent adresse får årsaken noMatch", async () => {
    const world = serve({ token: { email: "Ny@Eksempel.no", emailVerified: true }, docs: persons({ kari: { name: "Kari", email: "kari@eksempel.no" } }) });
    const result = await reportLoginProblem({ env, idToken: "godt", ask: world.ask, now: NOW, siteUrl: SITE });
    expect(result).toEqual({ status: 200, body: { ok: true } });
    const [path] = world.pathsIn("membershipClerkTasks");
    expect(world.plainOf(path)).toMatchObject({ loginAddress: "ny@eksempel.no", loginReason: "noMatch" });
  });

  test("en adresse som står på flere personer, får årsaken shared", async () => {
    const world = serve({
      token: { email: "familie@eksempel.no", emailVerified: true },
      docs: persons({ ola: { name: "Ola", email: "familie@eksempel.no" }, kari: { name: "Kari", email: "familie@eksempel.no" } }),
    });
    await reportLoginProblem({ env, idToken: "godt", ask: world.ask, now: NOW, siteUrl: SITE });
    const [path] = world.pathsIn("membershipClerkTasks");
    expect(world.plainOf(path)).toMatchObject({ loginReason: "shared" });
  });

  test("tjue meldinger i timen er taket: den neste refuseres med 429", async () => {
    const touched = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [
        `membershipClerkTasks/t${index}`,
        { id: `t${index}`, kind: "loginUnknownEmail", status: "open", createdAt: "2026-11-24T09:00:00.000Z", lastAttemptAt: "2026-11-24T09:30:00.000Z", loginAddress: `x${index}@eksempel.no`, loginReason: "noMatch", personId: "", personName: "", instruction: "x" },
      ])
    );
    const world = serve({ token: { email: "ny@eksempel.no", emailVerified: true }, docs: touched });
    const result = await reportLoginProblem({ env, idToken: "godt", ask: world.ask, now: NOW, siteUrl: SITE });
    expect(result.status).toBe(429);
    expect(world.pathsIn("membershipClerkTasks")).toHaveLength(20);
  });
});

describe("Varsel om ny oppgave", () => {
  const clerkAndAdmin = persons({
    kari: { name: "Kari", email: "kari@eksempel.no", membershipClerk: true },
    ola: { name: "Ola", email: "ola@eksempel.no", globalRole: "admin" },
  });
  const settings = { "cms_settings/global": { churchName: "Lillesand Misjonskirke" } };

  test("går til protokollansvarlig, og bare til administratorene når det ikke finnes en", async () => {
    const world = serve({ docs: { ...clerkAndAdmin, ...settings } });
    const result = await noticeNewTask({ database, env, ask: world.ask, headers, now: NOW, siteUrl: SITE, task: { summary: "Ny søknad.", id: "ny" } });
    expect(result).toEqual({ sent: true });
    expect(world.mails.map((mail) => mail.to)).toEqual([["kari@eksempel.no"]]);
    expect(world.mails[0].subject).toBe("Ny oppgave i Oppgaver – Lillesand Misjonskirke");
    expect(world.mails[0].text).toContain("Ny søknad.");
    expect(world.mails[0].text).toContain("Det er nå 0 åpne oppgaver.");
    expect(world.mails[0].html).toContain(`${SITE}/admin?tab=planlegger-medlemskap`);
    expect(world.mails[0].text).toContain("Du får denne e-posten fordi du er protokollansvarlig eller administrator.");

    const onlyAdmins = serve({ docs: { ...persons({ ola: { name: "Ola", email: "ola@eksempel.no", globalRole: "admin" } }), ...settings } });
    await noticeNewTask({ database, env, ask: onlyAdmins.ask, headers, now: NOW, siteUrl: SITE, task: { summary: "Ny søknad.", id: "ny" } });
    expect(onlyAdmins.mails.map((mail) => mail.to)).toEqual([["ola@eksempel.no"]]);
  });

  test("sendes ikke når en annen oppgave er laget i timen før", async () => {
    const world = serve({
      docs: {
        ...clerkAndAdmin,
        ...settings,
        "membershipClerkTasks/annen": { id: "annen", kind: "withdrawal", status: "open", createdAt: "2026-11-24T09:30:00.000Z", personId: "x", personName: "X", instruction: "x" },
      },
    });
    const result = await noticeNewTask({ database, env, ask: world.ask, headers, now: NOW, siteUrl: SITE, task: { summary: "Ny søknad.", id: "ny" } });
    expect(result).toEqual({ sent: false });
    expect(world.mails).toEqual([]);
  });

  test("kaster ikke når e-posttjenesten svikter", async () => {
    const world = serve({ docs: { ...clerkAndAdmin, ...settings }, resendStatus: 500 });
    const result = await noticeNewTask({ database, env, ask: world.ask, headers, now: NOW, siteUrl: SITE, task: { summary: "Ny søknad.", id: "ny" } });
    expect(result).toEqual({ sent: false });
  });
});

describe("Varsel om ny søknad fra Min side", () => {
  const application = (extra: Plain = {}) => ({
    id: "s1",
    personId: "ola",
    applicantName: "Ola Nordmann",
    kind: "congregationApply",
    status: "submitted",
    submittedAt: "2026-11-24T09:55:00.000Z",
    ...extra,
  });
  const world = (token: Token, extra: Record<string, Plain> = {}) =>
    serve({
      token,
      docs: {
        "logins/ola@eksempel.no": { personId: "ola" },
        "membershipApplications/s1": application(),
        "cms_settings/global": { churchName: "Lillesand Misjonskirke" },
        "persons/kari": { name: "Kari", email: "kari@eksempel.no", membershipClerk: true },
        ...extra,
      },
    });

  test("den som søkte, får varselet én gang; en annen får ikke sendt noe", async () => {
    const own = world({ email: "ola@eksempel.no", emailVerified: true });
    const first = await noticeNewApplication({ env, idToken: "godt", body: { applicationId: "s1" }, ask: own.ask, now: NOW, siteUrl: SITE });
    expect(first).toEqual({ status: 200, body: { ok: true, sent: true } });
    expect(own.mails).toHaveLength(1);
    expect(own.mails[0].text).toContain("Ny søknad om medlemskap fra Ola Nordmann.");
    expect(own.plainOf("membershipApplications/s1").noticeSentAt).toBe(NOW.toISOString());

    const second = await noticeNewApplication({ env, idToken: "godt", body: { applicationId: "s1" }, ask: own.ask, now: NOW, siteUrl: SITE });
    expect(second).toEqual({ status: 200, body: { ok: true, sent: false } });
    expect(own.mails).toHaveLength(1);
  });

  test("en som ikke er søkeren, refuseres", async () => {
    const other = world({ email: "kari@eksempel.no", emailVerified: true }, { "logins/kari@eksempel.no": { personId: "kari" } });
    const result = await noticeNewApplication({ env, idToken: "godt", body: { applicationId: "s1" }, ask: other.ask, now: NOW, siteUrl: SITE });
    expect(result.status).toBe(403);
    expect(other.mails).toEqual([]);
  });

  test("en søknad som er eldre enn en time, får ikke varsel", async () => {
    const old = serve({
      token: { email: "ola@eksempel.no", emailVerified: true },
      docs: { "logins/ola@eksempel.no": { personId: "ola" }, "membershipApplications/s1": application({ submittedAt: "2026-11-24T07:00:00.000Z" }) },
    });
    const result = await noticeNewApplication({ env, idToken: "godt", body: { applicationId: "s1" }, ask: old.ask, now: NOW, siteUrl: SITE });
    expect(result.status).toBe(409);
    expect(old.mails).toEqual([]);
  });
});

describe("Innlogging med en adresse som ikke står i registeret", () => {
  const sign = (world: ReturnType<typeof serve>, address: string, now = NOW) =>
    sendSignInEmail({ env, siteUrl: SITE, body: { email: address, returnTo: `${SITE}/minside` }, ask: world.ask, now });

  test("en ukjent adresse gir en oppgave, og en adresse i registeret gir ingen", async () => {
    const unknown = serve({ docs: { "cms_settings/global": { churchName: "Lillesand Misjonskirke" } } });
    await sign(unknown, "ukjent@eksempel.no");
    const [path] = unknown.pathsIn("membershipClerkTasks");
    expect(unknown.plainOf(path)).toMatchObject({ kind: "loginUnknownEmail", loginAddress: "ukjent@eksempel.no", loginReason: "noMatch" });

    const known = serve({ docs: { "logins/ola@eksempel.no": { personId: "ola" } } });
    await sign(known, "ola@eksempel.no");
    expect(known.pathsIn("membershipClerkTasks")).toEqual([]);
  });

  test("en begrenset forespørsel gir ingen oppgave", async () => {
    const world = serve({
      docs: {
        "loginRequests/a": { email: "ukjent@eksempel.no", at: "2026-11-24T09:50:00.000Z", inRegister: false, result: "sent" },
        "loginRequests/b": { email: "ukjent@eksempel.no", at: "2026-11-24T09:51:00.000Z", inRegister: false, result: "sent" },
        "loginRequests/c": { email: "ukjent@eksempel.no", at: "2026-11-24T09:52:00.000Z", inRegister: false, result: "sent" },
      },
    });
    const result = await sign(world, "ukjent@eksempel.no");
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(world.pathsIn("membershipClerkTasks")).toEqual([]);
  });
});
