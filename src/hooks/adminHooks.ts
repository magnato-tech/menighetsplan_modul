import { useMemo, useCallback, useEffect, useState } from "react";
import { useFirebase } from "../context/FirebaseDataContext";
import { useCms } from "../context/CmsContext";
import { AnalyticsPeriodId, buildChurchAnalytics } from "../utils/churchAnalytics";
import { visitCounting } from "../utils/siteTraffic";
import { Task, Group, Gathering } from "../types";
import { validateGathering } from "../utils/validation";
import {
  AssignedPerson,
  TaskStaffingStatus,
  calculateTaskStaffingStatus,
  countSlots,
  describeAssignments,
  StaffingStatusResult,
  getStaffingStatus,
} from "../utils/staffing";

export interface AdminGatheringItem {
  gathering: Gathering;
  group?: Group;
  tasks: Task[];
  tasksWithStaffing: Array<{ task: Task; taskStaffing: TaskStaffingStatus }>;
  totalTasks: number;
  coveredTasksCount: number;
  missingStaffingCount: number;
  staffing: StaffingStatusResult;
}

export interface AdminTaskItem {
  task: Task;
  gathering?: Gathering;
  group?: Group;
  assignedPersonsList: AssignedPerson[];
  neededCount: number;
  confirmedCount: number;
  pendingCount: number;
  availableSpots: number;
  isFullyCovered: boolean;
  missingCount: number;
  taskStaffing: TaskStaffingStatus;
}

// 9. Hook: useAdminDashboard
export function useAdminDashboard() {
  const {
    currentUser,
    signOut,
    allPersons,
    groups,
    gatherings,
    tasks,
    assignments,
    updateGroupName,
    updateGroup,
    createGroup,
    addPerson,
    updatePerson,
    getGroupById,
    getGatheringById,
    getPersonById,
    createGathering,
    updateGathering,
    deleteGathering,
    createTask,
    updateTask,
    assignTaskToPerson,
    volunteerRoles,
    createVolunteerRole,
    updateVolunteerRole,
    deleteVolunteerRole,
  } = useFirebase();

  const isAdmin = currentUser.globalRole === "admin";

  const adminPersons = useMemo(() => {
    return allPersons.map((person) => {
      const personGroups = groups.filter((g) => g.memberIds.includes(person.id));
      const leaderInGroups = groups.filter((g) => g.leaderIds.includes(person.id));
      const deputyInGroups = groups.filter((g) => g.deputyLeaderIds?.includes(person.id));
      return {
        person,
        groups: personGroups,
        leaderInGroups,
        deputyInGroups,
      };
    });
  }, [allPersons, groups]);

  const adminGroups = useMemo(() => {
    return groups.map((group) => {
      const leaders = allPersons.filter((p) => group.leaderIds.includes(p.id));
      const deputyLeaders = allPersons.filter((p) => group.deputyLeaderIds?.includes(p.id));
      const members = allPersons.filter((p) => group.memberIds.includes(p.id));
      const groupTasks = tasks.filter((t) => t.groupId === group.id);
      return {
        group,
        leaders,
        deputyLeaders,
        members,
        tasksCount: groupTasks.length,
      };
    });
  }, [groups, allPersons, tasks]);

  const adminGatherings = useMemo<AdminGatheringItem[]>(() => {
    return gatherings
      .filter((gathering) => {
        const group = getGroupById(gathering.groupId);
        // Exclude Husfellesskap from Admin -> Arrangementer list
        return group?.category !== "husgruppe";
      })
      .map((gathering) => {
        validateGathering(gathering);
        const group = getGroupById(gathering.groupId);
        const gatheringTasks = tasks.filter((t) => t.gatheringId === gathering.id);
        const staffing = getStaffingStatus(gatheringTasks, assignments);

        // Detailed counts for admin gathering overview
        const totalTasks = gatheringTasks.length;
        let coveredTasksCount = 0;
        let missingStaffingCount = 0;

        const tasksWithStaffing = gatheringTasks.map((task) => {
          const taskAssignments = assignments.filter((a) => a.taskId === task.id);
          const taskStaffing = calculateTaskStaffingStatus(task, taskAssignments);
          if (taskStaffing.isFullyCovered) {
            coveredTasksCount++;
          } else {
            missingStaffingCount += taskStaffing.missingCount;
          }
          return {
            task,
            taskStaffing,
          };
        });

        return {
          gathering,
          group,
          tasks: gatheringTasks,
          tasksWithStaffing,
          totalTasks,
          coveredTasksCount,
          missingStaffingCount,
          staffing,
        };
      });
  }, [gatherings, tasks, assignments, getGroupById]);

  const adminTasks = useMemo<AdminTaskItem[]>(() => {
    return tasks.map((task) => {
      const gathering = getGatheringById(task.gatheringId);
      const group = task.groupId ? getGroupById(task.groupId) : undefined;
      const taskAssignments = assignments.filter((a) => a.taskId === task.id);
      const taskStaffing = calculateTaskStaffingStatus(task, taskAssignments);
      const slots = countSlots(task, taskAssignments);

      return {
        task,
        gathering,
        group,
        assignedPersonsList: describeAssignments(taskAssignments, getPersonById),
        neededCount: slots.needed,
        confirmedCount: slots.confirmed,
        pendingCount: slots.pending,
        availableSpots: slots.free,
        isFullyCovered: taskStaffing.isFullyCovered,
        missingCount: taskStaffing.missingCount,
        taskStaffing,
      };
    });
  }, [tasks, assignments, getGatheringById, getGroupById, getPersonById]);

  const adminVolunteerRoles = useMemo(() => {
    return [...volunteerRoles].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "nb")
    );
  }, [volunteerRoles]);

  return {
    isAdmin,
    currentUser,
    signOut,
    allPersons,
    adminPersons,
    adminVolunteerRoles,
    adminGroups,
    adminGatherings,
    adminTasks,
    updateGroupName,
    updateGroup,
    createGroup,
    addPerson,
    updatePerson,
    createGathering,
    updateGathering,
    deleteGathering,
    createTask,
    updateTask,
    assignTaskToPerson,
    createVolunteerRole,
    updateVolunteerRole,
    deleteVolunteerRole,
    tasks,
  };
}

// 11. Hook: useAdminGroupDetail
export function useAdminGroupDetail(groupId: string) {
  const {
    currentUser,
    allPersons,
    gatherings,
    tasks,
    assignments,
    getGroupById,
    updateGroup,
    addGroupMember,
    removeGroupMember,
  } = useFirebase();

  const isAdmin = currentUser.globalRole === "admin";
  const group = getGroupById(groupId);

  const leaders = useMemo(() => {
    if (!group) return [];
    return allPersons.filter((p) => group.leaderIds.includes(p.id));
  }, [group, allPersons]);

  const deputyLeaders = useMemo(() => {
    if (!group) return [];
    return allPersons.filter((p) => group.deputyLeaderIds?.includes(p.id));
  }, [group, allPersons]);

  const members = useMemo(() => {
    if (!group) return [];
    return allPersons.filter((p) => group.memberIds.includes(p.id));
  }, [group, allPersons]);

  const availablePersonsToAdd = useMemo(() => {
    if (!group) return [];
    return allPersons.filter((p) => !group.memberIds.includes(p.id));
  }, [group, allPersons]);

  const groupGatherings = useMemo(() => {
    if (!group) return [];
    return gatherings
      .filter((g) => g.groupId === group.id)
      .map((gathering) => {
        const gatheringTasks = tasks.filter((t) => t.gatheringId === gathering.id);
        const staffing = getStaffingStatus(gatheringTasks, assignments);
        return {
          gathering,
          tasks: gatheringTasks,
          staffing,
        };
      });
  }, [group, gatherings, tasks, assignments]);

  return {
    isAdmin,
    currentUser,
    group,
    leaders,
    deputyLeaders,
    members,
    availablePersonsToAdd,
    allPersons,
    groupGatherings,
    updateGroup,
    addGroupMember,
    removeGroupMember,
  };
}

// 12. Hook: useAdminPersonDetail
export function useAdminPersonDetail(personId: string) {
  const {
    currentUser,
    allPersons,
    groups,
    tasks,
    assignments,
    getPersonById,
    updatePerson,
  } = useFirebase();

  const isAdmin = currentUser.globalRole === "admin";
  const person = getPersonById(personId);

  const personGroups = useMemo(() => {
    if (!person) return [];
    return groups.filter((g) => g.memberIds.includes(person.id));
  }, [person, groups]);

  const leaderInGroups = useMemo(() => {
    if (!person) return [];
    return groups.filter((g) => g.leaderIds.includes(person.id));
  }, [person, groups]);

  const deputyInGroups = useMemo(() => {
    if (!person) return [];
    return groups.filter((g) => g.deputyLeaderIds?.includes(person.id));
  }, [person, groups]);

  const personAssignments = useMemo(() => {
    if (!person) return [];
    return assignments.filter((a) => a.personId === person.id && a.response !== "withdrawn");
  }, [person, assignments]);

  const personTasks = useMemo(() => {
    if (!person) return [];
    const taskIds = personAssignments.map((a) => a.taskId);
    return tasks.filter((t) => taskIds.includes(t.id));
  }, [person, personAssignments, tasks]);

  return {
    isAdmin,
    currentUser,
    person,
    personGroups,
    leaderInGroups,
    deputyInGroups,
    personTasks,
    allPersons,
    updatePerson,
  };
}

// 13. Hook: useAdminTaskDetail
export function useAdminTaskDetail(taskId: string) {
  const {
    currentUser,
    getTaskById,
    getGatheringById,
    getGroupById,
    getAllAssignmentsForTask,
    getPersonById,
    updateTaskInstruction,
    updateTaskNeededCount,
  } = useFirebase();

  const isAdmin = currentUser.globalRole === "admin";
  const task = (taskId && getTaskById(taskId)) || null;
  const gathering = (task && getGatheringById(task.gatheringId)) || null;
  const group = (task?.groupId && getGroupById(task.groupId)) || null;

  const taskAssignments = useMemo(
    () => (task ? getAllAssignmentsForTask(task.id) : []),
    [task, getAllAssignmentsForTask]
  );
  const allAssignedPersonsWithStatus = useMemo(
    () => describeAssignments(taskAssignments, getPersonById),
    [taskAssignments, getPersonById]
  );
  const taskStaffing = useMemo(
    () => (task ? calculateTaskStaffingStatus(task, taskAssignments) : null),
    [task, taskAssignments]
  );

  const handleUpdateInstruction = useCallback(
    (instruction: string) => {
      if (!task) return { success: false, error: "Ingen oppgave valgt." };
      return updateTaskInstruction(task.id, instruction);
    },
    [task, updateTaskInstruction]
  );

  const handleUpdateNeededCount = useCallback(
    (neededCount: number | undefined) => {
      if (!task) return { success: false, error: "Ingen oppgave valgt." };
      return updateTaskNeededCount(task.id, neededCount);
    },
    [task, updateTaskNeededCount]
  );

  return {
    isAdmin,
    currentUser,
    task,
    gathering,
    group,
    allAssignedPersonsWithStatus,
    confirmedCount: taskStaffing?.confirmedCount ?? 0,
    isFullyCovered: taskStaffing?.isFullyCovered ?? false,
    missingCount: taskStaffing?.missingCount ?? 0,
    updateTaskInstruction: handleUpdateInstruction,
    updateTaskNeededCount: handleUpdateNeededCount,
  };
}

const ANALYTICS_CLOCK_MS = 5 * 60 * 1000;

// 14. Hook: useAdminAnalytics
/**
 * Everything the analysis board shows for the chosen period, worked out from the
 * planning data and the website content. The numbers follow the live data.
 */
export function useAdminAnalytics(periodId: AnalyticsPeriodId) {
  const {
    allPersons,
    groups,
    gatherings,
    tasks,
    assignments,
    attendances,
    headcounts,
    groupMessages,
    volunteerRoles,
    registerHeadcount,
    removeHeadcount,
    currentUser,
    setAnalyticsModuleHidden,
    showAllAnalyticsModules,
  } = useFirebase();
  const { pages, news, sermons, addons, settings } = useCms();
  const websiteVisits = visitCounting(addons, settings);

  // The tab stays mounted once visited, so the clock is moved on every few minutes:
  // a service that has just ended then shows up as missing a count without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), ANALYTICS_CLOCK_MS);
    return () => clearInterval(timer);
  }, [periodId]);

  const analytics = useMemo(
    () =>
      buildChurchAnalytics(
        {
          persons: allPersons,
          groups,
          gatherings,
          tasks,
          assignments,
          attendances,
          headcounts,
          messages: groupMessages,
          volunteerRoles,
          pages,
          news,
          sermons,
          websiteVisits,
        },
        periodId,
        now
      ),
    [allPersons, groups, gatherings, tasks, assignments, attendances, headcounts, groupMessages, volunteerRoles, pages, news, sermons, websiteVisits, periodId, now]
  );

  return {
    analytics,
    /** Whether the website counts its visits, for what the board says about them. */
    websiteVisits,
    registerHeadcount,
    removeHeadcount,
    /** The modules the person using the board has hidden. */
    hiddenModules: currentUser.analyticsHiddenModules ?? [],
    /** A choice can only be saved on a person who is in the register. */
    canCustomize: allPersons.some((p) => p.id === currentUser.id),
    setModuleHidden: setAnalyticsModuleHidden,
    showAllModules: showAllAnalyticsModules,
  };
}
