import { Task, Assignment, Person } from "../types";

// The staffing rules of PRODUKTDOKUMENTASJON.md chapter 3, in one place.

/** How a person's answer to a task reads in the planner. */
export const RESPONSE_LABELS: Record<Assignment["response"], string> = {
  pending: "Forespurt",
  confirmed: "Bekreftet",
  declined: "Avslått",
  withdrawn: "Forfall",
};

export interface AssignedPerson {
  assignment: Assignment;
  /** Missing when the person has been deleted. */
  person?: Person;
  statusLabel: string;
  response: Assignment["response"];
}

/** Each assignment with its person and how the answer reads. The name on the assignment is used when the register is not in the browser. */
export function describeAssignments(
  taskAssignments: Assignment[],
  getPersonById: (personId: string) => Person | undefined
): AssignedPerson[] {
  return taskAssignments.map((assignment) => {
    const known = getPersonById(assignment.personId);
    const person = known ?? (assignment.personName
      ? { id: assignment.personId, name: assignment.personName, globalRole: "member" as const }
      : undefined);
    return {
      assignment,
      person,
      statusLabel: RESPONSE_LABELS[assignment.response],
      response: assignment.response,
    };
  });
}

export interface TaskSlots {
  needed: number;
  confirmed: number;
  pending: number;
  /** Ledige plasser = Behov − Bekreftet − Venter */
  free: number;
}

/** Counts a task's slots. Someone who has declined or withdrawn holds no slot. */
export function countSlots(task: Pick<Task, "neededCount">, taskAssignments: Assignment[]): TaskSlots {
  const needed = task.neededCount ?? 1;
  const confirmed = taskAssignments.filter((a) => a.response === "confirmed").length;
  const pending = taskAssignments.filter((a) => a.response === "pending").length;
  return { needed, confirmed, pending, free: Math.max(0, needed - confirmed - pending) };
}

/**
 * The dot a group leader sees on a task of their own group: red when nobody is on it (nobody
 * has said yes or been asked), yellow when someone is but fewer than the need have said yes,
 * none when the need is met. The status stored on the task settles it where it can, so a
 * screen that has not fetched the assignments does not show red for a task that is spoken for.
 */
export type StaffingDot = "red" | "yellow";

export function staffingDotFor(task: Pick<Task, "status" | "neededCount">, taskAssignments: Assignment[]): StaffingDot | null {
  if (task.status === "cancelled" || task.status === "confirmed") return null;
  if (task.status === "assigned") return "yellow";
  const { needed, confirmed, pending } = countSlots(task, taskAssignments);
  if (confirmed >= needed) return null;
  return confirmed + pending === 0 ? "red" : "yellow";
}

/** One dot for several tasks: red when any is red, yellow when any is yellow. */
export function worstStaffingDot(dots: readonly (StaffingDot | null)[]): StaffingDot | null {
  if (dots.includes("red")) return "red";
  return dots.includes("yellow") ? "yellow" : null;
}

/** Whether the person is on the task: has said yes, or has been asked and not answered yet. */
export function holdsSlot(assignment: Pick<Assignment, "response">): boolean {
  return assignment.response === "confirmed" || assignment.response === "pending";
}

const ACUTE_FORFALL_HOURS = 48;

/** A withdrawal is acute when it comes less than 48 hours before the gathering starts. */
export function isAcuteForfall(gatheringStartsAt: string | undefined, at: Date): boolean {
  const start = gatheringStartsAt ? new Date(gatheringStartsAt).getTime() : NaN;
  if (Number.isNaN(start)) return false;
  return start - at.getTime() < ACUTE_FORFALL_HOURS * 60 * 60 * 1000;
}

/**
 * The status a task has, given who is assigned to it. It is stored on the task every time
 * its assignments change, so the status never says something the assignments do not.
 *
 * - confirmed: every slot is filled by someone who has said yes
 * - assigned: every slot is spoken for, but someone has yet to answer
 * - vacant: a slot is free after an acute withdrawal, until it is filled again
 * - open: a slot is free
 */
export function taskStatusFor(
  task: Pick<Task, "status" | "neededCount">,
  taskAssignments: Assignment[],
  acuteForfall = false
): Task["status"] {
  if (task.status === "cancelled") return "cancelled";
  const { needed, confirmed, free } = countSlots(task, taskAssignments);
  if (free === 0) return confirmed >= needed ? "confirmed" : "assigned";
  return acuteForfall || task.status === "vacant" ? "vacant" : "open";
}

/**
 * What an absence stores on the assignment: the answer, and when it was given.
 * A reason is not stored. It is taken in person, because it can be private.
 */
export function absenceFields(
  response: Assignment["response"],
  respondedAt: string
): { response: "withdrawn" | "declined"; respondedAt: string } {
  return { response: response === "confirmed" ? "withdrawn" : "declined", respondedAt };
}

/** Assignments that still carry a reason from before it stopped being stored. The field is deleted, not kept. */
export function idsWithWithdrawalReason(assignments: readonly object[]): string[] {
  return assignments
    .flatMap((item) => {
      if (typeof item !== "object" || item === null || !("withdrawalReason" in item)) return [];
      const id = (item as { id?: unknown }).id;
      return typeof id === "string" ? [id] : [];
    })
    .sort();
}

/** A change to who is on a task. */
export interface AssignmentChange {
  add?: Assignment;
  /** A field given as `undefined` is cleared. */
  update?: { id: string; fields: Partial<Assignment> }[];
  remove?: string;
}

/** The task's assignments as they are once the change has been made. */
export function applyAssignmentChange(taskAssignments: Assignment[], change: AssignmentChange): Assignment[] {
  const updated = taskAssignments
    .filter((a) => a.id !== change.remove)
    .map((a) => {
      const fields = change.update?.find((u) => u.id === a.id)?.fields;
      return fields ? { ...a, ...fields } : a;
    });
  return change.add ? [...updated, change.add] : updated;
}

export type StaffingColor = "green" | "yellow" | "red";

export interface TaskStaffingStatus {
  color: StaffingColor;
  statusText: string; // "Dekket" | "Mangler X" | "Venter på svar"
  confirmedCount: number;
  neededCount: number;
  missingCount: number;
  pendingCount: number;
  hasForfall: boolean;
  isFullyCovered: boolean;
}

/**
 * Standardized 3-color staffing status for a single task:
 * 🟢 Grønn = behovet er fullt dekket ("Dekket")
 * 🔴 Rød = det mangler folk ("Mangler X")
 * 🟡 Gul = forespurt, men ikke svart ("Venter på svar")
 *
 * Regler:
 * 2/2 bekreftet → 🟢
 * 1/2 bekreftet → 🔴
 * 0/2 bekreftet + forespørsler som venter på svar → 🟡
 * 1/2 bekreftet + 1 ubesvart forespørsel → 🔴
 * Forfall som åpner en plass → 🔴
 * Forfall + ny forespørsel → fortsatt 🔴 inntil plassen faktisk er dekket
 * Først når hele behovet er dekket med bekreftede personer → 🟢
 */
export function calculateTaskStaffingStatus(
  task: Task,
  taskAssignments: Assignment[] = []
): TaskStaffingStatus {
  const { needed, confirmed: confirmedCount, pending: pendingCount } = countSlots(task, taskAssignments);

  // If no assignments provided, synthesize from task.status fallback
  if (taskAssignments.length === 0) {
    if (task.status === "confirmed") {
      return {
        color: "green",
        statusText: "Dekket",
        confirmedCount: needed,
        neededCount: needed,
        missingCount: 0,
        pendingCount: 0,
        hasForfall: false,
        isFullyCovered: true,
      };
    }
    if (task.status === "vacant") {
      return {
        color: "red",
        statusText: `Mangler ${needed}`,
        confirmedCount: 0,
        neededCount: needed,
        missingCount: needed,
        pendingCount: 0,
        hasForfall: true,
        isFullyCovered: false,
      };
    }
    if (task.status === "assigned") {
      return {
        color: "yellow",
        statusText: "Venter på svar",
        confirmedCount: 0,
        neededCount: needed,
        missingCount: needed,
        pendingCount: 1,
        hasForfall: false,
        isFullyCovered: false,
      };
    }
    // "open"
    return {
      color: "red",
      statusText: `Mangler ${needed}`,
      confirmedCount: 0,
      neededCount: needed,
      missingCount: needed,
      pendingCount: 0,
      hasForfall: false,
      isFullyCovered: false,
    };
  }

  const withdrawnCount = taskAssignments.filter((a) => a.response === "withdrawn").length;
  const hasForfall = withdrawnCount > 0 || task.status === "vacant";

  const missingCount = Math.max(0, needed - confirmedCount);
  const isFullyCovered = confirmedCount >= needed;

  if (isFullyCovered) {
    return {
      color: "green",
      statusText: "Dekket",
      confirmedCount,
      neededCount: needed,
      missingCount: 0,
      pendingCount,
      hasForfall: false,
      isFullyCovered: true,
    };
  }

  // Not fully covered:
  // - Forfall som åpner en plass -> 🔴
  // - Forfall + ny forespørsel -> fortsatt 🔴 inntil plassen faktisk er dekket
  // - 1/2 bekreftet -> 🔴
  // - 1/2 bekreftet + 1 ubesvart forespørsel -> 🔴
  if (hasForfall || confirmedCount > 0) {
    return {
      color: "red",
      statusText: `Mangler ${missingCount}`,
      confirmedCount,
      neededCount: needed,
      missingCount,
      pendingCount,
      // Red either way, but only a withdrawal or a vacant task counts as forfall:
      // 1 of 2 confirmed is short of people without anyone having dropped out.
      hasForfall,
      isFullyCovered: false,
    };
  }

  // confirmedCount === 0:
  // 0/2 bekreftet + forespørsler som venter på svar -> 🟡
  if (pendingCount > 0) {
    return {
      color: "yellow",
      statusText: "Venter på svar",
      confirmedCount: 0,
      neededCount: needed,
      missingCount,
      pendingCount,
      hasForfall: false,
      isFullyCovered: false,
    };
  }

  // 0 bekreftet, 0 venter -> 🔴 Mangler X
  return {
    color: "red",
    statusText: `Mangler ${missingCount}`,
    confirmedCount: 0,
    neededCount: needed,
    missingCount,
    pendingCount: 0,
    hasForfall: false,
    isFullyCovered: false,
  };
}

export interface StaffingStatusResult {
  color: StaffingColor;
  label: string;
  badgeText: string;
  totalTasks: number;
  coveredCount: number;
  vacantCount: number;
  openCount: number;
  missingPeopleCount: number;
  pendingCount: number;
  needsAttention: boolean;
}

/**
 * Standardized 3-color staffing status for a gathering (collection of tasks):
 * 🟢 Grønn = behovet er fullt dekket ("Dekket")
 * 🔴 Rød = det mangler folk ("Mangler X")
 * 🟡 Gul = forespurt, men ikke svart ("Venter på svar")
 */
export function getStaffingStatus(
  tasksForGathering: Task[],
  assignments: Assignment[] = []
): StaffingStatusResult {
  const totalTasks = tasksForGathering.length;
  if (totalTasks === 0) {
    return {
      color: "green",
      label: "Ingen oppgaver",
      badgeText: "Dekket",
      totalTasks: 0,
      coveredCount: 0,
      vacantCount: 0,
      openCount: 0,
      missingPeopleCount: 0,
      pendingCount: 0,
      needsAttention: false,
    };
  }

  const taskStatuses = tasksForGathering.map((task) => {
    const taskAssigns = assignments.length > 0
      ? assignments.filter((a) => a.taskId === task.id)
      : [];
    return calculateTaskStaffingStatus(task, taskAssigns);
  });

  const totalMissing = taskStatuses.reduce((sum, s) => sum + s.missingCount, 0);
  const totalPending = taskStatuses.reduce((sum, s) => sum + s.pendingCount, 0);
  const coveredCount = taskStatuses.filter((s) => s.isFullyCovered).length;
  const vacantCount = taskStatuses.filter((s) => s.hasForfall).length;
  const openCount = taskStatuses.filter((s) => !s.isFullyCovered && !s.hasForfall).length;

  const hasRed = taskStatuses.some((s) => s.color === "red");
  const hasYellow = taskStatuses.some((s) => s.color === "yellow");

  if (hasRed) {
    return {
      color: "red",
      label: `Mangler ${totalMissing}`,
      badgeText: `Mangler ${totalMissing}`,
      totalTasks,
      coveredCount,
      vacantCount,
      openCount,
      missingPeopleCount: totalMissing,
      pendingCount: totalPending,
      needsAttention: true,
    };
  }

  if (hasYellow) {
    return {
      color: "yellow",
      label: "Venter på svar",
      badgeText: "Venter på svar",
      totalTasks,
      coveredCount,
      vacantCount,
      openCount,
      missingPeopleCount: totalMissing,
      pendingCount: totalPending,
      needsAttention: false,
    };
  }

  return {
    color: "green",
    label: "Dekket",
    badgeText: "Dekket",
    totalTasks,
    coveredCount,
    vacantCount,
    openCount,
    missingPeopleCount: 0,
    pendingCount: 0,
    needsAttention: false,
  };
}
