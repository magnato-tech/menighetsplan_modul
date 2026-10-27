import { hasPlanner, type Level } from "../../utils/level";
import type { StudioTab } from "./studio";

// The two parts of the admin: planning (events, people, staffing) and the website. Only the menu
// on the left and the overview follow the part that is chosen; every tab keeps its address.
// This is not the level (utils/level.ts): the level says what a congregation has, the part says
// what one is working on now.

export const STUDIO_AREAS = ["planlegging", "nettside"] as const;

export type StudioArea = (typeof STUDIO_AREAS)[number];

export const STUDIO_AREA_NAMES: Record<StudioArea, string> = {
  planlegging: "Planlegging",
  nettside: "Nettside",
};

// Keyed by tab, so a new tab cannot be added without saying where it belongs.
// null: the tab is in the menu whichever part is chosen.
const TAB_AREAS: Record<StudioTab, StudioArea | null> = {
  dashboard: null,
  "cms-sider": "nettside",
  "cms-nyheter": "nettside",
  "cms-taler": "nettside",
  "cms-stab": "nettside",
  "cms-medier": "nettside",
  "cms-design": "nettside",
  "cms-innstillinger": "nettside",
  "cms-overstyringer": "nettside",
  "cms-hjelp": null,
  "planlegger-samlinger": "planlegging",
  "planlegger-oppgaver": "planlegging",
  "planlegger-grupper": "planlegging",
  "planlegger-personer": "planlegging",
  "planlegger-roller": "planlegging",
  "planlegger-maler": "planlegging",
  "planlegger-semesterplan": "planlegging",
  arshjul: "planlegging",
  epost: "planlegging",
  "database-admin": null,
  moduler: null,
  analyse: "planlegging",
  nettsidebesok: "nettside",
  "demo-oppsett": null,
};

/** The part a tab belongs to, or null for a tab that is there in both. */
export const areaOfTab = (tab: StudioTab): StudioArea | null => TAB_AREAS[tab];

/** Where someone starts who has not chosen yet: the planning where the congregation has it. */
export const defaultArea = (level: Level): StudioArea => (hasPlanner(level) ? "planlegging" : "nettside");

export function parseArea(value: unknown): StudioArea | null {
  return STUDIO_AREAS.find((area) => area === value) ?? null;
}

// The part last chosen is remembered in this browser, so someone who only plans comes back to
// the planning. It is a convenience: without it, the default above is used.
const STORAGE_KEY = "menighetsplan_admin_area";

export function readStoredArea(): StudioArea | null {
  try {
    return parseArea(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeArea(area: StudioArea): void {
  try {
    localStorage.setItem(STORAGE_KEY, area);
  } catch {
    // Not remembered; the default is used next time
  }
}

/**
 * The part to show: the part of the open tab when it has one, otherwise the one last chosen,
 * otherwise the default for the level.
 */
export function areaToShow(tab: StudioTab, chosen: StudioArea | null, level: Level): StudioArea {
  return areaOfTab(tab) ?? chosen ?? defaultArea(level);
}
