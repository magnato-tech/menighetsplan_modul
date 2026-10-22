import { collection, getDocs, query, where } from "firebase/firestore";
import { CMS_COLLECTIONS } from "../data/collections";
import { CONTENT_VERSION_RECORD, contentVersionFields } from "../data/settingsRecords";
import { db } from "../firebase";
import { byNewest, versionsToPrune, type ContentKind, type ContentVersion } from "../utils/contentVersions";
import { createDocument, deleteDocument } from "./firestore";
import { reportWriteError } from "./writeErrors";

// The earlier versions of pages and news articles (see utils/contentVersions.ts) are stored in
// cms_settings, each marked as a version, as the templates and roles are: the rules in a database in
// use turn a new collection away until they are published. There only administrators may write, and
// only those in the register may read, so a version is never shown to a visitor.

/** The kept versions of one page or article, newest first. */
export async function fetchVersions(kind: ContentKind, targetId: string): Promise<ContentVersion[]> {
  const snapshot = await getDocs(
    query(collection(db, CMS_COLLECTIONS.SETTINGS), where("recordType", "==", CONTENT_VERSION_RECORD), where("targetId", "==", targetId))
  );
  return snapshot.docs
    .map((d) => ({ ...d.data(), id: d.id }) as ContentVersion & { recordType?: string })
    .filter((version) => version.kind === kind && typeof version.replacedAt === "string")
    .map(({ recordType: _mark, ...version }) => version)
    .sort(byNewest);
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
