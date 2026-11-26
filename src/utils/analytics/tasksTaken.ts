import { currentAssignments, latestStamp } from "../staffing";
import { summarizeFullStaffing } from "./health";
import { analyticsPeriod } from "./periods";
import { DAY_MS, timeOf } from "./shared";
import type { ChurchData } from "./shared";

// ============================================================================
// Tasks taken: what people have said yes to, counted from now and back
// ============================================================================

export interface TasksTakenSummary {
  lastDay: number;
  lastWeek: number;
  lastMonth: number;
  openSlotsNext4Weeks: number;
}

const HOUR_MS = DAY_MS / 24;

/**
 * Tasks people have said yes to. A task counts when the later of the person's answer and their
 * assignment falls in the window before now. One person on one task counts once. The window does
 * not follow the chosen period: it always runs from now. The open slots are the same figure as
 * «Bemanning per arrangement» shows for the next four weeks.
 */
export function summarizeTasksTaken(data: Pick<ChurchData, "gatherings" | "tasks" | "assignments">, now: number): TasksTakenSummary {
  const liveTaskIds = new Set(data.tasks.filter((t) => t.status !== "cancelled").map((t) => t.id));
  const takenAt = currentAssignments(data.assignments)
    .filter((a) => a.response === "confirmed" && liveTaskIds.has(a.taskId))
    .map((a) => timeOf(latestStamp(a)))
    .filter((at) => !Number.isNaN(at) && at <= now);
  const takenWithin = (hours: number) => takenAt.filter((at) => at > now - hours * HOUR_MS).length;
  return {
    lastDay: takenWithin(24),
    lastWeek: takenWithin(7 * 24),
    lastMonth: takenWithin(30 * 24),
    openSlotsNext4Weeks: summarizeFullStaffing(data, analyticsPeriod("next4w", now)).missingSlots,
  };
}
