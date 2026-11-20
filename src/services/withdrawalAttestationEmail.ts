import { auth } from "../firebase";
import type { MembershipClerkTask } from "../types";
import type { EmailOutcome } from "../utils/emailOutcome";
import { EMAIL_SEND_PATH } from "./email";
import { recordWithdrawalAttestationDelivery } from "./membershipClerkTasks";

export type WithdrawalAttestationEmailOutcome = EmailOutcome & { to?: string; copyTo?: string };

async function requestWithdrawalAttestationEmail(taskId: string): Promise<WithdrawalAttestationEmailOutcome> {
  const unreachable: WithdrawalAttestationEmailOutcome = {
    ok: false,
    reason: "unreachable",
    message: "Fikk ikke kontakt med e-postutsendingen. Sjekk nettet og prøv igjen.",
  };
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return { ok: false, reason: "not-signed-in", message: "Du må være logget inn for å sende attest." };
    const response = await fetch(EMAIL_SEND_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ mode: "withdrawalAttestation", taskId }),
    });
    const answer = (await response.json().catch(() => null)) as WithdrawalAttestationEmailOutcome | null;
    return answer && typeof answer === "object" && typeof answer.ok === "boolean" ? answer : unreachable;
  } catch {
    return unreachable;
  }
}

/** Sender attest med vedlegg og lagrer logg i registeret. */
export async function sendWithdrawalAttestationEmail(
  task: MembershipClerkTask,
  clerkId: string
): Promise<{ to: string; copyTo: string }> {
  const outcome = await requestWithdrawalAttestationEmail(task.id);
  if (!outcome.ok) throw new Error(outcome.message ?? "Kunne ikke sende e-post.");
  const to = outcome.to ?? "";
  const copyTo = outcome.copyTo ?? "";
  await recordWithdrawalAttestationDelivery(task, clerkId, {
    channel: "email",
    to,
    copyTo,
  });
  return { to, copyTo };
}