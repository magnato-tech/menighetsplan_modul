import { arrayRemove, arrayUnion, deleteField, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { CMS_COLLECTIONS } from "../data/collections";
import { SURFACES_DOC_ID, SURFACES_RECORD } from "../data/settingsRecords";
import {
  calendarNoteKey,
  parseSurfaces,
  type CalendarDeclined,
  type CalendarNote,
  type InstallationSurfaces,
} from "../utils/surfaces";

const surfacesRef = () => doc(db, CMS_COLLECTIONS.SETTINGS, SURFACES_DOC_ID);

export function subscribeSurfaces(onChange: (surfaces: InstallationSurfaces) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(
    surfacesRef(),
    (snapshot) => {
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      onChange(parseSurfaces(snapshot.data()));
    },
    onError
  );
}

export type SurfacesPatch = Partial<
  Pick<
    InstallationSurfaces,
    | "minSide"
    | "ownWebsite"
    | "externalSiteUrl"
    | "signInBackUrl"
    | "externalCalendarUrl"
    | "importNewAutomatically"
  >
>;

export async function saveSurfaces(patch: SurfacesPatch): Promise<void> {
  await setDoc(surfacesRef(), { recordType: SURFACES_RECORD, ...patch }, { merge: true });
}

export async function dismissExternalUid(uid: string): Promise<void> {
  await setDoc(surfacesRef(), { recordType: SURFACES_RECORD, dismissedUids: arrayUnion(uid) }, { merge: true });
}

/** Turns a feed event away, or records that its planner event was deleted, so it is not taken in again. */
export async function dismissExternalEvent(uid: string, note: CalendarNote): Promise<void> {
  await setDoc(
    surfacesRef(),
    {
      recordType: SURFACES_RECORD,
      dismissedUids: arrayUnion(uid),
      calendarNotes: { [calendarNoteKey(uid)]: note },
    },
    { merge: true }
  );
}

/** Takes a feed event back in: it is no longer dismissed, and its note is removed. */
export async function restoreExternalUid(uid: string): Promise<void> {
  await setDoc(
    surfacesRef(),
    {
      recordType: SURFACES_RECORD,
      dismissedUids: arrayRemove(uid),
      calendarNotes: { [calendarNoteKey(uid)]: deleteField() },
    },
    { merge: true }
  );
}

/** «La være»: the Google values are kept as declined, so the same change is not suggested again. */
export async function declineExternalChange(uid: string, values: CalendarDeclined): Promise<void> {
  await setDoc(
    surfacesRef(),
    { recordType: SURFACES_RECORD, calendarDeclined: { [calendarNoteKey(uid)]: values } },
    { merge: true }
  );
}

export async function keepExternalUid(uid: string): Promise<void> {
  await setDoc(surfacesRef(), { recordType: SURFACES_RECORD, keptUids: arrayUnion(uid) }, { merge: true });
}

export async function clearExternalCalendarImportQueue(): Promise<void> {
  await setDoc(
    surfacesRef(),
    { recordType: SURFACES_RECORD, dismissedUids: [], keptUids: [], calendarNotes: deleteField(), calendarDeclined: deleteField() },
    { merge: true }
  );
}

export async function unkeepExternalUid(uid: string): Promise<void> {
  await setDoc(surfacesRef(), { recordType: SURFACES_RECORD, keptUids: arrayRemove(uid) }, { merge: true });
}
