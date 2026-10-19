import type { Gathering } from "../types";
import { ONGOING_MS, locationOf } from "./gatherings";

// The order of the events in the admin's list. They are shown by date, the earliest first,
// until the admin picks another column in the table.

export type GatheringSortKey = "date" | "title" | "location" | "staffing";
export type GatheringSortDirection = "asc" | "desc";

/** What the list needs to know of an event to put it in order. */
export interface SortableGathering {
  gathering: Pick<Gathering, "startsAt" | "title" | "location">;
  /** How many volunteers the event still lacks. */
  missingStaffingCount: number;
}

const byText = (a: string, b: string): number => a.localeCompare(b, "nb", { sensitivity: "base", numeric: true });
const timeOf = (row: SortableGathering): number => new Date(row.gathering.startsAt).getTime() || 0;

/**
 * The events in the order asked for. Events that are alike in the column, stand by date, the
 * earliest first, so a list sorted by place is still a calendar within each place.
 */
export function sortGatherings<T extends SortableGathering>(rows: readonly T[], key: GatheringSortKey = "date", direction: GatheringSortDirection = "asc"): T[] {
  const turn = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const byDate = timeOf(a) - timeOf(b);
    if (key === "date") return turn * byDate;
    const inColumn =
      key === "title"
        ? byText(a.gathering.title, b.gathering.title)
        : key === "location"
          ? byText(locationOf(a.gathering), locationOf(b.gathering))
          : a.missingStaffingCount - b.missingStaffingCount;
    return turn * inColumn || byDate;
  });
}

/** The sorting after a column heading is pressed: the same column turns, a new one starts with the lowest first. */
export function nextGatheringSort(
  currentKey: GatheringSortKey,
  currentDirection: GatheringSortDirection,
  pressed: GatheringSortKey
): { key: GatheringSortKey; direction: GatheringSortDirection } {
  return pressed === currentKey ? { key: pressed, direction: currentDirection === "asc" ? "desc" : "asc" } : { key: pressed, direction: "asc" };
}

export type GatheringPeriod = "kommende" | "tidligere";

/**
 * The events of one period: those to come (and one going on now), or those held. Sorted by date,
 * the coming ones from the soonest and the held ones from the latest, so the list starts where the
 * admin is most likely to look.
 */
export function gatheringsInPeriod<T extends SortableGathering>(
  rows: readonly T[],
  period: GatheringPeriod,
  now: number,
  key: GatheringSortKey = "date",
  direction: GatheringSortDirection = "asc"
): T[] {
  const coming = (row: T) => timeOf(row) >= now - ONGOING_MS;
  const chosen = rows.filter((row) => (period === "kommende" ? coming(row) : !coming(row)));
  const sorted = sortGatherings(chosen, key, direction);
  return period === "tidligere" && key === "date" ? sorted.reverse() : sorted;
}
