// The Google service account of the installation, from the setting FIREBASE_SERVICE_ACCOUNT: the
// content of the key file Firebase gives when a private key is made (Prosjektinnstillinger →
// Tjenestekontoer). The functions at the hosting use it to sign someone in with a login link (see
// loginLinkRedeem.ts) and to read the register as the service account, which the rules do not stop.
//
// No Google library is used (firebase-admin is not a dependency): the token is a JWT signed with
// node:crypto, and every request is a plain fetch, as in firestoreRest.ts.

import { createSign } from "node:crypto";
import type { Fetch } from "./firestoreRest";

/** The setting in Vercel that holds the whole key file. */
export const SERVICE_ACCOUNT_SETTING = "FIREBASE_SERVICE_ACCOUNT";

/** The three fields of the key file the functions need. */
export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/** The audience a custom token for Firebase Auth is made for. */
export const CUSTOM_TOKEN_AUDIENCE = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const IDENTITY_URL = "https://identitytoolkit.googleapis.com/v1/projects";
const HOUR_SECONDS = 3600;

const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);

/** The account in the setting, or null when it is missing, not JSON, or a field is missing. */
export function readServiceAccount(env: Record<string, unknown>): ServiceAccount | null {
  const raw = textOf(env[SERVICE_ACCOUNT_SETTING]);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const fields = parsed as Record<string, unknown>;
  const projectId = textOf(fields.project_id);
  const clientEmail = textOf(fields.client_email);
  const privateKey = textOf(fields.private_key);
  if (projectId === null || clientEmail === null || privateKey === null) return null;
  // A key pasted in as one line keeps its line breaks as the two characters \n
  return { project_id: projectId, client_email: clientEmail, private_key: privateKey.replace(/\\n/g, "\n") };
}

const base64url = (value: string): string => Buffer.from(value, "utf8").toString("base64url");

/** A JWT signed with the account's private key (RS256). */
export function signJwt(account: ServiceAccount, claims: Record<string, unknown>): string {
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key).toString("base64url");
  return `${unsigned}.${signature}`;
}

/** A custom token: what the browser signs in with (signInWithCustomToken) as the account `uid`. */
export function customToken(account: ServiceAccount, uid: string, nowSeconds: number): string {
  return signJwt(account, {
    iss: account.client_email,
    sub: account.client_email,
    aud: CUSTOM_TOKEN_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + HOUR_SECONDS,
    uid,
  });
}

/** An access token for Google's APIs, from the JWT bearer grant. */
export async function accessToken(account: ServiceAccount, ask: Fetch, nowSeconds: number): Promise<string> {
  const assertion = signJwt(account, {
    iss: account.client_email,
    scope: CLOUD_SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + HOUR_SECONDS,
  });
  const response = await ask(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`,
  });
  if (!response.ok) throw new Error(`Google svarte ${response.status} ved innlogging av tjenestekontoen`);
  const answer = (await response.json()) as { access_token?: unknown };
  if (typeof answer.access_token !== "string") throw new Error("Google ga ingen tilgangsnøkkel");
  return answer.access_token;
}

/** One request to the Identity Toolkit, as the service account. Thrown when Google refuses. */
export async function identityRequest(url: string, token: string, body: unknown, ask: Fetch): Promise<Record<string, unknown>> {
  const response = await ask(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Identity Toolkit svarte ${response.status}`);
  return ((await response.json()) ?? {}) as Record<string, unknown>;
}

/** The account with the address, or null when there is none. */
export async function findUserByEmail(projectId: string, email: string, token: string, ask: Fetch): Promise<{ localId: string; emailVerified: boolean; disabled: boolean; hasPassword: boolean } | null> {
  const answer = await identityRequest(`${IDENTITY_URL}/${encodeURIComponent(projectId)}/accounts:lookup`, token, { email: [email] }, ask);
  const user = Array.isArray(answer.users) ? (answer.users[0] as Record<string, unknown> | undefined) : undefined;
  const localId = textOf(user?.localId);
  if (!user || localId === null) return null;
  const providers = Array.isArray(user.providerUserInfo) ? (user.providerUserInfo as { providerId?: unknown }[]) : [];
  const hasPassword = typeof user.passwordHash === "string" || providers.some((provider) => provider?.providerId === "password");
  return { localId, emailVerified: user.emailVerified === true, disabled: user.disabled === true, hasPassword };
}

/** A new account for the address, its address already confirmed. Returns its id. */
export async function createUser(projectId: string, email: string, token: string, ask: Fetch): Promise<string> {
  const answer = await identityRequest(`${IDENTITY_URL}/${encodeURIComponent(projectId)}/accounts`, token, { email, emailVerified: true }, ask);
  const localId = textOf(answer.localId);
  if (localId === null) throw new Error("Identity Toolkit ga ingen konto-id");
  return localId;
}

/** Confirms the address of an account that has not confirmed it. */
export async function markEmailVerified(projectId: string, localId: string, token: string, ask: Fetch): Promise<void> {
  await identityRequest(`${IDENTITY_URL}/${encodeURIComponent(projectId)}/accounts:update`, token, { localId, emailVerified: true }, ask);
}
