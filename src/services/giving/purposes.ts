import { collection, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { GIVING_PURPOSES_COLLECTION } from "../../data/collections";
import { db } from "../../firebase";
import { cleanPurposeName, type GivingPurpose } from "../../utils/giving/purposes";
import { documentFields, forUpdate, sanitizeForFirestore } from "../../utils/firestoreData";

// The gift purposes (utils/giving/purposes.ts). Only an administrator may read or write them (firestore.rules).
// Nothing is deleted: a purpose is renamed or deactivated. What a purpose is used for is never changed.

/** Follows the purposes, now and after every change. Returns the function that stops following. */
export function subscribeGivingPurposes(onChange: (purposes: GivingPurpose[]) => void, onError: (error: unknown) => void): () => void {
  return onSnapshot(
    collection(db, GIVING_PURPOSES_COLLECTION),
    (snapshot) => onChange(snapshot.docs.map((one) => ({ id: one.id, ...one.data() }) as GivingPurpose)),
    onError
  );
}

/** Stores a new purpose at its own id. The id is not stored again inside the document. */
export function createGivingPurpose(purpose: GivingPurpose): Promise<void> {
  return setDoc(doc(db, GIVING_PURPOSES_COLLECTION, purpose.id), sanitizeForFirestore(documentFields(purpose)));
}

export function renameGivingPurpose(id: string, name: string, personId: string, now: Date = new Date()): Promise<void> {
  return updateDoc(
    doc(db, GIVING_PURPOSES_COLLECTION, id),
    forUpdate({ name: cleanPurposeName(name), updatedAt: now.toISOString(), updatedBy: personId })
  );
}

export function setGivingPurposeActive(id: string, active: boolean, personId: string, now: Date = new Date()): Promise<void> {
  return updateDoc(
    doc(db, GIVING_PURPOSES_COLLECTION, id),
    forUpdate({ active, updatedAt: now.toISOString(), updatedBy: personId })
  );
}
