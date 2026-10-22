import React from "react";
import { CalendarClock } from "lucide-react";

interface NewsEndDateDialogProps {
  open: boolean;
  /** The latest date the article mentions, offered as its last day ("2026-10-16"), or null. */
  suggestion: string | null;
  onUseSuggestion: () => void;
  onChooseDate: () => void;
  onSaveWithout: () => void;
}

const DAY_LABEL = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", timeZone: "UTC" });
const dayLabel = (day: string) => DAY_LABEL.format(new Date(`${day}T12:00:00Z`));

/**
 * Asked when a published article is saved with nothing that ends it: no last day, and no event in the
 * calendar. An article about an event put in as news would otherwise stand on the website after it.
 */
export const NewsEndDateDialog: React.FC<NewsEndDateDialogProps> = ({ open, suggestion, onUseSuggestion, onChooseDate, onSaveWithout }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-[var(--studio-overlay)] backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="news-end-date-title"
        className="bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl"
      >
        <h3 id="news-end-date-title" className="text-base font-bold text-[var(--studio-text)] flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-amber-500" />
          <span>Når skal nyheten gå ut?</span>
        </h3>
        <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
          Nyheten har ingen siste dag og hører ikke til et arrangement i kalenderen. Da blir den stående på nettsiden til noen fjerner den.
          Handler den om et arrangement, sett siste dag den skal vises.
        </p>
        {suggestion && (
          <p className="text-xs text-[var(--studio-text)]">
            Teksten nevner <strong>{dayLabel(suggestion)}</strong>.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onSaveWithout}
            className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] text-[var(--studio-muted)] text-xs font-semibold hover:bg-[var(--studio-hover)] cursor-pointer transition-colors"
          >
            Lagre uten siste dag
          </button>
          <button
            type="button"
            onClick={onChooseDate}
            autoFocus={!suggestion}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              suggestion ? "bg-[var(--studio-surface)] text-[var(--studio-text)] hover:bg-[var(--studio-hover)]" : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            Velg dato
          </button>
          {suggestion && (
            <button
              type="button"
              onClick={onUseSuggestion}
              autoFocus
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              Vis til og med {dayLabel(suggestion)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
