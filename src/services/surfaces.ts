import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { CMS_COLLECTIONS } from "../data/collections";
import { SURFACES_DOC_ID, SURFACES_RECORD } from "../data/settingsRecords";
import { parseSurfaces, type InstallationSurfaces } from "../utils/surfaces";

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
  Pick<InstallationSurfaces, "minSide" | "ownWebsite" | "externalSiteUrl" | "externalCalendarUrl">
>;

export async function saveSurfaces(patch: SurfacesPatch): Promise<void> {
  await setDoc(surfacesRef(), { recordType: SURFACES_RECORD, ...patch }, { merge: true });
}

export async function dismissExternalUid(uid: string): Promise<void> {
  await setDoc(surfacesRef(), { recordType: SURFACES_RECORD, dismissedUids: arrayUnion(uid) }, { merge: true });
}

export async function keepExternalUid(uid: string): Promise<void> {
  await setDoc(surfacesRef(), { recordType: SURFACES_RECORD, keptUids: arrayUnion(uid) }, { merge: true });
}

export async function unkeepExternalUid(uid: string): Promise<void> {
  await setDoc(surfacesRef(), { recordType: SURFACES_RECORD, keptUids: arrayRemove(uid) }, { merge: true });
}
