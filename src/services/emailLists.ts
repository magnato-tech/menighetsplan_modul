import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { EMAIL_LISTS_COLLECTION } from "../data/collections";
import { db } from "../firebase";
import type { EmailList } from "../utils/emailLists";
import { forUpdate, sanitizeForFirestore } from "../utils/firestoreData";

// The e-mail lists made on the «Personer» tab (see utils/emailLists.ts). Only an administrator may read or
// write them (firestore.rules). Until the rules are published again, the database refuses, and the page says so.

/** Follows the lists, now and after every change. Returns the function that stops following. */
export function subscribeEmailLists(onChange: (lists: EmailList[]) => void, onError: (error: unknown) => void): () => void {
  return onSnapshot(
    collection(db, EMAIL_LISTS_COLLECTION),
    (snapshot) => onChange(snapshot.docs.map((one) => ({ id: one.id, ...one.data() }) as EmailList)),
    onError
  );
}

/** Stores a new list. */
export function saveEmailList(list: EmailList): Promise<void> {
  return setDoc(doc(db, EMAIL_LISTS_COLLECTION, list.id), sanitizeForFirestore(list));
}

export function renameEmailList(id: string, name: string, now: Date = new Date()): Promise<void> {
  return updateDoc(doc(db, EMAIL_LISTS_COLLECTION, id), forUpdate({ name, updatedAt: now.toISOString() }));
}

/** Stores the persons of a fixed list, in place of the ones there were. */
export function setListPersons(id: string, personIds: string[], now: Date = new Date()): Promise<void> {
  return updateDoc(doc(db, EMAIL_LISTS_COLLECTION, id), forUpdate({ personIds, updatedAt: now.toISOString() }));
}

export function deleteEmailList(id: string): Promise<void> {
  return deleteDoc(doc(db, EMAIL_LISTS_COLLECTION, id));
}
