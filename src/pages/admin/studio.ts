import type { useAdminDashboard } from "../../hooks/useAppHooks";
import { isPubliclyVisible } from "../../utils/visibility";
import { ONGOING_MS, isGroupGathering } from "../../utils/gatherings";
import { needsAction, staffingStateOf, summarizeStates, type RosterState, type RosterSummary } from "../../utils/staffingRoster";

export const STUDIO_TABS = [
  "dashboard",
  "cms-sider",
  "cms-nyheter",
  "cms-taler",
  "cms-stab",
  "cms-medier",
  "cms-design",
  "cms-innstillinger",
  "cms-overstyringer",
  "cms-hjelp",
  "planlegger-samlinger",
  "planlegger-oppgaver",
  "planlegger-grupper",
  "planlegger-personer",
  "planlegger-roller",
  "planlegger-maler",
  "arshjul",
  "epost",
  "database-admin",
  "moduler",
  "analyse",
  "nettsidebesok",
  "demo-oppsett",
] as const;

export type StudioTab = (typeof STUDIO_TABS)[number];

/** The tab named in the address. Anything unknown opens the dashboard rather than an empty page. */
export function toStudioTab(value: string | null): StudioTab {
  return STUDIO_TABS.find((tab) => tab === value) ?? "dashboard";
}

/** The address of a tab. Links built with this cannot point at a tab that does not exist. */
export function studioTabUrl(tab: StudioTab): string {
  return `/admin?tab=${tab}`;
}

/**
 * Everything useAdminDashboard returns. AdminStudio calls the hook once and hands
 * the result to the tabs, so its derived lists are not recomputed per tab.
 */
export type StudioData = ReturnType<typeof useAdminDashboard>;

export type ShowFeedback = (text: string, type?: "success" | "error") => void;

export function countPublicGatherings(items: StudioData["adminGatherings"]): number {
  return items.filter((item) => isPubliclyVisible(item.gathering)).length;
}

/**
 * Tasks that can still be staffed: the gathering lies ahead or is going on now. A task on
 * a gathering that is over is history for the analysis board, not something to follow up.
 */
export function stillToStaff<T extends Pick<StudioData["adminTasks"][number], "gathering">>(items: T[], now = Date.now()): T[] {
  return items.filter((item) => !item.gathering || new Date(item.gathering.startsAt).getTime() >= now - ONGOING_MS);
}

/** The state of a task by the one rule for forfall, ubesatt and venter (see utils/staffingRoster.ts). */
export function taskStateOf(item: StudioData["adminTasks"][number]): RosterState {
  return staffingStateOf({
    status: item.task.status,
    isFullyCovered: item.isFullyCovered,
    hasForfall: item.taskStaffing.hasForfall,
    hasAssignments: item.assignedPersonsList.length > 0,
    free: item.availableSpots,
  });
}

/** A task someone must be found for: a free slot after a forfall, or one nobody has been asked to. */
export function isUrgentTask(item: StudioData["adminTasks"][number]): boolean {
  return needsAction(taskStateOf(item));
}

/** Tasks still to staff that someone must be found for («Må ordnes»). */
export function countUrgentTasks(items: StudioData["adminTasks"], now = Date.now()): number {
  return stillToStaff(items, now).filter(isUrgentTask).length;
}

/** How far ahead the follow-up looks first. Further out, an empty slot is planning, not an emergency. */
export const NEAR_WEEKS = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Tasks on gatherings within the next `weeks` weeks (or going on now). A task without a gathering is left out. */
export function withinWeeks<T extends Pick<StudioData["adminTasks"][number], "gathering">>(items: T[], weeks: number, now = Date.now()): T[] {
  return items.filter((item) => {
    if (!item.gathering) return false;
    const start = new Date(item.gathering.startsAt).getTime();
    return start >= now - ONGOING_MS && start < now + weeks * WEEK_MS;
  });
}

export type FollowUpFilter = "ordnes" | "venter" | "alle";

export interface FollowUpGroup {
  gathering?: StudioData["adminTasks"][number]["gathering"];
  items: StudioData["adminTasks"];
}

const STATE_RANK: Record<RosterState, number> = { forfall: 0, ubesatt: 1, venter: 2, dekket: 3, avlyst: 4 };

/**
 * «Trenger oppfølging»: the tasks still to staff, per gathering and soonest first, with forfall
 * before ubesatt within a gathering. Cancelled tasks are not followed up.
 */
export function followUpGroups(
  items: StudioData["adminTasks"],
  filter: FollowUpFilter,
  weeks: number | null,
  now = Date.now()
): FollowUpGroup[] {
  const ahead = weeks === null ? stillToStaff(items, now) : withinWeeks(items, weeks, now);
  const chosen = ahead.filter((item) => {
    const state = taskStateOf(item);
    if (state === "avlyst") return false;
    if (filter === "ordnes") return needsAction(state);
    if (filter === "venter") return state === "venter";
    return true;
  });
  const groups = new Map<string, FollowUpGroup>();
  for (const item of chosen) {
    const key = item.gathering?.id ?? "";
    const group = groups.get(key) ?? { gathering: item.gathering, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  const startOf = (group: FollowUpGroup) => (group.gathering ? new Date(group.gathering.startsAt).getTime() : Infinity);
  return [...groups.values()]
    .sort((a, b) => startOf(a) - startOf(b))
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (a, b) => STATE_RANK[taskStateOf(a)] - STATE_RANK[taskStateOf(b)] || a.task.title.localeCompare(b.task.title, "nb")
      ),
    }));
}

export interface UpcomingGathering {
  item: StudioData["adminGatherings"][number];
  staffing: RosterSummary;
}

/**
 * The next gatherings, soonest first, with how their staffing stands: what the overview opens with.
 * Gatherings in the groups' own calendars and cancelled ones are left out; one going on now is included.
 */
export function upcomingGatherings(
  gatherings: StudioData["adminGatherings"],
  tasks: StudioData["adminTasks"],
  count: number,
  now = Date.now()
): UpcomingGathering[] {
  return gatherings
    .filter((item) => !item.gathering.cancelled && !isGroupGathering(item.gathering))
    .filter((item) => new Date(item.gathering.startsAt).getTime() >= now - ONGOING_MS)
    .sort((a, b) => new Date(a.gathering.startsAt).getTime() - new Date(b.gathering.startsAt).getTime())
    .slice(0, count)
    .map((item) => ({
      item,
      staffing: summarizeStates(tasks.filter((t) => t.task.gatheringId === item.gathering.id).map(taskStateOf)),
    }));
}
