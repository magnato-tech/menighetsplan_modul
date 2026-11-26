import type { Gathering, GatheringHeadcount } from "../../types";
import { isWorshipService } from "../gatherings";
import { canRegisterHeadcount, headcountTotal } from "../headcount";
import type { AnalyticsPeriod } from "./periods";
import type { ChurchData } from "./shared";
import { average, heldIn } from "./shared";

// ============================================================================
// Attendance: how many came
// ============================================================================

export interface CountedGathering {
  gathering: Gathering;
  isWorship: boolean;
  headcount?: GatheringHeadcount;
  /** Adults and children together. Absent when nobody has registered a count. */
  total?: number;
}

export interface AttendanceSummary {
  /** Church-wide gatherings held in the period, oldest first. Group meetings are not counted here. */
  gatherings: CountedGathering[];
  worship: CountedGathering[];
  worshipCounted: number;
  /** Average of the worship services that have a count. Null when none has. */
  averageWorship: number | null;
  /** Average of every church-wide gathering that has a count, worship or not. */
  averageAll: number | null;
  averageWorshipChildren: number | null;
  previousAverageWorship: number | null;
  previousWorshipCounted: number;
  highestWorship: CountedGathering | null;
  /** Everyone counted at any church-wide gathering in the period. */
  totalCounted: number;
  /** Held gatherings without a count, newest first: the list to register. */
  missing: CountedGathering[];
}

/** The held gatherings that can have a count (see canRegisterHeadcount), each with its count if registered. */
function countedGatherings(
  held: Gathering[],
  headcountByGathering: Map<string, GatheringHeadcount>,
  now: number
): CountedGathering[] {
  return held
    .filter((g) => canRegisterHeadcount(g, now))
    .map((gathering) => {
      const headcount = headcountByGathering.get(gathering.id);
      return {
        gathering,
        isWorship: isWorshipService(gathering),
        headcount,
        total: headcount ? headcountTotal(headcount) : undefined,
      };
    });
}

export function summarizeAttendance(data: Pick<ChurchData, "gatherings" | "headcounts">, period: AnalyticsPeriod): AttendanceSummary {
  const headcountByGathering = new Map(data.headcounts.map((h) => [h.gatheringId, h]));
  const gatherings = countedGatherings(heldIn(data.gatherings, period.from, period.to), headcountByGathering, period.to);
  const previous = countedGatherings(
    heldIn(data.gatherings, period.previousFrom, period.from, false),
    headcountByGathering,
    period.to
  );

  const worship = gatherings.filter((g) => g.isWorship);
  const countedWorship = worship.filter((g) => g.total !== undefined);
  const previousCountedWorship = previous.filter((g) => g.isWorship && g.total !== undefined);

  const highestWorship = countedWorship.reduce<CountedGathering | null>(
    (best, g) => (best === null || (g.total ?? 0) > (best.total ?? 0) ? g : best),
    null
  );

  return {
    gatherings,
    worship,
    worshipCounted: countedWorship.length,
    averageWorship: average(countedWorship.map((g) => g.total ?? 0)),
    averageAll: average(gatherings.filter((g) => g.total !== undefined).map((g) => g.total ?? 0)),
    averageWorshipChildren: average(countedWorship.map((g) => g.headcount?.children ?? 0)),
    previousAverageWorship: average(previousCountedWorship.map((g) => g.total ?? 0)),
    previousWorshipCounted: previousCountedWorship.length,
    highestWorship,
    totalCounted: gatherings.reduce((sum, g) => sum + (g.total ?? 0), 0),
    missing: gatherings.filter((g) => g.total === undefined).reverse(),
  };
}
