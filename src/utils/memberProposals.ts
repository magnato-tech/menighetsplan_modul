import type { MemberProposal } from "../types";

/** How long a proposed name may be. The same limit is in firestore.rules. */
export const PROPOSAL_NAME_MAX = 80;

/**
 * The name as it is stored: one line, no spaces at the ends.
 * Null when there is nothing to store, or it is longer than the rules allow.
 */
export function proposalName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > PROPOSAL_NAME_MAX) return null;
  return name;
}

/** How long a dealt-with proposal stays on the screen, counted from decidedAt. */
export const PROPOSAL_OUTCOME_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const byProposedAt = (a: MemberProposal, b: MemberProposal) =>
  a.proposedAt < b.proposedAt ? -1 : a.proposedAt > b.proposedAt ? 1 : 0;

/** The proposals an administrator has not dealt with yet, oldest first. */
export function pendingProposals(proposals: readonly MemberProposal[]): MemberProposal[] {
  return proposals.filter((proposal) => proposal.status === "pending").sort(byProposedAt);
}

/** Whether a dealt-with proposal is still inside the 30 days from decidedAt. */
export function outcomeStillShown(proposal: Pick<MemberProposal, "status" | "decidedAt">, now: number): boolean {
  if (proposal.status === "pending" || !proposal.decidedAt) return false;
  const decided = Date.parse(proposal.decidedAt);
  return !Number.isNaN(decided) && now - decided <= PROPOSAL_OUTCOME_DAYS * DAY_MS;
}

/** Waiting proposals, and outcomes from the last 30 days. */
export function visibleProposals(proposals: readonly MemberProposal[], now: number = Date.now()): MemberProposal[] {
  return proposals.filter((proposal) => proposal.status === "pending" || outcomeStillShown(proposal, now)).sort(byProposedAt);
}

/** Dealt-with proposals the mirror may delete: no decidedAt, or decided more than 30 days ago. */
export function proposalIdsToForget(proposals: readonly MemberProposal[], now: number = Date.now()): string[] {
  return proposals
    .filter((proposal) => proposal.status !== "pending" && !outcomeStillShown(proposal, now))
    .map((proposal) => proposal.id)
    .sort();
}

/** What the screen says about a proposal that has been dealt with. */
export function proposalOutcomeLabel(status: MemberProposal["status"]): "Lagt til" | "Ikke lagt til" | null {
  if (status === "added") return "Lagt til";
  if (status === "dismissed") return "Ikke lagt til";
  return null;
}

/**
 * A warning when the name is already a member of the group, or already waiting.
 * The proposal may still be sent: names are not unique.
 */
export function duplicateProposalWarning(
  name: string,
  memberNames: readonly string[],
  pendingNames: readonly string[]
): string | null {
  const cleaned = proposalName(name);
  if (!cleaned) return null;
  const same = (other: string) => other.trim().toLocaleLowerCase("nb") === cleaned.toLocaleLowerCase("nb");
  if (memberNames.some(same)) return "En med det navnet er allerede i gruppen.";
  if (pendingNames.some(same)) return "Det navnet er allerede foreslått.";
  return null;
}
