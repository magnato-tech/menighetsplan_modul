import React from "react";
import { AlertTriangle } from "lucide-react";

interface UnsavedChangesDialogProps {
  open: boolean;
  /** The title of the page with the changes, as it stands in the editor. */
  pageTitle?: string;
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
}

/** Asked before the editor closes or moves to another page while it holds changes that are not saved. */
export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({ open, pageTitle, onSave, onDiscard, onStay }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-[var(--studio-overlay)] backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl"
      >
        <h3 id="unsaved-changes-title" className="text-base font-bold text-[var(--studio-text)] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <span>Endringene er ikke lagret</span>
        </h3>
        <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
          {pageTitle?.trim() ? `Du har endret «${pageTitle.trim()}» uten å lagre.` : "Du har endret siden uten å lagre."} Vil du lagre før du går videre?
        </p>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onStay}
            autoFocus
            className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] text-[var(--studio-muted)] text-xs font-semibold hover:bg-[var(--studio-hover)] cursor-pointer transition-colors"
          >
            Bli her
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] text-rose-600 text-xs font-semibold hover:bg-[var(--studio-hover)] cursor-pointer transition-colors"
          >
            Forkast endringene
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Lagre
          </button>
        </div>
      </div>
    </div>
  );
};
