import React, { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { Gathering } from "../../types";
import { formatNorwegianDateTime, formatNorwegianShortDateTime } from "../../utils/dates";
import { nearbySequence, neighbours, type SequenceItem } from "../../utils/gatheringSequence";

interface GatheringDateNavProps {
  gathering: Gathering;
  /** The gatherings the arrows step through, from gatheringSequence */
  sequence: SequenceItem[];
  /** Opens another gathering, keeping the tab */
  onOpen: (gatheringId: string) => void;
}

const arrowClass =
  "inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent print:hidden";

/**
 * The date of a gathering in the header, with an arrow on each side for the previous and the next one. The
 * date opens a short list of the gatherings around it.
 */
export const GatheringDateNav: React.FC<GatheringDateNavProps> = ({ gathering, sequence, onOpen }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { previous, next } = neighbours(sequence, gathering.id);
  const nearby = nearbySequence(sequence, gathering.id);

  // Closes on Escape and on a click outside the date and the list
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (gatheringId: string) => {
    setOpen(false);
    onOpen(gatheringId);
  };

  return (
    <span ref={wrapRef} className="relative inline-flex items-center gap-0.5">
      <button
        type="button"
        disabled={!previous}
        onClick={() => previous && go(previous.gathering.id)}
        aria-label={previous ? `Forrige: ${formatNorwegianDateTime(previous.gathering.startsAt)}` : "Ingen tidligere"}
        title={previous ? `Forrige: ${formatNorwegianDateTime(previous.gathering.startsAt)}` : "Ingen tidligere"}
        className={arrowClass}
      >
        <ChevronLeft className="w-5 h-5" aria-hidden />
      </button>

      <button
        type="button"
        id="gathering-date-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden />
        {formatNorwegianDateTime(gathering.startsAt)}
      </button>

      <button
        type="button"
        disabled={!next}
        onClick={() => next && go(next.gathering.id)}
        aria-label={next ? `Neste: ${formatNorwegianDateTime(next.gathering.startsAt)}` : "Ingen senere"}
        title={next ? `Neste: ${formatNorwegianDateTime(next.gathering.startsAt)}` : "Ingen senere"}
        className={arrowClass}
      >
        <ChevronRight className="w-5 h-5" aria-hidden />
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="Samlingene i rekken"
          tabIndex={-1}
          className="absolute left-0 top-full mt-1 z-40 w-72 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg p-1 outline-none print:hidden"
        >
          <ul>
            {nearby.map((item) => {
              const current = item.gathering.id === gathering.id;
              const cancelled = Boolean(item.gathering.cancelled);
              return (
                <li key={item.gathering.id}>
                  <button
                    type="button"
                    aria-current={current ? "true" : undefined}
                    onClick={() => go(item.gathering.id)}
                    className={`w-full flex flex-wrap items-baseline gap-x-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                      current ? "bg-indigo-50 text-indigo-900 font-bold" : "text-slate-700 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <span>{formatNorwegianShortDateTime(item.gathering.startsAt)}</span>
                    {item.gathering.theme && <span className="text-slate-500 font-normal">{item.gathering.theme}</span>}
                    {cancelled && <span className="text-slate-500 font-normal line-through">Avlyst</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </span>
  );
};
