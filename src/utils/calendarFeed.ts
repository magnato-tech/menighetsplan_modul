import type { Gathering } from "../types";
import { eventPath } from "./gatheringPresentation";
import { isOpenCommunityGathering, locationOf } from "./gatherings";

const DEFAULT_DURATION_MS = 90 * 60 * 1000;
const FEED_PAST_MS = 30 * 24 * 60 * 60 * 1000;
const FEED_FUTURE_MS = 365 * 24 * 60 * 60 * 1000;

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatIcalUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const startOf = (g: Pick<Gathering, "startsAt">) => new Date(g.startsAt).getTime();

/**
 * Gatherings for the public iCal feed: open community events in the subscription window.
 * Same inclusion rule as the calendar module (`isOpenCommunityGathering`).
 */
export function gatheringsForCalendarFeed<T extends Gathering>(
  gatherings: T[],
  now: Date = new Date()
): T[] {
  const from = now.getTime() - FEED_PAST_MS;
  const to = now.getTime() + FEED_FUTURE_MS;
  return gatherings
    .filter((g) => isOpenCommunityGathering(g) && startOf(g) >= from && startOf(g) <= to)
    .sort((a, b) => startOf(a) - startOf(b));
}

export interface IcalendarOptions {
  calendarName?: string;
  now?: Date;
  /** Where the website is, "https://menigheten.example". With it, every event carries the address of its own page. */
  siteUrl?: string;
}

/** One event as the lines of a calendar entry: the lead first, then the theme and the Bible text. */
function eventLines(g: Gathering, now: Date, siteUrl?: string): string[] {
  const start = new Date(g.startsAt);
  const end = g.endsAt ? new Date(g.endsAt) : new Date(start.getTime() + DEFAULT_DURATION_MS);
  const theme = [g.theme, g.bibleText].filter(Boolean).join(" — ");
  const description = [g.summary?.trim(), theme].filter(Boolean).join("\n\n");

  return [
    "BEGIN:VEVENT",
    `UID:${g.id}@menighetsplan`,
    `DTSTAMP:${formatIcalUtc(now)}`,
    `DTSTART:${formatIcalUtc(start)}`,
    `DTEND:${formatIcalUtc(end)}`,
    `SUMMARY:${escapeIcal(g.title || "Samling")}`,
    `LOCATION:${escapeIcal(locationOf(g))}`,
    ...(description ? [`DESCRIPTION:${escapeIcal(description)}`] : []),
    ...(siteUrl ? [`URL:${siteUrl.replace(/\/+$/, "")}${eventPath(g.id)}`] : []),
    ...(g.cancelled ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
  ];
}

function calendarOf(events: Gathering[], options: IcalendarOptions): string {
  const now = options.now || new Date();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Menighetsplan//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(options.calendarName || "Menighetsplan")}`,
    ...events.flatMap((event) => eventLines(event, now, options.siteUrl)),
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Build an iCalendar document for open community gatherings. */
export function toIcalendar(gatherings: Gathering[], options: IcalendarOptions = {}): string {
  return calendarOf(gatheringsForCalendarFeed(gatherings, options.now || new Date()), options);
}

/** Build an iCalendar document for an explicit list of gatherings (e.g. a personal feed). */
export function toIcalendarFromGatherings(gatherings: Gathering[], options: IcalendarOptions = {}): string {
  const sorted = [...gatherings].sort((a, b) => startOf(a) - startOf(b));
  return calendarOf(sorted, options);
}

/** One event as a calendar file, for the one who wants just that event in their own calendar. */
export function toIcalendarEvent(gathering: Gathering, options: IcalendarOptions = {}): string {
  return calendarOf([gathering], options);
}
