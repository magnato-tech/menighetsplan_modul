import { doc, getDoc, setDoc } from "firebase/firestore";
import { CMS_COLLECTIONS } from "../data/collections";
import { db } from "../firebase";
import { gatheringNoteDocId, gatheringNoteFields, gatheringNoteOf, type GatheringNote } from "../utils/gatheringNote";
import { reportWriteError } from "./writeErrors";

// The notes on a gathering are one document each in cms_settings (see utils/gatheringNote.ts). They
// are read with one get, when the gathering page opens. Only an administrator writes them: the rules
// let a member read the settings, and create or change a note only for an administrator.

const noteDoc = (gatheringId: string) => doc(db, CMS_COLLECTIONS.SETTINGS, gatheringNoteDocId(gatheringId));

/** The note on a gathering. Empty when nothing has been written yet. Throws when the database refuses the read. */
export async function readGatheringNote(gatheringId: string): Promise<GatheringNote> {
  const snapshot = await getDoc(noteDoc(gatheringId));
  return gatheringNoteOf(gatheringId, snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined);
}

/** Stores the text of a note, in place of the one there. Says whether it went well; a failure is reported. */
export async function saveGatheringNote(note: GatheringNote): Promise<boolean> {
  try {
    await setDoc(noteDoc(note.gatheringId), gatheringNoteFields(note));
    return true;
  } catch (error) {
    reportWriteError("lagre notatet", error);
    return false;
  }
}
