import { collection, getDocs, query, where } from "firebase/firestore";
import { CMS_COLLECTIONS } from "../data/collections";
import { CONTENT_VERSION_RECORD, contentVersionFields } from "../data/settingsRecords";
import { db } from "../firebase";
import { keptVersionsOf, versionsToPrune, type ContentKind, type ContentVersion } from "../utils/contentVersions";
import { type TrashRecord } from "../utils/trash";
import { createDocument, deleteDocument } from "./firestore";
import { reportWriteError } from "./writeErrors";

// The earlier versions of pages and news articles (see utils/contentVersions.ts) are stored in
// cms_settings, each marked as a version, as the templates and roles are: the rules in a database in
// use turn a new collection away until they are published. There only administrators may write, and
// only those in the register may read, so a version is never shown to a visitor.
// The deleted pages, articles and talks (the recycle bin, see utils/trash.ts) are stored there too.

/** The kept versions of one page or article, newest first. */
export async function fetchVersions(kind: ContentKind, targetId: string): Promise<ContentVersion[]> {
  const snapshot = await getDocs(
    query(collection(db, CMS_COLLECTIONS.SETTINGS), where("recordType", "==", CONTENT_VERSION_RECORD), where("targetId", "==", targetId))
  );
  return keptVersionsOf(
    snapshot.docs.map((d) => ({ ...d.data(), id: d.id })),
    kind,
    targetId
  );
}

/**
 * Keeps the version that was just replaced, and removes the oldest beyond the number kept. A failure
 * is reported, but the save it belongs to has gone through already.
 */
export async function keepVersion(version: ContentVersion): Promise<void> {
  try {
    await createDocument(CMS_COLLECTIONS.SETTINGS, contentVersionFields(version));
    const kept = await fetchVersions(version.kind, version.targetId);
    for (const id of versionsToPrune(kept)) await deleteDocument(CMS_COLLECTIONS.SETTINGS, id);
  } catch (error) {
    reportWriteError("ta vare på forrige versjon", error);
  }
}

/** Stores the deleted items in the recycle bin. Rejects if any of them is not stored, so nothing is deleted then. */
export async function moveToTrash(records: TrashRecord[]): Promise<void> {
  await Promise.all(records.map((record) => createDocument(CMS_COLLECTIONS.SETTINGS, contentVersionFields(record))));
}

/** Every item in the recycle bin, as stored (not yet sorted or checked for age). */
export async function fetchTrashRecords(): Promise<TrashRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, CMS_COLLECTIONS.SETTINGS),
      where("recordType", "==", CONTENT_VERSION_RECORD),
      where("deleted", "==", true)
    )
  );
  return snapshot.docs.map((d) => {
    const { recordType: _mark, ...record } = d.data();
    return { ...record, id: d.id } as TrashRecord;
  });
}

/** Removes an item from the recycle bin for good, or when it has been restored. */
export function deleteTrashRecord(id: string): Promise<void> {
  return deleteDocument(CMS_COLLECTIONS.SETTINGS, id);
}
