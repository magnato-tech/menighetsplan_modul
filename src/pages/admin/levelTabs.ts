import { hasPlanner, type Level } from "../../utils/level";
import type { StudioTab } from "./studio";

// Which tabs of the admin a level has (see utils/level.ts). The menu and the gate in front of a
// tab (LevelGate.tsx) both ask here.
//
// The person register is in both levels: signing in rests on it, so a congregation with only
// the website still needs to say who its people and administrators are.

/** The tabs only Menighetsplan has: the planner beyond the calendar. */
export const PLANNER_TABS: readonly StudioTab[] = ["planlegger-oppgaver", "planlegger-grupper", "planlegger-roller"];

export const isTabInLevel = (tab: StudioTab, level: Level): boolean => hasPlanner(level) || !PLANNER_TABS.includes(tab);
