import type { Gathering } from "../types";
import { isOpenCommunityGathering } from "./gatherings";

// How an event is presented on the website: a picture, a sentence or two (the lead), a longer
// text and a link. All of it is optional and lies on the event itself, beside the facts the
// planner owns (title, time, place). It is filled in in the one form an event has
// (utils/gatheringForm.ts).

type Presented = Pick<Gathering, "imageUrl" | "summary" | "content" | "theme">;

/** The address of an event's own page on the website. Every card and calendar entry for the event leads here. */
export const eventPath = (id: string): string => `/arrangement/${encodeURIComponent(id)}`;

/** Whether an address is the page of an event. */
export const isEventPath = (pathname: string): boolean => /^\/arrangement\/[^/]+\/?$/.test(pathname);

/** The line under the title on a card: the lead, or the theme when no lead is written. */
export const teaserOf = (gathering: Pick<Gathering, "summary" | "theme">): string => gathering.summary?.trim() || gathering.theme?.trim() || "";

export type MissingOnWebsite = "bilde" | "tekst";

/**
 * What an event shown on the website is still without: a picture, and a text (a lead or a
 * longer text). An event that is not shown there is missing nothing.
 */
export function missingOnWebsite(gathering: Presented & Pick<Gathering, "type" | "visibility" | "isPublic">): MissingOnWebsite[] {
  if (!isOpenCommunityGathering(gathering)) return [];
  const missing: MissingOnWebsite[] = [];
  if (!gathering.imageUrl?.trim()) missing.push("bilde");
  if (!gathering.summary?.trim() && !gathering.content?.trim()) missing.push("tekst");
  return missing;
}
