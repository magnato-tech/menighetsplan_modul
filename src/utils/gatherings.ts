import type { Assignment, Gathering, Person, Task, VolunteerRole } from "../types";
import { isPubliclyVisible, visibilityOf } from "./visibility";

// What the public sees of the gatherings: which are worship services, which lie ahead,
// and which one the front page lifts up. Shared by the website and the public API.

/**
 * Whether the gathering is a worship service. The flag set in the planner decides;
 * the title is only read for documents from before the flag existed.
 */
export function isWorshipService(g: Pick<Partial<Gathering>, "title" | "isGudstjeneste">): boolean {
  if (typeof g.isGudstjeneste === "boolean") return g.isGudstjeneste;
  return (g.title || "").toLowerCase().includes("gudstjeneste");
}

/** Where a gathering is held when nothing else is said (PRODUKTDOKUMENTASJON.md 2.1). */
export const DEFAULT_LOCATION = "Kirken";

export function locationOf(g: Pick<Gathering, "location">): string {
  return g.location?.trim() || DEFAULT_LOCATION;
}

const startOf = (g: Pick<Gathering, "startsAt">) => new Date(g.startsAt).getTime();

/** A group meeting (`gruppesamling`), as opposed to a church-wide gathering (`arrangement`). */
export function isGroupGathering(g: Pick<Partial<Gathering>, "type">): boolean {
  return g.type === "gruppesamling";
}

/**
 * Open to the whole congregation and visitors: visible outward and not a group-only meeting.
 * Same rule as contract v1 (`excludeGroupGatherings` in the public API).
 */
export function isOpenCommunityGathering(
  g: Pick<Partial<Gathering>, "type" | "visibility" | "isPublic">
): boolean {
  return isPubliclyVisible(g) && !isGroupGathering(g);
}

/** Open community gatherings from `from` onward, nearest first. */
export function upcomingPublicGatherings<T extends Gathering>(gatherings: T[], from: number): T[] {
  return gatherings
    .filter((g) => isOpenCommunityGathering(g) && startOf(g) >= from)
    .sort((a, b) => startOf(a) - startOf(b));
}

/** A gathering that started less than four hours ago is still going on. */
export const ONGOING_MS = 4 * 60 * 60 * 1000;

export interface Highlight {
  gathering: Gathering;
  /** Why this one: an admin featured it, it is the next worship service, or it is simply next. */
  kind: "featured" | "worship" | "next";
}

/**
 * The one gathering the front page lifts up (PRODUKTDOKUMENTASJON.md chapter 5).
 * A featured gathering comes first, however far ahead it is. Without one, the next
 * worship service; without that, whatever is next. A cancelled gathering is never lifted up.
 */
export function pickHighlight(gatherings: Gathering[], now: number): Highlight | null {
  const candidates = upcomingPublicGatherings(gatherings, now - ONGOING_MS).filter((g) => !g.cancelled);

  const featured = candidates.find((g) => visibilityOf(g) === "fremhevet");
  if (featured) return { gathering: featured, kind: "featured" };

  const worship = candidates.find(isWorshipService);
  if (worship) return { gathering: worship, kind: "worship" };

  return candidates.length > 0 ? { gathering: candidates[0], kind: "next" } : null;
}

/** A task that is the speaker's: the volunteer role «Taler», or a task called «Taler» or «Dagens taler». */
function isSpeakerTask(task: Pick<Task, "volunteerRoleId" | "title">, roles: Pick<VolunteerRole, "id" | "name">[]): boolean {
  const roleName = task.volunteerRoleId ? roles.find((role) => role.id === task.volunteerRoleId)?.name : undefined;
  if (roleName?.trim().toLowerCase() === "taler") return true;
  const title = task.title.trim().toLowerCase();
  return title === "taler" || title === "dagens taler";
}

/**
 * The names of those who have said yes («confirmed») to the speaker's task of a gathering, in the order
 * the assignments were made. A name is the person's name in the register, or the one kept on the
 * assignment when the person is no longer there. Nobody who has not said yes is named.
 */
export function speakerNamesOf(
  gatheringId: string,
  tasks: Pick<Task, "id" | "gatheringId" | "volunteerRoleId" | "title">[],
  assignments: Pick<Assignment, "taskId" | "personId" | "response" | "personName">[],
  roles: Pick<VolunteerRole, "id" | "name">[],
  persons: Pick<Person, "id" | "name">[]
): string[] {
  const speakerTaskIds = new Set(
    tasks.filter((task) => task.gatheringId === gatheringId && isSpeakerTask(task, roles)).map((task) => task.id)
  );
  const names: string[] = [];
  for (const assignment of assignments) {
    if (assignment.response !== "confirmed" || !speakerTaskIds.has(assignment.taskId)) continue;
    const name = persons.find((person) => person.id === assignment.personId)?.name ?? assignment.personName;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}
