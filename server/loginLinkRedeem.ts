// Signing someone in with a login link (see loginLinkToken.ts). The link's token says which person
// it is for; the register is read as the service account to check that the person is still there,
// still has the address the link was sent to, and is not an administrator or web editor. Then the
// account of the address is found, or made, and a custom token is given back for the browser to
// sign in with. Nothing in the database's rules changes for this.

import { readDemoInstallation, readInstallationConfig, type InstallationEnv } from "../src/installation";
import type { Person } from "../src/types";
import { loginAddressesOf } from "../src/utils/personEmails";
import { readDocument, type Fetch } from "./firestoreRest";
import { emailHashOf, readLoginToken } from "./loginLinkToken";
import { accessToken, createUser, customToken, findUserByEmail, markEmailVerified, readServiceAccount } from "./serviceAccount";

const PERSONS = "persons";

export const LOGIN_LINK_NOT_SET_UP = "Innloggingslenker er ikke satt opp for denne installasjonen ennå.";
const INVALID = "Lenken er ikke gyldig. Logg inn på vanlig måte.";
const EXPIRED = "Lenken er gått ut. Logg inn på vanlig måte, eller be om en ny e-post.";
const NO_LONGER = "Denne lenken kan ikke brukes lenger. Logg inn på vanlig måte.";
const DISABLED = "Kontoen er sperret. Ta kontakt med menigheten.";
const UNREACHABLE = "Innloggingen kunne ikke fullføres akkurat nå. Prøv igjen.";

export interface LoginRedeemRequest {
  env: InstallationEnv;
  /** What the browser sent: {token}. */
  body: unknown;
  ask: Fetch;
  now?: Date;
}

export interface LoginRedeemResponse {
  status: number;
  body: { ok: true; customToken: string } | { ok: false; message: string };
}

const refuse = (status: number, message: string): LoginRedeemResponse => ({ status, body: { ok: false, message } });

/** Turns a login link into a custom token for the account of the person it was sent to. */
export async function redeemLoginLink({ env, body, ask, now = new Date() }: LoginRedeemRequest): Promise<LoginRedeemResponse> {
  if (readDemoInstallation(env) !== null) return refuse(403, "Demoen har ikke innloggingslenker.");
  const installation = readInstallationConfig(env);
  const account = readServiceAccount(env);
  if (!installation || !account || account.project_id !== installation.projectId) return refuse(503, LOGIN_LINK_NOT_SET_UP);

  const nowSeconds = Math.floor(now.getTime() / 1000);
  const token = body && typeof body === "object" ? (body as Record<string, unknown>).token : undefined;
  const link = readLoginToken(account, token, nowSeconds);
  if (link === "invalid") return refuse(400, INVALID);
  if (link === "expired") return refuse(410, EXPIRED);

  try {
    const bearer = await accessToken(account, ask, nowSeconds);
    const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
    const person = await readDocument(database, `${PERSONS}/${link.personId}`, ask, { Authorization: `Bearer ${bearer}` });
    // The address the link was sent to: one of the person's login addresses, the main one or an extra one that may sign in
    const email = person ? loginAddressesOf(person as Pick<Person, "email" | "extraEmails">).find((address) => emailHashOf(address) === link.emailHash) : undefined;
    if (!person || !email) return refuse(403, NO_LONGER);
    if (person.globalRole === "admin" || person.globalRole === "nettredaktor") return refuse(403, NO_LONGER);

    const found = await findUserByEmail(installation.projectId, email, bearer, ask);
    if (found?.disabled) return refuse(403, DISABLED);
    // An account with a password whose address nobody has confirmed may have been made by someone
    // else with this address. It is not confirmed here, or that password would sign in as the person.
    if (found && !found.emailVerified && found.hasPassword) return refuse(403, NO_LONGER);
    const localId = found ? found.localId : await createUser(installation.projectId, email, bearer, ask);
    if (found && !found.emailVerified) await markEmailVerified(installation.projectId, localId, bearer, ask);

    return { status: 200, body: { ok: true, customToken: customToken(account, localId, nowSeconds) } };
  } catch (error) {
    // The token and the key are never written to the log, only what went wrong
    console.error("Innloggingslenken fikk ikke logget inn:", error instanceof Error ? error.message : error);
    return refuse(502, UNREACHABLE);
  }
}
