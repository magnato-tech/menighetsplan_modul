import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { CMS_COLLECTIONS } from "../data/collections";
import { YEAR_WHEEL_DOC_ID, YEAR_WHEEL_RECORD } from "../data/settingsRecords";
import { db } from "../firebase";
import { cleanYearWheelItem, yearWheelItemsOf, type YearWheelItem } from "../utils/yearWheel";

// The annual wheel is one document in cms_settings, marked with its recordType like the other
// records there (see data/settingsRecords.ts): the closed rules know that collection, and let an
// administrator write it. The whole wheel is small, and is stored whole every time.

/**
 * Follows the stored wheel. `null` means the congregation has stored none, and the standard
 * wheel is what it sees. Returns the function that stops following.
 */
export function subscribeYearWheel(onChange: (items: YearWheelItem[] | null) => void, onError?: (error: Error) => void): () => void {
  return onSnapshot(
    doc(db, CMS_COLLECTIONS.SETTINGS, YEAR_WHEEL_DOC_ID),
    (snapshot) => {
      const data = snapshot.data();
      onChange(snapshot.exists() && data?.recordType === YEAR_WHEEL_RECORD ? yearWheelItemsOf(data) : null);
    },
    (error) => onError?.(error)
  );
}

/** Stores the whole wheel, in place of what was there. */
export function saveYearWheel(items: readonly YearWheelItem[]): Promise<void> {
  return setDoc(doc(db, CMS_COLLECTIONS.SETTINGS, YEAR_WHEEL_DOC_ID), {
    recordType: YEAR_WHEEL_RECORD,
    items: items.map(cleanYearWheelItem),
    updatedAt: new Date().toISOString(),
  });
}
