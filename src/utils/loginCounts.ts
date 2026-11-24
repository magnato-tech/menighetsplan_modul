import { LOGIN_COUNTS, MIN_SIDE_OPENED, addDays, type LoginCountId, type TrafficDay } from "./siteTraffic";

// The sign-in and Min side counts of a stretch of days, for the Innlogging tab. The counts are
// sums per day, read from the same day documents as the website's (see utils/siteTraffic.ts).

/** Where a browser remembers the day Min side was last counted. Only the date is kept. */
export const MIN_SIDE_COUNT_KEY = "menighetsplan_minside_telt";

export interface LoginCountDay {
  /** "2026-11-24" */
  date: string;
  /** Sign-ins that day, all the ways together. */
  signIns: number;
  /** Sign-ins that day per way (see LOGIN_COUNTS). */
  byKind: Record<LoginCountId, number>;
  /** Openings of Min side that day. */
  minSide: number;
}

export interface LoginCountSummary {
  /** Every day from the first to the last, also the days with no counts. */
  days: LoginCountDay[];
  signIns: number;
  byKind: Record<LoginCountId, number>;
  minSide: number;
  /** The first day in the stretch that has any of these counts, or null when there is none. */
  countingSince: string | null;
}

const countOn = (day: TrafficDay | undefined, id: string): number => day?.actions[id] ?? 0;

/**
 * Sums the sign-in and Min side counts of the days from `from` to `to`, both included. Days
 * that are not in `days` count as zero. Days outside the stretch are ignored.
 */
export function summarizeLoginCounts(days: TrafficDay[], from: string, to: string): LoginCountSummary {
  const byDate = new Map(days.filter((day) => day.date >= from && day.date <= to).map((day) => [day.date, day]));
  const result: LoginCountDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const counted = byDate.get(date);
    const byKind = Object.fromEntries(LOGIN_COUNTS.map((kind) => [kind.id, countOn(counted, kind.id)])) as Record<LoginCountId, number>;
    const signIns = LOGIN_COUNTS.reduce((sum, kind) => sum + byKind[kind.id], 0);
    result.push({ date, signIns, byKind, minSide: countOn(counted, MIN_SIDE_OPENED) });
  }

  const totalByKind = Object.fromEntries(LOGIN_COUNTS.map((kind) => [kind.id, 0])) as Record<LoginCountId, number>;
  let minSide = 0;
  let countingSince: string | null = null;
  for (const day of result) {
    for (const kind of LOGIN_COUNTS) totalByKind[kind.id] += day.byKind[kind.id];
    minSide += day.minSide;
    if (countingSince === null && (day.signIns > 0 || day.minSide > 0)) countingSince = day.date;
  }
  const signIns = LOGIN_COUNTS.reduce((sum, kind) => sum + totalByKind[kind.id], 0);
  return { days: result, signIns, byKind: totalByKind, minSide, countingSince };
}

/** The part of the browser's storage that the once-a-day count uses. */
export interface MinimalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Whether an opening of Min side on `today` (a date in Norway, "2026-11-24") is counted, and
 * remembers that it was. At most once per browser per day: a second opening the same day is not
 * counted, and nor is the first one when the browser keeps nothing (blocked or full storage).
 * Skipping is the choice then, since counting every opening would break the rule the board states.
 */
export function countMinSideOpening(storage: MinimalStorage | null, today: string): boolean {
  if (storage === null) return false;
  try {
    if (storage.getItem(MIN_SIDE_COUNT_KEY) === today) return false;
    storage.setItem(MIN_SIDE_COUNT_KEY, today);
    return true;
  } catch {
    // Storage that cannot be read or written: nothing is counted rather than counted every time
    return false;
  }
}

const SHORT_MONTHS = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."] as const;

/** "24. nov." for a date like "2026-11-24". */
export function formatLongDayLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day}. ${SHORT_MONTHS[month - 1]}`;
}
