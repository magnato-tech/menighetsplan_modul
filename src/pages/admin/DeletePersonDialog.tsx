import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import type { PersonDeletion } from "../../utils/personDeletion";

interface DeletePersonDialogProps {
  personName: string;
  hasEmail: boolean;
  deletion: PersonDeletion;
  working?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const counted = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/**
 * The warning before a person is deleted from the register. It says what goes and what stays,
 * with the numbers for this person. A leader, the administrator themselves and the last
 * administrator cannot be deleted from here: the warning says what has to be done first.
 */
export const DeletePersonDialog: React.FC<DeletePersonDialogProps> = ({ personName, hasEmail, deletion, working = false, onConfirm, onClose }) => {
  const blocked = deletion.blockedBy.length > 0;
  const coming = deletion.comingAssignmentIds.length;

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="delete-person-heading" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-red-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 id="delete-person-heading" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <span>{blocked ? `${personName} kan ikke slettes ennå` : `Slette ${personName} fra registeret?`}</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Lukk" className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {blocked ? (
          <ul className="space-y-2 text-xs text-slate-700 list-disc pl-5">
            {deletion.blockedBy.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <>
            <ul aria-label="Dette skjer" className="space-y-1.5 text-xs text-slate-700 list-disc pl-5">
              <li>Navn, telefon, e-post, fødselsdato og resten av personkortet slettes.</li>
              <li>
                {deletion.groups.length === 0
                  ? "Personen er ikke med i noen gruppe."
                  : `Personen tas ut av ${counted(deletion.groups.length, "gruppe", "grupper")}: ${deletion.groups.map((group) => group.name).join(", ")}.`}
              </li>
              <li>
                {coming === 0
                  ? "Personen står ikke på oppgaver som kommer."
                  : `Personen tas av ${counted(coming, "oppgave", "oppgaver")} som kommer. ${coming === 1 ? "Den" : "De"} blir ${coming === 1 ? "ledig" : "ledige"} igjen.`}
              </li>
              {hasEmail && <li>Personen kan ikke lenger logge inn.</li>}
            </ul>
            <p className="text-xs text-slate-600">
              Det som er holdt, blir stående med navnet:{" "}
              {deletion.heldTasks === 0 ? "ingen oppgaver er holdt" : counted(deletion.heldTasks, "oppgave som er holdt", "oppgaver som er holdt")}, og meldinger personen har skrevet i
              gruppenes chat.
            </p>
            <p className="text-xs font-bold text-red-700">Det kan ikke angres.</p>
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer">
            {blocked ? "Lukk" : "Avbryt"}
          </button>
          {!blocked && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={working}
              className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Slett kontakten
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
