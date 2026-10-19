import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock, MapPin } from "lucide-react";
import { formatNorwegianDateTime } from "../../../../utils/dates";
import { locationOf } from "../../../../utils/gatherings";
import type { UpcomingGathering } from "../../studio";

interface UpcomingGatheringsPanelProps {
  upcoming: UpcomingGathering[];
  /** Whether the installation has the planner: without it there is no staffing to show. */
  withPlanner: boolean;
  onShowAll: () => void;
}

/** How the staffing of one gathering stands, in words with icons. */
const StaffingLine: React.FC<{ staffing: UpcomingGathering["staffing"] }> = ({ staffing }) => {
  if (staffing.total === 0) return <span className="text-[var(--studio-muted)]">Ingen oppgaver</span>;
  const toOrder = staffing.forfall + staffing.ubesatt;
  if (toOrder === 0 && staffing.venter === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <CheckCircle2 className="w-4 h-4" aria-hidden />
        Fullt bemannet
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {staffing.forfall > 0 && (
        <span className="inline-flex items-center gap-1 text-rose-400">
          <AlertTriangle className="w-4 h-4" aria-hidden />
          {staffing.forfall} forfall
        </span>
      )}
      {staffing.ubesatt > 0 && (
        <span className="inline-flex items-center gap-1 text-rose-400">
          <AlertTriangle className="w-4 h-4" aria-hidden />
          {staffing.ubesatt} ubesatt
        </span>
      )}
      {staffing.venter > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-400">
          <Clock className="w-4 h-4" aria-hidden />
          {staffing.venter} venter
        </span>
      )}
    </span>
  );
};

/**
 * What the planning overview opens with: the next gatherings, each one press from its staffing.
 * The next one is the largest, because that is where something may need fixing today.
 */
export const UpcomingGatheringsPanel: React.FC<UpcomingGatheringsPanelProps> = ({ upcoming, withPlanner, onShowAll }) => (
  <section aria-labelledby="upcoming-heading" className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h2 id="upcoming-heading" className="text-sm font-bold uppercase tracking-wider text-[var(--studio-muted)] flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-[var(--studio-icon)]" aria-hidden />
        Kommende arrangementer
      </h2>
      <button
        type="button"
        onClick={onShowAll}
        className="text-xs font-bold text-[var(--studio-icon)] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
      >
        Alle
        <ChevronRight className="w-4 h-4" aria-hidden />
      </button>
    </div>

    {upcoming.length === 0 ? (
      <p className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-sm text-[var(--studio-muted)]">
        Ingen arrangementer framover.
      </p>
    ) : (
      <ul className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {upcoming.map(({ item, staffing }, index) => {
          const g = item.gathering;
          const toOrder = staffing.forfall + staffing.ubesatt;
          const first = index === 0;
          return (
            <li key={g.id}>
              <Link
                to={`/admin/samling/${g.id}${withPlanner ? "?vis=bemanning" : "?vis=program"}`}
                className={`block h-full rounded-2xl border bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] transition-colors ${
                  first ? "p-5" : "p-4"
                } ${withPlanner && toOrder > 0 ? "border-rose-700/70" : "border-[var(--studio-border)] hover:border-indigo-500"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    {first && <span className="text-[10px] font-black uppercase tracking-wider text-[var(--studio-icon)]">Neste</span>}
                    <p className={`font-black text-[var(--studio-text)] leading-tight ${first ? "text-lg" : "text-base"}`}>{g.title}</p>
                    <p className="text-xs text-[var(--studio-muted)]">{formatNorwegianDateTime(g.startsAt)}</p>
                    <p className="text-xs text-[var(--studio-muted)] flex items-center gap-1">
                      <MapPin className="w-3 h-3" aria-hidden />
                      {locationOf(g)}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--studio-muted)] shrink-0 mt-1" aria-hidden />
                </div>
                {withPlanner && (
                  <div className="mt-3 pt-3 border-t border-[var(--studio-border)] text-sm font-bold">
                    <StaffingLine staffing={staffing} />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
