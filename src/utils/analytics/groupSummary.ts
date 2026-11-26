import type { GatheringAttendance, Group, GroupCategory, Person } from "../../types";
import { isGroupGathering } from "../gatherings";
import { allGroupPersonIds } from "../groups";
import type { AnalyticsPeriod } from "./periods";
import { QUIET_GROUP_DAYS } from "./periods";
import type { ChurchData } from "./shared";
import { before, DAY_MS, heldIn, share, timeOf, within } from "./shared";

// ============================================================================
// Groups: belonging and activity
// ============================================================================

export const GROUP_CATEGORY_LABELS: Record<GroupCategory, string> = {
  ledergruppe: "Ledergrupper",
  strategigruppe: "Strategigrupper",
  tjenestegruppe: "Tjenestegrupper",
  husgruppe: "Husfellesskap",
  interessegruppe: "Interessegrupper",
};

export interface GroupActivity {
  group: Group;
  members: number;
  newMembers: number;
  meetings: number;
  /** Answers to the group's meetings in the period. `possible` is members × meetings. */
  responses: { attending: number; declined: number; possible: number };
  messages: number;
  lastActivityAt: string | null;
  quiet: boolean;
}

export interface GroupSummary {
  groups: GroupActivity[];
  personsInGroups: number;
  belongingRate: number | null;
  withoutGroup: Person[];
  newMembers: number;
  messages: number;
  previousMessages: number;
  quietGroups: number;
  byCategory: { category: GroupCategory | "uten"; label: string; groups: number; people: number }[];
}

export function summarizeGroups(
  data: Pick<ChurchData, "persons" | "groups" | "gatherings" | "attendances" | "messages">,
  period: AnalyticsPeriod
): GroupSummary {
  const held = heldIn(data.gatherings, period.from, period.to);
  const quietSince = period.now - QUIET_GROUP_DAYS * DAY_MS;
  const attendancesByGathering = new Map<string, GatheringAttendance[]>();
  for (const a of data.attendances) {
    const list = attendancesByGathering.get(a.gatheringId) ?? [];
    list.push(a);
    attendancesByGathering.set(a.gatheringId, list);
  }

  const groups: GroupActivity[] = data.groups.map((group) => {
    const memberIds = allGroupPersonIds(group);
    const current = new Set(memberIds);
    // Someone who has left keeps their join date in the document; they are not counted
    const newMembers = Object.entries(group.memberJoinedAt ?? {}).filter(
      ([personId, at]) => current.has(personId) && within(timeOf(at), period.from, period.to)
    ).length;
    const meetings = held.filter((g) => g.groupId === group.id && isGroupGathering(g));
    let attending = 0;
    let declined = 0;
    for (const meeting of meetings) {
      for (const a of attendancesByGathering.get(meeting.id) ?? []) {
        // Answers from people who have since left are not part of the group's share
        if (!current.has(a.personId)) continue;
        if (a.status === "attending") attending++;
        else declined++;
      }
    }
    const groupMessages = data.messages.filter((m) => m.groupId === group.id);
    const messages = groupMessages.filter((m) => within(timeOf(m.createdAt), period.from, period.to)).length;
    const pastActivity = [
      ...groupMessages.map((m) => m.createdAt),
      ...data.gatherings
        .filter((g) => g.groupId === group.id && !g.cancelled && timeOf(g.startsAt) <= period.now)
        .map((g) => g.startsAt),
    ].filter((at) => timeOf(at) <= period.now);
    const lastActivityAt = pastActivity.reduce<string | null>(
      (latest, at) => (latest === null || timeOf(at) > timeOf(latest) ? at : latest),
      null
    );
    return {
      group,
      members: memberIds.length,
      newMembers,
      meetings: meetings.length,
      responses: { attending, declined, possible: memberIds.length * meetings.length },
      messages,
      lastActivityAt,
      quiet: lastActivityAt === null || timeOf(lastActivityAt) < quietSince,
    };
  });

  const inGroups = new Set(data.groups.flatMap((g) => allGroupPersonIds(g)));
  const personsInGroups = data.persons.filter((p) => inGroups.has(p.id)).length;

  const categories = new Map<GroupCategory | "uten", { groups: number; people: Set<string> }>();
  for (const group of data.groups) {
    const key = group.category ?? "uten";
    const row = categories.get(key) ?? { groups: 0, people: new Set<string>() };
    row.groups++;
    for (const id of allGroupPersonIds(group)) row.people.add(id);
    categories.set(key, row);
  }
  const order: (GroupCategory | "uten")[] = ["ledergruppe", "strategigruppe", "tjenestegruppe", "husgruppe", "interessegruppe", "uten"];
  const byCategory = order
    .filter((key) => categories.has(key))
    .map((key) => ({
      category: key,
      label: key === "uten" ? "Uten kategori" : GROUP_CATEGORY_LABELS[key],
      groups: categories.get(key)!.groups,
      people: categories.get(key)!.people.size,
    }));

  return {
    groups,
    personsInGroups,
    belongingRate: share(personsInGroups, data.persons.length),
    withoutGroup: data.persons.filter((p) => !inGroups.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, "nb")),
    newMembers: groups.reduce((sum, g) => sum + g.newMembers, 0),
    messages: data.messages.filter((m) => within(timeOf(m.createdAt), period.from, period.to)).length,
    previousMessages: data.messages.filter((m) => before(timeOf(m.createdAt), period.previousFrom, period.from)).length,
    quietGroups: groups.filter((g) => g.quiet).length,
    byCategory,
  };
}
