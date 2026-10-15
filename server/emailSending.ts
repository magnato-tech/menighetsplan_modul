// E-mail from the administration to leaders, volunteers and, as a newsletter, to the members,
// sent where the installation is hosted (see server/vercel/epost.ts). The browser never holds the key to the e-mail service, and never
// says who the e-mail goes to: it names an audience, and the register is read here, as the one
// who asks. The database's own rules refuse everyone but an administrator.

import { readDemoInstallation, readInstallationConfig, type InstallationEnv } from "../src/installation";
import { renderEmail, toEmailDraft, type EmailDraft } from "../src/utils/emailMessage";
import type { EmailOutcome, EmailRefusal, EmailStop } from "../src/utils/emailOutcome";
import { emailRecipients, firstNameOf, isNewsletter, toEmailAudience, usableEmail, type EmailRecipient } from "../src/utils/emailRecipients";
import { TEST_UNSUBSCRIBE_TOKEN, isNewsletterToken, newNewsletterToken, newsletterBannerOf, newsletterBannerUrlOf, optedOutPersonIds, unsubscribeUrlOf } from "../src/utils/newsletter";
import type { Group, Person } from "../src/types";
import { FirestoreRestError, readAll, readDocument, setTextFields, signedInAs, type Fetch } from "./firestoreRest";

// The names in src/data/collections.ts and src/data/settingsRecords.ts, written out: those files
// are the browser's (tests/email-sending.test.ts holds them together)
export const PERSONS = "persons";
export const GROUPS = "groups";
export const SETTINGS_DOCUMENT = "cms_settings/global";
export const EMAIL_DOCUMENT = "cms_settings/email";
export const NEWSLETTER_BANNER_DOCUMENT = "cms_settings/newsletter-banner";
export const NEWSLETTER_BANNER_RECORD = "newsletterBanner";
export const NEWSLETTER_OPT_OUTS = "newsletterOptOuts";

/** The settings of the installation the sending needs, beside the database's own. */
export const EMAIL_SETTINGS = {
  /** The key to the e-mail service. Only where the installation is hosted, never in the browser. */
  apiKey: "RESEND_API_KEY",
  /** The address the e-mail is sent from. Its domain must be approved at the e-mail service. */
  from: "EMAIL_FROM_ADDRESS",
} as const;

export const DEFAULT_FROM_ADDRESS = "ikke-svar@menighetsplan.no";
export const SEND_URL = "https://api.resend.com/emails/batch";
/** As many as the e-mail service takes in one request. */
export const BATCH_SIZE = 100;

export interface EmailRequest {
  env: InstallationEnv;
  /** Where the installation is, "https://menigheten.example". The button in the e-mail leads there. */
  siteUrl?: string;
  /** The token of the one who is signed in, from the request's Authorization header. */
  idToken?: string | null;
  /** What the browser sent. */
  body: unknown;
  ask: Fetch;
  /** Waits between two requests to the e-mail service, which takes two a second. Replaced in tests. */
  wait?: (ms: number) => Promise<void>;
}

export interface EmailResponse {
  status: number;
  body: EmailOutcome;
}

const MESSAGES: Record<Exclude<EmailRefusal, "unreachable">, [number, string]> = {
  demo: [403, "Demoen sender ikke e-post."],
  "not-configured": [503, "E-post er ikke satt opp for denne installasjonen ennå."],
  "not-signed-in": [401, "Du må være logget inn for å sende e-post."],
  "not-admin": [403, "Bare en administrator kan sende e-post."],
  "bad-request": [400, "E-posten kan ikke sendes slik den er."],
  "no-reply-to": [400, "Legg inn adressen svar skal gå til, før du sender."],
  "no-recipients": [400, "Ingen av mottakerne har en e-postadresse."],
  database: [502, "Registeret kunne ikke leses akkurat nå. Prøv igjen."],
  "rules-outdated": [409, "Databasen har ikke fått reglene for nyhetsbrev ennå. Lim inn de nye reglene i Firebase, og prøv igjen."],
};

const refuse = (reason: Exclude<EmailRefusal, "unreachable">, message?: string): EmailResponse => ({
  status: MESSAGES[reason][0],
  body: { ok: false, reason, message: message ?? MESSAGES[reason][1] },
});

const settingOf = (env: InstallationEnv, name: string): string | undefined => {
  const value = env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

/**
 * The address a token is for. The token is not checked here: it is handed to the database, which
 * checks it and refuses a false one, before anything is read or sent.
 */
export function emailOfToken(idToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: unknown };
    return usableEmail(payload.email);
  } catch {
    return null;
  }
}

/** The sender as the inbox shows it: the congregation's name, and the address of the installation. */
export function senderOf(churchName: string, address: string): string {
  const name = churchName.replace(/["<>\r\n]/g, "").trim();
  return name ? `"${name}" <${address}>` : address;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function sendEmail({ env, siteUrl, idToken, body, ask, wait = pause }: EmailRequest): Promise<EmailResponse> {
  if (readDemoInstallation(env) !== null) return refuse("demo");
  const installation = readInstallationConfig(env);
  const apiKey = settingOf(env, EMAIL_SETTINGS.apiKey);
  if (!installation || !apiKey || !siteUrl) return refuse("not-configured");

  const caller = idToken ? emailOfToken(idToken) : null;
  if (!idToken || !caller) return refuse("not-signed-in");

  const request = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const mode = request.mode === "test" ? "test" : request.mode === "send" ? "send" : null;
  const draft: EmailDraft | null = toEmailDraft(request);
  const audience = toEmailAudience(request.audience);
  const newsletter = audience !== null && isNewsletter(audience);
  const only = Array.isArray(request.onlyPersonIds) ? request.onlyPersonIds.filter((id): id is string => typeof id === "string") : undefined;
  if (!mode || !draft || (mode === "send" && !audience)) return refuse("bad-request");

  // The register, read as the one who asks. Only an administrator may list it.
  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const as = signedInAs(idToken);
  let persons: Person[];
  let groups: Group[];
  try {
    persons = (await readAll(database, PERSONS, ask, as)) as unknown as Person[];
    const me = persons.find((person) => usableEmail(person.email) === caller);
    if (me?.globalRole !== "admin") return refuse("not-admin");
    groups = mode === "send" ? ((await readAll(database, GROUPS, ask, as)) as unknown as Group[]) : [];
  } catch (error) {
    const status = error instanceof FirestoreRestError ? error.status : 0;
    if (status === 401) return refuse("not-signed-in");
    if (status === 403 || status === 7) return refuse("not-admin");
    console.error("E-postutsendingen fikk ikke lest registeret:", error instanceof Error ? error.message : error);
    return refuse("database");
  }

  const [settings, record] = await Promise.all([
    readDocument(database, SETTINGS_DOCUMENT, ask, as).catch(() => null),
    readDocument(database, EMAIL_DOCUMENT, ask, as).catch(() => null),
  ]);
  const churchName = (typeof settings?.churchName === "string" && settings.churchName.trim()) || "Menigheten";
  const replyTo = usableEmail(record?.replyTo);
  if (!replyTo) return refuse("no-reply-to");

  // A newsletter is not sent to those who have unsubscribed. Whether anyone has, is only known
  // where the database's rules have the collection; older rules refuse it, and then nothing is sent.
  let unsubscribed = new Set<string>();
  let bannerUrl: string | null = null;
  if (newsletter) {
    try {
      const optOuts = mode === "send" ? await readAll(database, NEWSLETTER_OPT_OUTS, ask, as) : [];
      unsubscribed = optedOutPersonIds(persons, optOuts.map((optOut) => optOut.id));
    } catch (error) {
      const status = error instanceof FirestoreRestError ? error.status : 0;
      if (status === 403 || status === 7) return refuse("rules-outdated");
      console.error("Nyhetsbrevet fikk ikke lest hvem som har meldt seg av:", error instanceof Error ? error.message : error);
      return refuse("database");
    }
    const banner = await readDocument(database, NEWSLETTER_BANNER_DOCUMENT, ask, as).catch(() => null);
    if (banner?.recordType === NEWSLETTER_BANNER_RECORD && newsletterBannerOf(banner.imageUrl)) {
      bannerUrl = newsletterBannerUrlOf(siteUrl, typeof banner.updatedAt === "string" ? banner.updatedAt : "1");
    }
  }

  let recipients: EmailRecipient[];
  let withoutEmail = 0;
  if (mode === "test") {
    const me = persons.find((person) => usableEmail(person.email) === caller);
    recipients = [{ email: caller, personIds: me ? [me.id] : [], firstName: firstNameOf(me?.name) }];
  } else {
    const found = emailRecipients(audience!, persons, groups, only, unsubscribed);
    recipients = found.recipients;
    withoutEmail = found.withoutEmail.length;
    if (recipients.length === 0) return refuse("no-recipients");
  }

  // Everyone a newsletter goes to, has a key of their own in the link that unsubscribes them.
  // A person who has none yet, is given one before anything is sent.
  const tokens = new Map<string, string>();
  if (newsletter) {
    const byId = new Map(persons.map((person) => [person.id, person]));
    const missing: { path: string; fields: Record<string, string> }[] = [];
    for (const recipient of recipients) {
      if (mode === "test") {
        tokens.set(recipient.email, TEST_UNSUBSCRIBE_TOKEN);
        continue;
      }
      const owner = recipient.personIds.map((id) => byId.get(id)).find((person) => isNewsletterToken(person?.newsletterToken));
      const token = owner?.newsletterToken ?? newNewsletterToken();
      if (!owner) missing.push({ path: `${PERSONS}/${recipient.personIds[0]}`, fields: { newsletterToken: token } });
      tokens.set(recipient.email, token);
    }
    try {
      for (let start = 0; start < missing.length; start += 400) await setTextFields(database, missing.slice(start, start + 400), ask, as);
    } catch (error) {
      console.error("Nyhetsbrevet fikk ikke lagret lenkene til avmelding:", error instanceof Error ? error.message : error);
      return refuse("database");
    }
  }

  const from = senderOf(churchName, settingOf(env, EMAIL_SETTINGS.from) ?? DEFAULT_FROM_ADDRESS);
  let sent = 0;
  let stopped: EmailStop | null = null;
  let detail: string | undefined;

  for (let start = 0; start < recipients.length; start += BATCH_SIZE) {
    if (start > 0) await wait(600);
    const batch = recipients.slice(start, start + BATCH_SIZE).map((recipient) => {
      const unsubscribeUrl = newsletter ? unsubscribeUrlOf(siteUrl, tokens.get(recipient.email)!) : null;
      const rendered = renderEmail({ draft, churchName, siteUrl, firstName: recipient.firstName, ...(unsubscribeUrl ? { newsletter: { unsubscribeUrl, bannerUrl } } : {}) });
      return {
        from,
        to: [recipient.email],
        reply_to: replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } } : {}),
      };
    });
    try {
      const response = await ask(SEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        const answer = (await response.json().catch(() => null)) as { message?: unknown } | null;
        stopped = response.status === 429 ? "quota" : "rejected";
        detail = typeof answer?.message === "string" ? answer.message.slice(0, 300) : undefined;
        console.error("E-posttjenesten tok ikke imot utsendingen:", response.status, detail ?? "");
        break;
      }
      sent += batch.length;
    } catch (error) {
      stopped = "unreachable";
      console.error("E-posttjenesten svarte ikke:", error instanceof Error ? error.message : error);
      break;
    }
  }

  const remainingPersonIds = stopped ? recipients.slice(sent).flatMap((recipient) => recipient.personIds) : [];
  return { status: 200, body: { ok: true, mode, sent, withoutEmail, stopped, remainingPersonIds, ...(detail ? { detail } : {}) } };
}
