import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { LeaderGroupCard } from "../../pages/leaderGroup/LeaderGroupCard";

interface TeamCardDialogProps {
  groupId: string;
  /** The id of the team's icon in «Bemanning». Focus goes back to it when the dialog closes. */
  returnFocusId: string;
  onClose: () => void;
}

/**
 * The team's group card over «Bemanning», in a popup. Escape, the close button and a press on the
 * backdrop close it. Body scroll is locked while it is open.
 */
export const TeamCardDialog: React.FC<TeamCardDialogProps> = ({ groupId, returnFocusId, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.getElementById(returnFocusId)?.focus();
    };
  }, [returnFocusId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-card-title"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex justify-end bg-white p-1">
          <button
            ref={closeRef}
            type="button"
            aria-label="Lukk"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>
        {/* Opened from the staffing, so the people of the team come first */}
        <LeaderGroupCard groupId={groupId} inPopup initialTab="medlemmer" />
      </div>
    </div>,
    document.body
  );
};
