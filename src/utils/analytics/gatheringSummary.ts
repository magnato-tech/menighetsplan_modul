import { isGroupGathering, isWorshipService } from "../gatherings";
import type { AnalyticsPeriod } from "./periods";
import { UPCOMING_DAYS } from "./periods";
import type { ChurchData } from "./shared";
import { DAY_MS, heldIn, timeOf, within } from "./shared";

// ============================================================================
// Gatherings: what took place
// ============================================================================

export interface GatheringSummary {
  held: number;
  previousHeld: number;
  worship: number;
  otherEvents: number;
  groupMeetings: number;
  cancelled: number;
  /** Planned in the coming four weeks, not cancelled. */
  upcoming: number;
}

export function summarizeGatherings(data: Pick<ChurchData, "gatherings">, period: AnalyticsPeriod): GatheringSummary {
  const held = heldIn(data.gatherings, period.from, period.to);
  const groupMeetings = held.filter(isGroupGathering).length;
  const worship = held.filter((g) => !isGroupGathering(g) && isWorshipService(g)).length;
  return {
    held: held.length,
    previousHeld: heldIn(data.gatherings, period.previousFrom, period.from, false).length,
    worship,
    otherEvents: held.length - groupMeetings - worship,
    groupMeetings,
    cancelled: data.gatherings.filter((g) => g.cancelled && within(timeOf(g.startsAt), period.from, period.to)).length,
    upcoming: data.gatherings.filter(
      (g) => !g.cancelled && timeOf(g.startsAt) > period.now && timeOf(g.startsAt) <= period.now + UPCOMING_DAYS * DAY_MS
    ).length,
  };
}
