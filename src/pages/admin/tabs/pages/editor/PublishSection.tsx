import React from "react";
import { Check, Clock, X } from "lucide-react";
import { CmsPage } from "../../../../../data/cmsData";
import { formatNorwegianDateTime } from "../../../../../utils/dates";

// Turns a stored time into the value a datetime-local input expects, in local time.
function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  } catch {
    return "";
  }
}

// Preset publishing times: tomorrow 09:00, next Sunday 08:00 and next Monday 09:00.
function getPresetDate(type: "tomorrow" | "sunday" | "monday"): string {
  const d = new Date();
  if (type === "tomorrow") {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else if (type === "sunday") {
    const daysUntilSunday = (7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSunday);
    d.setHours(8, 0, 0, 0);
  } else if (type === "monday") {
    const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(9, 0, 0, 0);
  }
  return d.toISOString();
}

export interface PublishSectionProps {
  editingPage: Partial<CmsPage>;
  onUpdate: (updated: Partial<CmsPage>) => void;
}

export const PublishSection: React.FC<PublishSectionProps> = ({ editingPage, onUpdate }) => {
  const publishTime = editingPage.publishAt ? new Date(editingPage.publishAt).getTime() : 0;
  const isFutureScheduled =
    editingPage.isPublished !== false &&
    Boolean(publishTime && publishTime > Date.now());

  const handlePublishDateChange = (val: string) => {
    if (!val) {
      onUpdate({
        ...editingPage,
        publishAt: undefined,
        publishedAt: undefined,
      });
      return;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return;
    const iso = d.toISOString();
    const isFuture = d.getTime() > Date.now();
    onUpdate({
      ...editingPage,
      publishAt: iso,
      publishedAt: iso,
      isPublished: true, // Auto-enable publishing when scheduling a date
      status: isFuture ? "scheduled" : "published",
    });
  };
  return (
    <div data-page-section="publish" className="space-y-4">
      {/* Publisering & Synlighet */}
      <div className="p-4 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)] space-y-4">
        <h4 className="text-xs font-bold text-[var(--studio-text)] uppercase tracking-wider">
          Publisering & Synlighet
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] cursor-pointer hover:border-[var(--studio-border)] transition-colors">
            <input
              type="checkbox"
              checked={editingPage.isPublished !== false}
              onChange={(e) => onUpdate({ ...editingPage, isPublished: e.target.checked })}
              className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold block text-[var(--studio-text)] text-xs">Aktiver publisering</span>
              <span className="text-[11px] text-[var(--studio-muted)] block leading-tight mt-0.5">
                Når aktivert, vil siden være synlig for publikum (eller automatisk fra planlagt dato).
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] cursor-pointer hover:border-[var(--studio-border)] transition-colors">
            <input
              type="checkbox"
              checked={editingPage.inNavMenu !== false}
              onChange={(e) => onUpdate({ ...editingPage, inNavMenu: e.target.checked })}
              className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold block text-[var(--studio-text)] text-xs">Vis i offentlig meny</span>
              <span className="text-[11px] text-[var(--studio-muted)] block leading-tight mt-0.5">
                Vises i toppmenyen eller nedtrekksmenyen. Slått av er siden bare tilgjengelig via direkte lenke.
              </span>
            </div>
          </label>
        </div>

        {/* 'Publiseringsdato'-velger (Planlagt publisering) */}
        <div className="p-3.5 rounded-xl bg-[var(--studio-overlay)] border border-[var(--studio-border)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
              <span>Publiseringsdato & tidspunkt (Planlegging)</span>
            </label>
            {editingPage.publishAt && (
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    ...editingPage,
                    publishAt: undefined,
                    publishedAt: undefined,
                  })
                }
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="Fjern tidsplan og publiser umiddelbart"
              >
                <X className="w-3 h-3" />
                <span>Nullstill dato (publiser umiddelbart)</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1">
              <input
                type="datetime-local"
                value={toDatetimeLocal(editingPage.publishAt)}
                onChange={(e) => handlePublishDateChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Hurtigvalg-knapper */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handlePublishDateChange(getPresetDate("tomorrow"))}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-[11px] font-medium transition-colors cursor-pointer"
                title="Sett publisering til i morgen kl. 09:00"
              >
                I morgen 09:00
              </button>
              <button
                type="button"
                onClick={() => handlePublishDateChange(getPresetDate("sunday"))}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-[11px] font-medium transition-colors cursor-pointer"
                title="Sett publisering til kommende søndag kl. 08:00"
              >
                Søndag 08:00
              </button>
              <button
                type="button"
                onClick={() => handlePublishDateChange(getPresetDate("monday"))}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-muted)] text-[11px] font-medium transition-colors cursor-pointer"
                title="Sett publisering til neste mandag kl. 09:00"
              >
                Mandag 09:00
              </button>
            </div>
          </div>

          {/* Forklarende statusmelding basert på valgt dato */}
          {editingPage.publishAt ? (
            isFutureScheduled ? (
              <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-800/80 text-blue-200 text-xs flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block text-blue-100">
                    Planlagt for automatisk publisering:
                  </span>
                  <p className="text-[11px] text-blue-300/90 leading-relaxed">
                    Siden holdes automatisk som en skjult kladd for publikum frem til{" "}
                    <strong className="text-[var(--studio-text)] font-semibold">
                      {formatNorwegianDateTime(editingPage.publishAt)}
                    </strong>
                    . Da går siden automatisk over til statusen «Publisert» uten manuell handling.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-emerald-300">
                  Publiseringsdato er passert ({formatNorwegianDateTime(editingPage.publishAt)}). Siden er aktiv og synlig på nettsiden.
                </span>
              </div>
            )
          ) : (
            <p className="text-[11px] text-[var(--studio-muted)]">
              💡 La feltet stå tomt hvis du vil publisere siden umiddelbart ved lagring.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
