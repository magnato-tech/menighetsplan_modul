import React, { useEffect, useRef } from "react";

/** How long the «Angre» offer stays on the screen. */
const SHOW_MS = 6000;

interface ProgramUndoToastProps {
  /** What was changed, in Norwegian, e.g. «Flyttet «Lovsang»». */
  what: string;
  onUndo: () => void;
  onHide: () => void;
}

/**
 * A small notice after a change to the programme, with a way to take it back. Give it a new `key` for
 * each change, so the time on screen starts again. It hides itself after a few seconds.
 */
export const ProgramUndoToast: React.FC<ProgramUndoToastProps> = ({ what, onUndo, onHide }) => {
  // Kept in a ref so a new onHide from a re-render does not restart the timer
  const hideRef = useRef(onHide);
  hideRef.current = onHide;

  useEffect(() => {
    const timer = window.setTimeout(() => hideRef.current(), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)] flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm shadow-lg print:hidden"
    >
      <span className="min-w-0 truncate">Lagret · {what}</span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer"
      >
        Angre
      </button>
    </div>
  );
};
