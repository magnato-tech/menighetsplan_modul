import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { CMS_COLLECTIONS } from "../data/collections";
import { EMAIL_DOC_ID, EMAIL_RECORD } from "../data/settingsRecords";
import { auth, db } from "../firebase";
import type { EmailDraft } from "../utils/emailMessage";
import { emailRecordOf, type EmailLogEntry, type EmailOutcome, type EmailRecord } from "../utils/emailOutcome";
import type { EmailAudience } from "../utils/emailRecipients";

// E-mail from the administration. The sending itself is done where the installation is hosted
// (server/emailSending.ts): the browser names who it is for and what it says, and proves who is
// asking. What the page keeps (where answers go, and the log) is one document in cms_settings,
// marked with its recordType like the other records there (see data/settingsRecords.ts).

/** Where the sending is done. Only an installation at the hosting has it: a developer's machine has not. */
export const EMAIL_SEND_PATH = "/api/epost";

export type EmailSendRequest = EmailDraft & ({ mode: "test" } | { mode: "send"; audience: EmailAudience; onlyPersonIds?: string[] });

/** Asks for an e-mail to be sent, as the one who is signed in. Never throws: what went wrong, comes back as the answer. */
export async function requestEmail(request: EmailSendRequest): Promise<EmailOutcome> {
  const unreachable: EmailOutcome = { ok: false, reason: "unreachable", message: "Fikk ikke kontakt med e-postutsendingen. Sjekk nettet og prøv igjen." };
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return { ok: false, reason: "not-signed-in", message: "Du må være logget inn for å sende e-post." };
    const response = await fetch(EMAIL_SEND_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(request),
    });
    const answer = (await response.json().catch(() => null)) as EmailOutcome | null;
    return answer && typeof answer === "object" && typeof answer.ok === "boolean" ? answer : unreachable;
  } catch {
    return unreachable;
  }
}

const recordDoc = () => doc(db, CMS_COLLECTIONS.SETTINGS, EMAIL_DOC_ID);

/** Follows what the page keeps. Returns the function that stops following. */
export function subscribeEmailRecord(onChange: (record: EmailRecord) => void, onError?: (error: Error) => void): () => void {
  return onSnapshot(
    recordDoc(),
    (snapshot) => {
      const data = snapshot.data();
      onChange(emailRecordOf(snapshot.exists() && data?.recordType === EMAIL_RECORD ? data : undefined));
    },
    (error) => onError?.(error)
  );
}

/** Stores where answers go. */
export function saveReplyTo(replyTo: string): Promise<void> {
  return setDoc(recordDoc(), { recordType: EMAIL_RECORD, replyTo: replyTo.trim().toLowerCase(), updatedAt: new Date().toISOString() }, { merge: true });
}

/** Stores the whole log, in place of the one that was there. */
export function saveEmailLog(log: readonly EmailLogEntry[]): Promise<void> {
  return setDoc(recordDoc(), { recordType: EMAIL_RECORD, log, updatedAt: new Date().toISOString() }, { merge: true });
}
