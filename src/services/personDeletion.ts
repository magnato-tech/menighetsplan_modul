import { arrayRemove, collection, deleteField, doc, FieldPath, getDocs, query, where, writeBatch } from "firebase/firestore";
import { COLLECTIONS } from "../data/collections";
import { db } from "../firebase";
import type { PersonDeletion } from "../utils/personDeletion";

/**
 * Deletes a person from the register in one sending: out of the groups, off the tasks that come
 * (which get the status that follows), the answers to gatherings that come, and the person. What
 * lies beside the register (the login, the cards in the groups' directories) follows from the
 * register, and is taken away by the mirror in the administrator's browser (useRegisterMirror).
 */
export async function deletePersonWithTraces(personId: string, deletion: PersonDeletion): Promise<void> {
  // The person's answers to gatherings that have not been held: nobody is coming who is not there
  const answers = await getDocs(query(collection(db, COLLECTIONS.GATHERING_ATTENDANCES), where("personId", "==", personId)));
  const upcoming = new Set(deletion.upcomingGatheringIds);
  const batch = writeBatch(db);
  for (const answer of answers.docs) if (upcoming.has(String(answer.data().gatheringId))) batch.delete(answer.ref);
  for (const group of deletion.groups) {
    batch.update(
      doc(db, COLLECTIONS.GROUPS, group.id),
      "memberIds",
      arrayRemove(personId),
      new FieldPath("notificationPreferences", personId),
      deleteField(),
      new FieldPath("memberJoinedAt", personId),
      deleteField()
    );
  }
  for (const id of deletion.comingAssignmentIds) batch.delete(doc(db, COLLECTIONS.ASSIGNMENTS, id));
  for (const { taskId, status } of deletion.taskStatuses) batch.update(doc(db, COLLECTIONS.TASKS, taskId), { status });
  batch.delete(doc(db, COLLECTIONS.PERSONS, personId));
  await batch.commit();
}
