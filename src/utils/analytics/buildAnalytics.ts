import type { AttendanceSummary } from "./attendance";
import { summarizeAttendance } from "./attendance";
import type { ContentSummary } from "./content";
import { summarizeContent } from "./content";
import type { CoverageNote } from "./coverage";
import { describeCoverage } from "./coverage";
import type { EngagementSummary } from "./engagement";
import { summarizeEngagement } from "./engagement";
import type { GatheringSummary } from "./gatheringSummary";
import { summarizeGatherings } from "./gatheringSummary";
import type { GroupSummary } from "./groupSummary";
import { summarizeGroups } from "./groupSummary";
import type { FullStaffingSummary, MultiTaskSummary } from "./health";
import { summarizeFullStaffing, summarizeMultiTasks } from "./health";
import type { PeopleSummary } from "./people";
import { summarizePeople } from "./people";
import type { AnalyticsPeriod, AnalyticsPeriodId } from "./periods";
import { analyticsPeriod } from "./periods";
import type { ChurchData } from "./shared";
import type { TasksTakenSummary } from "./tasksTaken";
import { summarizeTasksTaken } from "./tasksTaken";
import type { VolunteerSummary } from "./volunteers";
import { summarizeVolunteers } from "./volunteers";

// ============================================================================
// Everything together
// ============================================================================

export interface ChurchAnalytics {
  period: AnalyticsPeriod;
  attendance: AttendanceSummary;
  gatherings: GatheringSummary;
  fullStaffing: FullStaffingSummary;
  multiTasks: MultiTaskSummary;
  engagement: EngagementSummary;
  volunteers: VolunteerSummary;
  groups: GroupSummary;
  people: PeopleSummary;
  content: ContentSummary;
  coverage: CoverageNote[];
  /** Counted from now, whatever period the board shows. */
  tasksTaken: TasksTakenSummary;
}

export function buildChurchAnalytics(data: ChurchData, periodId: AnalyticsPeriodId, now: number): ChurchAnalytics {
  const period = analyticsPeriod(periodId, now);
  const attendance = summarizeAttendance(data, period);
  const volunteers = summarizeVolunteers(data, period);
  const groups = summarizeGroups(data, period);
  const fullStaffing = summarizeFullStaffing(data, period);
  return {
    period,
    attendance,
    gatherings: summarizeGatherings(data, period),
    fullStaffing,
    multiTasks: summarizeMultiTasks(data, period),
    engagement: summarizeEngagement(data, period),
    volunteers,
    groups,
    people: summarizePeople(data, now),
    content: summarizeContent(data, period),
    coverage: describeCoverage(attendance, groups, volunteers, fullStaffing, data.websiteVisits),
    tasksTaken: summarizeTasksTaken(data, now),
  };
}
