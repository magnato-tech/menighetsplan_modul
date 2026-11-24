import { generateKeyPairSync, createVerify } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { redeemLoginLink } from "../server/loginLinkRedeem";
import { makeLoginToken } from "../server/loginLinkToken";
import { readServiceAccount } from "../server/serviceAccount";
import type { Fetch, RestFields, RestValue } from "../server/firestoreRest";
import { LOGIN_LINK_DAYS } from "../src/utils/loginLink";

// Every person and address here is made up. Google's answers are faked by `ask`.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const keyFile = JSON.stringify({ type: "service_account", project_id: "menigheten", client_email: "tjeneste@menigheten.iam.example", private_key: privateKey });
const env = {
  VITE_FIREBASE_API_KEY: "nokkel",
  VITE_FIREBASE_AUTH_DOMAIN: "menigheten.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "menigheten",
  VITE_FIREBASE_APP_ID: "app",
  FIREBASE_SERVICE_ACCOUNT: keyFile,
};
const account = readServiceAccount(env)!;
const NOW = new Date("2026-11-24T10:00:00Z");
const nowSeconds = Math.floor(NOW.getTime() / 1000);

const encode = (value: unknown): RestValue => {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  return { nullValue: null };
};
const fieldsOf = (data: object): RestFields => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)]));

interface Setup {
  person?: Record<string, unknown> | null;
  /** The account the address has at Google, or none. */
  account?: { localId: string; emailVerified: boolean; disabled?: boolean } | null;
  /** Fails the request to Google's sign-in, when true. */
  googleDown?: boolean;
}

/** A Google and a database that remember what they were asked. */
const world = ({ person = { id: "p1", name: "Kari Medlem", email: "kari@example.org", globalRole: "member" }, account: found = null, googleDown = false }: Setup = {}) => {
  const asked: { url: string; method?: string; headers?: Record<string, string>; body?: unknown }[] = [];
  const ask: Fetch = async (url, init) => {
    // Only the Identity Toolkit and the token address take JSON; the token address takes a form
    const body = init?.headers?.["Content-Type"] === "application/json" && init.body ? JSON.parse(init.body) : undefined;
    asked.push({ url, method: init?.method, headers: init?.headers, body });
    const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
    if (url === "https://oauth2.googleapis.com/token") return googleDown ? { ok: false, status: 500, json: async () => ({}) } : ok({ access_token: "tilgang-1" });
    if (url.includes("/documents/persons/")) return person ? ok({ name: url, fields: fieldsOf(person) }) : { ok: false, status: 404, json: async () => ({}) };
    if (url.endsWith("/accounts:lookup")) return ok(found ? { users: [{ ...found, disabled: found.disabled ?? false }] } : { kind: "x" });
    if (url.endsWith("/accounts")) return ok({ localId: "ny-konto" });
    if (url.endsWith("/accounts:update")) return ok({ localId: body.localId });
    throw new Error(`Uventet adresse i testen: ${url}`);
  };
  return { ask, asked, calls: (end: string) => asked.filter((call) => call.url.endsWith(end)) };
};

const linkFor = (personId = "p1", email = "kari@example.org", at = nowSeconds) => makeLoginToken(account, personId, email, at);
const redeem = (place: ReturnType<typeof world>, body: unknown, extra: Partial<Parameters<typeof redeemLoginLink>[0]> = {}) =>
  redeemLoginLink({ env, body, ask: place.ask, now: NOW, ...extra });

describe("Innloggingslenken logger inn den som står i lenken", () => {
  beforeEach(() => vi.stubGlobal("console", { ...console, error: vi.fn() }));
  afterEach(() => vi.unstubAllGlobals());

  test("en konto som finnes, men ikke har bekreftet adressen, får bekreftelsen og et innloggingsbevis", async () => {
    const place = world({ account: { localId: "konto-1", emailVerified: false } });
    const { status, body } = await redeem(place, { token: linkFor() });
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(place.calls("accounts:update")).toHaveLength(1);
    expect(place.calls("/accounts")).toHaveLength(0);

    // The database is read as the service account, not as anyone in the browser
    const database = place.asked.find((call) => call.url.includes("/documents/persons/"));
    expect(database?.headers).toEqual({ Authorization: "Bearer tilgang-1" });

    const { ok, claims } = verify((body as { customToken: string }).customToken);
    expect(ok).toBe(true);
    expect(claims).toMatchObject({ uid: "konto-1", aud: expect.stringContaining("IdentityToolkit"), iat: nowSeconds });
  });

  test("en konto med passord og ubekreftet adresse blir ikke bekreftet og ikke logget inn", async () => {
    const place = world({ account: { localId: "konto-1", emailVerified: false, providerUserInfo: [{ providerId: "password" }] } as never });
    const { status, body } = await redeem(place, { token: linkFor() });
    expect(status).toBe(403);
    expect(body).toMatchObject({ ok: false });
    expect(place.calls("accounts:update")).toHaveLength(0);
  });

  test("uten konto laget den en, med adressen bekreftet, og innloggingsbeviset er for den nye kontoen", async () => {
    const place = world({ account: null });
    const { status, body } = await redeem(place, { token: linkFor() });
    expect(status).toBe(200);
    const created = place.calls("/accounts")[0];
    expect(created.body).toEqual({ email: "kari@example.org", emailVerified: true });
    expect(place.calls("accounts:update")).toHaveLength(0);
    expect(verify((body as { customToken: string }).customToken).claims).toMatchObject({ uid: "ny-konto" });
  });

  test("en konto som er sperret, logger ikke inn", async () => {
    const place = world({ account: { localId: "konto-1", emailVerified: true, disabled: true } });
    expect((await redeem(place, { token: linkFor() })).body).toMatchObject({ ok: false, message: "Kontoen er sperret. Ta kontakt med menigheten." });
  });

  test("en utgått lenke får beskjed om det, og en ugyldig lenke om at den ikke er gyldig", async () => {
    const place = world();
    const old = linkFor("p1", "kari@example.org", nowSeconds - LOGIN_LINK_DAYS * 86_400 - 10);
    expect(await redeem(place, { token: old })).toMatchObject({ status: 410 });
    expect(await redeem(place, { token: "ikke-en-lenke" })).toMatchObject({ status: 400, body: { ok: false, message: "Lenken er ikke gyldig. Logg inn på vanlig måte." } });
    expect(await redeem(place, null)).toMatchObject({ status: 400 });
    expect(place.asked).toEqual([]);
  });

  test("en administrator eller en nettredaktør får ikke innloggingslenke", async () => {
    for (const globalRole of ["admin", "nettredaktor"]) {
      const place = world({ person: { id: "p1", name: "Ada", email: "kari@example.org", globalRole: globalRole === "admin" ? "admin" : "nettredaktor" } });
      expect(await redeem(place, { token: linkFor() })).toMatchObject({ status: 403 });
      expect(place.calls("/accounts")).toHaveLength(0);
    }
  });

  test("en person som er borte, eller som har fått en annen adresse, logger ikke inn", async () => {
    expect(await redeem(world({ person: null }), { token: linkFor() })).toMatchObject({ status: 403 });
    expect(await redeem(world({ person: { id: "p1", name: "Kari", email: "ny@example.org", globalRole: "member" } }), { token: linkFor() })).toMatchObject({ status: 403 });
    expect(await redeem(world({ person: { id: "p1", name: "Kari", globalRole: "member" } }), { token: linkFor() })).toMatchObject({ status: 403 });
  });

  test("demoen har ingen innloggingslenker, og en installasjon uten tjenestekonto kan ikke svare", async () => {
    const place = world();
    expect(await redeem(place, { token: linkFor() }, { env: { ...env, VITE_DEMO: "true" } })).toMatchObject({ status: 403, body: { message: "Demoen har ikke innloggingslenker." } });
    expect(await redeem(place, { token: linkFor() }, { env: { ...env, FIREBASE_SERVICE_ACCOUNT: undefined } })).toMatchObject({ status: 503 });
    // Another project's key is not this installation's
    expect(await redeem(place, { token: linkFor() }, { env: { ...env, VITE_FIREBASE_PROJECT_ID: "annet" } })).toMatchObject({ status: 503 });
    expect(place.asked).toEqual([]);
  });

  test("når Google svarer feil, får den som prøver beskjed om å prøve igjen, og ingen nøkkel eller lenke kommer i loggen", async () => {
    const place = world({ googleDown: true });
    const result = await redeem(place, { token: linkFor() });
    expect(result).toEqual({ status: 502, body: { ok: false, message: "Innloggingen kunne ikke fullføres akkurat nå. Prøv igjen." } });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain(privateKey);
    expect(logged).not.toContain(linkFor());
  });
});

/** Checks a custom token with the test's public key, and gives back its claims. */
function verify(token: string) {
  const [header, payload, signature] = token.split(".");
  const ok = createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(publicKey, Buffer.from(signature, "base64url"));
  return { ok, claims: JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown> };
}
