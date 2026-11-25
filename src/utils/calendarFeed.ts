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

/** Norwegian time of a moment, whatever the time zone of the machine. */
const OSLO_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

interface OsloTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function osloTimeOf(d: Date): OsloTime {
  const parts: Record<string, number> = {};
  for (const part of OSLO_TIME.formatToParts(d)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

const ymd = (year: number, month: number, day: number) =>
  `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
const dayOf = (t: OsloTime) => ymd(t.year, t.month, t.day);
const isMidnight = (t: OsloTime) => t.hour === 0 && t.minute === 0;

/** The Norwegian day after the given one. Counted in UTC, so no time zone can move it. */
function dayAfter(t: OsloTime): string {
  const next = new Date(Date.UTC(t.year, t.month - 1, t.day + 1));
  return ymd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/**
 * DTSTART and DTEND of one event. A whole-day event (starts at 00:00 Norwegian time, and ends at 00:00 or
 * not at all) is written as dates; every other event is written as moments in UTC.
 */
function timeLines(g: Gathering): string[] {
  const start = new Date(g.startsAt);
  const startOslo = osloTimeOf(start);
  const endsAt = g.endsAt ? new Date(g.endsAt) : undefined;
  const endOslo = endsAt ? osloTimeOf(endsAt) : undefined;

  if (isMidnight(startOslo) && (!endOslo || isMidnight(endOslo))) {
    const startDay = dayOf(startOslo);
    const endDay = endOslo && dayOf(endOslo) > startDay ? dayOf(endOslo) : dayAfter(startOslo);
    return [`DTSTART;VALUE=DATE:${startDay}`, `DTEND;VALUE=DATE:${endDay}`];
  }
  const end = endsAt ?? new Date(start.getTime() + DEFAULT_DURATION_MS);
  return [`DTSTART:${formatIcalUtc(start)}`, `DTEND:${formatIcalUtc(end)}`];
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
  const theme = [g.theme, g.bibleText].filter(Boolean).join(" — ");
  const description = [g.summary?.trim(), theme].filter(Boolean).join("\n\n");

  return [
    "BEGIN:VEVENT",
    `UID:${g.id}@menighetsplan`,
    `DTSTAMP:${formatIcalUtc(now)}`,
    ...timeLines(g),
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

export const PUBLIC_CALENDAR_FEED_PATH = "/api/offentlig/kalender.ics";

/** Query string for the public feed (menighet in the demo). */
export function publicCalendarFeedSearchParams(demoSite: string | null, isDemo: boolean): string {
  if (!isDemo) return "";
  const params = new URLSearchParams({ menighet: demoSite ?? "eksempel" });
  return params.toString();
}

export function publicCalendarFeedUrl(origin: string, demoSite: string | null, isDemo: boolean): string {
  const base = `${origin.replace(/\/+$/, "")}${PUBLIC_CALENDAR_FEED_PATH}`;
  const qs = publicCalendarFeedSearchParams(demoSite, isDemo);
  return qs ? `${base}?${qs}` : base;
}

/** Opens Google Calendar's «add by URL» flow for an https iCal address. */
export function googleCalendarSubscribeUrl(icsUrl: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}`;
}
