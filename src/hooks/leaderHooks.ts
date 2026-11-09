import { useMemo, useCallback } from "react";
import { useFirebase } from "../context/FirebaseDataContext";
import { Group, ProgramItem } from "../types";
import { calculateTaskStaffingStatus, describeAssignments, getStaffingStatus } from "../utils/staffing";
import { isInGroup, leadsGroup, allGroupPersonIds } from "../utils/groups";

// 14. Hook: useLeaderGroupDetail
export function useLeaderGroupDetail(groupId: string) {
  const {
    currentUser,
    allPersons,
    hasFullRegister,
    getPersonById,
    gatherings,
    tasks,
    assignments,
    getGroupById,
    updateGroup,
    addGroupMember,
    removeGroupMember,
    getGroupMessages,
    sendGroupMessage,
    assignTaskToPerson,
    updateAssignmentStatus,
    removeAssignment,
  } = useFirebase();

  const group = getGroupById(groupId);

  // Access checks:
  const isLeader = Boolean(group && group.leaderIds.includes(currentUser.id));
  const isDeputy = Boolean(group && group.deputyLeaderIds?.includes(currentUser.id));
  const isAdmin = currentUser.globalRole === "admin";
  const hasLeaderAccess = Boolean(group && (isLeader || isDeputy || isAdmin));
  const isMember = Boolean(group && (isInGroup(group, currentUser.id) || isAdmin));
  const hasAccess = Boolean(group && (isMember || hasLeaderAccess));

  const peopleOf = (ids: readonly string[]) => (hasFullRegister
    ? allPersons.filter((person) => ids.includes(person.id))
    : ids.flatMap((id) => getPersonById(id) ?? []));

  const leaders = useMemo(() => {
    if (!group) return [];
    return peopleOf(group.leaderIds);
  }, [group, allPersons, hasFullRegister, getPersonById]);

  const deputyLeaders = useMemo(() => {
    if (!group) return [];
    return peopleOf(group.deputyLeaderIds ?? []);
  }, [group, allPersons, hasFullRegister, getPersonById]);

  const members = useMemo(() => {
    if (!group) return [];
    return hasFullRegister ? allPersons.filter((person) => isInGroup(group, person.id)) : peopleOf(allGroupPersonIds(group));
  }, [group, allPersons, hasFullRegister, getPersonById]);

  const availablePersonsToAdd = useMemo(() => {
    if (!group || currentUser.globalRole !== "admin") return [];
    return allPersons.filter((p) => !isInGroup(group, p.id));
  }, [group, allPersons, currentUser.globalRole]);

  const groupGatherings = useMemo(() => {
    if (!group) return [];
    
    // Find all gatherings assigned to this group or where this group has tasks
    const groupTasks = tasks.filter((t) => t.groupId === group.id);
    const relevantGatheringIds = new Set([
      ...gatherings.filter((g) => g.groupId === group.id).map((g) => g.id),
      ...groupTasks.map((t) => t.gatheringId),
    ]);

    return gatherings
      .filter((g) => relevantGatheringIds.has(g.id))
      .map((gathering) => {
        const gatheringTasks = groupTasks.filter((t) => t.gatheringId === gathering.id);
        const staffing = getStaffingStatus(gatheringTasks, assignments);

        // Detailed task items with assignments
        const taskItems = gatheringTasks.map((task) => {
          const taskAssignments = assignments.filter((a) => a.taskId === task.id);
          const assignedPersons = describeAssignments(taskAssignments, getPersonById);

          const taskStaffing = calculateTaskStaffingStatus(task, taskAssignments);
          const confirmedCount = taskStaffing.confirmedCount;
          const neededCount = taskStaffing.neededCount;
          const isFullyCovered = taskStaffing.isFullyCovered;
          const hasForfall = taskStaffing.hasForfall;

          return {
            task,
            assignedPersons,
            confirmedCount,
            neededCount,
            isFullyCovered,
            hasForfall,
            taskStaffing,
          };
        });

        // Compute total needed and confirmed count for gathering
        const totalNeeded = taskItems.reduce((acc, t) => acc + (t.neededCount || 1), 0);
        const totalConfirmed = taskItems.reduce((acc, t) => acc + t.confirmedCount, 0);
        const hasForfall = taskItems.some((t) => t.hasForfall);
        const isFullyCovered = totalNeeded > 0 && totalConfirmed >= totalNeeded && !hasForfall;

        return {
          gathering,
          tasks: gatheringTasks,
          taskItems,
          totalNeeded,
          totalConfirmed,
          hasForfall,
          isFullyCovered,
          staffing,
        };
      })
      .sort((a, b) => new Date(a.gathering.startsAt).getTime() - new Date(b.gathering.startsAt).getTime());
  }, [group, gatherings, tasks, assignments, getPersonById]);

  const messages = useMemo(() => {
    if (!group) return [];
    return getGroupMessages(group.id);
  }, [group, getGroupMessages]);

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!group) return { success: false, error: "Ingen gruppe valgt." };
      return sendGroupMessage(group.id, content);
    },
    [group, sendGroupMessage]
  );

  return {
    hasAccess,
    isMember,
    hasLeaderAccess,
    isLeader,
    isDeputy,
    isAdmin,
    currentUser,
    group,
    leaders,
    deputyLeaders,
    members,
    availablePersonsToAdd,
    allPersons,
    groupGatherings,
    messages,
    updateGroup,
    addGroupMember,
    removeGroupMember,
    sendMessage: handleSendMessage,
    assignTaskToPerson,
    updateAssignmentStatus,
    removeAssignment,
  };
}

// One shared empty list, so a gathering without a programme does not look changed on every render
const NO_PROGRAM: ProgramItem[] = [];

// 15. Hook: useLeaderGatheringDetail
export function useLeaderGatheringDetail(gatheringId: string) {
  const {
    currentUser,
    gatherings,
    groups,
    tasks,
    assignments,
    allPersons,
    hasFullRegister,
    getGatheringById,
    getGroupById,
    getPersonById,
    assignTaskToPerson,
    updateAssignmentStatus,
    removeAssignment,
    reportAbsence: performReportAbsence,
    updateTaskNeededCount,
    updateTaskInstruction,
    updateTask,
    createTask,
    deleteTask,
    updateGathering,
    volunteerRoles,
  } = useFirebase();

  const gathering = useMemo(() => {
    if (!gatheringId) return null;
    return getGatheringById(gatheringId) || null;
  }, [gatheringId, getGatheringById, gatherings]);

  // All tasks for this gathering
  const gatheringTasks = useMemo(() => {
    if (!gathering) return [];
    return tasks.filter((t) => t.gatheringId === gathering.id);
  }, [gathering, tasks]);

  // Find all groups involved in this gathering
  const involvedGroupIds = useMemo(() => {
    const ids = new Set<string>();
    if (gathering) {
      ids.add(gathering.groupId);
    }
    gatheringTasks.forEach((t) => {
      if (t.groupId) ids.add(t.groupId);
    });
    return Array.from(ids);
  }, [gathering, gatheringTasks]);

  const involvedGroups = useMemo(() => {
    return involvedGroupIds.map((id) => getGroupById(id)).filter(Boolean) as Group[];
  }, [involvedGroupIds, getGroupById]);

  // Every involved group the user leads or is deputy leader of. Their tasks are the user's to follow up.
  const myGroups = useMemo(
    () => involvedGroups.filter((g) => leadsGroup(g, currentUser.id)),
    [involvedGroups, currentUser]
  );
  const userLedGroup = myGroups[0] ?? null;

  const group = useMemo(() => {
    if (userLedGroup) return userLedGroup;
    if (gathering) return getGroupById(gathering.groupId) || null;
    return null;
  }, [userLedGroup, gathering, getGroupById]);

  const isLeader = Boolean(
    (group && group.leaderIds.includes(currentUser.id)) ||
    involvedGroups.some((g) => g.leaderIds.includes(currentUser.id))
  );
  const isDeputy = Boolean(
    (group && group.deputyLeaderIds?.includes(currentUser.id)) ||
    involvedGroups.some((g) => g.deputyLeaderIds?.includes(currentUser.id))
  );
  const isAdmin = currentUser.globalRole === "admin";
  const hasAccess = Boolean(isAdmin || isLeader || isDeputy);

  // Every gathering the user can open, by the same rule as hasAccess: the gathering's own group, or a group
  // with a task on it, is led by the user. An admin opens them all. Used by the arrows on the gathering page.
  const openableGatherings = useMemo(() => {
    if (isAdmin) return gatherings;
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const groupIdsOf = new Map<string, Set<string>>();
    for (const task of tasks) {
      if (!task.gatheringId || !task.groupId) continue;
      const ids = groupIdsOf.get(task.gatheringId) ?? new Set<string>();
      ids.add(task.groupId);
      groupIdsOf.set(task.gatheringId, ids);
    }
    return gatherings.filter((g) => {
      const ids = [g.groupId, ...(groupIdsOf.get(g.id) ?? [])];
      return ids.some((id) => {
        const group = groupById.get(id);
        return Boolean(group && leadsGroup(group, currentUser.id));
      });
    });
  }, [isAdmin, gatherings, groups, tasks, currentUser.id]);

  // The people in a group, for a leader to assign from
  const membersOf = useCallback(
    (g: Group) =>
      hasFullRegister
        ? allPersons.filter((p) => isInGroup(g, p.id))
        : allGroupPersonIds(g).flatMap((id) => getPersonById(id) ?? []),
    [allPersons, hasFullRegister, getPersonById]
  );
  const groupMembers = useMemo(() => {
    if (!group) return hasFullRegister ? allPersons : [];
    return membersOf(group);
  }, [group, allPersons, hasFullRegister, membersOf]);

  const tasksWithDetails = useMemo(() => {
    if (!gathering) return [];

    return gatheringTasks.map((task) => {
      const taskGroup = task.groupId ? getGroupById(task.groupId) : undefined;
      const taskAssignments = assignments.filter((a) => a.taskId === task.id);
      const assignedPersons = describeAssignments(taskAssignments, getPersonById);

      const taskStaffing = calculateTaskStaffingStatus(task, taskAssignments);
      const confirmedPersonsCount = taskStaffing.confirmedCount;
      const neededCount = taskStaffing.neededCount;
      const isFullyCovered = taskStaffing.isFullyCovered;
      const hasWithdrawn = taskStaffing.hasForfall;
      const missingCount = taskStaffing.missingCount;
      const isMyGroup = Boolean(task.groupId && myGroups.some((g) => g.id === task.groupId));
      const staffingStatusLabel = taskStaffing.statusText;

      return {
        task,
        taskGroup,
        isMyGroup,
        neededCount,
        assignedPersons,
        confirmedPersonsCount,
        isFullyCovered,
        missingCount,
        hasWithdrawn,
        staffingStatusLabel,
        taskStaffing,
      };
    });
  }, [gathering, gatheringTasks, assignments, getPersonById, getGroupById, myGroups]);

  // The programme registered on the gathering. A gathering without one has none; nothing is made up for it.
  const programSchedule = gathering?.programSchedule ?? NO_PROGRAM;

  return {
    hasAccess,
    isLeader,
    isDeputy,
    isAdmin,
    currentUser,
    gathering,
    group,
    myGroups,
    involvedGroups,
    groupMembers,
    membersOf,
    allPersons,
    tasksWithDetails,
    programSchedule,
    assignTaskToPerson,
    updateAssignmentStatus,
    removeAssignment,
    reportAbsence: performReportAbsence,
    updateTaskNeededCount,
    updateTaskInstruction,
    updateTask,
    createTask,
    deleteTask,
    allGroups: groups,
    updateGathering,
    volunteerRoles,
    gatheringTasks,
    openableGatherings,
  };
}
