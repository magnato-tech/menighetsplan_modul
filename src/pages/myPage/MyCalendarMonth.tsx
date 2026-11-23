import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { StaffingDotMark } from "../../components/gathering/StaffingDotMark";
import type { Gathering } from "../../types";
import { dayBounds, isContinuationDay, monthLabel, type CalendarMonthCell } from "../../utils/calendarMonth";
import { defaultMonthDay, dayKey, monthWeeks } from "../../utils/adminCalendar";
import { locationOf } from "../../utils/gatherings";
import type { PersonalCalendarEvent } from "../../utils/personalCalendar";
import type { StaffingDot } from "../../utils/staffing";

interface MyCalendarMonthProps {
  events: PersonalCalendarEvent[];
  /** The staffing dot of each event, when the person has one to see. */
  dots: ReadonlyMap<string, StaffingDot | null>;
  onOpen: (gatheringId: string) => void;
}

/** How many events a day shows in its cell before «+N til». The day's list beside the month shows all of them. */
const CELL_MAX = 3;

const WEEKDAYS = ["MAN", "TIR", "ONS", "TOR", "FRE", "LØR", "SØN"];

const clock = (iso: string) => new Intl.DateTimeFormat("no-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const dayName = (date: Date) => capitalize(new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long" }).format(date));

/**
 * The time an event shows on a day: «forts.» on a day it runs on after starting, nothing for an event that
 * starts at midnight and lasts whole days (00:00 says nothing there), otherwise the start time.
 */
function timeOnDay(g: Gathering, day: Date): string | null {
  if (isContinuationDay(g, dayBounds(day).start)) return "forts.";
  const start = new Date(g.startsAt);
  const atMidnight = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0;
  if (atMidnight && g.endsAt) return null;
  return clock(g.startsAt);
}

const pillClass = (cancelled: boolean | undefined) =>
  `flex items-center gap-1 w-full min-w-0 px-1 py-0.5 rounded text-[10px] leading-tight text-left cursor-pointer transition-colors ${
    cancelled ? "bg-red-50 text-red-700 line-through hover:bg-red-100" : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
  }`;

/**
 * The calendar as a month, for a tablet and a PC. A press on an event opens it; a press on a day selects it,
 * and the day's events are listed beside the month (on a PC) or under it (on a tablet).
 */
export const MyCalendarMonth: React.FC<MyCalendarMonthProps> = ({ events, dots, onOpen }) => {
  const [shown, setShown] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  // The day picked, and the month it was picked in. Another month, or none picked: defaultMonthDay decides.
  const [picked, setPicked] = useState<{ month: string; day: string } | null>(null);

  const monthKey = `${shown.year}-${shown.month}`;
  const gatherings = useMemo(() => events.map((e) => e.gathering), [events]);
  const weeks = useMemo(() => monthWeeks(shown.year, shown.month, gatherings), [shown, gatherings]);
  const cells = useMemo(() => weeks.flat(), [weeks]);
  const selectedKey = picked?.month === monthKey ? picked.day : defaultMonthDay(cells);
  const selectedCell = cells.find((cell) => dayKey(cell.date) === selectedKey);

  const goToToday = () => {
    const now = new Date();
    setShown({ year: now.getFullYear(), month: now.getMonth() });
    setPicked(null);
  };
  const goToMonth = (offset: number) => {
    setShown((current) => {
      const date = new Date(current.year, current.month + offset, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
    setPicked(null);
  };

  const renderPill = (g: Gathering, cell: CalendarMonthCell) => {
    const time = timeOnDay(g, cell.date);
    const dot = !g.cancelled ? dots.get(g.id) : null;
    return (
      <button
        key={g.id}
        type="button"
        onClick={() => onOpen(g.id)}
        data-calendar-event={g.id}
        title={`${time ? `${time} ` : ""}${g.title}${g.cancelled ? " (avlyst)" : ""}`}
        className={pillClass(g.cancelled)}
      >
        {dot && <StaffingDotMark dot={dot} />}
        {time && <span className="shrink-0 tabular-nums font-semibold">{time}</span>}
        <span className="truncate">{g.title}</span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">{capitalize(monthLabel(shown.year, shown.month))}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToToday}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            I dag
          </button>
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Forrige måned"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Neste måned"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_17rem] lg:gap-4 lg:items-start">
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {WEEKDAYS.map((name) => (
              <div key={name} className="py-1.5 text-center text-[10px] font-bold tracking-wide text-slate-500">
                {name}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={dayKey(week[0].date)} className="grid grid-cols-7">
              {week.map((cell) => {
                const key = dayKey(cell.date);
                const selected = key === selectedKey;
                const shownEvents = cell.events.slice(0, CELL_MAX);
                const more = cell.events.length - shownEvents.length;
                return (
                  <div
                    key={key}
                    data-calendar-day={key}
                    className={`min-h-[5.5rem] p-1 flex flex-col gap-0.5 border-t border-l border-slate-100 first:border-l-0 ${
                      selected ? "bg-emerald-50/70" : ""
                    } ${cell.inMonth ? "" : "opacity-50"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setPicked({ month: monthKey, day: key })}
                      aria-pressed={selected}
                      aria-label={`${dayName(cell.date)}${cell.events.length > 0 ? `, ${cell.events.length} hendelser` : ""}`}
                      className="self-center cursor-pointer"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold tabular-nums ${
                          cell.isToday
                            ? "bg-primary-700 text-white"
                            : selected
                              ? "ring-2 ring-emerald-600 text-slate-900"
                              : "text-slate-800 hover:bg-slate-100"
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                    </button>
                    {shownEvents.map((g) => renderPill(g, cell))}
                    {more > 0 && (
                      <button
                        type="button"
                        onClick={() => setPicked({ month: monthKey, day: key })}
                        aria-label={`Vis ${more} til denne dagen`}
                        className="px-1 text-left text-[10px] font-semibold text-emerald-800 hover:underline cursor-pointer"
                      >
                        +{more} til
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <aside className="mt-3 lg:mt-0 bg-white rounded-2xl border border-slate-200/80 p-3 space-y-2" aria-label="Valgt dag">
          {selectedCell && (
            <>
              <h3 className="text-sm font-bold text-slate-900">{dayName(selectedCell.date)}</h3>
              {selectedCell.events.length === 0 ? (
                <p className="text-xs text-slate-500">Ingen hendelser denne dagen.</p>
              ) : (
                selectedCell.events.map((g) => {
                  const time = timeOnDay(g, selectedCell.date);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onOpen(g.id)}
                      className={`w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 space-y-1 cursor-pointer ${
                        g.cancelled ? "bg-red-50/30 opacity-75" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-xs font-bold text-slate-900 leading-snug ${g.cancelled ? "line-through" : ""}`}>{g.title}</span>
                        {g.cancelled && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">Avlyst</span>
                        )}
                      </div>
                      {time && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                          <Clock className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
                          <span className="tabular-nums">{time}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" aria-hidden="true" />
                        <span className="truncate">{locationOf(g)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
};
