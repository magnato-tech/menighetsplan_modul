import type { Gathering, MeetingSchedule } from "../types";
import { norwegianDayOf } from "./news";
import { seriesDays } from "./series";

// A group leader's plan for the gatherings of a group: one gathering, or the same gathering
// repeated through the season, as a house group that meets every second Thursday does it.
//
// Every gathering of a plan is an ordinary gathering afterwards (see utils/series.ts): it can be
// moved, given another host or taken away on its own.

export const MEETING_REPEATS = [
  { id: "once", label: "Bare denne gangen" },
  { id: "weekly", label: "Hver uke" },
  { id: "every2", label: "Annenhver uke" },
  { id: "monthly", label: "Én gang i måneden" },
] as const;

export type MeetingRepeat = (typeof MEETING_REPEATS)[number]["id"];

/** A plan never holds more gatherings than this: every week for a little over half a year. */
export const MEETING_PLAN_LIMIT = 30;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

/** How often a group with a fixed meeting time meets, as the plan says it. Once, without one. */
export function repeatOfSchedule(schedule: Pick<MeetingSchedule, "frequency"> | undefined): MeetingRepeat {
  if (schedule?.frequency === "hver uke") return "weekly";
  if (schedule?.frequency === "annenhver uke") return "every2";
  if (schedule?.frequency === "hver måned") return "monthly";
  return "once";
}

/**
 * The first day a plan is suggested to start: the next day that is the group's weekday, today
 * not counted. A group without a fixed weekday gets the day a week from today.
 */
export function suggestedFirstDay(today: string, schedule?: Pick<MeetingSchedule, "weekday">): string {
  if (!DAY.test(today)) return "";
  const start = Date.parse(`${today}T00:00:00Z`);
  const weekday = WEEKDAYS.indexOf((schedule?.weekday ?? "").trim().toLowerCase());
  if (weekday < 0) return new Date(start + 7 * DAY_MS).toISOString().slice(0, 10);
  const ahead = (weekday - new Date(start).getUTCDay() + 7) % 7 || 7;
  return new Date(start + ahead * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The last day a plan is suggested to run to: the end of the season the first day lies in. The
 * spring runs to the 30th of June, the autumn to the 20th of December.
 */
export function lastDayOfSeason(first: string): string {
  if (!DAY.test(first)) return "";
  const year = first.slice(0, 4);
  if (first <= `${year}-06-30`) return `${year}-06-30`;
  if (first <= `${year}-12-20`) return `${year}-12-20`;
  return `${Number(year) + 1}-06-30`;
}

/** The days of a plan, the first one included. A gathering held once has the one day. */
export function meetingDays(first: string, last: string, repeat: MeetingRepeat): string[] {
  if (!DAY.test(first)) return [];
  if (repeat === "once") return [first];
  return seriesDays(first, last, repeat, MEETING_PLAN_LIMIT);
}

/**
 * Who hosts each of `count` gatherings when the participants take turns, starting with
 * `firstHostId` when that is one of them. Nobody to take turns gives no hosts.
 */
export function hostsInTurn(count: number, hostIds: readonly string[], firstHostId?: string): string[] {
  if (hostIds.length === 0 || count <= 0) return [];
  const start = Math.max(0, hostIds.indexOf(firstHostId ?? ""));
  return Array.from({ length: count }, (_, index) => hostIds[(start + index) % hostIds.length]);
}

/** The days among `days` on which the group already has a gathering, as the calendar in Norway shows them. */
export function daysTaken(days: readonly string[], gatherings: readonly Pick<Gathering, "startsAt">[]): string[] {
  const held = new Set(gatherings.map((gathering) => norwegianDayOf(new Date(gathering.startsAt).getTime())));
  return days.filter((day) => held.has(day));
}

/** The gathering that comes first among those that lie ahead and are not cancelled. */
export function nextGatheringOf<T extends Pick<Gathering, "startsAt" | "cancelled">>(gatherings: readonly T[], now: number = Date.now()): T | undefined {
  return gatherings
    .filter((gathering) => !gathering.cancelled && new Date(gathering.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
}

/**
 * Whether the participants are to be asked now whether they are coming. A gathering planned on
 * its own asks from the day the invitation is sent. A gathering that is one of a plan asks only
 * when it is the group's next one: a whole season planned at once must not give everyone a
 * dozen questions to answer on the same day. `next` is the group's next gathering.
 */
export function asksForAnswerNow(gathering: Pick<Gathering, "id" | "seriesId">, next: Pick<Gathering, "id"> | undefined): boolean {
  return !gathering.seriesId || gathering.id === next?.id;
}
