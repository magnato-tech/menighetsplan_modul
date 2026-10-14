import type { Gathering, Group, ProgramItem, Task, VolunteerRole } from "../types";
import { staffingDotFor, type AssignedPerson, type StaffingDot } from "./staffing";
import { resolveTaskInstruction } from "./roleStaffing";
import { isInGroup } from "./groups";
import { isPubliclyVisible } from "./visibility";

// The run sheet of a gathering ("kjøreplan"): its programme and its tasks on one timeline.
// It shows what is registered and nothing else. A programme item nobody has linked a task
// to is listed without anyone responsible, and a gathering without a programme lists its tasks.

/** A task as the gathering view knows it: its group, its people and whether it is covered. */
export interface RunSheetTask {
  task: Task;
  taskGroup?: Group;
  isMyGroup: boolean;
  neededCount: number;
  assignedPersons: AssignedPerson[];
  confirmedPersonsCount: number;
  isFullyCovered: boolean;
  hasWithdrawn: boolean;
}

export interface RunSheetRow {
  id: string;
  /** "HH:MM", or empty when no time is known. */
  time: string;
  title: string;
  description?: string;
  /** The task's title on a programme item with a task linked to it. */
  roleTitle?: string;
  /** When the people on the task are asked to meet, if the instruction says so. */
  meetAt?: string;
  groupName?: string;
  groupId?: string;
  isMyGroup: boolean;
  /** Missing on a programme item nobody is assigned to through a task. */
  task?: Task;
  neededCount: number;
  confirmedCount: number;
  isFullyCovered: boolean;
  hasForfall: boolean;
  assignedPersons: AssignedPerson[];
  instruction?: string;
}

/** "9:30" and "9.30" as "09:30", so times sort by the clock. Anything else is left as it is written. */
export function normalizeClock(value: string): string {
  const match = value.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value.trim();
}

/** The place in `programSchedule` behind a kjøreplan row built with `buildRunSheet`, or null for a task row. */
export function programIndexOfRunSheetRow(rowId: string): number | null {
  const match = rowId.match(/^program-(\d+)$/);
  return match ? Number(match[1]) : null;
}

/**
 * Moves one programme item in the list. The clock time on each row stays put, like when a template
 * programme is reordered, so the run sheet still sorts the same way but with new content on each line.
 */
export function reorderProgramSchedule(schedule: ProgramItem[], from: number, to: number): ProgramItem[] {
  if (from === to || from < 0 || to < 0 || from >= schedule.length || to >= schedule.length) return schedule;
  const times = schedule.map((item) => item.time);
  const items = [...schedule];
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);
  return items.map((item, index) => ({ ...item, time: times[index] }));
}

/**
 * The meeting time an instruction opens with: "Møt opp kl. 09:30 for rigging" gives "09:30".
 * Only an instruction that starts by saying when to meet counts; a clock time further into
 * the text may be about something else.
 */
export function meetingTimeOf(task: Pick<Task, "instruction">): string | undefined {
  const match = (task.instruction || "").match(/^\s*(?:møt(?:\s+opp)?|oppmøte)\s*(?:kl\.?\s*)?(\d{1,2}[:.]\d{2})/i);
  return match ? normalizeClock(match[1]) : undefined;
}

function taskFields(detail: RunSheetTask, roles: Map<string, VolunteerRole>) {
  const { task } = detail;
  return {
    task,
    groupName: detail.taskGroup?.name,
    groupId: task.groupId,
    isMyGroup: detail.isMyGroup,
    neededCount: detail.neededCount,
    confirmedCount: detail.confirmedPersonsCount,
    isFullyCovered: detail.isFullyCovered,
    hasForfall: detail.hasWithdrawn || task.status === "vacant",
    assignedPersons: detail.assignedPersons,
    instruction: resolveTaskInstruction(task, roles),
  };
}

export function buildRunSheet(
  programSchedule: ProgramItem[],
  tasks: RunSheetTask[],
  volunteerRoles: VolunteerRole[] = []
): RunSheetRow[] {
  const roles = new Map(volunteerRoles.map((r) => [r.id, r]));
  const linkedTaskIds = new Set<string>();

  const programRows = programSchedule.map((item, index): RunSheetRow => {
    const linked = item.taskId ? tasks.find((t) => t.task.id === item.taskId) : undefined;
    const base = {
      id: `program-${index}`,
      time: normalizeClock(item.time || ""),
      title: item.title,
      description: item.description,
    };
    if (!linked) {
      return { ...base, isMyGroup: false, neededCount: 0, confirmedCount: 0, isFullyCovered: true, hasForfall: false, assignedPersons: [] };
    }
    linkedTaskIds.add(linked.task.id);
    const instruction = resolveTaskInstruction(linked.task, roles);
    return {
      ...base,
      roleTitle: linked.task.title,
      meetAt: meetingTimeOf({ instruction }),
      ...taskFields(linked, roles),
    };
  });

  // Tasks outside the programme are placed at the time their people meet, when that is known
  const taskRows = tasks
    .filter((t) => !linkedTaskIds.has(t.task.id))
    .map((detail): RunSheetRow => ({
      id: `task-${detail.task.id}`,
      time: meetingTimeOf({ instruction: resolveTaskInstruction(detail.task, roles) }) ?? "",
      title: detail.task.title,
      description: detail.task.description,
      ...taskFields(detail, roles),
    }));

  // By the clock, with rows without a time last. The sort is stable, so the programme keeps its order.
  return [...programRows, ...taskRows].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

/**
 * A run sheet row as everyone who may see the gathering reads it ("Kjøreplan"): the names of
 * those who have accepted and nothing about who was asked, has withdrawn or said no. The
 * instruction is only given on the reader's own task.
 */
export interface SharedRunSheetRow {
  id: string;
  time: string;
  title: string;
  description?: string;
  roleTitle?: string;
  meetAt?: string;
  groupName?: string;
  /** Those who have accepted, in the order they were assigned. Empty when nobody has. */
  names: string[];
  /** The reader is asked or has accepted. */
  isMine: boolean;
  /** A task of a group the reader leads. */
  isMyGroup: boolean;
  instruction?: string;
  /** Only on a task of a group the reader leads: red when nobody is on it, yellow when it is not full. */
  dot?: StaffingDot;
}

export function sharedRunSheet(rows: RunSheetRow[], personId: string): SharedRunSheetRow[] {
  return rows.map((row) => {
    const mine = row.assignedPersons.some(
      (p) => p.assignment.personId === personId && (p.response === "confirmed" || p.response === "pending")
    );
    const names = row.assignedPersons
      .filter((p) => p.response === "confirmed")
      .map((p) => p.person?.name || p.assignment.personName || "")
      .filter(Boolean);
    return {
      id: row.id,
      time: row.time,
      title: row.title,
      description: row.description,
      roleTitle: row.roleTitle,
      meetAt: row.meetAt,
      groupName: row.groupName,
      names,
      isMine: mine,
      isMyGroup: row.isMyGroup,
      instruction: mine ? row.instruction : undefined,
      dot: (row.isMyGroup && row.task && staffingDotFor(row.task, row.assignedPersons.map((p) => p.assignment))) || undefined,
    };
  });
}

/**
 * Whether a person may see the run sheet of a gathering: one open to the congregation, one held by
 * a group they are in, or one where they stand on a task. Someone who may plan it, may also see it.
 * The database lets the same people read the names on it (firestore.rules, assignments).
 */
export function maySeeRunSheet(input: {
  gathering: Pick<Gathering, "visibility" | "isPublic">;
  gatheringGroup?: Group | null;
  personId: string;
  mayPlan: boolean;
  standsOnTask: boolean;
}): boolean {
  if (input.mayPlan || input.standsOnTask) return true;
  if (isPubliclyVisible(input.gathering)) return true;
  return Boolean(input.gatheringGroup && isInGroup(input.gatheringGroup, input.personId));
}
