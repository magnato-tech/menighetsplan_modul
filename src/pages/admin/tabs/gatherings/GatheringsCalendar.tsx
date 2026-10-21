import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { AdminGatheringItem } from "../../../../hooks/useAppHooks";
import { monthLabel } from "../../../../utils/calendarMonth";
import { calendarKindOf, dayKey, monthWeeks, weekDays, weekNumber, type CalendarKind } from "../../../../utils/adminCalendar";
import { visibilityOf } from "../../../../utils/visibility";
import type { CalendarMonthCell } from "../../../../utils/calendarMonth";

/** The colour of each filter button and of the events under it, solid so it reads on a light and a dark admin. */
export const KIND_COLORS: Record<CalendarKind, string> = {
  gudstjenester: "bg-indigo-600",
  husgrupper: "bg-emerald-600",
  tjenestegrupper: "bg-amber-600",
  andre: "bg-sky-600",
};

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const WEEKDAYS_LONG = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
/** How many events a day in the month shows before «+N til». */
const MONTH_DAY_MAX = 3;

const clock = (iso: string) => new Intl.DateTimeFormat("no-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const dayAndMonth = (date: Date) => new Intl.DateTimeFormat("no-NO", { day: "numeric", month: "short" }).format(date);

interface GatheringsCalendarProps {
  items: AdminGatheringItem[];
  mode: "month" | "week";
  /** A day in the month or week shown. */
  anchor: Date;
  onAnchorChange: (day: Date) => void;
  /** «+N til» on a day in the month opens that week. */
  onShowWeek: (day: Date) => void;
  /** A press on a free part of a day: a new event that day ("2026-10-25"). */
  onNewOnDay: (day: string) => void;
  /** A phone: the week as seven rows, not seven columns. */
  narrow: boolean;
}

/** One event in the calendar: time and title, in the colour of its button. It opens the event, as the card does. */
const EventPill: React.FC<{ item: AdminGatheringItem }> = ({ item }) => {
  const g = item.gathering;
  const internal = visibilityOf(g) === "intern";
  const missing = item.totalTasks > 0 && item.staffing.color === "red";
  return (
    <Link
      to={`/admin/samling/${g.id}?vis=bemanning`}
      onClick={(event) => event.stopPropagation()}
      title={`${clock(g.startsAt)} ${g.title}${internal ? " (kun intern)" : ""}${missing ? ` · mangler ${item.missingStaffingCount} frivillige` : ""}`}
      data-calendar-event={g.id}
      className={`flex items-center gap-1 min-w-0 px-1.5 py-0.5 rounded text-[10px] leading-tight font-semibold text-white hover:brightness-110 ${
        KIND_COLORS[calendarKindOf(g, item.group)]
      } ${internal ? "opacity-70 ring-1 ring-inset ring-white/60" : ""} ${g.cancelled ? "line-through opacity-60" : ""}`}
    >
      {missing && <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-rose-400 ring-1 ring-white" aria-label="Mangler frivillige" />}
      <span className="shrink-0 tabular-nums opacity-90">{clock(g.startsAt)}</span>
      <span className="truncate">{g.title}</span>
    </Link>
  );
};

/** The free part of a day opens a new event that day; the events in it open themselves. */
const dayProps = (cell: CalendarMonthCell, onNewOnDay: (day: string) => void) => ({
  onClick: () => onNewOnDay(dayKey(cell.date)),
  "data-calendar-day": dayKey(cell.date),
  title: "Trykk på en ledig plass for et nytt arrangement denne dagen",
});

const DayNumber: React.FC<{ cell: CalendarMonthCell }> = ({ cell }) => (
  <span
    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
      cell.isToday ? "bg-indigo-600 text-white" : cell.inMonth ? "text-[var(--studio-text)]" : "text-[var(--studio-muted)] opacity-60"
    }`}
  >
    {cell.date.getDate()}
  </span>
);

/** A small «+» for the keyboard and the screen reader, who cannot press a free part of a day. */
const NewButton: React.FC<{ cell: CalendarMonthCell; onNewOnDay: (day: string) => void }> = ({ cell, onNewOnDay }) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onNewOnDay(dayKey(cell.date));
    }}
    aria-label={`Nytt arrangement ${WEEKDAYS_LONG[(cell.date.getDay() + 6) % 7].toLowerCase()} ${dayAndMonth(cell.date)}`}
    className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-5 h-5 rounded flex items-center justify-center text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer"
  >
    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
  </button>
);

/**
 * «Kalender» in the planner shown as a month or a week. Events are only opened from here, never moved:
 * an event has tasks and people who said yes, and often a series («Flytt resten av serien» moves those).
 */
export const GatheringsCalendar: React.FC<GatheringsCalendarProps> = ({ items, mode, anchor, onAnchorChange, onShowWeek, onNewOnDay, narrow }) => {
  const byId = useMemo(() => new Map(items.map((item) => [item.gathering.id, item])), [items]);
  const events = useMemo(() => items.map((item) => item.gathering), [items]);
  const itemsOf = (cell: CalendarMonthCell) => cell.events.map((g) => byId.get(g.id)!).filter(Boolean);

  const step = (direction: 1 | -1) =>
    onAnchorChange(
      mode === "month"
        ? new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1)
        : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * direction)
    );

  const days = mode === "week" ? weekDays(anchor, events) : [];
  const title =
    mode === "month"
      ? monthLabel(anchor.getFullYear(), anchor.getMonth())
      : `Uke ${weekNumber(anchor)} · ${dayAndMonth(days[0].date)} – ${dayAndMonth(days[6].date)}`;

  const header = (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--studio-border)]">
      <h3 className="text-sm font-black text-[var(--studio-text)] first-letter:uppercase">{title}</h3>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onAnchorChange(new Date())}
          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[var(--studio-text)] border border-[var(--studio-border)] hover:bg-[var(--studio-hover)] cursor-pointer"
        >
          I dag
        </button>
        <button type="button" onClick={() => step(-1)} aria-label={mode === "month" ? "Forrige måned" : "Forrige uke"} className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => step(1)} aria-label={mode === "month" ? "Neste måned" : "Neste uke"} className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-hover)] cursor-pointer">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const frame = "rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] overflow-hidden";

  if (mode === "month") {
    const weeks = monthWeeks(anchor.getFullYear(), anchor.getMonth(), events);
    return (
      <div className={frame} data-calendar-view="month">
        {header}
        <div className="grid grid-cols-7 border-b border-[var(--studio-border)]">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--studio-muted)]">
              {day}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={dayKey(week[0].date)} className="grid grid-cols-7 border-b last:border-b-0 border-[var(--studio-border)]">
            {week.map((cell) => {
              const dayItems = itemsOf(cell);
              const extra = dayItems.length - MONTH_DAY_MAX;
              return (
                <div
                  key={dayKey(cell.date)}
                  {...dayProps(cell, onNewOnDay)}
                  className={`group min-h-[86px] p-1 border-r last:border-r-0 border-[var(--studio-border)] space-y-0.5 cursor-pointer hover:bg-[var(--studio-hover)]/40 ${
                    cell.inMonth ? "" : "bg-[var(--studio-bg)]/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <DayNumber cell={cell} />
                    <NewButton cell={cell} onNewOnDay={onNewOnDay} />
                  </div>
                  {dayItems.slice(0, MONTH_DAY_MAX).map((item) => (
                    <EventPill key={item.gathering.id} item={item} />
                  ))}
                  {extra > 0 && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onShowWeek(cell.date);
                      }}
                      className="w-full text-left px-1 text-[10px] font-bold text-[var(--studio-accent-text)] hover:underline cursor-pointer"
                    >
                      +{extra} til
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // The week: seven columns on a large screen, seven rows on a phone, so the whole week is on the screen
  return (
    <div className={frame} data-calendar-view="week">
      {header}
      <div className={narrow ? "divide-y divide-[var(--studio-border)]" : "grid grid-cols-7 divide-x divide-[var(--studio-border)]"}>
        {days.map((cell, index) => {
          const dayItems = itemsOf(cell);
          return (
            <div
              key={dayKey(cell.date)}
              {...dayProps(cell, onNewOnDay)}
              className={`group cursor-pointer hover:bg-[var(--studio-hover)]/40 ${
                narrow ? "flex items-start gap-2 px-2 py-1.5 min-h-[34px]" : "min-h-[220px] p-1.5 space-y-1"
              }`}
            >
              <div className={narrow ? "w-14 shrink-0 flex items-center gap-1" : "flex items-center justify-between"}>
                <span className={`text-[10px] font-bold uppercase ${cell.isToday ? "text-[var(--studio-accent-text)]" : "text-[var(--studio-muted)]"}`}>
                  {WEEKDAYS[index]}
                </span>
                <DayNumber cell={cell} />
                {!narrow && <NewButton cell={cell} onNewOnDay={onNewOnDay} />}
              </div>
              <div className={narrow ? "flex-1 min-w-0 space-y-0.5" : "space-y-0.5"}>
                {dayItems.map((item) => (
                  <EventPill key={item.gathering.id} item={item} />
                ))}
              </div>
              {narrow && <NewButton cell={cell} onNewOnDay={onNewOnDay} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
