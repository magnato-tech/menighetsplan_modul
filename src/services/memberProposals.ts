import { doc, setDoc } from "firebase/firestore";
import { COLLECTIONS } from "../data/collections";
import { buildMemberProposal, buildPerson } from "../data/newDocuments";
import { db } from "../firebase";
import { documentFields, sanitizeForFirestore } from "../utils/firestoreData";
import { addGroupMember, createDocument, deleteDocument, updateDocument } from "./firestore";

/** Sends a name for an administrator to approve. The id is the document's place, not a field. */
export async function proposeMember(groupId: string, proposedBy: string, name: string): Promise<void> {
  const proposal = buildMemberProposal({ groupId, proposedBy, name });
  if (!proposal) throw new Error("Skriv et navn.");
  await setDoc(
    doc(db, COLLECTIONS.MEMBER_PROPOSALS, proposal.id),
    sanitizeForFirestore(documentFields(proposal))
  );
}

/** Takes back a proposal that is still waiting. */
export function withdrawProposal(proposalId: string): Promise<void> {
  return deleteDocument(COLLECTIONS.MEMBER_PROPOSALS, proposalId);
}

/** The administrator sets the proposal aside. */
export function dismissProposal(proposalId: string): Promise<void> {
  return updateDocument(COLLECTIONS.MEMBER_PROPOSALS, proposalId, { status: "dismissed" });
}

/**
 * Puts someone who is already in the register into the group, and only then marks the proposal
 * dealt with. Adding is idempotent, so a second try still finishes the proposal.
 */
export async function acceptProposal(proposalId: string, groupId: string, personId: string): Promise<void> {
  await addGroupMember(groupId, personId);
  await updateDocument(COLLECTIONS.MEMBER_PROPOSALS, proposalId, { status: "added" });
}

/** Creates a person from the proposed name, puts them in the group, and then marks the proposal. */
export async function acceptProposalAsNew(proposalId: string, groupId: string, name: string): Promise<void> {
  const person = buildPerson({ name });
  await createDocument(COLLECTIONS.PERSONS, person);
  await addGroupMember(groupId, person.id);
  await updateDocument(COLLECTIONS.MEMBER_PROPOSALS, proposalId, { status: "added" });
}
