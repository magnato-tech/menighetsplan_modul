import { GATHERING_NOTE_DOC_PREFIX, GATHERING_NOTE_RECORD } from "../data/settingsRecords";

// The notes on a gathering: what the administration writes down about it, read by those who lead
// it. The notes are kept apart from the gathering, which is public, in one document per gathering
// in cms_settings (see services/gatheringNotes.ts). Only an administrator writes them.

export interface GatheringNote {
  gatheringId: string;
  text: string;
  /** When the text was last saved, an ISO time. Empty when nothing has been saved. */
  updatedAt: string;
  /** The name of the one who saved it, as it stood then. */
  updatedByName: string;
}

export const gatheringNoteDocId = (gatheringId: string): string => `${GATHERING_NOTE_DOC_PREFIX}${gatheringId}`;

/** A note with text in it. Spaces and empty lines alone do not count. */
export const hasNoteText = (text: string): boolean => text.trim() !== "";

/** The fields a note is stored with. The text is stored trimmed; an empty text is stored as empty, not removed. */
export function gatheringNoteFields(note: GatheringNote): GatheringNote & { recordType: string } {
  return { recordType: GATHERING_NOTE_RECORD, gatheringId: note.gatheringId, text: note.text.trim(), updatedAt: note.updatedAt, updatedByName: note.updatedByName };
}

/** What is stored, read without trusting it. Nothing stored, or a document of another kind, is an empty note. */
export function gatheringNoteOf(gatheringId: string, data: Record<string, unknown> | undefined): GatheringNote {
  const valid = data?.recordType === GATHERING_NOTE_RECORD && data.gatheringId === gatheringId;
  return {
    gatheringId,
    text: valid && typeof data.text === "string" ? data.text : "",
    updatedAt: valid && typeof data.updatedAt === "string" ? data.updatedAt : "",
    updatedByName: valid && typeof data.updatedByName === "string" ? data.updatedByName : "",
  };
}

/**
 * Whether a place in the database is a note on a gathering. A reset of the demo keeps them: they are a
 * congregation's own content (see utils/demoReset.ts).
 */
export function isGatheringNotePlace(place: string): boolean {
  const slash = place.lastIndexOf("/");
  const collection = place.slice(0, slash);
  const id = place.slice(slash + 1);
  return collection.endsWith("cms_settings") && id.startsWith(GATHERING_NOTE_DOC_PREFIX);
}
