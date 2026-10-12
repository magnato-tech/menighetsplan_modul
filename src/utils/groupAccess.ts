import type { Assignment, Gathering, Group, Person, Task } from "../types";
import { allGroupPersonIds, isInGroup, leadsGroup } from "./groups";
import { toPublicProfile } from "./publicProfile";

// What a signed-in person may know about other people, kept beside the register.
// The register itself is read only by an administrator and by each person about themselves.
// Firestore cannot hide a field inside a document, so each audience gets its own documents,
// and the rules refuse any other field (see firestore.rules).

/** The id of a card that belongs to one person in one group. Neither id contains "_". */
export const groupCardId = (groupId: string, personId: string): string => `${groupId}_${personId}`;

/** The id of the mark that lets one person read the names on one gathering's run sheet. */
export const gatheringReaderId = (gatheringId: string, personId: string): string => `${gatheringId}_${personId}`;

/** Name and phone of one person, for everyone in the same group. Never an e-mail or a birth date. */
export interface GroupDirectoryCard {
  id: string;
  groupId: string;
  personId: string;
  name: string;
  phone?: string;
}

/** The e-mail address of one person in a group. Only a leader or deputy of that group may read it. */
export interface GroupLeaderEmail {
  id: string;
  groupId: string;
  personId: string;
  email: string;
}

/**
 * A group as the website may show it. Person ids on it are only people who already have a
 * public profile. The private member list stays on the group document.
 */
export interface PublicGroupCard {
  id: string;
  name: string;
  description?: string;
  category?: Group["category"];
  tags?: string[];
  meetingSchedule?: Group["meetingSchedule"];
  isPublic: true;
  memberCount: number;
  leaderIds: string[];
  deputyLeaderIds: string[];
  memberIds: string[];
}

/** A mark that the person may read every name on that gathering. */
export interface GatheringReader {
  id: string;
  gatheringId: string;
  personId: string;
}

const byId = <T extends { id: string }>(items: readonly T[]): T[] => [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** One card per person in each group: the name, and the phone number when they have one. */
export function groupDirectoryOf(persons: readonly Person[], groups: readonly Group[]): GroupDirectoryCard[] {
  const people = new Map(persons.map((person) => [person.id, person]));
  const cards: GroupDirectoryCard[] = [];
  for (const group of groups) {
    for (const personId of allGroupPersonIds(group)) {
      const person = people.get(personId);
      if (!person?.name) continue;
      const card: GroupDirectoryCard = { id: groupCardId(group.id, personId), groupId: group.id, personId, name: person.name };
      if (person.phone) card.phone = person.phone;
      cards.push(card);
    }
  }
  return byId(cards);
}

/** One e-mail card per person in a group who has an e-mail address. */
export function groupLeaderEmailsOf(persons: readonly Person[], groups: readonly Group[]): GroupLeaderEmail[] {
  const people = new Map(persons.map((person) => [person.id, person]));
  const cards: GroupLeaderEmail[] = [];
  for (const group of groups) {
    for (const personId of allGroupPersonIds(group)) {
      const email = people.get(personId)?.email?.trim();
      if (!email) continue;
      cards.push({ id: groupCardId(group.id, personId), groupId: group.id, personId, email });
    }
  }
  return byId(cards);
}

const publicIds = (ids: readonly string[] | undefined, persons: readonly Person[]): string[] => {
  const people = new Map(persons.map((person) => [person.id, person]));
  return (ids ?? []).filter((id) => {
    const person = people.get(id);
    return person ? toPublicProfile(person) !== null : false;
  });
};

/** The groups the website may list, without the private member list. */
export function publicGroupCardsOf(groups: readonly Group[], persons: readonly Person[]): PublicGroupCard[] {
  return byId(
    groups
      .filter((group) => group.isPublic === true)
      .map((group): PublicGroupCard => {
        const card: PublicGroupCard = {
          id: group.id,
          name: group.name,
          isPublic: true,
          memberCount: allGroupPersonIds(group).length,
          leaderIds: publicIds(group.leaderIds, persons),
          deputyLeaderIds: publicIds(group.deputyLeaderIds, persons),
          memberIds: publicIds(group.memberIds, persons),
        };
        if (group.description) card.description = group.description;
        if (group.category) card.category = group.category;
        if (group.tags && group.tags.length > 0) card.tags = group.tags;
        if (group.meetingSchedule) card.meetingSchedule = group.meetingSchedule;
        return card;
      })
  );
}

/** The group document the website can hold when it only has the public card. */
export function groupFromPublicCard(card: PublicGroupCard): Group {
  return {
    id: card.id,
    name: card.name,
    ...(card.description ? { description: card.description } : {}),
    ...(card.category ? { category: card.category } : {}),
    ...(card.tags ? { tags: card.tags } : {}),
    ...(card.meetingSchedule ? { meetingSchedule: card.meetingSchedule } : {}),
    isPublic: true,
    memberIds: card.memberIds,
    leaderIds: card.leaderIds,
    deputyLeaderIds: card.deputyLeaderIds,
  };
}

/** A person-shaped row for a group mate, so the screens that already read a person can read the card. */
export function personFromCard(card: GroupDirectoryCard, email?: string): Person {
  return {
    id: card.personId,
    name: card.name,
    globalRole: "member",
    ...(card.phone ? { phone: card.phone } : {}),
    ...(email ? { email } : {}),
  };
}

/**
 * Who a screen may list for a group. With the whole register, that is the register. Without it,
 * it is the directory, and the e-mail only when the viewer leads the group.
 */
export function visibleGroupPeople(
  group: Pick<Group, "id" | "memberIds" | "leaderIds" | "deputyLeaderIds">,
  hasFullRegister: boolean,
  persons: readonly Person[],
  cards: readonly GroupDirectoryCard[],
  emails: readonly GroupLeaderEmail[],
  viewerId: string
): Person[] {
  if (hasFullRegister) return persons.filter((person) => isInGroup(group, person.id));
  const withEmail = leadsGroup(group, viewerId);
  const emailOf = new Map(emails.filter((row) => row.groupId === group.id).map((row) => [row.personId, row.email]));
  return cards
    .filter((card) => card.groupId === group.id)
    .map((card) => personFromCard(card, withEmail ? emailOf.get(card.personId) : undefined))
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export interface AssignmentAccess extends Pick<Assignment, "personName" | "gatheringId" | "gatheringGroupId" | "gatheringPublic"> {
  id: string;
}

/**
 * The fields an assignment needs so a run sheet can show the name without the register, and so
 * the rules can tell who may read it. Only assignments that do not already say this.
 */
export function assignmentAccessPatches(
  assignments: readonly Assignment[],
  tasks: readonly Pick<Task, "id" | "gatheringId" | "groupId">[],
  gatherings: readonly Pick<Gathering, "id" | "groupId" | "isPublic">[],
  persons: readonly Pick<Person, "id" | "name">[]
): AssignmentAccess[] {
  const taskOf = new Map(tasks.map((task) => [task.id, task]));
  const gatheringOf = new Map(gatherings.map((gathering) => [gathering.id, gathering]));
  const nameOf = new Map(persons.map((person) => [person.id, person.name]));
  const patches: AssignmentAccess[] = [];
  for (const assignment of assignments) {
    const task = taskOf.get(assignment.taskId);
    const gatheringId = assignment.gatheringId || task?.gatheringId;
    if (!gatheringId) continue;
    const gathering = gatheringOf.get(gatheringId);
    const gatheringGroupId = assignment.gatheringGroupId || gathering?.groupId || task?.groupId;
    const personName = assignment.personName || nameOf.get(assignment.personId);
    if (!gatheringGroupId || !personName) continue;
    const gatheringPublic = gathering?.isPublic === true;
    if (
      assignment.personName === personName &&
      assignment.gatheringId === gatheringId &&
      assignment.gatheringGroupId === gatheringGroupId &&
      assignment.gatheringPublic === gatheringPublic
    ) {
      continue;
    }
    patches.push({ id: assignment.id, personName, gatheringId, gatheringGroupId, gatheringPublic });
  }
  return patches.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Who may read the names on a gathering: everyone in the gathering's group, and everyone who
 * stands on one of its tasks.
 */
export function gatheringReadersOf(
  gatherings: readonly Pick<Gathering, "id" | "groupId">[],
  groups: readonly Group[],
  tasks: readonly Pick<Task, "id" | "gatheringId">[],
  assignments: readonly Pick<Assignment, "taskId" | "personId" | "gatheringId">[]
): GatheringReader[] {
  const groupOf = new Map(groups.map((group) => [group.id, group]));
  const taskGathering = new Map(tasks.map((task) => [task.id, task.gatheringId]));
  const people = new Map<string, Set<string>>();
  const add = (gatheringId: string | undefined, personId: string | undefined) => {
    if (!gatheringId || !personId) return;
    const set = people.get(gatheringId) ?? new Set<string>();
    set.add(personId);
    people.set(gatheringId, set);
  };
  for (const gathering of gatherings) {
    const group = groupOf.get(gathering.groupId);
    if (group) for (const personId of allGroupPersonIds(group)) add(gathering.id, personId);
  }
  for (const assignment of assignments) add(assignment.gatheringId || taskGathering.get(assignment.taskId), assignment.personId);
  const readers: GatheringReader[] = [];
  for (const [gatheringId, personIds] of people) {
    for (const personId of personIds) readers.push({ id: gatheringReaderId(gatheringId, personId), gatheringId, personId });
  }
  return byId(readers);
}
