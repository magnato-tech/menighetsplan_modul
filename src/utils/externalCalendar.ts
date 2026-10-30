import type { Gathering } from "../types";
import type { GatheringTemplate } from "./gatheringTemplates";
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

    const endField = fieldLine(block, "DTEND");
    const endUtc = /TZID=UTC/i.test(endField.params) || endField.value.endsWith("Z");
    const end = endField.value ? icalDateTime(endField.value, endUtc) : { date: "", time: "" };

    const status = fieldValue(block, "STATUS").toUpperCase();
    out.push({
      uid: fieldValue(block, "UID"),
      title: fieldValue(block, "SUMMARY") || "Uten tittel",
      startsAt: toIso(start.date, start.time || "00:00"),
      endsAt: end.date ? toIso(end.date, end.time || start.time) : undefined,
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

function fieldsDiffer(g: Gathering, event: ExternalCalendarEvent): boolean {
  const loc = (g.location || "").trim();
  const eloc = (event.location || "").trim();
  return (
    g.title !== event.title ||
    g.startsAt !== event.startsAt ||
    (g.endsAt || "") !== (event.endsAt || "") ||
    loc !== eloc ||
    Boolean(g.cancelled) !== event.cancelled
  );
}

export function diffCalendar(
  feed: readonly ExternalCalendarEvent[],
  gatherings: readonly Gathering[],
  dismissedUids: readonly string[],
  keptUids: readonly string[]
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
      if (importableGathering(existing) && existing.externalCalendarUid && fieldsDiffer(existing, event)) {
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

/** Form values for creating an event from a feed row. */
export function formValuesFromExternalEvent(
  event: ExternalCalendarEvent,
  groupId: string,
  proposal: ImportProposal
): GatheringFormValues {
  const start = parseIsoToDateAndTime(event.startsAt);
  const end = event.endsAt ? parseIsoToDateAndTime(event.endsAt) : null;
  return newGatheringForm({
    title: event.title,
    date: start.date,
    time: start.time,
    endDate: end && end.date !== start.date ? end.date : "",
    endTime: end ? end.time : "",
    location: event.location,
    groupId,
    isGudstjeneste: proposal.isGudstjeneste,
    cancelled: event.cancelled,
    visibility: "offentlig",
  });
}
