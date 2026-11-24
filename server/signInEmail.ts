// Sending the link that signs someone in to Min side, with the congregation's own e-mail service
// (Resend), where the installation is hosted (see server/vercel/innloggingsepost.ts). The browser
// gives the address; here the register is checked, the link is made by Firebase's own Identity
// Toolkit (so Firebase still checks it when it is opened), and one e-mail is sent. An installation
// that cannot do this answers "not-available", and the browser has Firebase send the link as before
// (see sendSignInLink in src/services/auth.ts).
//
// Every request is written to the log `loginRequests`, which the Innlogging tab in the admin reads:
// the address, the time, whether it is in the register, and what became of it. The log is kept for
// KEEP_DAYS days. Nothing here ever writes a full address to the console.

import { readDemoInstallation, readInstallationConfig, type InstallationEnv } from "../src/installation";
import { usableEmail } from "../src/utils/emailRecipients";
import { safeDestination } from "../src/utils/loginLink";
import { renderSignInEmail, type SignInEmailPart } from "../src/utils/signInEmailMessage";
import { addDocument, deleteDocuments, documentExists, queryDocuments, readDocument, type Fetch, type RestDatabase } from "./firestoreRest";
import { DEFAULT_FROM_ADDRESS, EMAIL_SETTINGS, SETTINGS_DOCUMENT, senderOf, settingOf } from "./emailSending";
import { accessToken, identityRequest, readServiceAccount } from "./serviceAccount";

// The names in src/data/collections.ts, written out here (see emailSending.ts for why)
const LOGINS = "logins";
/** The choices of what the installation shows (src/data/settingsRecords.ts SURFACES_DOC_ID). */
const SURFACES_DOCUMENT = "cms_settings/surfaces";
const LOGIN_REQUESTS = "loginRequests";
const ONE_EMAIL_URL = "https://api.resend.com/emails";
const IDENTITY_URL = "https://identitytoolkit.googleapis.com/v1/projects";

/** How many requests for one address in an hour get a link. The rest are logged, and not sent. */
export const REQUESTS_PER_ADDRESS_PER_HOUR = 3;
/** How many requests all addresses together get a link in a day. The rest are logged, and not sent. */
export const REQUESTS_PER_DAY = 300;
/** How many days the log is kept. */
export const KEEP_DAYS = 90;
/** How many old requests one call deletes. The rest wait for the next call. */
const DELETE_PER_CALL = 50;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FAILED = "E-posten kunne ikke sendes akkurat nå. Prøv igjen om litt.";

export interface SignInEmailRequest {
  env: InstallationEnv;
  /** Where the installation is, "https://menigheten.example", taken from the request. */
  siteUrl?: string;
  /** What the browser sent: {email, returnTo}. */
  body: unknown;
  ask: Fetch;
  /** The time of the request. Replaced in tests. */
  now?: Date;
}

export interface SignInEmailResponse {
  status: number;
  body: { ok: true } | { ok: false; reason: "not-available" | "bad-email" | "failed"; message?: string };
}

const unavailable = (): SignInEmailResponse => ({ status: 503, body: { ok: false, reason: "not-available" } });
const refuse = (status: number, reason: "bad-email" | "failed", message: string): SignInEmailResponse => ({ status, body: { ok: false, reason, message } });

/**
 * Where the link leads after signing in: the address the browser gave, when it is on the
 * installation's own address. Anything else, such as an address on another website, is answered
 * with Min side (see safeDestination in utils/loginLink.ts).
 */
export function continueUrlOf(site: URL, returnTo: unknown): string {
  const fallback = `${site.origin}/minside`;
  if (typeof returnTo !== "string") return fallback;
  try {
    const target = new URL(returnTo);
    if (target.origin !== site.origin) return fallback;
    return `${site.origin}${safeDestination(target.pathname + target.search)}`;
  } catch {
    return fallback;
  }
}

/** Whether this address has had its requests for the hour, or every address has had its requests for the day. */
async function isLimited(database: RestDatabase, address: string, now: Date, ask: Fetch, headers: Record<string, string>): Promise<boolean> {
  const hourAgo = new Date(now.getTime() - HOUR_MS).toISOString();
  // One condition only, as the database needs no index for it; the hour is checked here
  const mine = await queryDocuments(database, LOGIN_REQUESTS, { field: "email", op: "EQUAL", value: address }, ask, headers);
  if (mine.filter((row) => String(row.at) >= hourAgo).length >= REQUESTS_PER_ADDRESS_PER_HOUR) return true;
  // At most as many as the cap, which is all that has to be counted
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString();
  const today = await queryDocuments(database, LOGIN_REQUESTS, { field: "at", op: "GREATER_THAN_OR_EQUAL", value: dayAgo }, ask, headers, REQUESTS_PER_DAY);
  return today.length >= REQUESTS_PER_DAY;
}

/** Writes the request to the log, then deletes the oldest requests that are past keeping. Never changes the answer. */
async function logRequest(database: RestDatabase, address: string, at: Date, inRegister: boolean, result: "sent" | "failed" | "limited", ask: Fetch, headers: Record<string, string>): Promise<void> {
  try {
    await addDocument(database, LOGIN_REQUESTS, { email: address, at: at.toISOString(), inRegister, result }, ask, headers);
  } catch (error) {
    console.error("Forespørselen om innloggingslenke fikk ikke blitt logget:", error instanceof Error ? error.message : error);
  }
  try {
    const cutoff = new Date(at.getTime() - KEEP_DAYS * DAY_MS).toISOString();
    const old = await queryDocuments(database, LOGIN_REQUESTS, { field: "at", op: "LESS_THAN", value: cutoff }, ask, headers, DELETE_PER_CALL);
    await deleteDocuments(database, old.map((row) => `${LOGIN_REQUESTS}/${row.id}`), ask, headers);
  } catch {
    // Left for a later call: the old requests are not shown to anyone who is not an administrator anyway
  }
}

interface Delivery {
  ask: Fetch;
  database: RestDatabase;
  /** The token of the service account, as the header says. */
  bearer: string;
  projectId: string;
  apiKey: string;
  fromAddress: string;
  address: string;
  inRegister: boolean;
  continueUrl: string;
  siteOrigin: string;
}

/** Makes the link when the address is in the register, and sends the one e-mail. True when the e-mail service took it. Never throws. */
/** Where «Til nettsiden» leads: the address set for the sign-in page, else the congregation's own website when the one here is off, else here. */
async function websiteOf(database: RestDatabase, ask: Fetch, bearer: string, siteOrigin: string): Promise<string> {
  const surfaces = await readDocument(database, SURFACES_DOCUMENT, ask, { Authorization: `Bearer ${bearer}` }).catch(() => null);
  // The same test as utils/surfaces.ts makes, kept here so the server does not pull in the app's settings
  const web = (value: unknown): string => (typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : "");
  const set = web(surfaces?.signInBackUrl);
  if (set) return set;
  const own = surfaces?.ownWebsite !== false;
  const external = web(surfaces?.externalSiteUrl);
  return !own && external ? external : siteOrigin;
}

async function deliver({ ask, database, bearer, projectId, apiKey, fromAddress, address, inRegister, continueUrl, siteOrigin }: Delivery): Promise<boolean> {
  try {
    const settings = await readDocument(database, SETTINGS_DOCUMENT, ask, { Authorization: `Bearer ${bearer}` });
    const churchName = (typeof settings?.churchName === "string" && settings.churchName.trim()) || "Menigheten";

    let subject: string;
    let parts: SignInEmailPart[];
    if (inRegister) {
      // Made by Firebase, with the same address and the same place to go back to as its own e-mail would have
      const answer = await identityRequest(
        `${IDENTITY_URL}/${encodeURIComponent(projectId)}/accounts:sendOobCode`,
        bearer,
        { requestType: "EMAIL_SIGNIN", email: address, continueUrl, canHandleCodeInApp: true, returnOobLink: true },
        ask
      );
      const link = typeof answer.oobLink === "string" ? answer.oobLink : "";
      if (link === "") throw new Error("Identity Toolkit ga ingen innloggingslenke");
      subject = `Logg inn på Min side – ${churchName}`;
      parts = [
        { text: "Hei!" },
        { text: `Trykk på knappen for å logge inn på Min side hos ${churchName}. Du trenger ikke passord.` },
        { button: { label: "Logg inn", url: link } },
        { text: "Lenken virker bare én gang og bare en kort stund. Har du ikke bedt om den, kan du se bort fra denne e-posten." },
        { text: `Vennlig hilsen ${churchName}` },
      ];
    } else {
      subject = `Vi fant ikke adressen din – ${churchName}`;
      parts = [
        { text: "Hei!" },
        { text: `Noen ba om å logge inn på Min side hos ${churchName} med denne adressen, men den står ikke i menighetens register.` },
        { text: "Kanskje er du registrert med en annen e-postadresse? Prøv den, eller ta kontakt med menigheten, så hjelper vi deg." },
        { button: { label: "Til nettsiden", url: await websiteOf(database, ask, bearer, siteOrigin) } },
        { text: `Vennlig hilsen ${churchName}` },
      ];
    }

    const rendered = renderSignInEmail({ subject, churchName, parts });
    const response = await ask(ONE_EMAIL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: senderOf(churchName, fromAddress), to: [address], subject: rendered.subject, html: rendered.html, text: rendered.text }),
    });
    if (!response.ok) {
      console.error("E-posttjenesten tok ikke imot innloggingsepost:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    // Nothing of the address or the link is written here, only what went wrong
    console.error("Innloggingsepost fikk ikke blitt laget eller sendt:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** Sends the sign-in link for an address, or says why it cannot. Never throws. */
export async function sendSignInEmail({ env, siteUrl, body, ask, now = new Date() }: SignInEmailRequest): Promise<SignInEmailResponse> {
  const installation = readDemoInstallation(env) === null ? readInstallationConfig(env) : null;
  const account = readServiceAccount(env);
  const apiKey = settingOf(env, EMAIL_SETTINGS.apiKey);
  let site: URL;
  try {
    site = new URL(siteUrl ?? "");
  } catch {
    return unavailable();
  }
  if (!installation || !account || account.project_id !== installation.projectId || !apiKey) return unavailable();

  const request = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const address = usableEmail(request.email);
  if (!address) return refuse(400, "bad-email", "E-postadressen ser ikke riktig ut.");

  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const continueUrl = continueUrlOf(site, request.returnTo);
  const fromAddress = settingOf(env, EMAIL_SETTINGS.from) ?? DEFAULT_FROM_ADDRESS;
  try {
    const bearer = await accessToken(account, ask, Math.floor(now.getTime() / 1000));
    const headers = { Authorization: `Bearer ${bearer}` };
    // The register is read before the limit is checked, so that a request which is not sent is logged with the right answer
    const inRegister = await documentExists(database, `${LOGINS}/${encodeURIComponent(address)}`, ask, headers);
    const limited = await isLimited(database, address, now, ask, headers);
    const sent = limited ? false : await deliver({ ask, database, bearer, projectId: installation.projectId, apiKey, fromAddress, address, inRegister, continueUrl, siteOrigin: site.origin });
    const result = limited ? "limited" : sent ? "sent" : "failed";
    await logRequest(database, address, now, inRegister, result, ask, headers);
    return sent || limited ? { status: 200, body: { ok: true } } : refuse(502, "failed", FAILED);
  } catch (error) {
    console.error("Innloggingsepost fikk ikke sjekket registeret eller Google:", error instanceof Error ? error.message : error);
    // Without a sure answer from the register, the e-mail is left to Firebase as before rather than sent wrong
    return unavailable();
  }
}
