import type { Assignment, Gathering, ProgramItem, Task } from "../types";
import { buildInitialVolunteerRoles, volunteerRoleIdForName, type DefaultVolunteerRoleName } from "./defaultVolunteerRoles";
import { itemClock, standardServiceTemplate, tasksOfTemplate, withTemplateDurations, type GatheringTemplate } from "../utils/gatheringTemplates";
import { taskStatusFor } from "../utils/staffing";

// The planner of the demo: the calendar and the staffing of a congregation's own planner, copied,
// with the demo's fictional persons in place of its people. Every date is moved 70 days back, with
// the same weekday, so the planner is written for DEMO_CONTENT_WEEK like the rest of the demo
// content (see utils/liveDates.ts). Events and people are referred to by the planner's own numbers
// (A-numbers and P-numbers): nothing here names the congregation the planner was copied from.
//
// The Sundays and the shared events are made by demoServiceSeries(). The handwritten gatherings
// in mockData.ts that are dated before DEMO_CONTENT_WEEK stay (history for Analysebord), and so do
// those that share no day with a copied event.

/** The owner of the shared events («Felleskalender»): the group that has no members of its own. */
const OWNER_GROUP = "group-lederskap";

/** The Møteleder of the service on this day is confirmed (Andreas Lind, who can try the run sheet as meeting leader). */
const CONFIRMED_MEETING_LEADER = { day: "2026-11-15", personId: "person-14" };

/**
 * The people of the planner, P0 to P36 by how much responsibility they carry, and the demo person
 * each one is. Nobody is mapped to person-11 (Bjørn Egeland), who is in no tjenestegruppe. The
 * demo doors and tests depend on P0, P3, P7, P9 and P10.
 */
export const PLANNER_PERSON: Readonly<Record<string, string>> = {
  P0: "person-1", // Kari Nordmann
  P1: "person-15", // Camilla Bakke
  P2: "person-2", // Ola Hansen
  P3: "person-14", // Andreas Lind
  P4: "person-6", // Silje Markussen
  P5: "person-5", // Thomas Viken
  P6: "person-13", // Martin Kleveland
  P7: "person-9", // Håkon Tveit
  P8: "person-8", // Marit Solberg
  P9: "person-23", // Kristine Vik
  P10: "person-27", // Ellen Fossli
  P11: "person-20", // Fredrik Dahl
  P12: "person-12", // Ruth Elisabeth Foss
  P13: "person-22", // Magnus Sætre
  P14: "person-21", // Anne Grethe Nilsen
  P15: "person-31", // Hildegunn Røed
  P16: "person-35", // Ane Sørensen
  P17: "person-41", // Marte Hovland
  P18: "person-43", // Hanne Riise
  P19: "person-39", // Ingeborg Lunde
  P20: "person-16", // Henrik Olsen
  P21: "person-3", // Ingrid Berg
  P22: "person-4", // Jonas Lie
  P23: "person-7", // Per Kristian Moen
  P24: "person-10", // Synnøve Aas
  P25: "person-24", // Tobias Berntsen
  P26: "person-25", // Solveig Knudsen
  P27: "person-26", // Geir Knudsen
  P28: "person-28", // Lars Fossli
  P29: "person-29", // Julie Haugen
  P30: "person-30", // Mathias Johannessen
  P31: "person-32", // Torleif Røed
  P32: "person-33", // Nora Eide
  P33: "person-37", // Linnea Berge
  P34: "person-34", // Even Holm
  P35: "person-36", // Jakob Strøm
  P36: "person-38", // Ole Martin Haug
};

/** The tasks of a service: the standard template, with the staffing of the planner where it differs. */
const TEMPLATE_EXTRA_STAFFING: readonly [DefaultVolunteerRoleName, number][] = [
  ["Lyd", 1],
  ["Bilde", 1],
  ["Rigging", 1],
  ["Kjøkken", 2],
  ["Baking", 1],
  ["Pynting", 1],
  ["Forbønn", 2],
];

/** The team of a task where the planner puts it somewhere other than the role's standard team. */
const TEAM_OF_TASK: Record<string, string> = { Lyd: "group-rigging", Bilde: "group-rigging" };

/** The part of a task's id that names it in an assignment's id. */
const SLUG: Record<string, string> = {
  Møteleder: "moteleder",
  Taler: "taler",
  Forbønn: "forbonn",
  Lovsang: "lovsang",
  Lyd: "lyd",
  Bilde: "bilde",
  Rigging: "rigging",
  Barnekirke: "barnekirke",
  Kjøkken: "kjokken",
  Baking: "baking",
  Pynting: "pynting",
  Møtevert: "motevert",
};

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
    extraStaffing: TEMPLATE_EXTRA_STAFFING.map(([roleName, neededCount], index) => ({
      id: `ekstra-${index + 1}`,
      roleId: volunteerRoleIdForName(roleName),
      roleName,
      neededCount,
    })),
  };
}

/** The offset of Norwegian time on a calendar day: summer time from the last Sunday of March to the last of October. */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - last.getUTCDay();
}

function osloOffset(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const afterMarch = month > 3 || (month === 3 && date >= lastSunday(year, 3));
  const beforeOctober = month < 10 || (month === 10 && date < lastSunday(year, 10));
  return afterMarch && beforeOctober ? "+02:00" : "+01:00";
}

/** A clock time on a calendar day in Norway, as an exact moment the way mockData.ts writes them. */
const at = (day: string, clock: string): string => `${day}T${clock}:00${osloOffset(day)}`;

type ServiceKind = "gudstjeneste" | "festgudstjeneste" | "menighetsfest" | "fellesgudstjeneste";

const SERVICE_TITLE: Record<ServiceKind, string> = {
  gudstjeneste: "Gudstjeneste",
  festgudstjeneste: "Festgudstjeneste",
  menighetsfest: "Menighetsfest",
  fellesgudstjeneste: "Fellesgudstjeneste",
};

interface ServiceDef {
  /** The planner's number for the event (A2 and so on), which the staffing refers to. */
  key: string;
  kind: ServiceKind;
  day: string;
  start: string;
  /** Without an end, the service lasts as long as the template's programme. */
  end?: string;
  location?: string;
  /** The group of the event, where it is not the shared one. */
  group?: string;
  /** The planner's own staffing for the service, where it differs from the template. */
  kjokken?: number;
  barnekirke?: number;
  noMotevert?: boolean;
}

/** The worship services and the other full services of the calendar. */
const SERVICES: ServiceDef[] = [
  { key: "A2", kind: "gudstjeneste", day: "2026-08-16", start: "11:00", end: "12:30", location: "Bedehuset", noMotevert: true },
  { key: "A5", kind: "gudstjeneste", day: "2026-08-30", start: "11:00", end: "12:30", location: "Bedehuset", kjokken: 1 },
  { key: "A10", kind: "gudstjeneste", day: "2026-09-13", start: "11:00", end: "12:30", location: "Bedehuset", barnekirke: 2 },
  { key: "A13", kind: "gudstjeneste", day: "2026-09-27", start: "11:00", end: "12:30", location: "Bedehuset", kjokken: 1 },
  { key: "A17", kind: "festgudstjeneste", day: "2026-10-15", start: "16:00", end: "17:00", location: "Bedehuset" },
  { key: "A19", kind: "menighetsfest", day: "2026-10-25", start: "16:00", location: "Bedehuset", group: "group-motevert" },
  { key: "A20", kind: "gudstjeneste", day: "2026-11-01", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A23", kind: "gudstjeneste", day: "2026-11-15", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A24", kind: "gudstjeneste", day: "2026-11-29", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A26", kind: "gudstjeneste", day: "2026-12-13", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A29", kind: "gudstjeneste", day: "2026-12-27", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A31", kind: "gudstjeneste", day: "2027-01-10", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A32", kind: "gudstjeneste", day: "2027-01-24", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A34", kind: "gudstjeneste", day: "2027-02-07", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A35", kind: "gudstjeneste", day: "2027-02-21", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A37", kind: "gudstjeneste", day: "2027-03-07", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A38", kind: "gudstjeneste", day: "2027-03-21", start: "11:00", end: "12:30", location: "Bedehuset" },
  { key: "A39", kind: "fellesgudstjeneste", day: "2027-04-11", start: "11:00", group: "group-motevert" },
];

interface SharedEvent {
  key: string;
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  /** The prayer evening with one task: the Møteleder (A6). */
  moteleder?: boolean;
}

/** The other events of the shared calendar: prayer evenings, the members' meeting, and so on. */
const SHARED: SharedEvent[] = [
  { key: "A0", id: "gathering-bonn-2026-08-03", title: "Bønn for byen", startsAt: at("2026-08-03", "20:00"), location: "Kirkesalen" },
  { key: "A6", id: "gathering-bonn-2026-08-31", title: "Bønn for byen", startsAt: at("2026-08-31", "19:00"), endsAt: at("2026-08-31", "20:00"), location: "Kirkesalen", moteleder: true },
  { key: "A7", id: "gathering-menighetsmote-2026-09-02", title: "Menighetsmøte", startsAt: at("2026-09-02", "17:00"), endsAt: at("2026-09-02", "19:00"), location: "Bedehuset" },
  { key: "A12", id: "gathering-misjonstur-2026-09-17", title: "Misjonstur", startsAt: at("2026-09-17", "00:00"), endsAt: at("2026-09-20", "23:59"), location: "Utlandet" },
  { key: "A16", id: "gathering-bonn-2026-10-05", title: "Bønn for byen", startsAt: at("2026-10-05", "19:00"), endsAt: at("2026-10-05", "20:00"), location: "Kirkesalen" },
  { key: "A21", id: "gathering-bonn-2026-11-02", title: "Bønn for byen", startsAt: at("2026-11-02", "19:00"), endsAt: at("2026-11-02", "20:00"), location: "Kirkesalen" },
  { key: "A22", id: "gathering-arsmote-2026-11-10", title: "Årsmøte", startsAt: at("2026-11-10", "17:00"), location: "Bedehuset" },
  { key: "A25", id: "gathering-bonn-2026-11-30", title: "Bønn for byen", startsAt: at("2026-11-30", "19:00"), endsAt: at("2026-11-30", "20:00"), location: "Bedehuset" },
  { key: "A28", id: "gathering-menighetsskole-2026-12-25", title: "Menighetsskole", startsAt: at("2026-12-25", "19:00"), endsAt: at("2026-12-26", "09:00"), location: "Bedehuset" },
  { key: "A30", id: "gathering-bonn-2026-12-28", title: "Bønn for byen", startsAt: at("2026-12-28", "19:00"), endsAt: at("2026-12-28", "20:00"), location: "Kirkesalen" },
  { key: "A33", id: "gathering-bonn-2027-02-01", title: "Bønn for byen", startsAt: at("2027-02-01", "19:00"), endsAt: at("2027-02-01", "20:00"), location: "Kirkesalen" },
  { key: "A36", id: "gathering-bonn-2027-03-01", title: "Bønn for byen", startsAt: at("2027-03-01", "19:00"), endsAt: at("2027-03-01", "20:00"), location: "Kirkesalen" },
];

interface HusDef {
  groupId: string;
  days: string[];
  start: string;
  end: string;
  location?: string;
  hostPersonId?: string;
}

/** The Husfellesskap series of two groups: the meetings in their homes, every other week. */
const HUS: HusDef[] = [
  { groupId: "group-hus-1", days: ["2026-08-19", "2026-09-02", "2026-09-16", "2026-09-30"], start: "19:30", end: "21:30" },
  {
    groupId: "group-hus-2",
    days: ["2026-08-06", "2026-08-20", "2026-09-03", "2026-09-17", "2026-10-01"],
    start: "19:00",
    end: "21:00",
    location: "Hos verten",
    hostPersonId: PLANNER_PERSON.P2,
  },
];

/**
 * The staffing of the planner: the event, the task, the person (P-number) and the answer. Each line
 * is one assignment, and nothing else is staffed.
 */
const STAFFING: [string, string, string, "conf" | "pend" | "decl"][] = [
  ["A13", "Forbønn", "P5", "conf"],
  ["A13", "Forbønn", "P7", "conf"],
  ["A13", "Møteleder", "P4", "conf"],
  ["A2", "Kjøkken", "P5", "conf"],
  ["A2", "Kjøkken", "P7", "conf"],
  ["A5", "Forbønn", "P12", "conf"],
  ["A5", "Forbønn", "P1", "conf"],
  ["A5", "Kjøkken", "P16", "conf"],
  ["A2", "Rigging", "P3", "conf"],
  ["A10", "Møtevert", "P12", "pend"],
  ["A10", "Rigging", "P3", "conf"],
  ["A10", "Taler", "P18", "conf"],
  ["A2", "Forbønn", "P0", "conf"],
  ["A5", "Rigging", "P8", "conf"],
  ["A5", "Lovsang", "P2", "conf"],
  ["A2", "Lovsang", "P6", "conf"],
  ["A10", "Barnekirke", "P0", "conf"],
  ["A10", "Barnekirke", "P20", "conf"],
  ["A13", "Kjøkken", "P1", "conf"],
  ["A5", "Møteleder", "P0", "conf"],
  ["A5", "Barnekirke", "P4", "conf"],
  ["A13", "Taler", "P0", "conf"],
  ["A10", "Forbønn", "P0", "conf"],
  ["A10", "Forbønn", "P2", "conf"],
  ["A5", "Taler", "P3", "conf"],
  ["A10", "Møteleder", "P1", "conf"],
  ["A13", "Barnekirke", "P19", "conf"],
  ["A10", "Lovsang", "P6", "conf"],
  ["A2", "Møteleder", "P4", "conf"],
  ["A2", "Barnekirke", "P1", "conf"],
  ["A13", "Lovsang", "P2", "conf"],
  ["A13", "Rigging", "P8", "conf"],
  ["A10", "Kjøkken", "P15", "conf"],
  ["A10", "Kjøkken", "P17", "conf"],
  ["A2", "Taler", "P0", "conf"],
  ["A29", "Kjøkken", "P1", "conf"],
  ["A17", "Taler", "P3", "conf"],
  ["A17", "Møtevert", "P0", "decl"],
  ["A17", "Møteleder", "P0", "conf"],
  ["A2", "Lyd", "P3", "conf"],
  ["A2", "Baking", "P7", "conf"],
  ["A2", "Pynting", "P13", "conf"],
  ["A2", "Bilde", "P9", "conf"],
  ["A10", "Baking", "P14", "conf"],
  ["A13", "Baking", "P7", "conf"],
  ["A10", "Pynting", "P1", "conf"],
  ["A13", "Bilde", "P9", "pend"],
  ["A10", "Lyd", "P3", "conf"],
  ["A5", "Lyd", "P8", "conf"],
  ["A5", "Bilde", "P9", "pend"],
  ["A10", "Bilde", "P11", "pend"],
  ["A5", "Pynting", "P4", "conf"],
  ["A13", "Lyd", "P8", "conf"],
  ["A13", "Pynting", "P1", "conf"],
  ["A5", "Baking", "P11", "conf"],
  ["A17", "Bilde", "P4", "conf"],
  ["A6", "Møteleder", "P0", "conf"],
];

const RESPONSE: Record<"conf" | "pend" | "decl", Assignment["response"]> = { conf: "confirmed", pend: "pending", decl: "declined" };

/** The id of a gathering without its prefix, which the ids of its tasks and assignments are made from. */
const partOf = (gatheringId: string): string => gatheringId.replace(/^gathering-/, "");

/**
 * The calendar of the demo's planner: the services and the shared events, the Husfellesskap series,
 * their tasks, and the assignments the planner has. The status of each task follows its assignments.
 */
export function demoServiceSeries(): { gatherings: Gathering[]; tasks: Task[]; assignments: Assignment[] } {
  const roles = buildInitialVolunteerRoles();
  const template = withTemplateDurations(demoServiceTemplate());
  const templateTasks = tasksOfTemplate(template, roles);
  const gatherings: Gathering[] = [];
  const tasks: Task[] = [];
  const assignments: Assignment[] = [];

  /** The planner's staffing of one event, and the status each task then has. */
  const staff = (key: string, eventTasks: Task[], gatheringId: string) => {
    const eventAssignments: Assignment[] = [];
    for (const [lineKey, title, person, answer] of STAFFING.filter((line) => line[0] === key)) {
      const task = eventTasks.find((candidate) => candidate.title === title);
      if (!task) throw new Error(`Bemanningen har ${title} på ${key}, men oppgaven finnes ikke`);
      const slot = eventAssignments.filter((a) => a.taskId === task.id).length + 1;
      const personId = PLANNER_PERSON[person];
      if (!personId) throw new Error(`${lineKey}: ${person} er ikke knyttet til noen person`);
      eventAssignments.push({
        id: `assign-${partOf(gatheringId)}-${SLUG[title]}-${slot}`,
        taskId: task.id,
        personId,
        response: RESPONSE[answer],
      });
    }
    // The Møteleder of the one service with a confirmed leader (see CONFIRMED_MEETING_LEADER)
    if (gatheringId === `gathering-gudstjeneste-${CONFIRMED_MEETING_LEADER.day}`) {
      const task = eventTasks.find((candidate) => candidate.title === "Møteleder");
      if (task) {
        eventAssignments.push({
          id: `assign-gudstjeneste-${CONFIRMED_MEETING_LEADER.day}-moteleder`,
          taskId: task.id,
          personId: CONFIRMED_MEETING_LEADER.personId,
          response: "confirmed",
        });
      }
    }
    for (const task of eventTasks) {
      task.status = taskStatusFor(task, eventAssignments.filter((a) => a.taskId === task.id));
    }
    assignments.push(...eventAssignments);
  };

  for (const def of SERVICES) {
    const id = def.kind === "gudstjeneste" ? `gathering-gudstjeneste-${def.day}` : `gathering-${def.kind}-${def.day}`;
    const eventTasks: Task[] = [];
    const taskIds = new Map<string, string>();
    for (const templateTask of templateTasks) {
      if (def.noMotevert && templateTask.title === "Møtevert") continue;
      const neededCount =
        templateTask.title === "Kjøkken" && def.kjokken !== undefined
          ? def.kjokken
          : templateTask.title === "Barnekirke" && def.barnekirke !== undefined
            ? def.barnekirke
            : templateTask.neededCount;
      const groupId = TEAM_OF_TASK[templateTask.title] ?? templateTask.groupId;
      const task: Task = {
        id: `task-${partOf(id)}-${eventTasks.length + 1}`,
        gatheringId: id,
        title: templateTask.title,
        status: "open",
        neededCount,
        ...(templateTask.volunteerRoleId ? { volunteerRoleId: templateTask.volunteerRoleId } : {}),
        ...(groupId ? { groupId } : {}),
      };
      eventTasks.push(task);
      taskIds.set(templateTask.key, task.id);
    }
    tasks.push(...eventTasks);
    const end = def.end ? at(def.day, def.end) : at(def.day, itemClock(def.start, { offsetMinutes: template.durationMinutes }));
    const programSchedule: ProgramItem[] = template.program.map((item, index) => {
      const taskId = item.roleId ? taskIds.get(item.roleId) : undefined;
      const groupId = taskId ? eventTasks.find((task) => task.id === taskId)?.groupId : undefined;
      return {
        id: `program-${partOf(id)}-${index + 1}`,
        time: itemClock(def.start, item),
        durationMinutes: item.durationMinutes,
        title: item.title,
        ...(item.description ? { description: item.description } : {}),
        ...(taskId ? { taskId } : {}),
        ...(groupId ? { groupId } : {}),
      };
    });
    gatherings.push({
      id,
      groupId: def.group ?? OWNER_GROUP,
      title: SERVICE_TITLE[def.kind],
      startsAt: at(def.day, def.start),
      endsAt: end,
      ...(def.location ? { location: def.location } : {}),
      type: "arrangement",
      visibility: "offentlig",
      isPublic: true,
      isGudstjeneste: true,
      cancelled: false,
      programSchedule,
      templateId: "mal-gudstjeneste",
      ...(def.kind === "gudstjeneste" ? { seriesId: "serie-gudstjeneste" } : {}),
    });
    staff(def.key, eventTasks, id);
  }

  for (const event of SHARED) {
    const eventTasks: Task[] = [];
    if (event.moteleder) {
      const task: Task = {
        id: `task-${partOf(event.id)}-1`,
        gatheringId: event.id,
        title: "Møteleder",
        status: "open",
        neededCount: 1,
        volunteerRoleId: volunteerRoleIdForName("Møteleder"),
        groupId: "group-moteledere",
      };
      eventTasks.push(task);
      tasks.push(task);
    }
    gatherings.push({
      id: event.id,
      groupId: OWNER_GROUP,
      title: event.title,
      startsAt: event.startsAt,
      ...(event.endsAt ? { endsAt: event.endsAt } : {}),
      ...(event.location ? { location: event.location } : {}),
      type: "arrangement",
      visibility: "offentlig",
      isPublic: true,
      isGudstjeneste: false,
      cancelled: false,
    });
    staff(event.key, eventTasks, event.id);
  }

  for (const husDef of HUS) {
    for (const day of husDef.days) {
      gatherings.push({
        id: `gathering-husfellesskap-${husDef.groupId.replace("group-", "")}-${day}`,
        groupId: husDef.groupId,
        title: "Husfellesskap",
        startsAt: at(day, husDef.start),
        endsAt: at(day, husDef.end),
        ...(husDef.location ? { location: husDef.location } : {}),
        ...(husDef.hostPersonId ? { hostPersonId: husDef.hostPersonId } : {}),
        type: "gruppesamling",
        visibility: "intern",
        isPublic: false,
        isGudstjeneste: false,
        cancelled: false,
      });
    }
  }

  // staff() throws when a staffing line has no task to go on, so every line of the planner is placed
  return { gatherings, tasks, assignments };
}
