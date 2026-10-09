import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { CMS_COLLECTIONS } from "../data/collections";
import type { GatheringHeadcount } from "../types";
import { headcountIdFor } from "../utils/headcount";
import { deleteDocument, setDocument } from "./firestore";
import { HEADCOUNT_RECORD, headcountFields, isHeadcountRecord } from "../data/settingsRecords";

/**
 * Where headcounts (oppmøtetall) are stored. The rules deployed on the live project are
 * older than firestore.rules and reject new collections, gatheringHeadcounts included
 * (checked 5 October 2026). Like the volunteer roles (see volunteerRoles.ts), headcounts
 * are therefore stored as documents in cms_settings, which allows writes, marked so they
 * stay apart from the settings. The public website only reads the settings document
 * itself, so it never receives them.
 *
 * When the rules in firestore.rules are deployed, this file is the only place that
 * changes: read and write COLLECTIONS.GATHERING_HEADCOUNTS instead.
 */
export { HEADCOUNT_RECORD, headcountFields, isHeadcountRecord };

export function subscribeHeadcounts(onChange: (counts: GatheringHeadcount[]) => void): () => void {
  return onSnapshot(
    // Only the headcounts are asked for: the collection also holds the visit counts, which change with every visit
    query(collection(db, CMS_COLLECTIONS.SETTINGS), where("recordType", "==", HEADCOUNT_RECORD)),
    (snapshot) => {
      const counts = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as GatheringHeadcount & { recordType?: string })
        // A document without both numbers cannot be counted; it would make the sums wrong
        .filter(
          (count) =>
            isHeadcountRecord(count) &&
            typeof count.gatheringId === "string" &&
            Number.isFinite(count.adults) &&
            Number.isFinite(count.children)
        )
        .map(({ recordType: _recordType, ...count }) => count);
      onChange(counts);
    },
    (error) => handleFirestoreError(error, OperationType.GET, CMS_COLLECTIONS.SETTINGS)
  );
}

/** Stores the count, replacing any earlier count for the same gathering. */
export function saveHeadcount(count: GatheringHeadcount): Promise<void> {
  return setDocument(CMS_COLLECTIONS.SETTINGS, count.id, headcountFields(count));
}

export function deleteHeadcount(gatheringId: string): Promise<void> {
  return deleteDocument(CMS_COLLECTIONS.SETTINGS, headcountIdFor(gatheringId));
}
