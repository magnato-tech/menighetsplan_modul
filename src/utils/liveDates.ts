// Demo content that keeps up with the calendar.
//
// The demo content (data/mockData.ts and data/cmsData.ts) is written as if today were a day in
// one particular week. Before it is stored, every date in it is moved a whole number of weeks, so
// that week becomes the present one (see getCustomMockDocuments in data/mockDocuments.ts). Whole
// weeks, so a Sunday service stays on a Sunday. The clock is kept as it is read in Norway, so a
// service at 11:00 is at 11:00 on both sides of a change between summer and winter time.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const NORWAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** What the calendar and the clock show in Norway at a moment (in whole seconds), written as if it were UTC. */
function norwegianClock(moment: number): number {
  const part = Object.fromEntries(NORWAY.formatToParts(new Date(moment)).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(part.year, part.month - 1, part.day, part.hour % 24, part.minute, part.second);
}

/** The moment at which the calendar and the clock in Norway show `clock`. */
function momentOf(clock: number): number {
  // The distance between the two is asked for twice: the first answer may be from the other side of a clock change
  const nearby = clock - (norwegianClock(clock) - clock);
  return clock - (norwegianClock(nearby) - nearby);
}

/** The number of the day (counted from 1970) that the week of a clock reading starts on, a Monday. */
function mondayOf(clock: number): number {
  const day = Math.floor(clock / DAY_MS);
  return day - ((new Date(day * DAY_MS).getUTCDay() + 6) % 7);
}

/**
 * How many weeks the present week, as the calendar shows it in Norway, lies after the week of
 * `day` ("2026-08-31"). The answer changes at midnight between Sunday and Monday.
 */
export function weeksBetween(day: string, now: number): number {
  return (mondayOf(norwegianClock(now)) - mondayOf(Date.parse(`${day}T00:00:00Z`))) / 7;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * A stored date a number of weeks later (or, negative, earlier): a day ("2027-10-01") as a day,
 * and a moment as the moment the clock in Norway shows the same weekday and time. Anything that
 * is not a date is given back as it is.
 */
export function shiftDate(value: string, weeks: number): string {
  if (DAY.test(value)) {
    const day = Date.parse(`${value}T00:00:00Z`);
    return Number.isNaN(day) ? value : new Date(day + weeks * WEEK_MS).toISOString().slice(0, 10);
  }
  if (!MOMENT.test(value)) return value;
  const moment = Date.parse(value);
  if (Number.isNaN(moment)) return value;
  const milliseconds = ((moment % 1000) + 1000) % 1000;
  const clock = norwegianClock(moment - milliseconds) + weeks * WEEK_MS;
  return new Date(momentOf(clock) + milliseconds).toISOString();
}

/** A copy of a document, or of anything in one, with every date in it moved (see shiftDate). */
export function withLiveDates<T>(value: T, weeks: number): T {
  if (typeof value === "string") return shiftDate(value, weeks) as T;
  if (Array.isArray(value)) return value.map((item) => withLiveDates(item, weeks)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withLiveDates(item, weeks)])) as T;
  }
  return value;
}
