import type { Gathering, Group, GatheringAttendance } from "../types";
import { isGroupGathering, upcomingPublicGatherings } from "./gatherings";

export type PersonalCalendarSource = "menigheten" | "mine_grupper";

export type PersonalCalendarFilter = "alle" | "menigheten" | "mine_grupper";

export interface PersonalCalendarEvent {
  gathering: Gathering;
  source: PersonalCalendarSource;
  groupName?: string;
}

const startOf = (g: Pick<Gathering, "startsAt">) => new Date(g.startsAt).getTime();

function isUpcoming(gathering: Gathering, from: number): boolean {
  return startOf(gathering) >= from;
}

function husgruppeVisible(
  gathering: Gathering,
  group: Group,
  attendance: GatheringAttendance | undefined
): boolean {
  if (group.category !== "husgruppe") return true;
  const invited = gathering.invitationSent || gathering.invitationSentAt;
  return !!invited || attendance !== undefined;
}

/**
 * Personal calendar for Min side: open community gatherings plus upcoming group
 * gatherings from the member's groups. Same dataset can later feed personal iCal.
 */
export function personalCalendarEvents(
  gatherings: Gathering[],
  myGroups: Group[],
  from: number,
  getAttendance: (gatheringId: string) => GatheringAttendance | undefined
): PersonalCalendarEvent[] {
  const churchEvents: PersonalCalendarEvent[] = upcomingPublicGatherings(gatherings, from).map(
    (gathering) => ({
      gathering,
      source: "menigheten",
    })
  );

  const churchIds = new Set(churchEvents.map((event) => event.gathering.id));
  const groupEvents: PersonalCalendarEvent[] = [];

  for (const group of myGroups) {
    for (const gathering of gatherings) {
      if (gathering.groupId !== group.id) continue;
      if (!isGroupGathering(gathering)) continue;
      if (!isUpcoming(gathering, from)) continue;
      if (churchIds.has(gathering.id)) continue;
      if (!husgruppeVisible(gathering, group, getAttendance(gathering.id))) continue;

      groupEvents.push({
        gathering,
        source: "mine_grupper",
        groupName: group.name,
      });
    }
  }

  return [...churchEvents, ...groupEvents].sort(
    (a, b) => startOf(a.gathering) - startOf(b.gathering)
  );
}

export function filterPersonalCalendarEvents(
  events: PersonalCalendarEvent[],
  filter: PersonalCalendarFilter
): PersonalCalendarEvent[] {
  if (filter === "alle") return events;
  if (filter === "menigheten") return events.filter((event) => event.source === "menigheten");
  return events.filter((event) => event.source === "mine_grupper");
}

/** Same window as the public iCal feed: recent past and one year ahead. */
export const PERSONAL_FEED_PAST_MS = 30 * 24 * 60 * 60 * 1000;
export const PERSONAL_FEED_FUTURE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Gatherings for a person's iCal subscription: same rules as Min kalender, within the feed window.
 */
export function personalCalendarGatheringsForFeed(
  gatherings: Gathering[],
  myGroups: Group[],
  now: Date,
  getAttendance: (gatheringId: string) => GatheringAttendance | undefined
): Gathering[] {
  const from = now.getTime() - PERSONAL_FEED_PAST_MS;
  const to = now.getTime() + PERSONAL_FEED_FUTURE_MS;
  return personalCalendarEvents(gatherings, myGroups, from, getAttendance)
    .map((event) => event.gathering)
    .filter((gathering) => startOf(gathering) <= to);
}

export const PERSONAL_CALENDAR_FEED_PATH = "/api/min/kalender.ics";

/** Query string for the personal feed (token required; menighet in the demo). */
export function personalCalendarFeedSearchParams(token: string, demoSite: string | null, isDemo: boolean): string {
  const params = new URLSearchParams({ token });
  if (isDemo) params.set("menighet", demoSite ?? "eksempel");
  return params.toString();
}

export function personalCalendarFeedUrl(origin: string, token: string, demoSite: string | null, isDemo: boolean): string {
  return `${origin.replace(/\/+$/, "")}${PERSONAL_CALENDAR_FEED_PATH}?${personalCalendarFeedSearchParams(token, demoSite, isDemo)}`;
}

/** Opens Google Calendar's «add by URL» flow for an https iCal address. */
export function googleCalendarSubscribeUrl(icsUrl: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}`;
}
