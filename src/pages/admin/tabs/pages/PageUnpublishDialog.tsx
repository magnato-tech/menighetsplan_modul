import React, { useEffect } from "react";
import { EyeOff } from "lucide-react";
import type { CmsPage } from "../../../../data/cmsData";

interface PageUnpublishDialogProps {
  page: CmsPage | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Asks before a published page is taken off the website. Nothing is deleted, so this is not a red warning.
export const PageUnpublishDialog: React.FC<PageUnpublishDialogProps> = ({ page, onConfirm, onCancel }) => {
  // Escape cancels, like Avbryt. Hooks come before the early return below.
  useEffect(() => {
    if (!page) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, onCancel]);

  if (!page) return null;

  return (
    <div className="fixed inset-0 bg-[var(--studio-overlay)] backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
        <h3 className="text-base font-bold text-[var(--studio-text)] flex items-center gap-2">
          <EyeOff className="w-5 h-5 text-amber-500" aria-hidden="true" />
          <span>Ta «{page.title}» bort fra nettsiden?</span>
        </h3>
        <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
          Siden blir kladd og vises ikke på nettsiden før du publiserer den igjen. Innholdet blir liggende.
        </p>
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
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Sett til kladd
          </button>
        </div>
      </div>
    </div>
  );
};
