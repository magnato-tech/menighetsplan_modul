import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  FieldPath,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Task } from "../types";
import { COLLECTIONS, CMS_COLLECTIONS, GATHERING_READERS_COLLECTION } from "../data/collections";
import { gatheringReaderId } from "../utils/groupAccess";
import { sanitizeForFirestore, forUpdate, documentFields } from "../utils/firestoreData";
import type { AssignmentChange } from "../utils/staffing";

type PlanningCollection = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
type CollectionName = PlanningCollection | (typeof CMS_COLLECTIONS)[keyof typeof CMS_COLLECTIONS];

// ============================================================================
// Reading
// ============================================================================

/**
 * Calls back with the whole collection, now and after every change.
 * A local write shows up at once, before the server has answered; if the server
 * then rejects it, the listener is called again with what is actually stored.
 */
export function subscribeCollection<T extends { id: string }>(
  name: PlanningCollection,
  onChange: (items: T[]) => void
): () => void {
  return onSnapshot(
    collection(db, name),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T))),
    (error) => handleFirestoreError(error, OperationType.GET, name)
  );
}

/**
 * Calls back with the public part of the groups or the events, now and after every change:
 * what a visitor who is not in the register may read. The database rules let such a visitor
 * read a group or an event only when it is marked public, and a question that could also give
 * other documents is turned away whole. So the question sets the same condition as the rules.
 *
 * Both are marked with `isPublic` when they are stored (see buildGroup, and visibilityFields in
 * utils/visibility.ts). A document without the mark is not given.
 */
/** Calls back with the documents in `name` whose `field` matches, the way a member is allowed to ask. */
export function subscribeWhere<T extends { id: string }>(
  name: string,
  field: string,
  op: "==" | "array-contains",
  value: string,
  onChange: (items: T[]) => void,
  /** A second condition the rule asks for, such as only the open ones. */
  and?: { field: string; value: string | boolean }
): () => void {
  const conditions = and ? [where(field, op, value), where(and.field, "==", and.value)] : [where(field, op, value)];
  return onSnapshot(
    query(collection(db, name), ...conditions),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T))),
    (error) => handleFirestoreError(error, OperationType.GET, name)
  );
}

/** Calls back with one document, or null when it is not there. */
export function subscribeDocument<T extends { id: string }>(
  name: string,
  id: string,
  onChange: (item: T | null) => void
): () => void {
  return onSnapshot(
    doc(db, name, id),
    (snapshot) => onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null),
    (error) => handleFirestoreError(error, OperationType.GET, `${name}/${id}`)
  );
}

export function subscribePublicPart<T extends { id: string }>(
  name: typeof COLLECTIONS.GROUPS | typeof COLLECTIONS.GATHERINGS,
  onChange: (items: T[]) => void
): () => void {
  return onSnapshot(
    query(collection(db, name), where("isPublic", "==", true)),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T))),
    (error) => handleFirestoreError(error, OperationType.GET, name)
  );
}

// ============================================================================
// Writing
// ============================================================================

// Each function returns the promise of the write and leaves it to the caller to report
// a failure. New documents arrive fully built (see data/newDocuments.ts), id included.

export function createDocument<T extends { id: string }>(name: CollectionName, document: T): Promise<void> {
  return setDocument(name, document.id, document);
}

/**
 * Stores many new documents in one collection. A sending holds 400 at most, so a long list goes
 * in several. They are all started at once: each is in the browser's own copy straight away, also
 * when the network is slow, and the promise is of them all having reached the database.
 */
export function createDocuments<T extends { id: string }>(name: CollectionName, documents: readonly T[]): Promise<void> {
  const sendings: Promise<void>[] = [];
  for (let start = 0; start < documents.length; start += 400) {
    const batch = writeBatch(db);
    for (const document of documents.slice(start, start + 400)) batch.set(doc(db, name, document.id), sanitizeForFirestore(document));
    sendings.push(batch.commit());
  }
  return Promise.all(sendings).then(() => undefined);
}

/** Stores the whole document under the given id, replacing what was there. */
export function setDocument(name: CollectionName, id: string, document: object): Promise<void> {
  return setDoc(doc(db, name, id), sanitizeForFirestore(document));
}

/** A field given as `undefined` is removed from the stored document. */
export function updateDocument(name: CollectionName, id: string, updates: object): Promise<void> {
  return updateDoc(doc(db, name, id), forUpdate(updates));
}

export function deleteDocument(name: CollectionName, id: string): Promise<void> {
  return deleteDoc(doc(db, name, id));
}

// The writes below change lists and maps inside a document, or several documents at once.
// None of them reads before it writes, so two changes made at the same time cannot
// overwrite each other.

export function addGroupMember(groupId: string, personId: string): Promise<void> {
  return updateDoc(
    doc(db, COLLECTIONS.GROUPS, groupId),
    "memberIds",
    arrayUnion(personId),
    new FieldPath("memberJoinedAt", personId),
    new Date().toISOString()
  );
}

/** Leaving a group also ends any leader role in it. */
export function removeGroupMember(groupId: string, personId: string): Promise<void> {
  return updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), {
    memberIds: arrayRemove(personId),
    leaderIds: arrayRemove(personId),
    deputyLeaderIds: arrayRemove(personId),
  });
}

/** Hides or shows one module on the person's analysis board, without reading the list first. */
export function setAnalyticsModuleHidden(personId: string, moduleId: string, hidden: boolean): Promise<void> {
  return updateDoc(
    doc(db, COLLECTIONS.PERSONS, personId),
    "analyticsHiddenModules",
    hidden ? arrayUnion(moduleId) : arrayRemove(moduleId)
  );
}

export function setGroupNotifications(groupId: string, personId: string, enabled: boolean): Promise<void> {
  return updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), new FieldPath("notificationPreferences", personId), enabled);
}

/**
 * Stores a change to who is on a task together with the task status that follows from it
 * (see taskStatusFor), so the status can never disagree with the assignments.
 */
export function saveAssignmentChange(taskId: string, change: AssignmentChange, taskStatus: Task["status"]): Promise<void> {
  const batch = writeBatch(db);
  const assignmentRef = (id: string) => doc(db, COLLECTIONS.ASSIGNMENTS, id);
  if (change.add) {
    batch.set(assignmentRef(change.add.id), sanitizeForFirestore(documentFields(change.add)));
    if (change.add.gatheringId && change.add.personId) {
      // One's own mark names only the gathering. A leader's mark for someone else also names the group.
      const mark = change.add.nameGroupId
        ? { gatheringId: change.add.gatheringId, personId: change.add.personId, nameGroupId: change.add.nameGroupId }
        : { gatheringId: change.add.gatheringId, personId: change.add.personId };
      // The mark is sent on its own, and a refusal is not an error. The person very often has the
      // mark already (they are in the gathering's group, or stand on another task there), and
      // only an administrator may write over one that exists. Sent together with the answer, that
      // refusal stopped the whole sending: nobody could take a second task on the same gathering.
      void setDoc(doc(db, GATHERING_READERS_COLLECTION, gatheringReaderId(change.add.gatheringId, change.add.personId)), mark).catch(() => undefined);
    }
  }
  for (const { id, fields } of change.update ?? []) batch.update(assignmentRef(id), forUpdate(fields));
  if (change.remove) batch.delete(assignmentRef(change.remove));
  batch.update(doc(db, COLLECTIONS.TASKS, taskId), { status: taskStatus });
  return batch.commit();
}

/**
 * Deletes an event together with its tasks and everyone on them, in one write: either all of it
 * is gone, or nothing is. An event can then never be left with tasks nobody can find, or people
 * on tasks of an event that is not there.
 */
export function deleteGatheringAndStaffing(gatheringId: string, taskIds: string[], assignmentIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const id of assignmentIds) batch.delete(doc(db, COLLECTIONS.ASSIGNMENTS, id));
  for (const id of taskIds) batch.delete(doc(db, COLLECTIONS.TASKS, id));
  batch.delete(doc(db, COLLECTIONS.GATHERINGS, gatheringId));
  return batch.commit();
}

/**
 * Deletes a CMS page and moves its sub-pages to the top level in the same write,
 * so the database never holds a page that points at a deleted parent.
 */
export function deletePage(pageId: string, subPageIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, CMS_COLLECTIONS.PAGES, pageId));
  for (const subPageId of subPageIds) {
    batch.update(doc(db, CMS_COLLECTIONS.PAGES, subPageId), {
      parentId: null,
      parentPageId: null,
    });
  }
  return batch.commit();
}

/**
 * Updates menuOrder and navOrder for a list of pages in a single atomic batch.
 */
export function reorderPages(orderedPageIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedPageIds.forEach((pageId, index) => {
    const order = index + 1;
    batch.update(doc(db, CMS_COLLECTIONS.PAGES, pageId), {
      menuOrder: order,
      navOrder: order,
    });
  });
  return batch.commit();
}
