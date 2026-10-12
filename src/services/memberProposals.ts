import { arrayUnion, doc, setDoc, writeBatch, FieldPath } from "firebase/firestore";
import { COLLECTIONS } from "../data/collections";
import { buildMemberProposal, buildPerson } from "../data/newDocuments";
import { db } from "../firebase";
import { documentFields, sanitizeForFirestore } from "../utils/firestoreData";
import { deleteDocument, updateDocument } from "./firestore";

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

/** The administrator sets the proposal aside. The person is not added. */
export function dismissProposal(proposalId: string): Promise<void> {
  return updateDocument(COLLECTIONS.MEMBER_PROPOSALS, proposalId, {
    status: "dismissed",
    decidedAt: new Date().toISOString(),
  });
}

const decided = () => new Date().toISOString();

/** Membership and the outcome land together, or not at all. */
export async function acceptProposal(proposalId: string, groupId: string, personId: string): Promise<void> {
  const decidedAt = decided();
  const batch = writeBatch(db);
  batch.update(
    doc(db, COLLECTIONS.GROUPS, groupId),
    "memberIds",
    arrayUnion(personId),
    new FieldPath("memberJoinedAt", personId),
    decidedAt
  );
  batch.update(doc(db, COLLECTIONS.MEMBER_PROPOSALS, proposalId), { status: "added", decidedAt });
  await batch.commit();
}

/** The new person, the membership and the outcome land together, or not at all. */
export async function acceptProposalAsNew(proposalId: string, groupId: string, name: string): Promise<void> {
  const person = buildPerson({ name });
  const decidedAt = decided();
  const batch = writeBatch(db);
  batch.set(doc(db, COLLECTIONS.PERSONS, person.id), sanitizeForFirestore(person));
  batch.update(
    doc(db, COLLECTIONS.GROUPS, groupId),
    "memberIds",
    arrayUnion(person.id),
    new FieldPath("memberJoinedAt", person.id),
    decidedAt
  );
  batch.update(doc(db, COLLECTIONS.MEMBER_PROPOSALS, proposalId), { status: "added", decidedAt });
  await batch.commit();
}
