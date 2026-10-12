import { describe, expect, test } from "vitest";
import { buildMemberProposal } from "../src/data/newDocuments";
import { documentFields, sanitizeForFirestore } from "../src/utils/firestoreData";
import { pendingProposals, proposalName, PROPOSAL_NAME_MAX } from "../src/utils/memberProposals";
import type { MemberProposal } from "../src/types";

describe("Forslag om et medlem", () => {
  test("lagrer bare navnet, uten id i dokumentet", () => {
    const built = buildMemberProposal({ groupId: "gruppe", proposedBy: "leder", name: "  Anne   Berg " });
    expect(built?.name).toBe("Anne Berg");
    expect(built?.status).toBe("pending");
    const stored = sanitizeForFirestore(documentFields(built!));
    expect(stored).not.toHaveProperty("id");
    expect(Object.keys(stored).sort()).toEqual(["groupId", "name", "proposedAt", "proposedBy", "status"]);
  });

  test("tar ikke imot et tomt eller for langt navn", () => {
    expect(proposalName("   ")).toBeNull();
    expect(proposalName("a".repeat(PROPOSAL_NAME_MAX + 1))).toBeNull();
    expect(buildMemberProposal({ groupId: "gruppe", proposedBy: "leder", name: "   " })).toBeNull();
  });

  test("viser bare de som venter, de eldste først", () => {
    const proposals: MemberProposal[] = [
      { id: "ny", groupId: "g", name: "Ny", proposedBy: "leder", proposedAt: "2026-10-12T12:00:00.000Z", status: "pending" },
      { id: "ferdig", groupId: "g", name: "Ferdig", proposedBy: "leder", proposedAt: "2026-10-12T08:00:00.000Z", status: "added" },
      { id: "gammel", groupId: "g", name: "Gammel", proposedBy: "leder", proposedAt: "2026-10-12T09:00:00.000Z", status: "pending" },
      { id: "avvist", groupId: "g", name: "Avvist", proposedBy: "leder", proposedAt: "2026-10-12T07:00:00.000Z", status: "dismissed" },
    ];
    expect(pendingProposals(proposals).map((proposal) => proposal.id)).toEqual(["gammel", "ny"]);
  });
});