import { collection, deleteField, doc, getDocs, query, where, writeBatch, type DocumentReference } from "firebase/firestore";
import { CMS_COLLECTIONS, COLLECTIONS } from "../data/collections";
import { db } from "../firebase";

// Deleting a group, with what only exists because of it (see utils/groupDeletion.ts).

const ownedBy = (collectionName: string, groupId: string) => query(collection(db, collectionName), where("groupId", "==", groupId));

/** What lies in the database for the group besides the group itself: asked when the warning is shown. */
export async function readGroupTraces(groupId: string): Promise<{ messages: number; proposals: number }> {
  const [messages, proposals] = await Promise.all([getDocs(ownedBy(COLLECTIONS.GROUP_MESSAGES, groupId)), getDocs(ownedBy(COLLECTIONS.MEMBER_PROPOSALS, groupId))]);
  return { messages: messages.size, proposals: proposals.size };
}

/**
 * Deletes the group, its messages and the proposals for new participants, and takes the group off
 * the roles and templates that named it. The group itself goes in the last sending, so a failure
 * on the way leaves a group that can be deleted again, not loose ends without a group.
 */
export async function deleteGroupWithTraces(groupId: string, pointing: { roleIds: readonly string[]; templateIds: readonly string[] }): Promise<void> {
  const [messages, proposals] = await Promise.all([getDocs(ownedBy(COLLECTIONS.GROUP_MESSAGES, groupId)), getDocs(ownedBy(COLLECTIONS.MEMBER_PROPOSALS, groupId))]);
  type Step = { remove: DocumentReference } | { release: DocumentReference };
  const steps: Step[] = [
    ...[...messages.docs, ...proposals.docs].map((found) => ({ remove: found.ref })),
    ...[...pointing.roleIds, ...pointing.templateIds].map((id) => ({ release: doc(db, CMS_COLLECTIONS.SETTINGS, id) })),
    { remove: doc(db, COLLECTIONS.GROUPS, groupId) },
  ];
  for (let start = 0; start < steps.length; start += 400) {
    const batch = writeBatch(db);
    for (const step of steps.slice(start, start + 400)) {
      if ("remove" in step) batch.delete(step.remove);
      else batch.update(step.release, { groupId: deleteField(), updatedAt: new Date().toISOString() });
    }
    await batch.commit();
  }
}
