import type { NewGatheringInput, NewTaskInput } from "../data/newDocuments";
import type { Gathering, GatheringVisibility, ProgramItem, Task, VolunteerRole } from "../types";
import { parseIsoToDateAndTime } from "./dates";
import { newGatheringOf, type GatheringFormValues } from "./gatheringForm";
import { isWorshipService } from "./gatherings";
import { newId } from "./id";
import { normalizeClock } from "./runSheet";
import { durationsOf, withComputedTimes } from "./programTiming";
import { visibilityOf } from "./visibility";

// Templates for events: the recipe for a kind of event, so one that is held again and again
// (a worship service, a youth meeting) is not set up from nothing each time.
//
// A template holds the facts of the event (title, time, place), how it is presented on the
// website (picture and text), its programme and the staffing it needs. An event made from a
// template is an ordinary event from then on: changing the template changes the events made
// after, and nothing that already stands in the calendar.
//
// The programme is kept as minutes from the start, so the whole of it follows when an event is
// given another time of day than the template's.

export interface TemplateProgramItem {
  id: string;
  /** Minutes from the start of the event. Negative for what happens before it starts. */
  offsetMinutes: number;
  durationMinutes: number;
  title: string;
  description?: string;
  /** The role that has the item: its place in the role library, and its name as it was when chosen. */
  roleId?: string;
  roleName?: string;
}

/** A task the event needs filled, beyond those its programme gives. */
export interface TemplateStaffing {
  id: string;
  roleId?: string;
  roleName: string;
  neededCount: number;
}

export interface GatheringTemplate {
  id: string;
  /** What the template is called in the admin. */
  name: string;
  title: string;
  /** The time of day such an event usually starts, "11:00", and how long it lasts. */
  time: string;
  durationMinutes: number;
  location?: string;
  groupId?: string;
  isGudstjeneste: boolean;
  visibility: GatheringVisibility;
  imageUrl?: string;
  imageAlt?: string;
  summary?: string;
  content?: string;
  linkUrl?: string;
  linkLabel?: string;
  program: TemplateProgramItem[];
  extraStaffing: TemplateStaffing[];
  updatedAt?: string;
}

// ---------- The clock ----------

const DAY_MINUTES = 24 * 60;

/** "11:07" as minutes since midnight. Null when the text is not a time of day. */
export function minutesOf(clock: string): number | null {
  const match = normalizeClock(clock).match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[1]) < 24 && Number(match[2]) < 60 ? minutes : null;
}

/** Minutes since midnight as "11:07". Past midnight it starts over, as a clock does. */
export function clockOf(minutes: number): string {
  const inDay = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`;
}

/** The time of day a programme item stands at, in an event that starts at `start`. */
export const itemClock = (start: string, item: Pick<TemplateProgramItem, "offsetMinutes">): string => clockOf((minutesOf(start) ?? 0) + item.offsetMinutes);

/** The time of day an event from the template ends, when it starts at `start`. Empty when the template gives no length. */
export const endClockOf = (
  start: string,
  template: Pick<GatheringTemplate, "durationMinutes" | "program">
): string => {
  const startMin = minutesOf(start) ?? 0;
  let minutes = template.durationMinutes;
  if (minutes <= 0 && template.program.length > 0) {
    minutes = template.program.reduce((sum, item) => sum + Math.max(0, item.durationMinutes || 0), 0);
  }
  return minutes > 0 ? clockOf(startMin + minutes) : "";
};

// ---------- The programme's lengths ----------

/** The time of day as a date-time string, so programTiming can read it. Only the clock part is used. */
const isoOfClock = (clock: string): string => {
  const at = minutesOf(clock) ?? 0;
  return new Date(2000, 0, 1, Math.floor(at / 60), at % 60).toISOString();
};

/** The items with their offsets worked out from the lengths before them, the first one at `start` minutes. */
export function withOffsetsFromDurations(program: readonly TemplateProgramItem[], start: number): TemplateProgramItem[] {
  let at = start;
  return program.map((item) => {
    const next = { ...item, offsetMinutes: at };
    at += item.durationMinutes;
    return next;
  });
}

/**
 * The template with each item's length filled in and its offset worked out from the lengths. An item
 * without a usable length takes the gap to the next item's time, as programTiming reads older programmes.
 * The programme keeps the place of its first item, so one that starts before the template's time still does.
 */
export function withTemplateDurations(template: GatheringTemplate): GatheringTemplate {
  const sorted = [...template.program].sort((a, b) => a.offsetMinutes - b.offsetMinutes);
  const endClock = endClockOf(template.time, template);
  const durations = durationsOf(
    sorted.map((item) => ({
      time: itemClock(template.time, item),
      durationMinutes: Number.isFinite(item.durationMinutes) ? item.durationMinutes : undefined,
      title: item.title,
    })),
    endClock ? isoOfClock(endClock) : undefined,
  );
  const lengthened = sorted.map((item, index) => ({ ...item, durationMinutes: durations[index] }));
  return { ...template, program: withOffsetsFromDurations(lengthened, sorted[0]?.offsetMinutes ?? 0) };
}

// ---------- Roles ----------

type RoleRef = Pick<TemplateProgramItem, "roleId" | "roleName">;

/** The role in the library an item points at: by its place there, or by its name when the place is gone. */
function roleOf(ref: RoleRef, roles: readonly VolunteerRole[]): VolunteerRole | undefined {
  const name = ref.roleName?.trim().toLowerCase();
  return roles.find((role) => role.id === ref.roleId) ?? (name ? roles.find((role) => role.name.trim().toLowerCase() === name) : undefined);
}

/** What the role is called now: its name in the library, or the name it had when it was chosen. */
export const roleNameOf = (ref: RoleRef, roles: readonly VolunteerRole[]): string => roleOf(ref, roles)?.name ?? ref.roleName?.trim() ?? "";

const roleKeyOf = (ref: RoleRef, roles: readonly VolunteerRole[]): string => roleOf(ref, roles)?.id ?? `navn:${roleNameOf(ref, roles).toLowerCase()}`;

export interface TemplateTask {
  /** Tells the tasks of a template apart. The programme items that belong to a task carry the same. */
  key: string;
  title: string;
  volunteerRoleId?: string;
  /** The team the role belongs to in the role library. */
  groupId?: string;
  neededCount: number;
  /** Whether the task comes from the programme, or is one of the extra ones. */
  from: "program" | "extra";
}

/**
 * The tasks an event from the template gets: one for each role in the programme, however many
 * items the role has, and the extra ones. A role that is both in the programme and among the
 * extra ones is one task, with the count the extra one says.
 */
export function tasksOfTemplate(template: Pick<GatheringTemplate, "program" | "extraStaffing">, roles: readonly VolunteerRole[]): TemplateTask[] {
  const tasks = new Map<string, TemplateTask>();
  const add = (ref: RoleRef, from: TemplateTask["from"], neededCount: number) => {
    const title = roleNameOf(ref, roles);
    if (!title) return;
    const key = roleKeyOf(ref, roles);
    const role = roleOf(ref, roles);
    const before = tasks.get(key);
    tasks.set(key, { key, title, volunteerRoleId: role?.id, groupId: role?.groupId, neededCount: from === "extra" ? neededCount : before?.neededCount ?? neededCount, from: before?.from ?? from });
  };
  for (const item of template.program) add(item, "program", 1);
  for (const extra of template.extraStaffing) add(extra, "extra", Math.max(1, extra.neededCount || 1));
  return [...tasks.values()];
}

// ---------- An event from a template ----------

/** The fields of the event's form, filled in from a template. The day is the form's own. */
export function formValuesFromTemplate(template: GatheringTemplate, values: GatheringFormValues): GatheringFormValues {
  const time = minutesOf(template.time) === null ? values.time : normalizeClock(template.time);
  return {
    ...values,
    title: template.title,
    time,
    endDate: "",
    endTime: endClockOf(time, template),
    location: template.location ?? "",
    groupId: template.groupId || values.groupId,
    isGudstjeneste: template.isGudstjeneste,
    visibility: template.visibility,
    imageUrl: template.imageUrl ?? "",
    imageAlt: template.imageAlt ?? "",
    summary: template.summary ?? "",
    content: template.content ?? "",
    linkUrl: template.linkUrl ?? "",
    linkLabel: template.linkLabel ?? "",
  };
}

export interface PlannedGathering {
  gathering: NewGatheringInput;
  tasks: { key: string; input: Omit<NewTaskInput, "gatheringId"> }[];
  program: { time: string; durationMinutes?: number; title: string; description?: string; taskKey?: string }[];
}

export interface PlanOptions {
  /** The template the event is made from. Without one it is an event with no programme and no tasks. */
  template?: GatheringTemplate | null;
  roles?: readonly VolunteerRole[];
  /** False on the level without the planner: the event then gets neither programme nor tasks. */
  withPlanner?: boolean;
  /** Set on every event of a series, so they can be told from other events, and from other series. */
  seriesId?: string;
  /** When the event is created from the congregation's iCal feed. */
  externalCalendarUid?: string;
}

/**
 * What is stored for one event, as the form holds it: the event itself, and with a template its
 * programme and tasks. The programme stands at the times of day that follow from the event's
 * own start.
 */
export function planGathering(
  values: GatheringFormValues,
  { template, roles = [], withPlanner = true, seriesId, externalCalendarUid }: PlanOptions = {}
): PlannedGathering {
  const gathering: NewGatheringInput = {
    ...newGatheringOf(values),
    ...(template ? { templateId: template.id } : {}),
    ...(seriesId ? { seriesId } : {}),
    ...(externalCalendarUid ? { externalCalendarUid } : {}),
  };
  if (!template || !withPlanner) return { gathering, tasks: [], program: [] };

  const tasks = tasksOfTemplate(template, roles);
  const keys = new Set(tasks.map((task) => task.key));
  // The programme starts where the template's first item stands, counted from the event's start. Each
  // post then gets its clock time and length from programTiming, so the times follow the lengths.
  const lengths = withTemplateDurations(template).program;
  const programStart = new Date(new Date(gathering.startsAt).getTime() + (lengths[0]?.offsetMinutes ?? 0) * 60000).toISOString();
  const timed = withComputedTimes(
    lengths.map((item) => ({ time: "", title: item.title, durationMinutes: item.durationMinutes })),
    programStart,
    gathering.endsAt
  );
  return {
    gathering,
    tasks: tasks.map((task) => ({ key: task.key, input: { title: task.title, volunteerRoleId: task.volunteerRoleId, groupId: task.groupId, neededCount: task.neededCount, status: "open" } })),
    program: lengths.map((item, index) => {
      const key = roleNameOf(item, roles) ? roleKeyOf(item, roles) : undefined;
      return {
        time: timed[index].time,
        durationMinutes: timed[index].durationMinutes,
        title: item.title,
        description: item.description,
        taskKey: key && keys.has(key) ? key : undefined,
      };
    }),
  };
}

type Result = { success: boolean; error?: string };

/** The three things that are stored when an event is made, as the app does them. */
export interface GatheringActions {
  createGathering: (data: NewGatheringInput) => Result & { gathering?: Gathering };
  createTask: (data: NewTaskInput) => Result & { task?: Task };
  updateGathering: (gatheringId: string, updates: Partial<Gathering>) => Result;
}

export type GatheringProgramActions = Pick<GatheringActions, "createTask" | "updateGathering">;

/** Creates the tasks and programme of a plan on an event that already exists. */
export function attachPlannedProgram(gatheringId: string, plan: PlannedGathering, actions: GatheringProgramActions): Result {
  const taskIds = new Map<string, { id: string; groupId?: string }>();
  for (const { key, input } of plan.tasks) {
    const created = actions.createTask({ ...input, gatheringId });
    if (!created.success) return created;
    if (created.task) taskIds.set(key, { id: created.task.id, groupId: created.task.groupId });
  }

  const updates: Partial<Gathering> = {};
  if (plan.program.length > 0) {
    updates.programSchedule = plan.program.map(({ taskKey, ...item }) => {
      const task = taskKey ? taskIds.get(taskKey) : undefined;
      return { id: newId("program"), ...item, ...(task ? { taskId: task.id, groupId: task.groupId } : {}) };
    });
  }
  if (plan.gathering.templateId) updates.templateId = plan.gathering.templateId;
  if (plan.gathering.endsAt) updates.endsAt = plan.gathering.endsAt;
  if (Object.keys(updates).length === 0) return { success: true };
  return actions.updateGathering(gatheringId, updates);
}

/** Form values for planning: the event's own day and title, with end time from the template when none is set. */
export function formValuesForTemplateApply(template: GatheringTemplate, values: GatheringFormValues): GatheringFormValues {
  const endTime = values.endTime || endClockOf(values.time, template);
  return { ...values, endDate: endTime ? values.endDate || values.date : values.endDate, endTime };
}

/** Stores a planned event: the event, its tasks, and then the programme with each item tied to its task. */
export function createPlannedGathering(actions: GatheringActions, plan: PlannedGathering): Result & { gathering?: Gathering } {
  const created = actions.createGathering(plan.gathering);
  if (!created.success || !created.gathering) return created;
  // Without tasks and programme there is nothing more to store: the event holds the rest already
  if (plan.tasks.length === 0 && plan.program.length === 0) return created;
  const attached = attachPlannedProgram(created.gathering.id, plan, actions);
  if (!attached.success) return attached;
  return created;
}

/** Fills an existing event with a template's programme and tasks. Existing tasks should be removed first. */
export function applyTemplateToGathering(gatheringId: string, plan: PlannedGathering, actions: GatheringProgramActions): Result {
  if (!plan.tasks.length && !plan.program.length) return { success: false, error: "Malen har ikke program eller oppgaver." };
  return attachPlannedProgram(gatheringId, plan, actions);
}

// ---------- A template from an event ----------

/**
 * A template made of an event that is already set up: its facts, its presentation, its
 * programme as minutes from the start, and its tasks. An item lasts until the next one starts.
 */
export function templateFromGathering(gathering: Gathering, tasks: readonly Task[], roles: readonly VolunteerRole[], name = gathering.title): GatheringTemplate {
  const start = parseIsoToDateAndTime(gathering.startsAt).time;
  const startMinutes = minutesOf(start) ?? 0;
  const length = gathering.endsAt ? Math.round((new Date(gathering.endsAt).getTime() - new Date(gathering.startsAt).getTime()) / 60000) : 0;
  const refOf = (task: Task | undefined): RoleRef => (task ? { roleId: task.volunteerRoleId, roleName: roles.find((role) => role.id === task.volunteerRoleId)?.name ?? task.title } : {});

  const timed = (gathering.programSchedule ?? [])
    .map((item) => ({ item, at: minutesOf(item.time) }))
    .filter((entry): entry is { item: ProgramItem; at: number } => entry.at !== null)
    .sort((a, b) => a.at - b.at);
  const program: TemplateProgramItem[] = timed.map(({ item, at }, index) => ({
    id: newId("item"),
    offsetMinutes: at - startMinutes,
    durationMinutes: index + 1 < timed.length ? Math.max(0, timed[index + 1].at - at) : 0,
    title: item.title,
    ...(item.description ? { description: item.description } : {}),
    ...refOf(tasks.find((task) => task.id === item.taskId)),
  }));

  const inProgram = new Set(timed.map(({ item }) => item.taskId).filter(Boolean));
  const extraStaffing: TemplateStaffing[] = tasks
    .filter((task) => task.status !== "cancelled" && (!inProgram.has(task.id) || (task.neededCount ?? 1) > 1))
    .map((task) => ({ id: newId("vakt"), roleId: task.volunteerRoleId, roleName: refOf(task).roleName ?? task.title, neededCount: task.neededCount ?? 1 }));

  return {
    id: newId("mal"),
    name: name.trim() || gathering.title,
    title: gathering.title,
    time: start,
    durationMinutes: Math.max(0, length),
    location: gathering.location,
    groupId: gathering.groupId,
    isGudstjeneste: isWorshipService(gathering),
    visibility: visibilityOf(gathering),
    imageUrl: gathering.imageUrl,
    imageAlt: gathering.imageAlt,
    summary: gathering.summary,
    content: gathering.content,
    linkUrl: gathering.linkUrl,
    linkLabel: gathering.linkLabel,
    program,
    extraStaffing,
  };
}

// ---------- The template a congregation can start from ----------

/**
 * A worship service at 11:00: offset and length in minutes from start, title, role, optional note for the run sheet.
 * Each length runs to the next offset, so the clock times are the same as the programme always showed.
 */
const STANDARD_SERVICE_PROGRAM: readonly (readonly [number, number, string, string?, string?])[] = [
  [-15, 15, "Velkommen ved inngang", "Møtevert"],
  [0, 7, "Lovsang x2", "Lovsang"],
  [7, 3, "Velkommen. Åpningsord", "Møteleder", "Dagens tema"],
  [10, 5, "Bønn", "Møteleder"],
  [15, 3, "Kunngjøringer", "Møteleder"],
  [18, 12, "Lovsang x3", "Lovsang"],
  [30, 2, "Barnekirke", "Barnekirke", "Barna går til sin samling"],
  [32, 8, "☕Kaffe / te-påfyll", "Møtevert"],
  [40, 2, "Bønn før tale", "Møteleder", "Forbønn for taler"],
  [42, 20, "Tale / undervisning", "Taler"],
  [62, 5, "Lovsang", "Lovsang"],
  [67, 1, "Nattverd og presentasjon av bønnestasjoner (3stk)"],
  [68, 12, "Forbønn", "Forbønn"],
  [80, 2, "Kollekt", "Møteleder", "Vipps-skjerm under lovsang"],
  [82, 7, "Lovsang x2", "Lovsang"],
  [89, 1, "Velsignelsen", "Møteleder"],
  [90, 2, "Lovsang (avslutningssang)", "Lovsang"],
  [92, 30, "Kirkekaffe", "Møtevert"],
];

/**
 * The template for a worship service that a congregation can put in and change: the programme
 * above, with each role tied to the role of that name in the congregation's own role library
 * when there is one.
 */
export function standardServiceTemplate(roles: readonly VolunteerRole[]): GatheringTemplate {
  return {
    id: newId("mal"),
    name: "Gudstjeneste",
    title: "Gudstjeneste",
    time: "11:00",
    durationMinutes: 92,
    isGudstjeneste: true,
    visibility: "offentlig",
    program: STANDARD_SERVICE_PROGRAM.map(([offsetMinutes, durationMinutes, title, roleName, description]) => ({
      id: newId("item"),
      offsetMinutes,
      durationMinutes,
      title,
      ...(description ? { description } : {}),
      ...(roleName ? { roleName, roleId: roleOf({ roleName }, roles)?.id } : {}),
    })),
    extraStaffing: [],
  };
}

/** A template as it is listed: sorted by name. */
export const byTemplateName = (a: Pick<GatheringTemplate, "name">, b: Pick<GatheringTemplate, "name">): number => a.name.localeCompare(b.name, "nb");
