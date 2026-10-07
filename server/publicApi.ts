import type { Gathering, Group } from "../src/types";
import { validateEvent } from "../src/utils/validation";
import { isGroupPublic, isPubliclyVisible, visibilityOf } from "../src/utils/visibility";
import { DEFAULT_LOCATION, isWorshipService } from "../src/utils/gatherings";

// Firestore documents are untyped at runtime, so every field is optional until validated.
export type GatheringDoc = Partial<Gathering>;
export type GroupDoc = Partial<Group>;

// Where an event is held when no place is given: the same word as in the app
export { DEFAULT_LOCATION };
const DEFAULT_DURATION_MS = 90 * 60 * 1000;

// ============================================================================
// Time zone
// ============================================================================

const osloClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Formats an instant as ISO 8601 in Norwegian local time (`+01:00` / `+02:00`).
 * The offset is derived from the Oslo wall clock itself, so the result does not
 * depend on the time zone the server process runs in.
 */
export function toOsloIso(d: Date): string {
  const p = Object.fromEntries(osloClock.formatToParts(d).map(({ type, value }) => [type, value]));
  const wallClockAsUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  const offsetMinutes = Math.round((wallClockAsUtc - d.getTime()) / 60000);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

// ============================================================================
// Gatherings: one set of rules shared by every endpoint
// ============================================================================

export function keywordTags(title: string): string[] {
  const t = title.toLowerCase();
  const tags: string[] = [];
  if (t.includes("ungdom")) tags.push("ungdom");
  if (t.includes("barn") || t.includes("familie")) tags.push("barn og unge");
  if (t.includes("husfellesskap") || t.includes("gruppe")) tags.push("smågrupper");
  if (t.includes("kaffe") || t.includes("lunsj") || t.includes("måltid")) tags.push("fellesskap");
  return tags;
}

export interface PublicGathering {
  gathering: Gathering;
  start: Date;
  isWorship: boolean;
  tags: string[];
}

export interface PublicGatheringOptions {
  /** Drop `type: "gruppesamling"` even when it is marked public. */
  excludeGroupGatherings?: boolean;
  /** Inclusive bounds on the start time, in epoch milliseconds. */
  from?: number | null;
  to?: number | null;
}

/**
 * Filters and classifies raw gathering documents for public consumption, sorted by start time.
 * Documents that fail validation are left out and reported on the server log.
 */
export function toPublicGatherings(docs: GatheringDoc[], options: PublicGatheringOptions = {}): PublicGathering[] {
  const { excludeGroupGatherings = false, from = null, to = null } = options;
  const items: PublicGathering[] = [];

  for (const doc of docs) {
    if (!isPubliclyVisible(doc)) continue;
    if (excludeGroupGatherings && doc.type === "gruppesamling") continue;

    let gathering: Gathering;
    try {
      gathering = validateEvent(doc);
    } catch (err) {
      console.warn(`Public API: skipping invalid gathering ${doc.id ?? "(no id)"}:`, err instanceof Error ? err.message : err);
      continue;
    }

    const start = new Date(gathering.startsAt);
    if (from !== null && start.getTime() < from) continue;
    if (to !== null && start.getTime() > to) continue;

    const isWorship = isWorshipService(gathering);
    items.push({
      gathering,
      start,
      isWorship,
      tags: [...(isWorship ? ["gudstjeneste"] : []), ...keywordTags(gathering.title)],
    });
  }

  return items.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Contract v1 (`/api/offentlig/arrangementer`), see INTEGRASJON-MENIGHETSPLAN.md. */
export function toContractV1({ gathering: g, start, isWorship, tags }: PublicGathering, now: Date = new Date()) {
  const end = g.endsAt ? new Date(g.endsAt) : new Date(start.getTime() + DEFAULT_DURATION_MS);
  return {
    id: g.id,
    type: isWorship ? "gudstjeneste" : "arrangement",
    tittel: g.title,
    tema: g.theme || "",
    bibeltekst: g.bibleText || "",
    // The contract has `beskrivelse` and `heldag`, but Gathering has no such fields yet.
    beskrivelse: "",
    start: toOsloIso(start),
    slutt: toOsloIso(end),
    heldag: false,
    sted: g.location || DEFAULT_LOCATION,
    status: g.cancelled ? "avlyst" : "planlagt",
    tagger: tags,
    sistEndret: g.updatedAt || now.toISOString(),
  };
}

/** v1.1 shape (`/api/public/*`), with both Norwegian and English keys. */
export function toV11({ gathering: g, isWorship, tags }: PublicGathering) {
  const location = g.location || DEFAULT_LOCATION;
  // Same tags as v1, with the gathering type inserted after "gudstjeneste".
  const keywords = isWorship ? tags.slice(1) : tags;
  const categories = [...(isWorship ? ["gudstjeneste"] : []), ...(g.type ? [g.type] : []), ...keywords];
  return {
    uid: g.id,
    id: g.id,
    groupId: g.groupId || "",
    tittel: g.title,
    title: g.title,
    start: g.startsAt,
    slutt: g.endsAt || "",
    sted: location,
    location,
    beskrivelse: "",
    tema: g.theme || "",
    kategorier: categories.length > 0 ? categories : ["samling"],
    erGudstjeneste: isWorship,
    // Set by an admin to lift the gathering up, as the front page of the app does
    fremhevet: visibilityOf(g) === "fremhevet",
    erAvlyst: Boolean(g.cancelled),
    cancelled: Boolean(g.cancelled),
  };
}

// ============================================================================
// Groups and recurring events
// ============================================================================

export interface RecurringEvent {
  id: string;
  groupId?: string;
  tittel: string;
  ukedag: string;
  klokkeslett: string;
  frekvens: string;
  sted: string;
  kategori: string;
  beskrivelse: string;
}

/**
 * Only groups that are open to the public, and of those only the name, category,
 * meeting schedule and member count. Member lists and contact details are never exposed.
 */
export function toPublicGroups(docs: GroupDoc[]) {
  return docs.filter(isGroupPublic).map((g) => {
    const name = g.name || "Gruppe";
    const category = g.category || "gruppe";
    return {
      id: g.id,
      navn: name,
      name,
      kategori: category,
      category,
      moteplan: g.meetingSchedule || null,
      meetingSchedule: g.meetingSchedule || null,
      antallMedlemmer: Array.isArray(g.memberIds) ? g.memberIds.length : undefined,
    };
  });
}

/** Recurring events come from the meeting schedules of the public groups, nothing else. */
export function toRecurringEvents(docs: GroupDoc[]): RecurringEvent[] {
  const events: RecurringEvent[] = [];
  for (const g of docs) {
    if (!isGroupPublic(g) || !g.id || !g.meetingSchedule?.weekday) continue;
    const name = g.name || "Gruppe";
    const category = g.category || "gruppe";
    const frequency = g.meetingSchedule.frequency || "annenhver uke";
    events.push({
      id: `recurring-group-${g.id}`,
      groupId: g.id,
      tittel: name,
      ukedag: g.meetingSchedule.weekday,
      klokkeslett: g.meetingSchedule.time || "19:00",
      frekvens: frequency,
      sted: category === "husgruppe" ? "Hjemmene" : "Kirken",
      kategori: category,
      beskrivelse: `Faste samlinger for ${name} (${frequency}).`,
    });
  }
  return events;
}
