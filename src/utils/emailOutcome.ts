import { toEmailAudience, usableEmail, type EmailAudience } from "./emailRecipients";

// What comes back from a sending, and the log the admin page keeps of what has been sent. The
// log holds numbers and, when a sending stopped halfway, the ids of those who are left: never a
// name, an address or the text that was sent to them.

export type EmailRefusal =
  | "demo"
  | "not-configured"
  | "not-signed-in"
  | "not-admin"
  | "bad-request"
  | "no-reply-to"
  | "no-recipients"
  | "database"
  /** The browser got no answer from where the e-mail is sent. */
  | "unreachable";

/** Why a sending stopped before everyone had got theirs. */
export type EmailStop = "quota" | "rejected" | "unreachable";

export type EmailOutcome =
  | {
      ok: true;
      mode: "test" | "send";
      /** How many addresses the e-mail service took the e-mail for. */
      sent: number;
      /** How many in the audience have no usable address. */
      withoutEmail: number;
      /** Null when everyone got theirs. */
      stopped: EmailStop | null;
      /** The persons who did not get theirs because the sending stopped. Ids only. */
      remainingPersonIds: string[];
      /** What the e-mail service said when it stopped, for the administrator to pass on. */
      detail?: string;
    }
  | { ok: false; reason: EmailRefusal; message: string };

export interface EmailLogEntry {
  id: string;
  /** When it was sent, an ISO time. */
  sentAt: string;
  audience: EmailAudience;
  /** What the audience was called when it was sent: a group may be renamed or deleted later. */
  audienceLabel: string;
  subject: string;
  sent: number;
  withoutEmail: number;
  stopped: EmailStop | null;
  /** Those who are still to get it. Emptied when the rest has been sent. */
  remainingPersonIds: string[];
}

export interface EmailRecord {
  /** Where an answer to an e-mail goes. Empty until the administrator has put one in. */
  replyTo: string;
  /** The newest first. */
  log: EmailLogEntry[];
}

export const EMAIL_LOG_MAX = 50;

const STOPS: EmailStop[] = ["quota", "rejected", "unreachable"];
const countOf = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

/** What is stored, read without trusting it. */
export function emailRecordOf(data: Record<string, unknown> | undefined): EmailRecord {
  const entries = Array.isArray(data?.log) ? data.log : [];
  const log = entries.flatMap((entry): EmailLogEntry[] => {
    if (!entry || typeof entry !== "object") return [];
    const { id, sentAt, audience, audienceLabel, subject, sent, withoutEmail, stopped, remainingPersonIds } = entry as Record<string, unknown>;
    const to = toEmailAudience(audience);
    if (typeof id !== "string" || typeof sentAt !== "string" || Number.isNaN(Date.parse(sentAt)) || !to || typeof subject !== "string") return [];
    return [
      {
        id,
        sentAt,
        audience: to,
        audienceLabel: typeof audienceLabel === "string" ? audienceLabel : "",
        subject,
        sent: countOf(sent),
        withoutEmail: countOf(withoutEmail),
        stopped: STOPS.includes(stopped as EmailStop) ? (stopped as EmailStop) : null,
        remainingPersonIds: Array.isArray(remainingPersonIds) ? remainingPersonIds.filter((value): value is string => typeof value === "string") : [],
      },
    ];
  });
  return { replyTo: usableEmail(data?.replyTo) ?? "", log };
}

/** The log with one more sending first, and no longer than it is kept. */
export const withLogEntry = (log: readonly EmailLogEntry[], entry: EmailLogEntry): EmailLogEntry[] => [entry, ...log.filter((other) => other.id !== entry.id)].slice(0, EMAIL_LOG_MAX);

/** The log after the rest of a stopped sending has gone out: the entry no longer has anyone left. */
export const withRestSent = (log: readonly EmailLogEntry[], id: string, stillLeft: readonly string[], stopped: EmailStop | null): EmailLogEntry[] =>
  log.map((entry) => (entry.id === id ? { ...entry, remainingPersonIds: [...stillLeft], stopped } : entry));

export const DOUBLE_SEND_HOURS = 24;

/**
 * The newest sending of the same subject to the same audience within the last day: what the
 * administrator is asked about before the same e-mail goes out twice.
 */
export function recentSameSending(log: readonly EmailLogEntry[], audienceKeyOf: (audience: EmailAudience) => string, audience: EmailAudience, subject: string, now: Date): EmailLogEntry | null {
  const since = now.getTime() - DOUBLE_SEND_HOURS * 3_600_000;
  const same = subject.trim().toLocaleLowerCase("nb");
  return (
    log.find(
      (entry) =>
        entry.sent > 0 &&
        Date.parse(entry.sentAt) >= since &&
        audienceKeyOf(entry.audience) === audienceKeyOf(audience) &&
        entry.subject.trim().toLocaleLowerCase("nb") === same
    ) ?? null
  );
}

/** What a stopped sending is told with. */
export function stopMessage(stopped: EmailStop, left: number, detail?: string): string {
  const rest = left === 1 ? "1 person gjenstår" : `${left} personer gjenstår`;
  if (stopped === "quota") return `E-posttjenesten tar ikke imot flere e-poster nå: grensen for i dag eller denne måneden er nådd. ${rest}. Send til dem som gjenstår i morgen.`;
  if (stopped === "unreachable") return `E-posttjenesten svarte ikke. ${rest}. Prøv igjen om litt.`;
  return `E-posttjenesten tok ikke imot utsendingen${detail ? ` («${detail}»)` : ""}. ${rest}.`;
}
