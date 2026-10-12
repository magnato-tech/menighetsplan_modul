import { collection, doc, getDoc, onSnapshot, writeBatch } from "firebase/firestore";
import { LOGINS_COLLECTION, PUBLIC_PROFILES_COLLECTION } from "../data/collections";
import { db, handleFirestoreError, OperationType } from "../firebase";
import type { Person } from "../types";
import { chunk } from "../utils/chunk";
import { sanitizeForFirestore } from "../utils/firestoreData";
import { loginIdOf, type Login } from "../utils/logins";
import type { MirrorChanges } from "../utils/mirror";

// What is kept beside the register in a database that is closed to those who are not in it
// (see utils/mirror.ts): the logins, which say who may sign in, and the public copies of the
// persons who are shown on the website.
//
// Someone signing in may read their own login, and only that. Everyone may read the public
// copies. Only an administrator may read all the logins, and write either.

const BATCH_SIZE = 400;

/** Whether what was received is what the database holds: not a copy in the browser, and nothing of our own on its way. */
export type Settled = boolean;

const asLogin = (id: string, data: Record<string, unknown> | undefined): Login | null =>
  data && typeof data.personId === "string" && data.personId !== "" ? { id, personId: data.personId, role: data.role === "admin" ? "admin" : "member" } : null;

/** The login of the address, or null when the address is nobody's in the register. Throws when it cannot be read. */
export async function readOwnLogin(email: string): Promise<Login | null> {
  const id = loginIdOf(email);
  if (id === "" || id.includes("/")) return null;
  const snapshot = await getDoc(doc(db, LOGINS_COLLECTION, id));
  return asLogin(id, snapshot.data());
}

/** Follows every login. Only an administrator is let to. */
export function subscribeLogins(onChange: (logins: Login[], settled: Settled) => void): () => void {
  return onSnapshot(
    collection(db, LOGINS_COLLECTION),
    { includeMetadataChanges: true },
    (snapshot) =>
      onChange(
        snapshot.docs.flatMap((d) => asLogin(d.id, d.data()) ?? []),
        !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites
      ),
    (error) => handleFirestoreError(error, OperationType.GET, LOGINS_COLLECTION)
  );
}

/** Follows the public copies of persons: what the website shows of the register. */
export function subscribePublicProfiles(onChange: (persons: Person[], settled: Settled) => void): () => void {
  return onSnapshot(
    collection(db, PUBLIC_PROFILES_COLLECTION),
    { includeMetadataChanges: true },
    (snapshot) =>
      onChange(
        snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Person),
        !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites
      ),
    (error) => handleFirestoreError(error, OperationType.GET, PUBLIC_PROFILES_COLLECTION)
  );
}

async function store<T extends { id: string }>(name: string, changes: MirrorChanges<T>): Promise<void> {
  const writes: ({ set: T } | { remove: string })[] = [...changes.set.map((set) => ({ set })), ...changes.remove.map((remove) => ({ remove }))];
  for (const piece of chunk(writes, BATCH_SIZE)) {
    const batch = writeBatch(db);
    for (const write of piece) {
      if ("set" in write) {
        // The id is the place of the document, and is not repeated inside it
        const { id, ...fields } = write.set;
        batch.set(doc(db, name, id), sanitizeForFirestore(fields));
      } else {
        batch.delete(doc(db, name, write.remove));
      }
    }
    await batch.commit();
  }
}

/** Writes the logins that are new or changed, and takes away those the register no longer gives. */
export const storeLoginChanges = (changes: MirrorChanges<Login>): Promise<void> => store(LOGINS_COLLECTION, changes);

/** Writes the public copies that are new or changed, and takes away those of persons who are no longer shown. */
export const storePublicProfileChanges = (changes: MirrorChanges<Person>): Promise<void> => store(PUBLIC_PROFILES_COLLECTION, changes);
