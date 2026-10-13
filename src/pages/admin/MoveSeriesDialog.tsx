import React, { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, X } from "lucide-react";
import type { Gathering } from "../../types";
import { moveByDays, parseIsoToDateAndTime } from "../../utils/dates";
import { daysBetween, movedRestOfSeries } from "../../utils/series";

interface MoveSeriesDialogProps {
  /** The event the move starts from. It and those after it in the series are moved. */
  from: Gathering;
  /** Every event, so the rest of the series can be found. */
  gatherings: readonly Gathering[];
  /** How many of the events that are moved have someone asked or assigned. */
  staffedCount: number;
  onMove: (days: number) => void;
  onClose: () => void;
}

// "søn. 10. jan.": a day as it is read in a list
const dayText = (moment: string): string =>
  new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" }).format(new Date(moment));

/**
 * Moves the rest of a series: the admin gives the event a new day, and it and those after it are
 * moved as many days. What stands on the events follows them. The new days are shown before
 * anything is changed.
 */
export const MoveSeriesDialog: React.FC<MoveSeriesDialogProps> = ({ from, gatherings, staffedCount, onMove, onClose }) => {
  const currentDay = parseIsoToDateAndTime(from.startsAt).date;
  const [newDay, setNewDay] = useState(currentDay);
  const days = daysBetween(currentDay, newDay) ?? 0;
  const moved = useMemo(() => movedRestOfSeries(gatherings, from, days, moveByDays), [gatherings, from, days]);
  // With nothing to move yet, the events that would be moved are still counted
  const count = useMemo(() => movedRestOfSeries(gatherings, from, 1, moveByDays).length, [gatherings, from]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="move-series-heading" className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h3 id="move-series-heading" className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[var(--studio-icon)]" aria-hidden="true" />
            <span>Flytt resten av serien</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Lukk" className="text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-xs text-[var(--studio-muted)]">
          «{from.title}» {dayText(from.startsAt)} og de {count - 1} som kommer etter i serien, flyttes like mange dager. Klokkeslett, program, oppgaver og
          de som står på dem, følger med.
        </p>

        <div className="space-y-1">
          <label htmlFor="input-move-series-day" className="text-xs font-semibold text-[var(--studio-muted)]">
            Ny dato for {dayText(from.startsAt)}
          </label>
          <input
            type="date"
            id="input-move-series-day"
            value={newDay}
            onChange={(e) => setNewDay(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
          />
        </div>

        {moved.length > 0 ? (
          <section aria-label="Nye datoer" className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] p-3 space-y-2">
            <p className="text-xs font-bold text-[var(--studio-text)]">
              {moved.length} {moved.length === 1 ? "arrangement" : "arrangementer"} flyttes {Math.abs(days)} {Math.abs(days) === 1 ? "dag" : "dager"}{" "}
              {days > 0 ? "fram" : "tilbake"}
            </p>
            <p className="text-xs text-[var(--studio-muted)]">{moved.map((event) => dayText(event.startsAt)).join(" · ")}</p>
          </section>
        ) : (
          <p className="text-xs text-[var(--studio-muted)]">Velg en annen dato for å se hvor arrangementene havner.</p>
        )}

        {staffedCount > 0 && (
          <p className="flex items-start gap-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {staffedCount} av arrangementene har folk som er spurt eller står på en oppgave. De blir stående, på den nye datoen. Si fra til dem.
            </span>
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--studio-border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl border border-[var(--studio-border)] text-[var(--studio-muted)] text-xs font-bold cursor-pointer"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={moved.length === 0}
            onClick={() => onMove(days)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {moved.length > 1 ? `Flytt ${moved.length} arrangementer` : "Flytt arrangementet"}
          </button>
        </div>
      </div>
    </div>
  );
};
