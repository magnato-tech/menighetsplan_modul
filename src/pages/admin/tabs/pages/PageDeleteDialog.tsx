import React from "react";
import { AlertTriangle } from "lucide-react";

interface PageDeleteDialogProps {
  pageId: string | null;
  subPagesCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PageDeleteDialog: React.FC<PageDeleteDialogProps> = ({
  pageId,
  subPagesCount,
  onConfirm,
  onCancel,
}) => {
  if (!pageId) return null;

  return (
    <div className="fixed inset-0 bg-[var(--studio-overlay)] backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
        <h3 className="text-base font-bold text-[var(--studio-text)] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-500" />
          <span>Flytte side til papirkurven?</span>
        </h3>
        <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
          Siden tas bort fra nettsiden og flyttes til papirkurven. Du kan hente den tilbake i 30 dager, og den står der den sto.
        </p>
        {subPagesCount > 0 && (
          <p className="text-xs text-amber-300 leading-relaxed bg-amber-950/40 p-3 rounded-xl border border-amber-800/40">
            {subPagesCount === 1
              ? "Siden har én underfane. Den slettes ikke, men flyttes automatisk opp til en hovedfane."
              : `Siden har ${subPagesCount} underfaner. De slettes ikke, men flyttes automatisk opp til hovedfaner.`}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] text-[var(--studio-muted)] text-xs font-semibold hover:bg-[var(--studio-hover)] cursor-pointer transition-colors"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Flytt til papirkurven
          </button>
        </div>
      </div>
    </div>
  );
};
