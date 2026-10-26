import React, { useState } from "react";
import { X } from "lucide-react";
import type { ProgramItem } from "../../types";
import { newId } from "../../utils/id";
import { DEFAULT_DURATION_MINUTES } from "../../utils/programTiming";

interface ProgramPostDialogProps {
  /** The post to change. Missing for a new plain post. */
  item?: ProgramItem;
  /** False for a post tied to a task: it can be changed and moved, but not deleted. */
  canDelete: boolean;
  onSave: (item: ProgramItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/** A length typed in minutes, or null when it is not a usable number. */
function minutesOf(text: string): number | null {
  const value = Number(text.trim());
  return text.trim() !== "" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/**
 * Change or add one programme post: its title, what it is about and how long it lasts. The clock time
 * is not typed here; it follows from the durations of the posts before it.
 */
export const ProgramPostDialog: React.FC<ProgramPostDialogProps> = ({ item, canDelete, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [duration, setDuration] = useState(String(item?.durationMinutes ?? DEFAULT_DURATION_MINUTES));
  const [titleMissing, setTitleMissing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setTitleMissing(true);
      return;
    }
    // An empty or unusable length keeps the post's current one
    const minutes = minutesOf(duration) ?? item?.durationMinutes ?? DEFAULT_DURATION_MINUTES;
    // Built without the description key when it is empty: the database does not take undefined values
    const next: ProgramItem = {
      ...(item ?? { id: newId("program"), time: "" }),
      title: cleanTitle,
      durationMinutes: minutes,
    };
    delete next.description;
    const cleanDescription = description.trim();
    if (cleanDescription) next.description = cleanDescription;
    onSave(next);
  };

  const heading = item ? "Endre posten" : "Ny programpost";
  const inputClass = "w-full h-11 px-3 rounded-xl border border-slate-300 text-sm";

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-post-heading"
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 id="program-post-heading" className="text-base font-extrabold text-slate-900">
            {heading}
          </h3>
          <button
            type="button"
            aria-label="Lukk"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="space-y-3">
          <label className="block space-y-1" htmlFor="program-post-title">
            <span className="text-[11px] font-semibold text-slate-700">Tittel</span>
            <input
              id="program-post-title"
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleMissing(false);
              }}
              aria-invalid={titleMissing || undefined}
              className={inputClass}
            />
          </label>
          {titleMissing && <p className="text-[11px] text-red-600">Skriv en tittel for posten.</p>}

          <label className="block space-y-1" htmlFor="program-post-description">
            <span className="text-[11px] font-semibold text-slate-700">Beskrivelse (valgfritt)</span>
            <textarea
              id="program-post-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </label>

          <label className="block space-y-1" htmlFor="program-post-duration">
            <span className="text-[11px] font-semibold text-slate-700">Varighet (min)</span>
            <input
              id="program-post-duration"
              type="number"
              min={0}
              step={5}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className={inputClass}
            />
          </label>

          {item && !canDelete && (
            <p className="text-[11px] text-slate-500">Koblet til en oppgave. Kan endres og flyttes, men ikke slettes.</p>
          )}

          {confirmingDelete ? (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2">
              <p className="text-sm font-semibold text-red-900">Slette «{item?.title}» fra programmet?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDelete?.()}
                  className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer"
                >
                  Slett
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold cursor-pointer"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              {item && canDelete && onDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="h-11 px-2 mr-auto text-xs font-semibold text-slate-500 hover:text-red-700 cursor-pointer"
                >
                  Slett posten
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="submit"
                className="h-11 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold cursor-pointer"
              >
                Lagre
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
