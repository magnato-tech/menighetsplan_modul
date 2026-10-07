import { useMemo } from "react";
import { useFirebase } from "../context/FirebaseDataContext";
import { Person } from "../types";
import { resolveTaskInstruction } from "../utils/roleStaffing";
import { countSlots, holdsSlot } from "../utils/staffing";

// 1. Hook: useCurrentUser
export function useCurrentUser() {
  const { currentUser, allPersons, getUserGroups } = useFirebase();
  const userGroups = useMemo(
    () => (currentUser?.id && getUserGroups ? getUserGroups(currentUser.id) : []),
    [getUserGroups, currentUser?.id]
  );

  return {
    currentUser,
    allPersons,
    userGroups,
  };
}

// 2. Hook: useMyTasks — the tasks the current user has said yes to
export function useMyTasks() {
  const { currentUser, getTasksForPerson } = useFirebase();
  return useMemo(
    () => (currentUser?.id && getTasksForPerson ? getTasksForPerson(currentUser.id) : []),
    [getTasksForPerson, currentUser?.id]
  );
}

// 3. Hook: useTaskDetail — a task as one member sees it, and what they can do with it
export function useTaskDetail(taskId: string | undefined) {
  const {
    currentUser,
    getTaskById,
    getGatheringById,
    getGroupById,
    getPersonById,
    getAllAssignmentsForTask,
    isPersonInGroup,
    assignTaskToPerson,
    updateAssignmentStatus,
    reportAbsence,
    volunteerRoles,
  } = useFirebase();

  const task = (taskId && getTaskById(taskId)) || null;
  const group = (task?.groupId && getGroupById(task.groupId)) || null;
  const gathering = (task && getGatheringById(task.gatheringId)) || null;

  const taskAssignments = task ? getAllAssignmentsForTask(task.id) : [];
  const freeSlots = task ? countSlots(task, taskAssignments).free : 0;

  // The current user's own place on the task, if they have one
  const myAssignment = taskAssignments.find((a) => a.personId === currentUser.id && holdsSlot(a)) ?? null;
  const isAssignedToMe = myAssignment?.response === "confirmed";
  const isAskedOfMe = myAssignment?.response === "pending";

  // Tasks with a team are for group members; tasks without a team are for assignees and admins
  const permissionDenied =
    task !== null &&
    currentUser.globalRole !== "admin" &&
    !myAssignment &&
    (task.groupId ? !isPersonInGroup(currentUser.id, task.groupId) : true);

  const instruction = task ? resolveTaskInstruction(task, volunteerRoles) : "";

  // The others who are on it, those who have said yes first
  const othersOnTask = taskAssignments
    .filter((a) => holdsSlot(a) && a.personId !== currentUser.id)
    .sort((a, b) => Number(b.response === "confirmed") - Number(a.response === "confirmed"))
    .map((a) => getPersonById(a.personId))
    .filter((person): person is Person => person !== undefined);

  const canClaim = task !== null && !permissionDenied && task.status !== "cancelled" && freeSlots > 0 && !myAssignment;

  const refused = (error: string) => ({ success: false, error });

  return {
    task: permissionDenied ? null : task,
    instruction,
    gathering,
    group,
    othersOnTask,
    freeSlots,
    /** A slot stands empty after an acute withdrawal. */
    needsSubstitute: freeSlots > 0 && task?.status === "vacant",
    isAssignedToMe,
    isAskedOfMe,
    canClaim,
    canReportAbsence: isAssignedToMe,
    permissionDenied,
    /** Taking a task oneself is a yes, so the assignment is confirmed at once. */
    claimTask: () =>
      task && canClaim
        ? assignTaskToPerson(task.id, currentUser.id, "confirmed")
        : refused("Oppgaven kan ikke tas."),
    /** Answers a request from a leader. */
    answerRequest: (accept: boolean) =>
      myAssignment && isAskedOfMe
        ? updateAssignmentStatus(myAssignment.id, accept ? "confirmed" : "declined")
        : refused("Det er ingen forespørsel å svare på."),
    reportAbsence: () =>
      task && isAssignedToMe ? reportAbsence(task.id, currentUser.id) : refused("Du står ikke på denne oppgaven."),
  };
}

// 4. Hook: useModuleConfig
export function useModuleConfig() {
  const { moduleConfig, setModuleStatus, toggleKalender, toggleMeldinger } = useFirebase();

  return {
    moduleConfig,
    kalender: moduleConfig.kalender,
    meldinger: moduleConfig.meldinger,
    isKalenderOn: moduleConfig.kalender === "on",
    isMeldingerOn: moduleConfig.meldinger === "on",
    setModuleStatus,
    toggleKalender,
    toggleMeldinger,
  };
}
