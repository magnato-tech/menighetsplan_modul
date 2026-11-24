import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { listAccounts } from "../server/accountList";
import type { Fetch } from "../server/firestoreRest";

// The accounts of the installation, as Google gives them. Every person, address and account here is
// made up, and Google's answers are faked by `ask`.

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const keyFile = JSON.stringify({ type: "service_account", project_id: "menigheten", client_email: "tjeneste@menigheten.iam.example", private_key: privateKey });
const env = {
  VITE_FIREBASE_API_KEY: "nokkel",
  VITE_FIREBASE_AUTH_DOMAIN: "menigheten.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "menigheten",
  VITE_FIREBASE_APP_ID: "app",
  FIREBASE_SERVICE_ACCOUNT: keyFile,
};

/** A token the way the browser sends it: the claims are read, the signature is not checked here. */
const tokenFor = (email: string) => `hode.${Buffer.from(JSON.stringify({ email, email_verified: true })).toString("base64url")}.signatur`;

const personRow = (id: string, email: string, globalRole: string) => ({
  document: {
    name: `projects/menigheten/databases/(default)/documents/persons/${id}`,
    fields: { email: { stringValue: email }, globalRole: { stringValue: globalRole } },
  },
});

const NOW = 1_763_000_000_000;
const CREATED = 1_700_000_000_000;
const LOGGED_IN = 1_763_628_000_000;

const firstPage = {
  users: [
    { localId: "konto-1", email: " Ada@Example.org ", emailVerified: true, disabled: false, providerUserInfo: [{ providerId: "google.com" }], createdAt: String(CREATED), lastLoginAt: String(LOGGED_IN) },
    { localId: "konto-2", email: "bjorn@example.org", emailVerified: false, disabled: true, providerUserInfo: [{ providerId: "password" }], createdAt: String(CREATED), lastLoginAt: String(LOGGED_IN) },
  ],
  nextPageToken: "side-2",
};
const secondPage = {
  users: [{ localId: "konto-3", email: "ukjent@example.org", emailVerified: true, disabled: false, passwordHash: "hemmelig", createdAt: String(CREATED) }],
};

/** The register (Ada is an administrator, Frida is not), and Google's answers. */
function serve({ googleStatus = 200 }: { googleStatus?: number } = {}) {
  const asked: { url: string; method?: string; headers?: Record<string, string> }[] = [];
  const ask: Fetch = async (url, init) => {
    asked.push({ url, method: init?.method, headers: init?.headers });
    if (url.includes(":runQuery")) {
      const rows = [personRow("ada", "ada@example.org", "admin"), personRow("frida", "frida@example.org", "member")];
      return { ok: true, status: 200, json: async () => rows };
    }
    if (url === "https://oauth2.googleapis.com/token") return { ok: true, status: 200, json: async () => ({ access_token: "tilgang" }) };
    if (url.includes("accounts:batchGet")) {
      if (googleStatus !== 200) return { ok: false, status: googleStatus, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => (url.includes("nextPageToken=side-2") ? secondPage : firstPage) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { ask, asked };
}

describe("Kontolisten fra Firebase", () => {
  test("demoen har ingen ekte kontoer, og spør ingen", async () => {
    const { ask, asked } = serve();
    const result = await listAccounts({ env: { ...env, VITE_DEMO: "true" }, idToken: tokenFor("ada@example.org"), ask });
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ ok: false, reason: "demo" });
    expect(asked).toEqual([]);
  });

  test("mangler tjenestenøkkelen, sier listen det, og spør ingen", async () => {
    const { ask, asked } = serve();
    const withoutKey: Record<string, unknown> = { ...env };
    delete withoutKey.FIREBASE_SERVICE_ACCOUNT;
    const result = await listAccounts({ env: withoutKey, idToken: tokenFor("ada@example.org"), ask });
    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      ok: false,
      reason: "no-service-account",
      message: "Tjenestenøkkelen FIREBASE_SERVICE_ACCOUNT mangler hos Vercel. Uten den kan oversikten ikke hente kontoene.",
    });
    expect(asked).toEqual([]);
  });

  test("uten innlogging får ingen se listen", async () => {
    const { ask } = serve();
    expect(await listAccounts({ env, idToken: null, ask })).toMatchObject({ status: 401, body: { ok: false, reason: "not-signed-in" } });
    expect(await listAccounts({ env, idToken: "tull", ask })).toMatchObject({ status: 401, body: { ok: false, reason: "not-signed-in" } });
  });

  test("den som ikke er administrator i registeret, får ingen liste", async () => {
    const { ask, asked } = serve();
    const result = await listAccounts({ env, idToken: tokenFor("frida@example.org"), ask });
    expect(result).toEqual({ status: 403, body: { ok: false, reason: "not-admin", message: "Bare en administrator kan se innloggingene." } });
    expect(asked.some((request) => request.url.includes("accounts:batchGet"))).toBe(false);
  });

  test("en administrator får kontoene, med bare det oversikten trenger", async () => {
    const { ask } = serve();
    const result = await listAccounts({ env, idToken: tokenFor("ada@example.org"), ask, now: () => NOW });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      fetchedAt: new Date(NOW).toISOString(),
      accounts: [
        { email: "ada@example.org", emailVerified: true, disabled: false, provider: "google", createdAt: new Date(CREATED).toISOString(), lastLoginAt: new Date(LOGGED_IN).toISOString() },
        { email: "bjorn@example.org", emailVerified: false, disabled: true, provider: "e-postlenke", createdAt: new Date(CREATED).toISOString(), lastLoginAt: new Date(LOGGED_IN).toISOString() },
        { email: "ukjent@example.org", emailVerified: true, disabled: false, provider: "e-postlenke", createdAt: new Date(CREATED).toISOString(), lastLoginAt: null },
      ],
    });
    const text = JSON.stringify(result.body);
    for (const secret of ["konto-1", "localId", "hemmelig", "passwordHash", "providerUserInfo"]) expect(text.includes(secret)).toBe(false);
  });

  test("alle sidene leses, og hver med tilgangsnøkkelen til Google", async () => {
    const { ask, asked } = serve();
    await listAccounts({ env, idToken: tokenFor("ada@example.org"), ask, now: () => NOW });
    const pages = asked.filter((request) => request.url.includes("accounts:batchGet"));
    expect(pages.map((request) => request.url)).toEqual([
      "https://identitytoolkit.googleapis.com/v1/projects/menigheten/accounts:batchGet?maxResults=1000",
      "https://identitytoolkit.googleapis.com/v1/projects/menigheten/accounts:batchGet?maxResults=1000&nextPageToken=side-2",
    ]);
    expect(pages.every((request) => request.method === "GET" && request.headers?.Authorization === "Bearer tilgang")).toBe(true);
  });

  test("svarer Google feil, sier oversikten det, og fører ingen adresser i loggen", async () => {
    const { ask } = serve({ googleStatus: 500 });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await listAccounts({ env, idToken: tokenFor("ada@example.org"), ask });
    expect(result).toEqual({ status: 502, body: { ok: false, reason: "google", message: "Firebase svarte ikke. Prøv igjen om litt." } });
    expect(log.mock.calls.flat().join(" ")).not.toContain("@");
    log.mockRestore();
  });
});
