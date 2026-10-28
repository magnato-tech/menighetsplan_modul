import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFirebase } from "../../context/FirebaseDataContext";

interface GatheringTeamMessageDialogProps {
  /** The teams of the gathering, each once. All are chosen when the dialog opens. */
  teams: { groupId: string; name: string }[];
  /** Called with how many teams the message went to. The dialog is closed by the one who opened it. */
  onSent: (count: number) => void;
  onClose: () => void;
}

/**
 * One message to the teams of a gathering. Each chosen team gets the same text in its own chat. Escape,
 * the close button and a press on the backdrop close it.
 */
export const GatheringTeamMessageDialog: React.FC<GatheringTeamMessageDialogProps> = ({ teams, onSent, onClose }) => {
  const { sendGroupMessage } = useFirebase();
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(teams.map((team) => team.groupId)));
  const [text, setText] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const toggle = (groupId: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  const count = teams.filter((team) => chosen.has(team.groupId)).length;
  const canSend = count > 0 && text.trim() !== "";

  const send = () => {
    if (!canSend) return;
    for (const team of teams) {
      if (chosen.has(team.groupId)) sendGroupMessage(team.groupId, text);
    }
    onSent(count);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="gathering-team-message-title" className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="gathering-team-message-title" className="text-base font-extrabold text-slate-900">
            Melding til teamene
          </h2>
          <button
            type="button"
            aria-label="Lukk"
            onClick={onClose}
            className="w-11 h-11 -mt-2 -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {teams.length === 0 ? (
          <p className="text-sm text-slate-700">Arrangementet har ingen team ennå.</p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-slate-600 mb-1">Til</legend>
            {teams.map((team) => (
              <label key={team.groupId} className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chosen.has(team.groupId)}
                  onChange={() => toggle(team.groupId)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {team.name}
              </label>
            ))}
          </fieldset>
        )}

        <label className="block">
          <span className="block text-xs font-bold text-slate-600 mb-1">Melding</span>
          <textarea
            rows={5}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full text-sm text-slate-800 rounded-lg border border-slate-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 cursor-pointer">
            Avbryt
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg cursor-pointer"
          >
            Send
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
