import type { Gathering } from "../types";
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
