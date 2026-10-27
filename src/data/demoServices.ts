import type { Assignment, Gathering, ProgramItem, Task } from "../types";
import { buildInitialVolunteerRoles, volunteerRoleIdForName, type DefaultVolunteerRoleName } from "./defaultVolunteerRoles";
import { itemClock, standardServiceTemplate, tasksOfTemplate, withTemplateDurations, type GatheringTemplate } from "../utils/gatheringTemplates";

// The worship services of the example congregation every other Sunday, made from the standard
// template with its whole programme and a task for each role in it: what the semester plan and
// the run sheet are tried on in the demo. They are written for DEMO_CONTENT_WEEK, like the rest of
// the demo content, and moved with it (see utils/liveDates.ts).
//
// A Sunday that already has a service written by hand in mockData.ts keeps that one.

/** The first Sunday, the last, and the group the services belong to. */
const FIRST_SUNDAY = "2026-09-06";
const LAST_SUNDAY = "2027-04-25";
const OWNER_GROUP = "group-lederskap";
const START = "11:00";

const DAY_MS = 24 * 60 * 60 * 1000;

// One service has a confirmed meeting leader already, so someone can try the run sheet as meeting
// leader: the product owner logs in as Andreas Lind (a demo-door persona) and changes the programme.
const CONFIRMED_MEETING_LEADER = { day: "2026-11-15", personId: "person-14" };

/** The teams that are not in the standard programme, but are needed every Sunday: the template's extra staffing. */
const EXTRA_STAFFING: readonly [DefaultVolunteerRoleName, number][] = [
  ["Lyd", 1],
  ["Bilde", 1],
  ["Rigging", 1],
  ["Kjøkken", 2],
];

/**
 * The demo's template for a worship service: the standard one, tied to the demo's roles, with the
 * extra staffing, and with the same places every time it is made.
 */
export function demoServiceTemplate(): GatheringTemplate {
  const template = standardServiceTemplate(buildInitialVolunteerRoles());
  return {
    ...template,
    id: "mal-gudstjeneste",
    program: template.program.map((item, index) => ({ ...item, id: `punkt-${index + 1}` })),
    extraStaffing: EXTRA_STAFFING.map(([roleName, neededCount], index) => ({
      id: `ekstra-${index + 1}`,
      roleId: volunteerRoleIdForName(roleName),
      roleName,
      neededCount,
    })),
  };
}

/** The last Sunday of a month, as the day of the month. */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/** The offset of Norwegian time on a calendar day: summer time from the last Sunday of March to the last of October. */
function osloOffset(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const afterMarch = month > 3 || (month === 3 && date >= lastSunday(year, 3));
  const beforeOctober = month < 10 || (month === 10 && date < lastSunday(year, 10));
  return afterMarch && beforeOctober ? "+02:00" : "+01:00";
}

/** A clock time on a calendar day in Norway, as an exact moment the way mockData.ts writes them. */
const osloMoment = (day: string, clock: string): string => `${day}T${clock}:00${osloOffset(day)}`;

function sundays(): string[] {
  const days: string[] = [];
  for (let at = Date.parse(`${FIRST_SUNDAY}T12:00:00Z`); at <= Date.parse(`${LAST_SUNDAY}T12:00:00Z`); at += 14 * DAY_MS) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * The services, each with its tasks and its programme tied to them, and the assignments that are
 * confirmed in them. `written` are the gatherings written by hand: a Sunday with one of them at the
 * time of the service is left to it.
 */
export function demoServiceSeries(written: readonly Pick<Gathering, "startsAt">[]): { gatherings: Gathering[]; tasks: Task[]; assignments: Assignment[] } {
  const roles = buildInitialVolunteerRoles();
  const template = withTemplateDurations(demoServiceTemplate());
  const templateTasks = tasksOfTemplate(template, roles);
  const taken = new Set(written.map((gathering) => gathering.startsAt.slice(0, 16)));
  const meetingLeaderRoleId = volunteerRoleIdForName("Møteleder");

  const gatherings: Gathering[] = [];
  const tasks: Task[] = [];
  const assignments: Assignment[] = [];
  for (const day of sundays()) {
    if (taken.has(`${day}T${START}`)) continue;
    const id = `gathering-gudstjeneste-${day}`;
    const taskIds = new Map<string, string>();
    templateTasks.forEach((templateTask, index) => {
      // The meeting leader of the one service with a confirmed leader is filled
      const confirmed = day === CONFIRMED_MEETING_LEADER.day && templateTask.volunteerRoleId === meetingLeaderRoleId;
      const task: Task = {
        id: `task-gudstjeneste-${day}-${index + 1}`,
        gatheringId: id,
        title: templateTask.title,
        status: confirmed ? "confirmed" : "open",
        neededCount: templateTask.neededCount,
        ...(templateTask.volunteerRoleId ? { volunteerRoleId: templateTask.volunteerRoleId } : {}),
        ...(templateTask.groupId ? { groupId: templateTask.groupId } : {}),
      };
      tasks.push(task);
      taskIds.set(templateTask.key, task.id);
      if (confirmed) {
        assignments.push({
          id: `assign-gudstjeneste-${day}-moteleder`,
          taskId: task.id,
          personId: CONFIRMED_MEETING_LEADER.personId,
          response: "confirmed",
        });
      }
    });
    const programSchedule: ProgramItem[] = template.program.map((item, index) => {
      const taskId = item.roleId ? taskIds.get(item.roleId) : undefined;
      const groupId = taskId ? tasks.find((task) => task.id === taskId)?.groupId : undefined;
      return {
        id: `program-gudstjeneste-${day}-${index + 1}`,
        time: itemClock(START, item),
        durationMinutes: item.durationMinutes,
        title: item.title,
        ...(item.description ? { description: item.description } : {}),
        ...(taskId ? { taskId } : {}),
        ...(groupId ? { groupId } : {}),
      };
    });
    gatherings.push({
      id,
      groupId: OWNER_GROUP,
      title: template.title,
      startsAt: osloMoment(day, START),
      endsAt: osloMoment(day, itemClock(START, { offsetMinutes: template.durationMinutes })),
      location: "Hovedsalen",
      type: "arrangement",
      visibility: "offentlig",
      isPublic: true,
      isGudstjeneste: true,
      cancelled: false,
      programSchedule,
      templateId: "mal-gudstjeneste",
      seriesId: "serie-gudstjeneste",
    });
  }
  return { gatherings, tasks, assignments };
}
