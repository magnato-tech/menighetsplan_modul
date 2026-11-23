import type { Gathering } from "../types";
import { ONGOING_MS, isOpenCommunityGathering, isWorshipService } from "./gatherings";
import { norwegianDayOf } from "./news";
import { visibilityOf } from "./visibility";

// The page on the info screen in the church foyer: which open events it shows today, this week and later.
// Days are the days of the calendar in Norway. Day offsets are counted from the "YYYY-MM-DD" days, not from
// milliseconds, so a clock change never moves an event to another day.

export interface InfoScreenBoard {
  today: Gathering[];
  week: Gathering[];
  upcoming: Gathering[];
}

const WEEK_LIMIT = 5;
const UPCOMING_LIMIT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const OSLO = "Europe/Oslo";
const WEEKDAYS = ["SØN", "MAN", "TIR", "ONS", "TOR", "FRE", "LØR"];

/** A Norwegian day as a number of days since 1970, so that two days can be subtracted. */
const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

const startOf = (g: Gathering): number => Date.parse(g.startsAt);
const endsAtOf = (g: Gathering): number => (g.endsAt ? Date.parse(g.endsAt) : Number.NaN);
const byStart = (a: Gathering, b: Gathering): number => startOf(a) - startOf(b);

/**
 * What the info screen shows: the open events of today (not ended yet, or still going on from an earlier day),
 * the next six days (at most five), and what comes after (at most four, featured ones first).
 * Internal events and group meetings are left out. A cancelled event stays, so the page can strike it through.
 */
export function infoScreenBoard(gatherings: readonly Gathering[], now: number): InfoScreenBoard {
  const today = dayNumber(norwegianDayOf(now));
  const shown = gatherings.filter((g) => isOpenCommunityGathering(g) && !Number.isNaN(startOf(g)));
  const offsetOf = (g: Gathering): number => dayNumber(norwegianDayOf(startOf(g))) - today;

  const todayList = shown
    .filter((g) => {
      const offset = offsetOf(g);
      const endsAt = endsAtOf(g);
      if (offset === 0) {
        // Without an end time the event is taken to last four hours from its start
        const end = Number.isNaN(endsAt) ? startOf(g) + ONGOING_MS : endsAt;
        return end >= now;
      }
      // Started on an earlier day, and still going on
      return offset < 0 && !Number.isNaN(endsAt) && endsAt > now;
    })
    .sort(byStart);

  const week = shown
    .filter((g) => offsetOf(g) >= 1 && offsetOf(g) <= 6)
    .sort(byStart)
    .slice(0, WEEK_LIMIT);

  const later = shown.filter((g) => offsetOf(g) >= 7);
  const featured = later.filter((g) => visibilityOf(g) === "fremhevet").sort(byStart).slice(0, UPCOMING_LIMIT);
  const others = later
    .filter((g) => !featured.includes(g))
    .sort(byStart)
    .slice(0, UPCOMING_LIMIT - featured.length);
  const upcoming = [...featured, ...others].sort(byStart);

  return { today: todayList, week, upcoming };
}

/**
 * The event the today card is built around: the first worship service that is not cancelled,
 * else the first event that is not cancelled. The others of today come after it, in order.
 */
export function todayHeadline(today: readonly Gathering[]): { headline: Gathering | null; rest: Gathering[] } {
  const live = today.filter((g) => g.cancelled !== true);
  const headline = live.find(isWorshipService) ?? live[0] ?? null;
  return { headline, rest: today.filter((g) => g !== headline) };
}

// Formatting. All times are shown as they are in Norway, whatever the clock of the screen says.

const clockFormat = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longDateFormat = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, weekday: "long", day: "numeric", month: "long" });
const dayMonthFormat = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, day: "numeric", month: "long" });

/** The time of day now: "10:42". */
export function osloClock(now: number): string {
  return clockFormat.format(new Date(now));
}

/** The date now, with the weekday: "søndag 29. november". */
export function osloLongDate(now: number): string {
  return longDateFormat.format(new Date(now));
}

/** The start of an event as a time, with a dot between hour and minute: "11.00". */
export function osloTime(iso: string): string {
  const parts = Object.fromEntries(clockFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.hour}.${parts.minute}`;
}

/**
 * The start of an event as a time, or null when it starts at midnight in Norway: an event that lasts
 * all day, or several days, is saved from midnight and has no time of day to show.
 */
export function startTimeOf(iso: string): string | null {
  const time = osloTime(iso);
  return time === "00.00" ? null : time;
}

/** The weekday of an event in Norway, in capitals: "MAN", "TIR" … "SØN". */
export function osloWeekdayShort(iso: string): string {
  const day = norwegianDayOf(Date.parse(iso));
  return WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];
}

/** The day of the month of an event in Norway, without a leading zero: "30", "2". */
export function osloDayOfMonth(iso: string): string {
  return String(Number(norwegianDayOf(Date.parse(iso)).slice(8)));
}

/** The day and month of an event in Norway: "13. desember". */
export function osloDayMonth(iso: string): string {
  return dayMonthFormat.format(new Date(iso));
}
