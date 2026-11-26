import { collection, doc, getDoc, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { GIVING_ACCESS_COLLECTION, GIVING_LOG_COLLECTION, LOGINS_COLLECTION } from "../../data/collections";
import { db } from "../../firebase";
import { normalizeGivingAddress, storedAccessFields, type GivingAccess } from "../../utils/giving/access";

// Who holds which right in givertjeneste (utils/giving/access.ts). Only the rules decide who may read or write
// (firestore.rules, «Givertjeneste»). Every change is written together with its log entry, in one sending.

export type GivingAccessAction = "grant" | "change" | "activate";

/** Follows the rights on one address, for the person signed in with it. Null when that address has none. */
export function subscribeOwnAccess(
  address: string,
  onChange: (access: GivingAccess | null) => void,
  onError: (error: unknown) => void
): () => void {
  return onSnapshot(
    doc(db, GIVING_ACCESS_COLLECTION, normalizeGivingAddress(address)),
    (snapshot) => onChange(snapshot.exists() ? ({ address: snapshot.id, ...snapshot.data() } as GivingAccess) : null),
    onError
  );
}

/** Follows every right that has been given, for someone with «Tilganger». */
export function subscribeAllAccess(onChange: (list: GivingAccess[]) => void, onError: (error: unknown) => void): () => void {
  return onSnapshot(
    collection(db, GIVING_ACCESS_COLLECTION),
    (snapshot) => onChange(snapshot.docs.map((one) => ({ address: one.id, ...one.data() }) as GivingAccess)),
    onError
  );
}

/** The person the address signs in as, from the login the register gives it (logins/<address>). Null when there is none. */
export async function lookupLoginPersonId(address: string): Promise<string | null> {
  const snapshot = await getDoc(doc(db, LOGINS_COLLECTION, normalizeGivingAddress(address)));
  const personId = snapshot.exists() ? (snapshot.data() as { personId?: unknown }).personId : undefined;
  return typeof personId === "string" && personId !== "" ? personId : null;
}

/**
 * Stores the rights of one address, and the log entry for the change, in one sending. The document is set as a
 * whole, without the address inside it. The log holds exactly the document as it became.
 */
export async function saveAccess(access: GivingAccess, action: GivingAccessAction, byPersonId: string): Promise<void> {
  const address = normalizeGivingAddress(access.address);
  const stored = storedAccessFields({ ...access, address });
  const batch = writeBatch(db);
  batch.set(doc(db, GIVING_ACCESS_COLLECTION, address), stored);
  batch.set(doc(db, GIVING_LOG_COLLECTION, `access_${address}_${access.version}`), {
    action,
    target: address,
    version: access.version,
    at: serverTimestamp(),
    by: byPersonId,
    access: stored,
  });
  await batch.commit();
}
