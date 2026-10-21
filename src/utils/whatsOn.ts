import type { Gathering } from "../types";
import { isWorshipService, upcomingPublicGatherings } from "./gatherings";
import { visibilityOf } from "./visibility";

// «Hva skjer» on a page: which events it shows, how many, how they are laid out and what each card
// says. The choices are stored as text in the module's presentation (see utils/modulePresentation.ts).

/** Which of the coming public events are shown. */
export type WhatsOnSelection = "all" | "worship" | "featured" | "group";
/** How the cards are laid out. */
export type WhatsOnLayout = "grid" | "list" | "carousel" | "feature";
/** How the cards come into view as the visitor scrolls to them. */
export type WhatsOnMotion = "none" | "fade" | "slide" | "zoom";

export const WHATS_ON_COUNTS = [3, 4, 6, 8] as const;

export const WHATS_ON_SELECTIONS: { value: WhatsOnSelection; label: string }[] = [
  { value: "all", label: "Alle offentlige" },
  { value: "worship", label: "Bare gudstjenester" },
  { value: "featured", label: "Bare fremhevede" },
  { value: "group", label: "Én gruppe" },
];

export const WHATS_ON_LAYOUTS: { value: WhatsOnLayout; label: string }[] = [
  { value: "grid", label: "Rutenett" },
  { value: "list", label: "Liste" },
  { value: "carousel", label: "Karusell som kan blas" },
  { value: "feature", label: "Ett stort og resten små" },
];

export const WHATS_ON_MOTIONS: { value: WhatsOnMotion; label: string }[] = [
  { value: "fade", label: "Ton inn" },
  { value: "slide", label: "Gli inn fra siden" },
  { value: "zoom", label: "Zoom inn" },
  { value: "none", label: "Ingen bevegelse" },
];

export interface WhatsOnOptions {
  count: number;
  selection: WhatsOnSelection;
  /** The group whose events are shown, when the selection is one group. */
  groupId: string;
  layout: WhatsOnLayout;
  showSummary: boolean;
  showLocation: boolean;
  showTime: boolean;
  motion: WhatsOnMotion;
  /** The picture an event without one of its own is shown with. Empty: none. */
  fallbackImage: string;
}

/**
 * The choices as the module uses them. Anything missing or unknown is what the module always did:
 * the next four public events in a grid, with the line under the title, the time and the place.
 */
export function whatsOnOptionsOf(config: Record<string, string | undefined> = {}): WhatsOnOptions {
  const count = Number(config.count);
  const selection = WHATS_ON_SELECTIONS.some((option) => option.value === config.selection) ? (config.selection as WhatsOnSelection) : "all";
  const layout = WHATS_ON_LAYOUTS.some((option) => option.value === config.layout) ? (config.layout as WhatsOnLayout) : "grid";
  return {
    count: (WHATS_ON_COUNTS as readonly number[]).includes(count) ? count : 4,
    selection,
    groupId: config.groupId?.trim() || "",
    layout,
    showSummary: config.showSummary !== "off",
    showLocation: config.showLocation !== "off",
    showTime: config.showTime !== "off",
    motion: WHATS_ON_MOTIONS.some((option) => option.value === config.motion) ? (config.motion as WhatsOnMotion) : "fade",
    fallbackImage: config.fallbackImage?.trim() || "",
  };
}

const chosen = (gathering: Gathering, options: WhatsOnOptions): boolean => {
  switch (options.selection) {
    case "worship":
      return isWorshipService(gathering);
    case "featured":
      return visibilityOf(gathering) === "fremhevet";
    case "group":
      // A group not yet picked shows nothing, rather than every event
      return Boolean(options.groupId) && gathering.groupId === options.groupId;
    default:
      return true;
  }
};

/** The events the module shows: the coming public ones that fit the selection, nearest first, as many as chosen. */
export function whatsOnGatherings<T extends Gathering>(gatherings: T[], now: number, options: WhatsOnOptions): T[] {
  return upcomingPublicGatherings(gatherings, now)
    .filter((gathering) => chosen(gathering, options))
    .slice(0, options.count);
}

/** The classes that make the cards come into view as chosen (see src/index.css). None: they are simply there. */
export function revealClassOf(motion: WhatsOnMotion): string {
  if (motion === "none") return "";
  if (motion === "slide") return "reveal-children reveal-slide";
  if (motion === "zoom") return "reveal-children reveal-zoom";
  return "reveal-children";
}

/** The groups that have coming public events, the ones it makes sense to pick for «Én gruppe». */
export function whatsOnGroupIds(gatherings: Gathering[], now: number): string[] {
  return [...new Set(upcomingPublicGatherings(gatherings, now).map((gathering) => gathering.groupId).filter(Boolean))];
}
