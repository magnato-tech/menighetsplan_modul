import React, { useEffect, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { readGroupTraces } from "../../services/groupDeletion";
import type { GroupDeletion } from "../../utils/groupDeletion";

interface DeleteGroupDialogProps {
  groupId: string;
  groupName: string;
  deletion: GroupDeletion;
  onConfirm: () => void;
  onClose: () => void;
}

const counted = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/**
 * The warning before a group is deleted. It says what goes with the group and what stays, with
 * the numbers for this group. A group that owns events or tasks cannot be deleted from here: the
 * warning says what has to be moved first.
 */
export const DeleteGroupDialog: React.FC<DeleteGroupDialogProps> = ({ groupId, groupName, deletion, onConfirm, onClose }) => {
  const [traces, setTraces] = useState<{ messages: number; proposals: number } | null>(null);
  useEffect(() => {
    let current = true;
    readGroupTraces(groupId).then(
      (found) => current && setTraces(found),
      () => current && setTraces(null)
    );
    return () => {
      current = false;
    };
  }, [groupId]);

  const blocked = deletion.blockedBy.length > 0;

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="delete-group-heading" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-red-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 id="delete-group-heading" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" aria-hidden="true" />
            <span>{blocked ? `«${groupName}» kan ikke slettes ennå` : `Slette gruppen «${groupName}»?`}</span>
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
              <li>
                {deletion.participants === 0
                  ? "Gruppen har ingen deltakere."
                  : `${counted(deletion.participants, "person", "personer")} er ikke lenger med i gruppen. Personene blir stående i registeret.`}
              </li>
              <li>
                {traces === null
                  ? "Meldingene i gruppen slettes."
                  : traces.messages === 0
                    ? "Gruppen har ingen meldinger."
                    : `${counted(traces.messages, "melding", "meldinger")} i gruppen slettes.`}
              </li>
              {traces !== null && traces.proposals > 0 && <li>{counted(traces.proposals, "forslag", "forslag")} om nye deltakere slettes.</li>}
              {deletion.roles.length > 0 && (
                <li>
                  {deletion.roles.length === 1 ? "Rollen" : "Rollene"} {deletion.roles.map((role) => role.name).join(", ")} står uten tjenesteteam etterpå.
                </li>
              )}
              {deletion.templates.length > 0 && (
                <li>
                  {deletion.templates.length === 1 ? "Malen" : "Malene"} {deletion.templates.map((template) => template.name).join(", ")} står uten ansvarlig gruppe etterpå.
                </li>
              )}
            </ul>
            <p className="text-xs font-bold text-red-700">Det kan ikke angres.</p>
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer">
            {blocked ? "Lukk" : "Avbryt"}
          </button>
          {!blocked && (
            <button type="button" onClick={onConfirm} className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Slett gruppen
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
