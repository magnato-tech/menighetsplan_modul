// The e-mail that tells the protokollansvarlig that a new task is on the board (Oppgaver), sent with
// the congregation's own e-mail service (Resend), as the sign-in e-mail is (see server/signInEmail.ts).
// The recipients are read from the register here: the protokollansvarlig, or else the administrators
// when there is no protokollansvarlig. At most one notice goes out in an hour: when another task was
// made in the hour before, nothing is sent, and the next notice says how many tasks are open.
// Nothing here ever throws, and nothing is written to the console but what went wrong.

import type { InstallationEnv } from "../src/installation";
import { usableEmail } from "../src/utils/emailRecipients";
import { renderSignInEmail, type SignInEmailPart } from "../src/utils/signInEmailMessage";
import { queryDocuments, readAll, readDocument, type Fetch, type RestDatabase } from "./firestoreRest";
import { DEFAULT_FROM_ADDRESS, EMAIL_SETTINGS, PERSONS, SEND_URL, SETTINGS_DOCUMENT, senderOf, settingOf } from "./emailSending";

// The name in src/data/collections.ts, written out here (see emailSending.ts for why)
const MEMBERSHIP_CLERK_TASKS = "membershipClerkTasks";

const HOUR_MS = 60 * 60 * 1000;
/** Within this time of another task, no notice is sent. */
export const NOTICE_GAP_MS = HOUR_MS;
/** The most addresses one notice goes to. */
export const MAX_RECIPIENTS = 10;

export interface NewTaskNotice {
  database: RestDatabase;
  env: InstallationEnv;
  ask: Fetch;
  /** The authorization header of the service account, as the register is read with it. */
  headers: Record<string, string>;
  /** The time of the task. */
  now: Date;
  /** Where the installation is, "https://menigheten.example". The button leads to Oppgaver there. */
  siteUrl: string;
  /** What the task is about, in a sentence that names no one who is not already on the board. `id` is the task itself, which is not counted as another. */
  task: { summary: string; id?: string };
}

/** Sends the notice when it is due. `sent` says whether the e-mail service took it. Never throws. */
export async function noticeNewTask(input: NewTaskNotice): Promise<{ sent: boolean }> {
  try {
    return await sendNotice(input);
  } catch (error) {
    console.error("Varselet om ny oppgave ble ikke sendt:", error instanceof Error ? error.message : error);
    return { sent: false };
  }
}

async function sendNotice({ database, env, ask, headers, now, siteUrl, task }: NewTaskNotice): Promise<{ sent: boolean }> {
  const apiKey = settingOf(env, EMAIL_SETTINGS.apiKey);
  if (!apiKey) return { sent: false };

  // One notice an hour: a task made in the hour before (other than this one) means it was already said
  const since = new Date(now.getTime() - NOTICE_GAP_MS).toISOString();
  const recent = await queryDocuments(database, MEMBERSHIP_CLERK_TASKS, { field: "createdAt", op: "GREATER_THAN_OR_EQUAL", value: since }, ask, headers);
  if (recent.some((row) => row.id !== task.id)) return { sent: false };

  // The register decides who is told: the protokollansvarlig, or else the administrators
  const persons = (await readAll(database, PERSONS, ask, headers)) as unknown as { email?: unknown; membershipClerk?: unknown; globalRole?: unknown }[];
  const addressesOf = (wanted: (person: (typeof persons)[number]) => boolean): string[] =>
    persons.filter(wanted).flatMap((person) => {
      const address = usableEmail(person.email);
      return address ? [address] : [];
    });
  let addresses = addressesOf((person) => person.membershipClerk === true);
  if (addresses.length === 0) addresses = addressesOf((person) => person.globalRole === "admin");
  const recipients = [...new Set(addresses)].slice(0, MAX_RECIPIENTS);
  if (recipients.length === 0) return { sent: false };

  const open = await queryDocuments(database, MEMBERSHIP_CLERK_TASKS, { field: "status", op: "EQUAL", value: "open" }, ask, headers);
  const settings = await readDocument(database, SETTINGS_DOCUMENT, ask, headers).catch(() => null);
  const churchName = (typeof settings?.churchName === "string" && settings.churchName.trim()) || "Menigheten";
  const base = siteUrl.replace(/\/+$/, "");

  const parts: SignInEmailPart[] = [
    { text: "Hei!" },
    { text: task.summary },
    { text: `Det er nå ${open.length} åpne oppgaver.` },
    { button: { label: "Åpne Oppgaver", url: `${base}/admin?tab=planlegger-medlemskap` } },
    { text: `Vennlig hilsen ${churchName}` },
    { text: "Du får denne e-posten fordi du er protokollansvarlig eller administrator." },
  ];
  const rendered = renderSignInEmail({ subject: `Ny oppgave i Oppgaver – ${churchName}`, churchName, parts });
  const from = senderOf(churchName, settingOf(env, EMAIL_SETTINGS.from) ?? DEFAULT_FROM_ADDRESS);
  // One e-mail to each recipient, sent in one request to the batch endpoint, so nobody sees the others' addresses
  const response = await ask(SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(recipients.map((to) => ({ from, to: [to], subject: rendered.subject, html: rendered.html, text: rendered.text }))),
  });
  if (!response.ok) {
    console.error("E-posttjenesten tok ikke imot varselet om ny oppgave:", response.status);
    return { sent: false };
  }
  return { sent: true };
}
