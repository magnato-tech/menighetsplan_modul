import { DAY_MS } from "./shared";

export type AnalyticsPeriodId = "4w" | "3m" | "12m" | "next4w" | "next3m" | "next6m";

/** Whether a period is of what has been held, or of what is planned. */
export type AnalyticsDirection = "back" | "ahead";

export const ANALYTICS_PERIODS: { id: AnalyticsPeriodId; label: string; previousLabel: string; days: number; direction: AnalyticsDirection }[] = [
  { id: "4w", label: "Siste 4 uker", previousLabel: "forrige 4 uker", days: 28, direction: "back" },
  { id: "3m", label: "Siste 3 måneder", previousLabel: "forrige 3 måneder", days: 91, direction: "back" },
  // 52 whole weeks, so both periods hold the same number of Sundays
  { id: "12m", label: "Siste 12 måneder", previousLabel: "forrige 12 måneder", days: 364, direction: "back" },
  // Ahead: what is planned from now on. There is no period before to compare with.
  { id: "next4w", label: "Neste 4 uker", previousLabel: "", days: 28, direction: "ahead" },
  { id: "next3m", label: "Neste 3 måneder", previousLabel: "", days: 91, direction: "ahead" },
  { id: "next6m", label: "Neste halvår", previousLabel: "", days: 182, direction: "ahead" },
];

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriodId = "3m";

export interface AnalyticsPeriod {
  id: AnalyticsPeriodId;
  label: string;
  previousLabel: string;
  direction: AnalyticsDirection;
  /** The moment the board is looked at. The end of a period that looks back, the start of one that looks ahead. */
  now: number;
  /** The period is [from, to]. Looking back, `to` is now. Looking ahead, `from` is now. */
  from: number;
  to: number;
  /** The period before, of the same length: [previousFrom, from). Empty when looking ahead. */
  previousFrom: number;
  weeks: number;
}

export function analyticsPeriod(id: AnalyticsPeriodId, now: number): AnalyticsPeriod {
  const spec = ANALYTICS_PERIODS.find((p) => p.id === id) ?? ANALYTICS_PERIODS[1];
  const length = spec.days * DAY_MS;
  const weeks = Math.round(spec.days / 7);
  if (spec.direction === "ahead") {
    return { id: spec.id, label: spec.label, previousLabel: spec.previousLabel, direction: "ahead", now, from: now, to: now + length, previousFrom: now, weeks };
  }
  return {
    id: spec.id,
    label: spec.label,
    previousLabel: spec.previousLabel,
    direction: "back",
    now,
    from: now - length,
    to: now,
    previousFrom: now - 2 * length,
    weeks,
  };
}

/** Days ahead the board looks when it says how the coming staffing stands. */
export const UPCOMING_DAYS = 28;
/** A group with neither a meeting nor a message in this many days is shown as quiet. */
export const QUIET_GROUP_DAYS = 30;
/** A police certificate that runs out within this many days needs renewing now. */
export const POLICE_CERTIFICATE_WARNING_DAYS = 60;

/** Serving more often than every other week in the period. Never fewer than three times. */
export function highLoadThreshold(period: Pick<AnalyticsPeriod, "weeks">): number {
  return Math.max(3, Math.ceil(period.weeks / 2));
}
