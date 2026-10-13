import { collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import { COLLECTIONS } from "../data/collections";
import { db } from "../firebase";

// Emptying the group chats, as an administrator does before a new season. Only the messages go:
// the groups, who is in them, and everything else stand.

const messagesOf = (groupId: string | null) =>
  groupId === null ? collection(db, COLLECTIONS.GROUP_MESSAGES) : query(collection(db, COLLECTIONS.GROUP_MESSAGES), where("groupId", "==", groupId));

/** How many messages each group has, by the group's id. Read from the database, not from what the screen happens to hold. */
export async function countGroupMessages(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const message of (await getDocs(messagesOf(null))).docs) {
    const groupId = String(message.data().groupId ?? "");
    counts[groupId] = (counts[groupId] ?? 0) + 1;
  }
  return counts;
}

/** Deletes the messages of one group, or of every group when no group is given. Says how many were deleted. */
export async function deleteGroupMessages(groupId: string | null): Promise<number> {
  const found = (await getDocs(messagesOf(groupId))).docs;
  for (let start = 0; start < found.length; start += 400) {
    const batch = writeBatch(db);
    for (const message of found.slice(start, start + 400)) batch.delete(message.ref);
    await batch.commit();
  }
  return found.length;
}
