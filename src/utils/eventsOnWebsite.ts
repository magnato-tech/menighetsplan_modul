import type { Gathering } from "../types";
import { missingOnWebsite } from "./gatheringPresentation";
import { visibilityOf } from "./visibility";

// The list «Arrangementer på nettsiden» in the CMS: which events it shows, in which order,
// and how they are grouped by month. Pure functions, no React.

/** The filters above the list. */
export type EventsFilter = "kommende" | "mangler" | "offentlig" | "intern" | "fremhevet" | "tidligere";

const MONTH_NAMES = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

/** The start of the local day `now` falls on, in milliseconds. */
const startOfToday = (now: Date): number => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
};

/** The start of an event in milliseconds; NaN when the text is not a date. */
const startOf = (gathering: Gathering): number => new Date(gathering.startsAt).getTime();

/** Whether an event starts today or later (local time). */
const isUpcoming = (gathering: Gathering, now: Date): boolean => startOf(gathering) >= startOfToday(now);

/**
 * The events a filter shows, sorted: soonest first, except «tidligere» which is newest first.
 * Cancelled events are kept, as they are shown today.
 */
export function filterEvents(gatherings: readonly Gathering[], filter: EventsFilter, now: Date): Gathering[] {
  const upcoming = gatherings.filter((g) => isUpcoming(g, now));
  let shown: Gathering[];
  switch (filter) {
    case "kommende":
      shown = upcoming;
      break;
    case "tidligere":
      // An event whose date cannot be read is counted as past, so it is never lost
      shown = gatherings.filter((g) => !isUpcoming(g, now));
      break;
    case "mangler":
      shown = upcoming.filter((g) => visibilityOf(g) !== "intern" && missingOnWebsite(g).length > 0);
      break;
    case "offentlig":
    case "intern":
    case "fremhevet":
      shown = upcoming.filter((g) => visibilityOf(g) === filter);
      break;
  }
  const sorted = [...shown].sort((a, b) => startOf(a) - startOf(b));
  return filter === "tidligere" ? sorted.reverse() : sorted;
}

/** How many events each filter shows, for the counts on the filter buttons. */
export function countByFilter(gatherings: readonly Gathering[], now: Date): Record<EventsFilter, number> {
  return {
    kommende: filterEvents(gatherings, "kommende", now).length,
    mangler: filterEvents(gatherings, "mangler", now).length,
    offentlig: filterEvents(gatherings, "offentlig", now).length,
    intern: filterEvents(gatherings, "intern", now).length,
    fremhevet: filterEvents(gatherings, "fremhevet", now).length,
    tidligere: filterEvents(gatherings, "tidligere", now).length,
  };
}

/** One month of the list. `key` sorts by time, `label` is for reading, e.g. «November 2026». */
export interface MonthGroup {
  key: string;
  label: string;
  items: Gathering[];
}

/** Splits an already sorted list into months, in the order they come. Months are read in local time. */
export function groupByMonth(sortedGatherings: readonly Gathering[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const gathering of sortedGatherings) {
    const date = new Date(gathering.startsAt);
    const valid = !isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "ukjent";
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(gathering);
      continue;
    }
    const name = valid ? MONTH_NAMES[date.getMonth()] : "";
    const label = valid ? `${name.charAt(0).toUpperCase()}${name.slice(1)} ${date.getFullYear()}` : "Ukjent dato";
    groups.push({ key, label, items: [gathering] });
  }
  return groups;
}
