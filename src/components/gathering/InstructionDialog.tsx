import React from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { GatheringDetail, InstructionTarget } from "./gatheringDetail";
import { studioTabUrl } from "../../pages/admin/studio";

interface InstructionDialogProps {
  detail: GatheringDetail;
  /** What the dialog was opened for. */
  task: InstructionTarget;
  canAdminister: boolean;
  showToast: (text: string) => void;
  onClose: () => void;
}

export const InstructionDialog: React.FC<InstructionDialogProps> = ({ task, onClose }) => {
  const fromLibrary = Boolean(task.volunteerRoleId);

  return (
    <div
      id="modal-view-instruction"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={() => onClose()}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
              {task.groupName || "Instruks for oppgave"}
              {task.time && ` • kl. ${task.time}`}
            </span>
            <h3 className="text-base font-extrabold text-slate-900 leading-tight">{task.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
            {task.instruction || "Ingen instruks er registrert for denne rollen ennå."}
          </div>

          {fromLibrary && (
            <p className="text-[11px] text-slate-500">
              Instruksen kommer fra rollebiblioteket.{" "}
              <Link to={studioTabUrl("planlegger-roller")} className="text-indigo-700 font-bold hover:underline">
                Rediger i Roller
              </Link>
            </p>
          )}

          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Lukk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
