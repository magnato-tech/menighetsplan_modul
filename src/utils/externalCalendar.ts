import type { Gathering } from "../types";
import type { GatheringTemplate } from "./gatheringTemplates";
import type { CalendarDeclined, CalendarNote } from "./surfaces";
import { combineDateAndTimeToIso, parseIsoToDateAndTime } from "./dates";
import { newGatheringForm, type GatheringFormValues } from "./gatheringForm";

export interface ExternalCalendarEvent {
  uid: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location: string;
  description: string;
  cancelled: boolean;
}

export interface ImportProposal {
  templateId: string | null;
  isGudstjeneste: boolean;
}

export interface CalendarDiff {
  newEvents: ExternalCalendarEvent[];
  updated: { gathering: Gathering; event: ExternalCalendarEvent }[];
  gone: Gathering[];
}

function unfoldIcal(raw: string): string {
  return String(raw || "")
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "");
}

/** eRedaktør marks DTSTART as VALUE=DATE but puts a datetime in the value. */
export function fixEredaktorDateStart(ics: string): string {
  const text = unfoldIcal(ics);
  return text.replace(/^(DT(?:START|END));VALUE=DATE:(\d{8}T\d{6}(?:Z)?)$/gm, (_m, field, value) => `${field}:${value}`);
}

function utcToOslo(y: number, mo: number, d: number, h: number, mi: number, s: number): { date: string; time: string } {
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utc);
  const read = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}`,
  };
}

function icalDateTime(value: string, asUtc = false): { date: string; time: string } {
  const v = String(value || "").trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/i.exec(v);
  if (!m) return { date: "", time: "" };
  const useUtc = asUtc || Boolean(m[7]);
  if (m[4] && useUtc) {
    return utcToOslo(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  }
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const time = m[4] ? `${m[4]}:${m[5]}` : "";
  return { date, time };
}

function fieldLine(block: string, name: string): { params: string; value: string } {
  const re = new RegExp(`^${name}(;[^:]*)?:(.*)$`, "im");
  const hit = re.exec(block);
  if (!hit) return { params: "", value: "" };
  return {
    params: hit[1] || "",
    value: hit[2].trim().replace(/\\n/g, "\n").replace(/\\,/g, ","),
  };
}

function isDateOnlyIcalValue(value: string): boolean {
  return /^\d{8}$/.test(String(value || "").trim().replace(/Z$/i, ""));
}

function isAllDayStart(params: string, value: string): boolean {
  return /VALUE=DATE/i.test(params) && isDateOnlyIcalValue(value);
}

function fieldValue(block: string, name: string): string {
  return fieldLine(block, name).value;
}

function toIso(date: string, time: string): string {
  if (!date) return "";
  return combineDateAndTimeToIso(date, time || "00:00");
}

/** Parses VEVENT blocks from an iCalendar document. */
export function parseExternalCalendarFeed(ics: string): ExternalCalendarEvent[] {
  const text = fixEredaktorDateStart(unfoldIcal(ics));
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  const out: ExternalCalendarEvent[] = [];
  for (const raw of blocks) {
    const block = raw.split(/END:VEVENT/i)[0] || "";
    const startField = fieldLine(block, "DTSTART");
    const startUtc = /TZID=UTC/i.test(startField.params) || startField.value.endsWith("Z");
    const start = icalDateTime(startField.value, startUtc);
    if (!start.date) continue;

    const allDay = isAllDayStart(startField.params, startField.value);

    const endField = fieldLine(block, "DTEND");
    const endUtc = /TZID=UTC/i.test(endField.params) || endField.value.endsWith("Z");
    const end = endField.value ? icalDateTime(endField.value, endUtc) : { date: "", time: "" };

    const status = fieldValue(block, "STATUS").toUpperCase();
    let endsAt: string | undefined;
    if (!allDay && end.date) {
      endsAt = toIso(end.date, end.time || start.time);
    }
    out.push({
      uid: fieldValue(block, "UID"),
      title: fieldValue(block, "SUMMARY") || "Uten tittel",
      startsAt: toIso(start.date, allDay ? "" : start.time || "00:00"),
      endsAt,
      location: fieldValue(block, "LOCATION"),
      description: fieldValue(block, "DESCRIPTION"),
      cancelled: status === "CANCELLED",
    });
  }
  return out;
}

function isSundayMorning(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getDay() === 0 && d.getHours() < 14;
}

export function proposeImport(event: ExternalCalendarEvent, templates: readonly GatheringTemplate[]): ImportProposal {
  const title = event.title.toLowerCase();
  const worship =
    title.includes("gudstjeneste") ||
    isSundayMorning(event.startsAt);
  if (!worship) return { templateId: null, isGudstjeneste: false };
  const template =
    templates.find((t) => t.isGudstjeneste) ??
    templates.find((t) => t.name.localeCompare("Gudstjeneste", "nb") === 0) ??
    null;
  return { templateId: template?.id ?? null, isGudstjeneste: true };
}

/** True when the feed row carries a clock time, not just an all-day date from iCal. */
export function feedHasClockTime(event: ExternalCalendarEvent): boolean {
  const start = parseIsoToDateAndTime(event.startsAt);
  if (!start.date) return false;
  if (event.endsAt) return true;
  return start.time !== "00:00";
}

/** The fields kirkens kalender can change on a linked event. Google's changes are suggestions: the app never writes them alone. */
export type CalendarField = "title" | "startsAt" | "location" | "cancelled";

/** The fields where a linked planner event and the feed differ, in the order they are shown. */
export function differingFields(g: Gathering, event: ExternalCalendarEvent): CalendarField[] {
  const fields: CalendarField[] = [];
  if (g.title !== event.title) fields.push("title");
  const timeDiffers =
    feedHasClockTime(event) &&
    (g.startsAt !== event.startsAt || (event.endsAt !== undefined && (g.endsAt || "") !== event.endsAt));
  if (timeDiffers) fields.push("startsAt");
  if ((g.location || "").trim() !== (event.location || "").trim()) fields.push("location");
  if (Boolean(g.cancelled) !== event.cancelled) fields.push("cancelled");
  return fields;
}

/** The write for the chosen fields only, with Google's values. Nothing else on the planner event is part of it. */
export function calendarPatch(fields: readonly CalendarField[], event: ExternalCalendarEvent): Partial<Gathering> {
  const patch: Partial<Gathering> = {};
  if (fields.includes("title")) patch.title = event.title;
  if (fields.includes("startsAt")) {
    patch.startsAt = event.startsAt;
    if (event.endsAt !== undefined) patch.endsAt = event.endsAt;
  }
  if (fields.includes("location")) patch.location = event.location || undefined;
  if (fields.includes("cancelled")) patch.cancelled = event.cancelled;
  return patch;
}

/** True when Google's values are the ones the admin declined. The row stays hidden until Google changes again. */
export function isDeclined(event: ExternalCalendarEvent, declined: CalendarDeclined | undefined): boolean {
  if (!declined) return false;
  return (
    declined.title === event.title &&
    declined.startsAt === event.startsAt &&
    declined.location.trim() === event.location.trim() &&
    declined.cancelled === event.cancelled
  );
}

/** Google's values for an event, as they are kept when the admin declines them. */
export function declinedValuesOf(event: ExternalCalendarEvent): CalendarDeclined {
  return { title: event.title, startsAt: event.startsAt, location: event.location, cancelled: event.cancelled };
}

function gatheringMatchesEvent(g: Gathering, event: ExternalCalendarEvent): boolean {
  if (event.uid && g.externalCalendarUid === event.uid) return true;
  if (event.uid && !g.externalCalendarUid) return false;
  if (!event.uid) {
    return g.title === event.title && g.startsAt.slice(0, 16) === event.startsAt.slice(0, 16);
  }
  return false;
}

function linkedGathering(gatherings: readonly Gathering[], event: ExternalCalendarEvent): Gathering | undefined {
  return gatherings.find((g) => gatheringMatchesEvent(g, event));
}

function importableGathering(g: Gathering): boolean {
  return g.type !== "gruppesamling" && g.visibility !== "intern";
}

export function diffCalendar(
  feed: readonly ExternalCalendarEvent[],
  gatherings: readonly Gathering[],
  dismissedUids: readonly string[],
  keptUids: readonly string[],
  declinedFor: (uid: string) => CalendarDeclined | undefined = () => undefined
): CalendarDiff {
  const dismissed = new Set(dismissedUids);
  const kept = new Set(keptUids);
  const feedUids = new Set(feed.map((e) => e.uid).filter(Boolean));

  const newEvents: ExternalCalendarEvent[] = [];
  const updated: CalendarDiff["updated"] = [];
  const gone: Gathering[] = [];

  for (const event of feed) {
    if (event.uid && dismissed.has(event.uid)) continue;
    const existing = linkedGathering(gatherings, event);
    if (existing) {
      const changed = differingFields(existing, event).length > 0;
      const declined = event.uid ? isDeclined(event, declinedFor(event.uid)) : false;
      if (importableGathering(existing) && existing.externalCalendarUid && changed && !declined) {
        updated.push({ gathering: existing, event });
      }
      continue;
    }
    const blocking = gatherings.some(
      (g) => gatheringMatchesEvent(g, event) && (g.type === "gruppesamling" || g.visibility === "intern")
    );
    if (blocking) continue;
    newEvents.push(event);
  }

  for (const g of gatherings) {
    if (!g.externalCalendarUid || kept.has(g.externalCalendarUid)) continue;
    if (!importableGathering(g)) continue;
    if (!feedUids.has(g.externalCalendarUid)) gone.push(g);
  }

  return { newEvents, updated, gone };
}

/** The Norwegian calendar day of a moment, as yyyy-mm-dd. Empty when the text is not a moment. */
function osloDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
}

function wordsOf(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
}

function sharedWordCount(feedTitle: string, gatheringTitle: string): number {
  const words = new Set(wordsOf(gatheringTitle));
  return new Set(wordsOf(feedTitle).filter((word) => words.has(word))).size;
}

/** How clearly a planner title names the feed event: 2 when the titles are the same, 1 when it has the feed's main word, else 0. */
function titleClearness(gatheringTitle: string, feedTitle: string): number {
  if (gatheringTitle.trim().toLowerCase() === feedTitle.trim().toLowerCase()) return 2;
  const mainWord = wordsOf(feedTitle)[0];
  return mainWord !== undefined && gatheringTitle.toLowerCase().includes(mainWord) ? 1 : 0;
}

/**
 * Planner events that may be the same as a feed event: no feed link yet, not cancelled, not a group
 * meeting, and on the same Norwegian day. The best title match comes first, then shared words, then
 * the nearest start time.
 */
export function linkCandidates(event: ExternalCalendarEvent, gatherings: readonly Gathering[]): Gathering[] {
  const day = osloDay(event.startsAt);
  if (!day) return [];
  const start = new Date(event.startsAt).getTime();
  return gatherings
    .filter((g) => !g.externalCalendarUid && !g.cancelled && g.type !== "gruppesamling" && osloDay(g.startsAt) === day)
    .map((g) => ({
      g,
      clearness: titleClearness(g.title, event.title),
      shared: sharedWordCount(event.title, g.title),
      distance: Math.abs(new Date(g.startsAt).getTime() - start),
    }))
    .sort((a, b) => b.clearness - a.clearness || b.shared - a.shared || a.distance - b.distance)
    .map((row) => row.g);
}

/**
 * The one planner event to link without asking: the only candidate, or the candidate whose title
 * names the feed event clearly when no other candidate does as well. Otherwise null: the admin chooses.
 */
export function bestLink(event: ExternalCalendarEvent, gatherings: readonly Gathering[]): Gathering | null {
  const candidates = linkCandidates(event, gatherings);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const scores = candidates.map((g) => titleClearness(g.title, event.title));
  const top = Math.max(...scores);
  if (top === 0 || scores.filter((score) => score === top).length > 1) return null;
  return candidates[scores.indexOf(top)];
}

/** Feed events that are linked to a planner event by their uid, with that event. */
export function linkedFeedRows(
  feed: readonly ExternalCalendarEvent[],
  gatherings: readonly Gathering[]
): { event: ExternalCalendarEvent; gathering: Gathering }[] {
  return feed.flatMap((event) => {
    if (!event.uid) return [];
    const gathering = gatherings.find((g) => g.externalCalendarUid === event.uid);
    return gathering ? [{ event, gathering }] : [];
  });
}

export interface DismissedFeedRow {
  uid: string;
  title: string;
  startsAt: string;
  note?: CalendarNote;
}

/** Dismissed feed uids that are still in the feed, or have a note (deleted or turned away). */
export function dismissedFeedRows(
  feed: readonly ExternalCalendarEvent[],
  dismissedUids: readonly string[],
  noteFor: (uid: string) => CalendarNote | undefined
): DismissedFeedRow[] {
  return dismissedUids.flatMap((uid) => {
    const event = feed.find((e) => e.uid === uid);
    const note = noteFor(uid);
    if (!event && !note) return [];
    return [{ uid, title: event?.title ?? note?.title ?? "", startsAt: event?.startsAt ?? note?.startsAt ?? "", note }];
  });
}

/** Form values for creating an event from a feed row. */
export function formValuesFromExternalEvent(
  event: ExternalCalendarEvent,
  groupId: string,
  proposal: ImportProposal
): GatheringFormValues {
  const start = parseIsoToDateAndTime(event.startsAt);
  const end = event.endsAt ? parseIsoToDateAndTime(event.endsAt) : null;
  const midnightOnly = start.time === "00:00" && !event.endsAt;
  return newGatheringForm({
    title: event.title,
    date: start.date,
    time: midnightOnly ? "" : start.time,
    endDate: end && end.date !== start.date ? end.date : "",
    endTime: end && end.time && end.time !== "00:00" ? end.time : "",
    location: event.location,
    groupId,
    isGudstjeneste: proposal.isGudstjeneste,
    cancelled: event.cancelled,
    visibility: "offentlig",
  });
}
