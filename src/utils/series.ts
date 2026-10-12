// The days of a series: an event that is repeated from a first day through a last one.
//
// A series is counted in whole days, as the calendar shows them, and has nothing to do with the
// clock: the time of day is put on each day afterwards, so a service at 11:00 is at 11:00 on
// both sides of a change between summer and winter time.

export const SERIES_FREQUENCIES = [
  { id: "weekly", label: "Hver uke" },
  { id: "every2", label: "Hver 2. uke" },
  { id: "every3", label: "Hver 3. uke" },
  { id: "every4", label: "Hver 4. uke" },
  { id: "monthly", label: "Én gang i måneden" },
] as const;

export type SeriesFrequency = (typeof SERIES_FREQUENCIES)[number]["id"];

/** A series is never longer than this, however far apart the first and the last day are. */
export const SERIES_LIMIT = 60;

/**
 * The last day a new series is suggested to run to: through the rest of the year and up to the
 * summer. That is the 30th of June that comes next, this year's until it has passed.
 */
export function suggestedLastDay(today: string): string {
  const year = Number(today.slice(0, 4));
  if (!Number.isInteger(year) || today.length < 10) return "";
  return today <= `${year}-06-30` ? `${year}-06-30` : `${year + 1}-06-30`;
}

/**
 * What is taken away when the rest of a series is removed from one of its events on: that event
 * and those after it. An event somebody has been asked about, or has answered for, is left
 * standing, so nobody's answer disappears with it.
 */
export function restOfSeries<T extends { id: string; seriesId?: string; startsAt: string }>(
  events: readonly T[],
  from: Pick<T, "seriesId" | "startsAt">,
  hasAnswers: (event: T) => boolean
): { remove: T[]; kept: T[] } {
  if (!from.seriesId) return { remove: [], kept: [] };
  const start = new Date(from.startsAt).getTime();
  const rest = events.filter((event) => event.seriesId === from.seriesId && new Date(event.startsAt).getTime() >= start);
  return { remove: rest.filter((event) => !hasAnswers(event)), kept: rest.filter(hasAnswers) };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WEEKS: Record<Exclude<SeriesFrequency, "monthly">, number> = { weekly: 1, every2: 2, every3: 3, every4: 4 };

const parse = (day: string): number => (DAY.test(day) ? Date.parse(`${day}T00:00:00Z`) : NaN);
const write = (moment: number): string => new Date(moment).toISOString().slice(0, 10);

/** The day in a month that is the same weekday, in the same week of the month, as `first`. Null when the month has no such day. */
function sameWeekdayIn(year: number, month: number, first: Date): number | null {
  const week = Math.floor((first.getUTCDate() - 1) / 7);
  const start = new Date(Date.UTC(year, month, 1));
  const untilWeekday = (first.getUTCDay() - start.getUTCDay() + 7) % 7;
  const day = new Date(Date.UTC(year, month, 1 + untilWeekday + week * 7));
  return day.getUTCMonth() === start.getUTCMonth() ? day.getTime() : null;
}

/**
 * The days of a series, the first one included, each written "2026-10-18". Every week, or every
 * second, third or fourth, gives the same weekday. Once a month gives the same weekday in the
 * same week of the month (the second Sunday), and a month without one is left out.
 *
 * Nothing comes back when the first day is not a day, or the last one is before the first.
 */
export function seriesDays(first: string, last: string, frequency: SeriesFrequency, limit = SERIES_LIMIT): string[] {
  const start = parse(first);
  const end = parse(last);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];

  const days: string[] = [];
  if (frequency !== "monthly") {
    const step = WEEKS[frequency] * 7 * DAY_MS;
    for (let day = start; day <= end && days.length < limit; day += step) days.push(write(day));
    return days;
  }

  const firstDay = new Date(start);
  for (let month = 0; days.length < limit; month++) {
    const beginning = Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + month, 1);
    if (beginning > end) break;
    const year = new Date(beginning).getUTCFullYear();
    const day = sameWeekdayIn(year, new Date(beginning).getUTCMonth(), firstDay);
    if (day !== null && day <= end) days.push(write(day));
  }
  return days;
}
