// The report from the sign-in page of a signed-in account that the register does not know (see
// src/services/loginProblem.ts). The browser says nothing but that it was stopped: here the token is
// checked with Google, the register is read with the service account, and a task is made for the
// board (server/loginProblemTask.ts), unless the address is in the register after all.
//
// Limit: at most REPORTS_PER_HOUR tasks are touched by reports in an hour, all addresses together. A
// task counts once however many tries it has, as the number of tasks touched is what one query gives.

import { readDemoInstallation, readInstallationConfig, type InstallationEnv } from "../src/installation";
import { usableEmail } from "../src/utils/emailRecipients";
import { loginAddressesOf } from "../src/utils/personEmails";
import type { Person } from "../src/types";
import { documentExists, queryDocuments, readAll, type Fetch, type RestDatabase } from "./firestoreRest";
import { PERSONS } from "./emailSending";
import { recordLoginProblem } from "./loginProblemTask";
import { accessToken, readServiceAccount } from "./serviceAccount";

// The names in src/data/collections.ts, written out here (see emailSending.ts for why)
const LOGINS = "logins";
const MEMBERSHIP_CLERK_TASKS = "membershipClerkTasks";
const ACCOUNT_LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

/** How many tasks reports may touch in an hour, before the rest are refused. */
export const REPORTS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export interface LoginProblemRequest {
  env: InstallationEnv;
  /** The token of the one who is signed in, from the request's Authorization header. */
  idToken: string | null;
  ask: Fetch;
  /** The time of the report. Replaced in tests. */
  now?: Date;
  /** Where the installation is, "https://menigheten.example". Taken from the request. */
  siteUrl?: string;
}

export interface LoginProblemResponse {
  status: number;
  body: { ok: true; inRegister?: true } | { ok: false; reason?: string; message?: string };
}

const unavailable = (): LoginProblemResponse => ({ status: 503, body: { ok: false } });

/**
 * The address of a token, when Google confirms the token and the address is confirmed. Null for
 * anything else: a false or old token, or an address that is not confirmed.
 */
export async function verifiedAddressOf(apiKey: string, idToken: string, ask: Fetch): Promise<string | null> {
  const response = await ask(`${ACCOUNT_LOOKUP_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;
  const answer = (await response.json().catch(() => null)) as { users?: { email?: unknown; emailVerified?: unknown }[] } | null;
  const user = Array.isArray(answer?.users) ? answer?.users[0] : undefined;
  if (!user || user.emailVerified !== true) return null;
  return usableEmail(user.email);
}

/** Whether the reports have touched the limit of tasks in the hour before. */
async function overLimit(database: RestDatabase, now: Date, ask: Fetch, headers: Record<string, string>): Promise<boolean> {
  const hourAgo = new Date(now.getTime() - HOUR_MS).toISOString();
  const touched = await queryDocuments(database, MEMBERSHIP_CLERK_TASKS, { field: "lastAttemptAt", op: "GREATER_THAN_OR_EQUAL", value: hourAgo }, ask, headers, REPORTS_PER_HOUR);
  return touched.length >= REPORTS_PER_HOUR;
}

/** Records that a signed-in address is not in the register, unless it is. Never throws. */
export async function reportLoginProblem({ env, idToken, ask, now = new Date(), siteUrl }: LoginProblemRequest): Promise<LoginProblemResponse> {
  const installation = readDemoInstallation(env) === null ? readInstallationConfig(env) : null;
  const account = readServiceAccount(env);
  if (!installation || !account || account.project_id !== installation.projectId || !siteUrl) return unavailable();
  if (!idToken) return { status: 401, body: { ok: false, reason: "not-signed-in" } };

  try {
    const address = await verifiedAddressOf(installation.apiKey, idToken, ask);
    if (!address) return { status: 401, body: { ok: false, reason: "not-signed-in" } };

    const bearer = await accessToken(account, ask, Math.floor(now.getTime() / 1000));
    const headers = { Authorization: `Bearer ${bearer}` };
    const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
    if (await documentExists(database, `${LOGINS}/${encodeURIComponent(address)}`, ask, headers)) {
      return { status: 200, body: { ok: true, inRegister: true } };
    }
    if (await overLimit(database, now, ask, headers)) {
      return { status: 429, body: { ok: false, reason: "too-many", message: "For mange meldinger akkurat nå. Prøv igjen senere." } };
    }

    // Read as the service account: the register is not shown to the one who asks
    const persons = (await readAll(database, PERSONS, ask, headers)) as unknown as Person[];
    const holders = persons.filter((person) => loginAddressesOf(person).includes(address)).length;
    await recordLoginProblem({
      database,
      address,
      reason: holders >= 2 ? "shared" : "noMatch",
      now,
      ask,
      headers,
      env,
      siteUrl,
    });
    return { status: 200, body: { ok: true } };
  } catch (error) {
    console.error("Innloggingsproblemet fikk ikke blitt meldt:", error instanceof Error ? error.message : error);
    return unavailable();
  }
}
