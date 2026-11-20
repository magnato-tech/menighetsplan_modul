// Utmeldingsattest på e-post til medlemmet, med kopi til menighetens svaradresse (fra e-postoppsettet).

import { readDemoInstallation, readInstallationConfig, type InstallationEnv } from "../src/installation";
import type { MembershipClerkTask, Person } from "../src/types";
import {
  withdrawalAttestationDocxBase64,
  withdrawalAttestationEmailSubject,
  withdrawalAttestationEmailText,
  type WithdrawalAttestationInput,
} from "../src/utils/withdrawalAttestation";
import type { EmailOutcome } from "../src/utils/emailOutcome";
import { usableEmail } from "../src/utils/emailRecipients";
import { FirestoreRestError, readDocument, signedInAs, type Fetch } from "./firestoreRest";
import { DEFAULT_FROM_ADDRESS, EMAIL_DOCUMENT, EMAIL_SETTINGS, PERSONS, SEND_URL, SETTINGS_DOCUMENT, emailOfToken, senderOf } from "./emailSending";

const MEMBERSHIP_CLERK_TASKS = "membershipClerkTasks";

export type WithdrawalAttestationEmailOutcome = EmailOutcome & { to?: string; copyTo?: string };

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function sendWithdrawalAttestationEmail({
  env,
  siteUrl,
  idToken,
  body,
  ask,
  wait = pause,
}: {
  env: InstallationEnv;
  siteUrl?: string;
  idToken?: string | null;
  body: unknown;
  ask: Fetch;
  wait?: (ms: number) => Promise<void>;
}): Promise<{ status: number; body: WithdrawalAttestationEmailOutcome }> {
  const refuse = (reason: Exclude<EmailOutcome, { ok: true }>["reason"], message: string, status = 400) =>
    ({ status, body: { ok: false, reason, message } });

  if (readDemoInstallation(env) !== null) {
    return { status: 403, body: { ok: false, reason: "demo", message: "Demoen sender ikke e-post." } };
  }
  const installation = readInstallationConfig(env);
  const apiKey = typeof env[EMAIL_SETTINGS.apiKey] === "string" ? env[EMAIL_SETTINGS.apiKey].trim() : "";
  if (!installation || !apiKey || !siteUrl) {
    return { status: 503, body: { ok: false, reason: "not-configured", message: "E-post er ikke satt opp for denne installasjonen ennå." } };
  }

  const caller = idToken ? emailOfToken(idToken) : null;
  if (!idToken || !caller) {
    return { status: 401, body: { ok: false, reason: "not-signed-in", message: "Du må være logget inn for å sende attest." } };
  }

  const request = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const taskId = typeof request.taskId === "string" ? request.taskId.trim() : "";
  if (!taskId) return refuse("bad-request", "Mangler oppgave å sende for.");

  const database = { projectId: installation.projectId, databaseId: installation.firestoreDatabaseId };
  const as = signedInAs(idToken);

  let task: MembershipClerkTask | undefined;
  let member: Person | undefined;

  try {
    const login = await readDocument(database, `logins/${caller}`, ask, as).catch(() => null);
    const clerkPersonId = typeof login?.personId === "string" ? login.personId : null;
    if (!clerkPersonId) return { status: 401, body: { ok: false, reason: "not-signed-in", message: "Fant ikke innloggingen din." } };

    const clerk = (await readDocument(database, `${PERSONS}/${clerkPersonId}`, ask, as)) as Person | null;
    if (!clerk) return refuse("bad-request", "Fant ikke deg i registeret.");

    const maySend = clerk.globalRole === "admin" || clerk.membershipClerk === true;
    if (!maySend) {
      return {
        status: 403,
        body: { ok: false, reason: "not-admin", message: "Bare protokollansvarlig eller administrator kan sende attest." },
      };
    }

    const rawTask = await readDocument(database, `${MEMBERSHIP_CLERK_TASKS}/${taskId}`, ask, as);
    if (!rawTask) return refuse("bad-request", "Fant ikke oppgaven.");
    task = rawTask as unknown as MembershipClerkTask;
    if (task.kind !== "withdrawal" || task.status !== "open") return refuse("bad-request", "Oppgaven er ikke en åpen utmelding.");
    if (task.cornerstoneUpdated !== true) return refuse("bad-request", "Bekreft at Cornerstone er oppdatert først.");
    if (task.attestationEmailedAt) return refuse("bad-request", "Attest er allerede sendt på e-post.");

    member = (await readDocument(database, `${PERSONS}/${task.personId}`, ask, as)) as Person | null ?? undefined;
    if (!member) return refuse("bad-request", "Fant ikke personen.");
  } catch (error) {
    const status = error instanceof FirestoreRestError ? error.status : 0;
    if (status === 401 || status === 403) {
      return { status, body: { ok: false, reason: status === 401 ? "not-signed-in" : "not-admin", message: "Ingen tilgang." } };
    }
    console.error("Utmeldingsattest fikk ikke lest databasen:", error instanceof Error ? error.message : error);
    return { status: 502, body: { ok: false, reason: "database", message: "Registeret kunne ikke leses akkurat nå. Prøv igjen." } };
  }

  const to = usableEmail(member!.email);
  if (!to) return refuse("no-recipients", "Personen har ingen e-postadresse i registeret.");

  const [settings, record] = await Promise.all([
    readDocument(database, SETTINGS_DOCUMENT, ask, as).catch(() => null),
    readDocument(database, EMAIL_DOCUMENT, ask, as).catch(() => null),
  ]);
  const churchName = (typeof settings?.churchName === "string" && settings.churchName.trim()) || "Menigheten";
  const replyTo = usableEmail(record?.replyTo) ?? usableEmail(typeof settings?.email === "string" ? settings.email : undefined);
  if (!replyTo) {
    return {
      status: 400,
      body: { ok: false, reason: "no-reply-to", message: "Legg inn svaradresse under Send e-post før du sender attest." },
    };
  }

  const attestationInput: WithdrawalAttestationInput = {
    churchName,
    person: { name: task!.personName, birthDate: member!.birthDate },
    withdrawCongregation: task!.withdrawCongregation === true,
    withdrawDenomination: task!.withdrawDenomination === true,
    withdrawalDate: task!.withdrawalDate ?? new Date().toISOString().slice(0, 10),
  };

  let attachmentBase64: string;
  try {
    attachmentBase64 = await withdrawalAttestationDocxBase64(attestationInput);
  } catch (error) {
    console.error("Kunne ikke lage attest:", error instanceof Error ? error.message : error);
    return { status: 500, body: { ok: false, reason: "unreachable", message: "Attesten kunne ikke lages." } };
  }

  const fromAddress =
    (typeof env[EMAIL_SETTINGS.from] === "string" && env[EMAIL_SETTINGS.from].trim()) || DEFAULT_FROM_ADDRESS;
  const from = senderOf(churchName, fromAddress);
  const subject = withdrawalAttestationEmailSubject(task!.personName);
  const text = withdrawalAttestationEmailText(churchName);
  const filename = `utmeldingsattest-${task!.personName.replace(/\s+/g, "-")}.docx`;

  const payload = {
    from,
    to: [to],
    cc: [replyTo],
    reply_to: replyTo,
    subject,
    text,
    attachments: [{ filename, content: attachmentBase64 }],
  };

  await wait(0);
  try {
    const response = await ask(SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify([payload]),
    });
    if (!response.ok) {
      const answer = (await response.json().catch(() => null)) as { message?: unknown } | null;
      const detail = typeof answer?.message === "string" ? answer.message.slice(0, 300) : undefined;
      console.error("E-posttjenesten tok ikke imot utmeldingsattest:", response.status, detail ?? "");
      return {
        status: 200,
        body: {
          ok: false,
          reason: "unreachable",
          message: detail ? `E-posten ble ikke sendt: ${detail}` : "E-posten ble ikke sendt. Prøv igjen.",
        },
      };
    }
  } catch (error) {
    console.error("E-posttjenesten svarte ikke på utmeldingsattest:", error instanceof Error ? error.message : error);
    return { status: 200, body: { ok: false, reason: "unreachable", message: "Fikk ikke kontakt med e-postutsendingen." } };
  }

  return {
    status: 200,
    body: { ok: true, mode: "send", sent: 1, withoutEmail: 0, to, copyTo: replyTo },
  };
}