import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

/** One task on the event, and who stands on it or has been asked. */
export interface StaffedTask {
  title: string;
  people: { name: string; asked: boolean }[];
}

interface DeleteGatheringDialogProps {
  title: string;
  /** When the event is, as it is read: "Søndag 8. nov. kl. 11:00". */
  when: string;
  staffed: StaffedTask[];
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The warning before an event with people on its tasks is deleted. It names everyone who is
 * taken off, and one press removes them all and deletes the event. Nothing happens before that.
 */
export const DeleteGatheringDialog: React.FC<DeleteGatheringDialogProps> = ({ title, when, staffed, onConfirm, onClose }) => {
  const count = new Set(staffed.flatMap((task) => task.people.map((person) => person.name))).size;

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="delete-gathering-heading" className="fixed inset-0 z-50 bg-[var(--studio-overlay)] backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--studio-bg)] border border-red-900 p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h3 id="delete-gathering-heading" className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" aria-hidden="true" />
            <span>Slette arrangement med folk på oppgavene?</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Lukk" className="text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-xs text-[var(--studio-text)]">
          <strong>{title}</strong>, {when}
        </p>
        <p className="text-xs text-[var(--studio-muted)]">
          {count} {count === 1 ? "person står" : "personer står"} på oppgaver eller er spurt. De blir tatt av, og arrangementet slettes med program og oppgaver.
          Det kan ikke angres.
        </p>

        <section aria-label="De som blir tatt av" className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3">
          <ul className="space-y-1.5 text-xs">
            {staffed.map((task) => (
              <li key={task.title} className="flex gap-2">
                <span className="font-bold text-[var(--studio-text)] shrink-0">{task.title}:</span>
                <span className="text-[var(--studio-muted)]">{task.people.map((person) => (person.asked ? `${person.name} (spurt)` : person.name)).join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-amber-300">Løsningen sier ikke fra til dem. Gi beskjed selv.</p>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--studio-border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl border border-[var(--studio-border)] text-[var(--studio-text)] text-xs font-bold cursor-pointer"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Fjern alle og slett arrangementet
          </button>
        </div>
      </div>
    </div>
  );
};
