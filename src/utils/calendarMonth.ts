import type { Gathering } from "../types";

export interface CalendarMonthCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  events: Gathering[];
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Monday = 0 … Sunday = 6 */
function mondayBasedWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** The first millisecond of a calendar day and the last one, in the local time zone. */
export function dayBounds(date: Date): { start: number; end: number } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
  return { start, end };
}

/** The end of an event, when it is later than its start. An event without one lasts only its start day. */
function endOf(g: Pick<Gathering, "startsAt" | "endsAt">): number | undefined {
  if (!g.endsAt) return undefined;
  const end = Date.parse(g.endsAt);
  return end > Date.parse(g.startsAt) ? end : undefined;
}

/**
 * The event started before this day and ends after the day's start. An end at 00:00 does not include
 * the day that begins then (iCal convention: 25 Nov 00:00 to 26 Nov 00:00 is one day).
 */
export function isContinuationDay(g: Pick<Gathering, "startsAt" | "endsAt">, dayStart: number): boolean {
  const end = endOf(g);
  return end !== undefined && Date.parse(g.startsAt) < dayStart && end > dayStart;
}

/** The event occurs on the day: it starts within the day, or it runs into the day from an earlier one. */
export function occursOnDay(g: Pick<Gathering, "startsAt" | "endsAt">, dayStart: number, dayEnd: number): boolean {
  const start = Date.parse(g.startsAt);
  if (start >= dayStart && start <= dayEnd) return true;
  return isContinuationDay(g, dayStart);
}

/** The event lasts into the day after its start, so it is more than one day. */
export function lastsMoreThanOneDay(g: Pick<Gathering, "startsAt" | "endsAt">): boolean {
  const end = endOf(g);
  if (end === undefined) return false;
  return end > dayBounds(new Date(g.startsAt)).end + 1;
}

export function buildMonthGrid(
  year: number,
  month: number,
  events: Gathering[],
  today: Date = new Date()
): CalendarMonthCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - mondayBasedWeekday(firstOfMonth));

  const todayStart = startOfDay(today).getTime();
  const cells: CalendarMonthCell[] = [];

  for (let i = 0; i < 42; i++) {
    // Counted in calendar days. A day is 23 or 25 hours when the clocks change, so stepping
    // 24 hours at a time shows one date twice in October and skips one in March.
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const { start: dayStart, end: dayEnd } = dayBounds(date);
    const dayEvents = events.filter((g) => occursOnDay(g, dayStart, dayEnd));

    cells.push({
      date,
      inMonth: date.getMonth() === month,
      isToday: dayStart === todayStart,
      events: dayEvents,
    });
  }

  return cells;
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("no-NO", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
}
