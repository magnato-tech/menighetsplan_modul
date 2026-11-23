import type { MembershipClerkTask } from "../types";

/** Attest er levert når e-post er sendt fra løsningen, eller brevpost er krysset av (eldre felt støttes). */
export function withdrawalAttestationDelivered(
  task: Pick<MembershipClerkTask, "attestationEmailedAt" | "attestationPosted" | "attestationSent">
): boolean {
  return !!(task.attestationEmailedAt || task.attestationPosted || task.attestationSent);
}

export function canSendWithdrawalAttestationEmail(
  task: Pick<MembershipClerkTask, "kind" | "status" | "cornerstoneUpdated" | "attestationEmailedAt">,
  personEmail: string | undefined
): { ok: true } | { ok: false; reason: string } {
  if (task.kind !== "withdrawal" || task.status !== "open") return { ok: false, reason: "Oppgaven er ikke en åpen utmelding." };
  if (!task.cornerstoneUpdated) return { ok: false, reason: "Bekreft Cornerstone først." };
  if (task.attestationEmailedAt) return { ok: false, reason: "Attest er allerede sendt på e-post." };
  if (!personEmail?.trim()) return { ok: false, reason: "Personen har ingen e-postadresse i registeret." };
  return { ok: true };
}