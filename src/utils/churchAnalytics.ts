// The analysis board (Analysebord): what the stored data says about the life of the
// congregation over a period, compared with the period before. Every number is counted
// from what is in the database. Where something is not registered, it is reported as
// missing, never estimated.

export type { CountedGathering, AttendanceSummary } from "./analytics/attendance";
export { summarizeAttendance } from "./analytics/attendance";
export type { ChurchAnalytics } from "./analytics/buildAnalytics";
export { buildChurchAnalytics } from "./analytics/buildAnalytics";
export type { ContentSummary } from "./analytics/content";
export { summarizeContent } from "./analytics/content";
export type { CoverageNote } from "./analytics/coverage";
export { describeCoverage } from "./analytics/coverage";
export type { MonthBand, PersonEngagement, EngagementSummary } from "./analytics/engagement";
export { MONTH_BANDS, atLeastPerMonth, summarizeEngagement } from "./analytics/engagement";
export { headcountCsv } from "./analytics/export";
export type { GatheringSummary } from "./analytics/gatheringSummary";
export { summarizeGatherings } from "./analytics/gatheringSummary";
export type { GroupActivity, GroupSummary } from "./analytics/groupSummary";
export { GROUP_CATEGORY_LABELS, summarizeGroups } from "./analytics/groupSummary";
export type { FullStaffingSummary, MultiTaskOccurrence, MultiTaskSummary } from "./analytics/health";
export { summarizeFullStaffing, summarizeMultiTasks } from "./analytics/health";
export type { PeopleSummary } from "./analytics/people";
export { summarizePeople } from "./analytics/people";
export type { AnalyticsPeriodId, AnalyticsDirection, AnalyticsPeriod } from "./analytics/periods";
export { ANALYTICS_PERIODS, DEFAULT_ANALYTICS_PERIOD, analyticsPeriod, UPCOMING_DAYS, QUIET_GROUP_DAYS, POLICE_CERTIFICATE_WARNING_DAYS, highLoadThreshold } from "./analytics/periods";
export type { ChurchData, GatheringStaffing } from "./analytics/shared";
export type { TasksTakenSummary } from "./analytics/tasksTaken";
export { summarizeTasksTaken } from "./analytics/tasksTaken";
export type { RoleFill, LoadBucket, StaffingWindow, VolunteerSummary } from "./analytics/volunteers";
export { summarizeVolunteers } from "./analytics/volunteers";
