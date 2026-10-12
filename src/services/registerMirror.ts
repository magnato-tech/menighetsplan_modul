import { collection, deleteField, doc, getDoc, onSnapshot, writeBatch } from "firebase/firestore";
import {
  COLLECTIONS,
  GATHERING_READERS_COLLECTION,
  GROUP_DIRECTORY_COLLECTION,
  GROUP_LEADER_EMAILS_COLLECTION,
  LOGINS_COLLECTION,
  PUBLIC_GROUP_CARDS_COLLECTION,
  PUBLIC_PROFILES_COLLECTION,
} from "../data/collections";
import { db, handleFirestoreError, OperationType } from "../firebase";
import type { MemberProposal, Person } from "../types";
import type { AssignmentAccess, GatheringReader, GroupDirectoryCard, GroupLeaderEmail, PublicGroupCard } from "../utils/groupAccess";
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

export function subscribeGroupDirectory(onChange: (cards: GroupDirectoryCard[], settled: Settled) => void): () => void {
  return subscribePlain(GROUP_DIRECTORY_COLLECTION, onChange, (id, data) =>
    typeof data.groupId === "string" && typeof data.personId === "string" && typeof data.name === "string"
      ? { id, groupId: data.groupId, personId: data.personId, name: data.name, ...(typeof data.phone === "string" ? { phone: data.phone } : {}) }
      : null
  );
}

export function subscribeGroupLeaderEmails(onChange: (cards: GroupLeaderEmail[], settled: Settled) => void): () => void {
  return subscribePlain(GROUP_LEADER_EMAILS_COLLECTION, onChange, (id, data) =>
    typeof data.groupId === "string" && typeof data.personId === "string" && typeof data.email === "string"
      ? { id, groupId: data.groupId, personId: data.personId, email: data.email }
      : null
  );
}

export function subscribePublicGroupCards(onChange: (cards: PublicGroupCard[], settled: Settled) => void): () => void {
  return subscribePlain(PUBLIC_GROUP_CARDS_COLLECTION, onChange, (id, data) => {
    if (typeof data.name !== "string" || data.isPublic !== true || typeof data.memberCount !== "number") return null;
    const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
    return {
      id,
      name: data.name,
      isPublic: true as const,
      memberCount: data.memberCount,
      leaderIds: strings(data.leaderIds),
      deputyLeaderIds: strings(data.deputyLeaderIds),
      memberIds: strings(data.memberIds),
      ...(typeof data.description === "string" ? { description: data.description } : {}),
      ...(typeof data.category === "string" ? { category: data.category as PublicGroupCard["category"] } : {}),
      ...(Array.isArray(data.tags) ? { tags: strings(data.tags) } : {}),
      ...(data.meetingSchedule && typeof data.meetingSchedule === "object" ? { meetingSchedule: data.meetingSchedule as PublicGroupCard["meetingSchedule"] } : {}),
    };
  });
}

export function subscribeGatheringReaders(onChange: (readers: GatheringReader[], settled: Settled) => void): () => void {
  return subscribePlain(GATHERING_READERS_COLLECTION, onChange, (id, data) =>
    typeof data.gatheringId === "string" && typeof data.personId === "string" ? { id, gatheringId: data.gatheringId, personId: data.personId } : null
  );
}

function subscribePlain<T extends { id: string }>(
  name: string,
  onChange: (items: T[], settled: Settled) => void,
  read: (id: string, data: Record<string, unknown>) => T | null
): () => void {
  return onSnapshot(
    collection(db, name),
    { includeMetadataChanges: true },
    (snapshot) =>
      onChange(
        snapshot.docs.flatMap((d) => read(d.id, d.data()) ?? []),
        !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites
      ),
    (error) => handleFirestoreError(error, OperationType.GET, name)
  );
}

export const storeGroupDirectoryChanges = (changes: MirrorChanges<GroupDirectoryCard>): Promise<void> => store(GROUP_DIRECTORY_COLLECTION, changes);
export const storeGroupLeaderEmailChanges = (changes: MirrorChanges<GroupLeaderEmail>): Promise<void> => store(GROUP_LEADER_EMAILS_COLLECTION, changes);
export const storePublicGroupCardChanges = (changes: MirrorChanges<PublicGroupCard>): Promise<void> => store(PUBLIC_GROUP_CARDS_COLLECTION, changes);
export const storeGatheringReaderChanges = (changes: MirrorChanges<GatheringReader>): Promise<void> => store(GATHERING_READERS_COLLECTION, changes);

export function subscribeMemberProposals(onChange: (proposals: MemberProposal[], settled: Settled) => void): () => void {
  return subscribePlain(COLLECTIONS.MEMBER_PROPOSALS, onChange, (id, data): MemberProposal | null => {
    const status = data.status === "pending" || data.status === "added" || data.status === "dismissed" ? data.status : null;
    if (!status || typeof data.groupId !== "string" || typeof data.name !== "string" || typeof data.proposedBy !== "string" || typeof data.proposedAt !== "string") {
      return null;
    }
    return {
      id,
      groupId: data.groupId,
      name: data.name,
      proposedBy: data.proposedBy,
      proposedAt: data.proposedAt,
      status,
      ...(typeof data.decidedAt === "string" ? { decidedAt: data.decidedAt } : {}),
    };
  });
}

/** Deletes proposals the register no longer keeps. Admin only. */
export async function deleteMemberProposals(ids: readonly string[]): Promise<void> {
  for (const piece of chunk(ids, BATCH_SIZE)) {
    const batch = writeBatch(db);
    for (const id of piece) batch.delete(doc(db, COLLECTIONS.MEMBER_PROPOSALS, id));
    await batch.commit();
  }
}

/** Takes a stored reason off the assignments that still have one. It is not kept anywhere. */
export async function clearWithdrawalReasons(ids: readonly string[]): Promise<void> {
  for (const piece of chunk(ids, BATCH_SIZE)) {
    const batch = writeBatch(db);
    for (const id of piece) batch.update(doc(db, COLLECTIONS.ASSIGNMENTS, id), { withdrawalReason: deleteField() });
    await batch.commit();
  }
}

/** Writes the name and the gathering onto assignments that do not have them yet. */
export async function patchAssignmentAccess(patches: AssignmentAccess[]): Promise<void> {
  for (const piece of chunk(patches, BATCH_SIZE)) {
    const batch = writeBatch(db);
    for (const patch of piece) {
      const { id, ...fields } = patch;
      batch.update(doc(db, COLLECTIONS.ASSIGNMENTS, id), fields);
    }
    await batch.commit();
  }
}
