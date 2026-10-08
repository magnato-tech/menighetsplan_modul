import { collection, doc, getDocs, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { CMS_COLLECTIONS } from "../data/collections";
import { DEMO } from "../demo";

// The app is either in demo or in production. In demo, the database can be emptied and refilled
// from the Database tab: test data, datasets, another congregation's website. In production the
// same content is a congregation's real website and register, so nothing can be emptied from there.
//
// The mode is a marked document in cms_settings, like the volunteer roles (see volunteerRoles.ts):
// the rules deployed on a project accept that collection. A database without the document is in
// demo. The document is not part of a dataset, and emptying a part of the database leaves it.

export type OperatingMode = "demo" | "production";

export const OPERATING_MODE_RECORD = "operatingMode";
export const OPERATING_MODE_DOC_ID = "operating-mode";

export const OPERATING_MODE_LABELS: Record<OperatingMode, string> = {
  demo: "Demo",
  production: "Produksjon",
};

const modeOf = (data: { recordType?: unknown; mode?: unknown } | undefined): OperatingMode =>
  data?.recordType === OPERATING_MODE_RECORD && data.mode === "production" ? "production" : "demo";

/** The mode the database is in now. Read from the database each time, never from what a screen has loaded. */
export async function readOperatingMode(): Promise<OperatingMode> {
  const snapshot = await getDocs(collection(db, CMS_COLLECTIONS.SETTINGS));
  return modeOf(snapshot.docs.find((d) => d.id === OPERATING_MODE_DOC_ID)?.data());
}

export async function setOperatingMode(mode: OperatingMode): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, CMS_COLLECTIONS.SETTINGS, OPERATING_MODE_DOC_ID), { recordType: OPERATING_MODE_RECORD, mode });
  await batch.commit();
}

/** Follows the mode as it changes. Returns the function that stops following. */
export function subscribeOperatingMode(onChange: (mode: OperatingMode) => void, onError?: (error: Error) => void): () => void {
  return onSnapshot(
    doc(db, CMS_COLLECTIONS.SETTINGS, OPERATING_MODE_DOC_ID),
    (snapshot) => onChange(modeOf(snapshot.data())),
    (error) => onError?.(error)
  );
}

export const PRODUCTION_LOCK_MESSAGE =
  "Appen står i produksjon, og da kan ikke data slettes herfra. Sett den i demo øverst under Database først.";

export const DEMO_LOCK_MESSAGE = "Dette er demoen. Den deles av alle som ser på den, og kan ikke tømmes herfra.";

/**
 * Stops an emptying of the database when the app is in production, and always in the demo
 * installation, whose database every visitor shares. Called by every function that empties a
 * part of it, so the lock holds whichever button was pressed. If the mode cannot be read, the
 * error is passed on and nothing is deleted.
 */
export async function ensureDeletionAllowed(): Promise<void> {
  if (DEMO) throw new Error(DEMO_LOCK_MESSAGE);
  if ((await readOperatingMode()) === "production") throw new Error(PRODUCTION_LOCK_MESSAGE);
}
