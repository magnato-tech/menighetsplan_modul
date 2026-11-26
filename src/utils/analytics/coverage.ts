import type { VisitCounting } from "../siteTraffic";
import type { AttendanceSummary } from "./attendance";
import type { GroupSummary } from "./groupSummary";
import type { FullStaffingSummary } from "./health";
import type { VolunteerSummary } from "./volunteers";

// ============================================================================
// What the numbers rest on
// ============================================================================

export interface CoverageNote {
  id: string;
  status: "ok" | "partial" | "missing";
  text: string;
}

export function describeCoverage(
  attendance: AttendanceSummary,
  groups: GroupSummary,
  volunteers: VolunteerSummary,
  staffing: FullStaffingSummary,
  websiteVisits: VisitCounting = "off"
): CoverageNote[] {
  const worship = attendance.worship.length;
  const withTasks = staffing.gatherings;
  const withTimes = withTasks.filter((g) => (g.gathering.programSchedule ?? []).some((item) => item.taskId && item.time)).length;
  const counted = attendance.worshipCounted;
  const meetings = groups.groups.reduce((sum, g) => sum + g.meetings, 0);
  const answers = groups.groups.reduce((sum, g) => sum + g.responses.attending + g.responses.declined, 0);
  return [
    {
      id: "oppmote",
      status: worship === 0 ? "missing" : counted === worship ? "ok" : counted === 0 ? "missing" : "partial",
      text:
        worship === 0
          ? "Ingen gudstjenester er holdt i perioden."
          : `Oppmøtetall er registrert for ${counted} av ${worship} gudstjenester.`,
    },
    {
      id: "bemanning",
      status: volunteers.slotsNeeded > 0 ? "ok" : "missing",
      text:
        volunteers.slotsNeeded > 0
          ? `Bemanningen bygger på ${volunteers.slotsNeeded} plasser i oppgavene på samlingene i perioden.`
          : "Ingen samlinger i perioden hadde oppgaver å bemanne.",
    },
    {
      id: "svar",
      status: meetings === 0 ? "missing" : answers > 0 ? "ok" : "missing",
      text:
        meetings === 0
          ? "Ingen gruppesamlinger er holdt i perioden."
          : `${answers} svar («Kommer» / «Kommer ikke») på ${meetings} gruppesamlinger. Et svar sier hvem som planla å komme, ikke hvem som kom.`,
    },
    {
      id: "kjoreplan",
      status: withTasks.length === 0 || withTimes === 0 ? "missing" : withTimes === withTasks.length ? "ok" : "partial",
      text:
        withTasks.length === 0
          ? "Ingen samlinger med oppgaver i perioden, så ingen kjøreplan å se samtidige oppgaver i."
          : `Kjøreplanen har klokkeslett for oppgavene på ${withTimes} av ${withTasks.length} samlinger med oppgaver. Bare der kan bordet se om to oppgaver er samtidig.`,
    },
    {
      id: "nettside",
      status: websiteVisits === "counted" ? "ok" : "missing",
      text:
        websiteVisits === "counted"
          ? "Besøk på nettsiden telles anonymt og vises på bordet «Besøk på nettsiden». Hvem de besøkende er, måles ikke."
          : websiteVisits === "paused"
            ? "Tellingen av besøk på nettsiden er slått av. Den slås på igjen på bordet «Besøk på nettsiden»."
            : "Besøk på nettsiden telles ikke. Det gjør modulen «Besøk på nettsiden», som slås på under Moduler.",
    },
  ];
}
