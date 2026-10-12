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

/** The proposals an administrator has not dealt with yet, oldest first. */
export function pendingProposals(proposals: readonly MemberProposal[]): MemberProposal[] {
  return proposals
    .filter((proposal) => proposal.status === "pending")
    .sort((a, b) => (a.proposedAt < b.proposedAt ? -1 : a.proposedAt > b.proposedAt ? 1 : 0));
}
