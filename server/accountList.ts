// The accounts of the installation, as Firebase Authentication has them, for the Innlogging tab in
// the admin (see src/utils/accountOverview.ts). Read where the installation is hosted (see
// server/vercel/kontoer.ts), with the service account, as the one who asks: only an administrator
// may see the list. Nothing is stored, and only the fields the tab needs are given back: never the
// id of an account, its tokens, or its password.

import { readDemoInstallation, readInstallationConfig, type InstallationEnv } from "../src/installation";
import type { AccountListAnswer, AccountProvider, AccountRefusal, AccountRow } from "../src/utils/accountOverview";
import { usableEmail } from "../src/utils/emailRecipients";
import type { Person } from "../src/types";
import { FirestoreRestError, readAll, signedInAs, type Fetch } from "./firestoreRest";
import { PERSONS, emailOfToken } from "./emailSending";
import { accessToken, readServiceAccount, type ServiceAccount } from "./serviceAccount";

const BATCH_URL = "https://identitytoolkit.googleapis.com/v1/projects";
/** As many accounts as Google gives in one page. */
const PAGE_SIZE = 1000;
/** Enough for 20 000 accounts. A congregation has a few hundred. */
const MAX_PAGES = 20;

export interface AccountListRequest {
  env: InstallationEnv;
  /** The token of the one who is signed in, from the request's Authorization header. */
  idToken: string | null;
  ask: Fetch;
  /** The time, in milliseconds. Replaced in tests. */
  now?: () => number;
}

export interface AccountListResponse {
  status: number;
  body: AccountListAnswer;
}

type ServerRefusal = Exclude<AccountRefusal, "network" | "unavailable">;

const MESSAGES: Record<ServerRefusal, [number, string]> = {
  demo: [409, "Demoen har ingen ekte kontoer. Oversikten virker i menighetens egen installasjon."],
  "not-configured": [503, "Innlogging er ikke satt opp for denne installasjonen ennå."],
  "not-signed-in": [401, "Du må være logget inn for å se innloggingene."],
  "no-service-account": [503, "Tjenestenøkkelen FIREBASE_SERVICE_ACCOUNT mangler hos Vercel. Uten den kan oversikten ikke hente kontoene."],
  "not-admin": [403, "Bare en administrator kan se innloggingene."],
  database: [502, "Registeret kunne ikke leses akkurat nå. Prøv igjen."],
  google: [502, "Firebase svarte ikke. Prøv igjen om litt."],
};

const refuse = (reason: ServerRefusal): AccountListResponse => ({
  status: MESSAGES[reason][0],
  body: { ok: false, reason, message: MESSAGES[reason][1] },
});

const textOf = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  return text === "" ? null : text;
};

/** Firebase gives a time as a string of milliseconds since 1970. */
const isoOf = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const time = new Date(Number(value));
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
};

/** The part of one account the tab shows. Anything else Google gives is left out here. */
function rowOf(user: Record<string, unknown>): AccountRow {
  const email = textOf(user.email);
  const providers = Array.isArray(user.providerUserInfo) ? (user.providerUserInfo as ({ providerId?: unknown } | null)[]) : [];
  const provider: AccountProvider = providers.some((info) => info?.providerId === "google.com") ? "google" : email !== null ? "e-postlenke" : "annet";
  return {
    email,
    emailVerified: user.emailVerified === true,
    disabled: user.disabled === true,
    provider,
    createdAt: isoOf(user.createdAt),
    lastLoginAt: isoOf(user.lastLoginAt),
  };
}

/** Every account of the project, page by page. Thrown when Google refuses or cannot be reached. */
async function accountsOf(account: ServiceAccount, ask: Fetch, nowSeconds: number): Promise<AccountRow[]> {
  const token = await accessToken(account, ask, nowSeconds);
  const rows: AccountRow[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const next = pageToken === null ? "" : `&nextPageToken=${encodeURIComponent(pageToken)}`;
    const response = await ask(`${BATCH_URL}/${encodeURIComponent(account.project_id)}/accounts:batchGet?maxResults=${PAGE_SIZE}${next}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Identity Toolkit svarte ${response.status}`);
    const answer = ((await response.json()) ?? {}) as { users?: unknown; nextPageToken?: unknown };
    if (Array.isArray(answer.users)) {
      for (const user of answer.users) if (user && typeof user === "object") rows.push(rowOf(user as Record<string, unknown>));
    }
    if (typeof answer.nextPageToken !== "string" || answer.nextPageToken === "") break;
    pageToken = answer.nextPageToken;
  }
  return rows;
}

/** The accounts of the installation, for an administrator who asks. Never throws. */
export async function listAccounts({ env, idToken, ask, now = () => Date.now() }: AccountListRequest): Promise<AccountListResponse> {
  if (readDemoInstallation(env) !== null) return refuse("demo");
  const installation = readInstallationConfig(env);
  if (!installation) return refuse("not-configured");

  const caller = idToken ? emailOfToken(idToken) : null;
  if (!idToken || !caller) return refuse("not-signed-in");

  const account = readServiceAccount(env);
  if (!account || account.project_id !== installation.projectId) return refuse("no-service-account");

  // Only an administrator may list the register, so the one who asks is checked against it first
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  try {
    const persons = (await readAll(database, PERSONS, ask, signedInAs(idToken))) as unknown as Pick<Person, "email" | "globalRole">[];
    const me = persons.find((person) => usableEmail(person.email) === caller);
    if (me?.globalRole !== "admin") return refuse("not-admin");
  } catch (error) {
    const status = error instanceof FirestoreRestError ? error.status : 0;
    if (status === 401) return refuse("not-signed-in");
    if (status === 403 || status === 7) return refuse("not-admin");
    console.error("Innloggingsoversikten fikk ikke lest registeret:", error instanceof Error ? error.message : error);
    return refuse("database");
  }

  try {
    const accounts = await accountsOf(account, ask, Math.floor(now() / 1000));
    return { status: 200, body: { ok: true, accounts, fetchedAt: new Date(now()).toISOString() } };
  } catch (error) {
    console.error("Innloggingsoversikten fikk ikke hentet kontoene:", error instanceof Error ? error.message : error);
    return refuse("google");
  }
}
