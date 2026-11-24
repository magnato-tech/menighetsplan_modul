import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, test } from "vitest";
import { accessToken, customToken, findUserByEmail, readServiceAccount, signJwt, type ServiceAccount } from "../server/serviceAccount";
import type { Fetch } from "../server/firestoreRest";

// The service account is made up here: a key pair of the test's own, in the shape of Firebase's key file.
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const account: ServiceAccount = { project_id: "menigheten", client_email: "tjeneste@menigheten.iam.example", private_key: privateKey };
const keyFile = (fields: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "service_account", project_id: "menigheten", client_email: account.client_email, private_key: privateKey, ...fields });

/** Checks the signature of a JWT with the public key, and gives back its parts. */
const verified = (jwt: string) => {
  const [header, payload, signature] = jwt.split(".");
  const ok = createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(publicKey, Buffer.from(signature, "base64url"));
  return { ok, header: JSON.parse(Buffer.from(header, "base64url").toString("utf8")), claims: JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) };
};

describe("Tjenestekontoen", () => {
  test("nøkkelfilen leses fra innstillingen, og linjeskift i nøkkelen tas imot i begge former", () => {
    const read = readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: keyFile() });
    expect(read).toEqual(account);

    const oneLine = readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: keyFile({ private_key: privateKey.replace(/\n/g, "\\n") }) });
    expect(oneLine?.private_key).toBe(privateKey);
  });

  test("mangler innstillingen, er den ikke JSON, eller mangler et felt, finnes ingen konto", () => {
    expect(readServiceAccount({})).toBeNull();
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: "  " })).toBeNull();
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: "ikke json {" })).toBeNull();
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: "[]" })).toBeNull();
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: keyFile({ client_email: undefined }) })).toBeNull();
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: keyFile({ private_key: 7 }) })).toBeNull();
    expect(readServiceAccount({ FIREBASE_SERVICE_ACCOUNT: keyFile({ project_id: "" }) })).toBeNull();
  });

  test("et JWT signert med kontoens nøkkel kan kontrolleres med den offentlige nøkkelen", () => {
    const jwt = signJwt(account, { iss: "x", n: 1 });
    const { ok, header, claims } = verified(jwt);
    expect(ok).toBe(true);
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claims).toEqual({ iss: "x", n: 1 });
  });

  test("innloggingsbeviset til Firebase har de feltene Google krever, og et annet tidspunkt gir et annet beløp", () => {
    const token = customToken(account, "konto-1", 1_000_000);
    const { ok, claims } = verified(token);
    expect(ok).toBe(true);
    expect(claims).toMatchObject({
      iss: account.client_email,
      sub: account.client_email,
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      iat: 1_000_000,
      exp: 1_003_600,
      uid: "konto-1",
    });
  });

  test("tilgangsnøkkelen hentes med JWT-forespørselen, og en feil fra Google gir en feil", async () => {
    const asked: { url: string; body?: string; headers?: Record<string, string> }[] = [];
    const ask: Fetch = async (url, init) => {
      asked.push({ url, body: init?.body, headers: init?.headers });
      return { ok: true, status: 200, json: async () => ({ access_token: "tilgang-1" }) };
    };
    await expect(accessToken(account, ask, 2_000)).resolves.toBe("tilgang-1");
    expect(asked[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(asked[0].headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    const body = new URLSearchParams(asked[0].body);
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const assertion = verified(body.get("assertion") ?? "");
    expect(assertion.ok).toBe(true);
    expect(assertion.claims).toMatchObject({ iss: account.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: 2_000, exp: 5_600 });

    const refused: Fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    await expect(accessToken(account, refused, 2_000)).rejects.toThrow("401");
  });

  test("kontoen med en adresse finnes, eller finnes ikke, hos Identity Toolkit", async () => {
    const ask: Fetch = async (_url, init) => {
      const body = JSON.parse(init?.body ?? "{}") as { email?: string[] };
      if (body.email?.[0] === "kari@example.org") return { ok: true, status: 200, json: async () => ({ users: [{ localId: "konto-7", emailVerified: false }] }) };
      return { ok: true, status: 200, json: async () => ({ kind: "identitytoolkit#GetAccountInfoResponse" }) };
    };
    expect(await findUserByEmail("menigheten", "kari@example.org", "tilgang", ask)).toEqual({ localId: "konto-7", emailVerified: false, disabled: false, hasPassword: false });
    expect(await findUserByEmail("menigheten", "ola@example.org", "tilgang", ask)).toBeNull();
  });
});
