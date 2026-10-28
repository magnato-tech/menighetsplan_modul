import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { readGatheringNote, saveGatheringNote } from "../../services/gatheringNotes";
import { hasNoteText, type GatheringNote } from "../../utils/gatheringNote";

interface GatheringNotesProps {
  gatheringId: string;
  /** Only an administrator writes the notes. Everyone else who opens the gathering reads them. */
  canEdit: boolean;
  /** The name the note is saved with. */
  authorName: string;
}

/**
 * The notes on a gathering: a row that opens to the text. Folded by default; a small dot shows when there is
 * text. An administrator edits the text in place, and saves it with «Lagre» or Ctrl+S. The text is also
 * printed, unfolded, when there is any.
 */
export const GatheringNotes: React.FC<GatheringNotesProps> = ({ gatheringId, canEdit, authorName }) => {
  const [open, setOpen] = useState(false);
  // The note as it is stored. undefined while it is read, null when the database would not give it
  const [stored, setStored] = useState<GatheringNote | null | undefined>(undefined);
  // What the administrator has typed. Kept while the row is folded, so folding does not lose it
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setStored(undefined);
    readGatheringNote(gatheringId)
      .then((note) => {
        if (!active) return;
        setStored(note);
        setDraft(note.text);
      })
      .catch(() => {
        if (active) setStored(null);
      });
    return () => {
      active = false;
    };
  }, [gatheringId]);

  const text = stored?.text ?? "";
  const hasText = hasNoteText(text);
  const unsaved = draft.trim() !== text;

  const save = async () => {
    if (!stored || saving || !unsaved) return;
    setSaving(true);
    const note: GatheringNote = { gatheringId, text: draft.trim(), updatedAt: new Date().toISOString(), updatedByName: authorName };
    const ok = await saveGatheringNote(note);
    setSaving(false);
    if (ok) {
      setStored(note);
      setDraft(note.text);
    }
  };

  const cancel = () => {
    setDraft(text);
    setOpen(false);
  };

  // A note that could not be read is not shown as empty: the administrator is not asked to write over it
  const unreadable = stored === null;

  return (
    <>
      <div className="print:hidden">
        <button
          type="button"
          id="gathering-notes-toggle"
          aria-expanded={open}
          aria-controls="gathering-notes-panel"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 py-1 cursor-pointer"
        >
          {open ? <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 text-slate-500" aria-hidden="true" />}
          Notater
          {hasText && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" aria-hidden="true" />
              <span className="sr-only">har innhold</span>
            </>
          )}
        </button>

        {open && (
          <div id="gathering-notes-panel" className="mt-1 p-3 rounded-xl border border-slate-200 bg-white space-y-2">
            {unreadable ? (
              <p className="text-xs text-slate-500">Notatet kunne ikke hentes.</p>
            ) : canEdit ? (
              <>
                <label htmlFor="gathering-notes-text" className="sr-only">
                  Notater
                </label>
                <textarea
                  id="gathering-notes-text"
                  value={draft}
                  disabled={stored === undefined}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                      event.preventDefault();
                      save();
                    }
                  }}
                  rows={5}
                  className="w-full text-sm text-slate-800 rounded-lg border border-slate-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancel}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!unsaved || saving || stored === undefined}
                    className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-2 rounded-lg cursor-pointer"
                  >
                    Lagre
                  </button>
                </div>
              </>
            ) : hasText ? (
              <p className="text-sm text-slate-800 whitespace-pre-line">{text}</p>
            ) : (
              <p className="text-xs text-slate-500">Ingen notater.</p>
            )}
          </div>
        )}
      </div>

      {/* Printed unfolded, and only when there is text */}
      {hasText && (
        <div className="hidden print:block mb-3">
          <p className="text-xs font-bold text-black">Notater</p>
          <p className="text-sm text-black whitespace-pre-line">{text}</p>
        </div>
      )}
    </>
  );
};
