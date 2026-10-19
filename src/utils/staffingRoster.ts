import type { ProgramItem, Task, VolunteerRole } from "../types";
import type { AssignedPerson } from "./staffing";
import { resolveTaskInstruction } from "./roleStaffing";
import { meetingTimeOf, normalizeClock, type RunSheetTask } from "./runSheet";

// The staffing of one gathering ("Bemanning"): every task once, with its role, its team and the
// people on it. The programme may use the same task in several items (the meeting leader opens,
// prays and gives the notices); here it is one row, and a change to it is a change to all of them.

/**
 * Where a task stands, seen from the one who must act:
 * - forfall: a slot nobody holds, after someone pulled out
 * - ubesatt: a slot nobody holds, and nobody has pulled out
 * - venter: every slot is held, but someone has not answered yet
 * - dekket: every slot is filled by someone who has said yes
 * - avlyst: the task is not needed this time
 */
export type RosterState = "forfall" | "ubesatt" | "venter" | "dekket" | "avlyst";

export const ROSTER_STATE_LABELS: Record<RosterState, string> = {
  forfall: "Forfall",
  ubesatt: "Ubesatt",
  venter: "Venter på svar",
  dekket: "Dekket",
  avlyst: "Avlyst",
};

/** The states that ask for someone to be found. */
export function needsAction(state: RosterState): boolean {
  return state === "forfall" || state === "ubesatt";
}

export interface RosterRow {
  task: Task;
  roleTitle: string;
  groupId?: string;
  groupName?: string;
  /** A task of a group the reader leads. */
  isMyGroup: boolean;
  instruction?: string;
  /** The clock times of the programme items that use the task, earliest first, each once. */
  programTimes: string[];
  /** When the people on the task are asked to meet, if the instruction says so. */
  meetAt?: string;
  needed: number;
  confirmed: number;
  pending: number;
  /** Slots nobody holds: not confirmed, not asked. */
  free: number;
  state: RosterState;
  /** Those who hold a slot first (confirmed, then asked), then those who pulled out or said no. */
  people: AssignedPerson[];
}

const PERSON_ORDER: Record<AssignedPerson["response"], number> = { confirmed: 0, pending: 1, withdrawn: 2, declined: 3 };

/**
 * The state of one task. The one rule for forfall, ubesatt and venter, used by the gathering, the
 * overview and «Trenger oppfølging» alike.
 */
export function staffingStateOf(input: {
  status: Task["status"];
  isFullyCovered: boolean;
  /** Someone has pulled out, or the task was left vacant by a late withdrawal. */
  hasForfall: boolean;
  hasAssignments: boolean;
  free: number;
}): RosterState {
  if (input.status === "cancelled") return "avlyst";
  if (input.isFullyCovered) return "dekket";
  // Without the assignments in the browser, the stored status says whether the slots are spoken for
  if (!input.hasAssignments && input.status === "assigned") return "venter";
  if (input.free === 0) return "venter";
  return input.hasForfall ? "forfall" : "ubesatt";
}

function stateOf(detail: RunSheetTask, free: number): RosterState {
  return staffingStateOf({
    status: detail.task.status,
    isFullyCovered: detail.isFullyCovered,
    hasForfall: detail.hasWithdrawn,
    hasAssignments: detail.assignedPersons.length > 0,
    free,
  });
}

export function buildStaffingRoster(
  programSchedule: ProgramItem[],
  tasks: RunSheetTask[],
  volunteerRoles: VolunteerRole[] = []
): RosterRow[] {
  const roles = new Map(volunteerRoles.map((r) => [r.id, r]));
  return tasks.map((detail) => {
    const { task } = detail;
    const people = [...detail.assignedPersons].sort((a, b) => PERSON_ORDER[a.response] - PERSON_ORDER[b.response]);
    const confirmed = people.filter((p) => p.response === "confirmed").length;
    const pending = people.filter((p) => p.response === "pending").length;
    const needed = detail.neededCount;
    const free = Math.max(0, needed - confirmed - pending);
    const instruction = resolveTaskInstruction(task, roles) || undefined;
    const programTimes = [
      ...new Set(
        programSchedule
          .filter((item) => item.taskId === task.id)
          .map((item) => normalizeClock(item.time || ""))
          .filter(Boolean)
      ),
    ].sort();
    return {
      task,
      roleTitle: task.title,
      groupId: task.groupId,
      groupName: detail.taskGroup?.name,
      isMyGroup: detail.isMyGroup,
      instruction,
      programTimes,
      meetAt: meetingTimeOf({ instruction }),
      needed,
      confirmed,
      pending,
      free,
      state: stateOf(detail, free),
      people,
    };
  });
}

/** The time a row is placed at: its first programme item, else when its people meet. */
function timeOf(row: RosterRow): string {
  return row.programTimes[0] || row.meetAt || "99:99";
}

function byTime(a: RosterRow, b: RosterRow): number {
  return timeOf(a).localeCompare(timeOf(b)) || a.roleTitle.localeCompare(b.roleTitle, "nb");
}

export interface RosterTeam {
  /** Missing for the tasks that have no team. */
  groupId?: string;
  name: string;
  rows: RosterRow[];
}

export interface OrderedRoster {
  /** What must be found someone for: forfall first, then ubesatt. */
  attention: RosterRow[];
  /** Everything else, by team, the teams in the order they come in the programme and those without a team last. */
  teams: RosterTeam[];
}

/** Where a row is shown: among what must be ordered, or in its team. */
export type RosterPlace = "attention" | "team";

export function placeOf(row: RosterRow, held: ReadonlyMap<string, RosterPlace> = new Map()): RosterPlace {
  return held.get(row.task.id) ?? (needsAction(row.state) ? "attention" : "team");
}

/**
 * The order the staffing is shown in. A row someone has just changed is `held` where it was, so it
 * does not jump away from under the finger; it moves when the view is opened again.
 */
export function orderStaffingRoster(rows: RosterRow[], held: ReadonlyMap<string, RosterPlace> = new Map()): OrderedRoster {
  const attention = rows
    .filter((row) => placeOf(row, held) === "attention")
    .sort((a, b) => Number(a.state !== "forfall") - Number(b.state !== "forfall") || byTime(a, b));
  const shown = new Set(attention.map((row) => row.task.id));

  const teams = new Map<string, RosterTeam>();
  for (const row of rows) {
    if (shown.has(row.task.id)) continue;
    const key = row.groupId ?? "";
    const team = teams.get(key) ?? { groupId: row.groupId, name: row.groupName || (row.groupId ? "Team" : "Uten team"), rows: [] };
    team.rows.push(row);
    teams.set(key, team);
  }
  const ordered = [...teams.values()].map((team) => ({ ...team, rows: [...team.rows].sort(byTime) }));
  ordered.sort((a, b) => {
    if (!a.groupId !== !b.groupId) return a.groupId ? -1 : 1;
    return timeOf(a.rows[0]).localeCompare(timeOf(b.rows[0])) || a.name.localeCompare(b.name, "nb");
  });
  return { attention, teams: ordered };
}

export interface RosterSummary {
  forfall: number;
  ubesatt: number;
  venter: number;
  dekket: number;
  /** Tasks that are needed: all but the cancelled ones. */
  total: number;
}

export function summarizeStaffingRoster(rows: RosterRow[]): RosterSummary {
  const count = (state: RosterState) => rows.filter((row) => row.state === state).length;
  return {
    forfall: count("forfall"),
    ubesatt: count("ubesatt"),
    venter: count("venter"),
    dekket: count("dekket"),
    total: rows.filter((row) => row.state !== "avlyst").length,
  };
}
