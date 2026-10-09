import type { useAdminDashboard } from "../../hooks/useAppHooks";
import { isPubliclyVisible } from "../../utils/visibility";
import { ONGOING_MS } from "../../utils/gatherings";

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

export function isUrgentTask(item: StudioData["adminTasks"][number]): boolean {
  return item.taskStaffing.hasForfall || item.taskStaffing.color === "red" || item.task.status === "vacant";
}

export function countUrgentTasks(items: StudioData["adminTasks"], now = Date.now()): number {
  return stillToStaff(items, now).filter(isUrgentTask).length;
}
