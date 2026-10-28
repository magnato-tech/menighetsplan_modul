import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, useMyTasks } from "../../hooks/memberHooks";
import { formatNorwegianDateTime } from "../../utils/dates";
import { countSlots } from "../../utils/staffing";
import { useFirebase } from "../../context/FirebaseDataContext";
import { Task, GroupMessage, Gathering, Group } from "../../types";
import { AttentionItem } from "./attention";
import { asksForAnswerNow, nextGatheringOf } from "../../utils/meetingPlan";
import { useTimedMessage } from "../../hooks/useTimedMessage";
import { useMySemesterPlans } from "../../hooks/useSemesterPlans";

/**
 * Everything Min side shows, worked out from the planning data: what needs the
 * user's attention, their groups, and what comes next for them and for the congregation.
 */
export function useMyPage() {
  const { currentUser } = useCurrentUser();
  const allMyTasks = useMyTasks();
  const {
    tasks,
    assignments,
    gatherings,
    getUserGroups,
    getGroupMessages,
    getPersonAttendance,
    respondToGathering,
    assignTaskToPerson,
    updateAssignmentStatus,
    getGatheringsForGroup,
    getGatheringById,
    getGroupById,
    getTaskById,
    getAllAssignmentsForTask,
    volunteerRoles,
  } = useFirebase();

  const navigate = useNavigate();
  // The semester plans open for the user: one waiting is shown first, one gone through as a link
  const { mine: semesterPlans } = useMySemesterPlans();
  const [feedbackMessage, showFeedbackMessage, clearFeedbackMessage] = useTimedMessage<{ text: string; type: "success" | "info" }>(4000);

  const showToast = (text: string, type: "success" | "info" = "success") => showFeedbackMessage({ text, type });

  // What counts as upcoming is settled once, when the page opens
  const now = useMemo(() => Date.now(), []);
  const isUpcoming = (startsAt: string | undefined) => startsAt !== undefined && new Date(startsAt).getTime() >= now;

  // 1. User's groups
  const myGroups = useMemo(
    () => getUserGroups(currentUser.id),
    [getUserGroups, currentUser.id]
  );

  const myGroupIds = useMemo(() => myGroups.map((g) => g.id), [myGroups]);

  const hasServiceGroupMembership = useMemo(
    () => myGroups.some((group) => (group.category ?? "tjenestegruppe") === "tjenestegruppe"),
    [myGroups]
  );

  // The tasks the user has said yes to and that still lie ahead, the nearest first
  const myTasks = useMemo(() => {
    const startOf = (task: Task) => getGatheringById(task.gatheringId)?.startsAt;
    return allMyTasks
      .filter((task) => isUpcoming(startOf(task)))
      .sort((a, b) => new Date(startOf(a)!).getTime() - new Date(startOf(b)!).getTime());
  }, [allMyTasks, getGatheringById, now]);

  // =========================================================================
  // 1. TRENGER DIN OPPMERKSOMHET
  // Vises BARE dersom brukeren faktisk har noe å gjøre (ingen tom 0-boks)
  // =========================================================================
  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = [];
    // The role a task is for, by name: what the list is narrowed by
    const roleOf = (task: Task) => volunteerRoles.find((role) => role.id === task.volunteerRoleId)?.name;

    // A) Forespørsler fra en leder som brukeren ikke har svart på
    assignments
      .filter((a) => a.personId === currentUser.id && a.response === "pending")
      .forEach((assignment) => {
        const task = getTaskById(assignment.taskId);
        const gathering = task ? getGatheringById(task.gatheringId) : undefined;
        if (!task || task.status === "cancelled" || !isUpcoming(gathering?.startsAt)) return;
        items.push({
          type: "task_request",
          id: `request-${assignment.id}`,
          assignmentId: assignment.id,
          title: task.title,
          role: roleOf(task),
          taskDescription: task.description,
          startsAt: gathering?.startsAt || "",
          location: gathering?.location || gathering?.title,
          groupName: task.groupId ? getGroupById(task.groupId)?.name || "" : "",
        });
      });

    // B) Ubesvarte innkallinger til kommende samlinger i brukerens grupper
    myGroups.forEach((group) => {
      const ofGroup = getGatheringsForGroup(group.id);
      const next = nextGatheringOf(ofGroup);
      ofGroup.forEach((gathering) => {
        const invited = gathering.invitationSent || gathering.invitationSentAt;
        if (!invited || !isUpcoming(gathering.startsAt)) return;
        // A whole season planned at once asks about the next gathering only
        if (!asksForAnswerNow(gathering, next)) return;
        if (getPersonAttendance(gathering.id, currentUser.id)) return;
        items.push({
          type: "unanswered_invitation",
          id: `inv-${gathering.id}`,
          gatheringId: gathering.id,
          groupName: group.name,
          title: gathering.title,
          startsAt: gathering.startsAt,
          location: gathering.location,
          theme: gathering.theme,
        });
      });
    });

    // C) Oppgaver med ledig plass i gruppene brukeren er med i
    const myGroupSet = new Set(myGroupIds);
    tasks
      .filter((task) => task.groupId && myGroupSet.has(task.groupId) && task.status !== "cancelled")
      .forEach((task) => {
        const taskAssignments = getAllAssignmentsForTask(task.id);
        // Leave out a task the user is already on, has been asked about (shown above) or has said no to
        if (taskAssignments.some((a) => a.personId === currentUser.id)) return;
        if (countSlots(task, taskAssignments).free === 0) return;

        const gathering = getGatheringById(task.gatheringId);
        if (gathering && !isUpcoming(gathering.startsAt)) return;

        items.push({
          type: "open_task",
          id: `attention-task-${task.id}`,
          taskId: task.id,
          title: task.title,
          role: roleOf(task),
          taskDescription: task.description,
          startsAt: gathering?.startsAt || "",
          location: gathering?.location || gathering?.title,
          groupName: task.groupId ? getGroupById(task.groupId)?.name || "" : "",
          needsSubstitute: task.status === "vacant",
        });
      });

    // What was asked of the user personally comes first; within each kind, the nearest date first
    const kindOrder = { task_request: 0, unanswered_invitation: 1, open_task: 2 };
    const startOf = (item: AttentionItem) => (item.startsAt ? new Date(item.startsAt).getTime() : Infinity);
    return items.sort((a, b) => kindOrder[a.type] - kindOrder[b.type] || startOf(a) - startOf(b));
  }, [
    myGroups,
    myGroupIds,
    tasks,
    assignments,
    getGatheringsForGroup,
    getPersonAttendance,
    getGatheringById,
    getGroupById,
    getTaskById,
    getAllAssignmentsForTask,
    volunteerRoles,
    currentUser.id,
    now,
  ]);

  // The user's answer to an attention card: yes (take it, come, accept) or no
  const handleAttentionAnswer = (item: AttentionItem, yes: boolean) => {
    const answer = () => {
      switch (item.type) {
        case "task_request":
          return {
            result: updateAssignmentStatus(item.assignmentId, yes ? "confirmed" : "declined"),
            thanks: yes ? "Takk! Oppgaven er din." : "Takk for beskjed. Lederen ser at du ikke kan.",
          };
        case "unanswered_invitation":
          return {
            result: respondToGathering(item.gatheringId, currentUser.id, yes ? "attending" : "declined"),
            thanks: yes
              ? "Takk for svar! Du er registrert som KOMMER."
              : "Takk for beskjed. Du er registrert som KOMMER IKKE.",
          };
        case "open_task":
          // Taking a task oneself is a yes, so it is confirmed at once
          return {
            result: assignTaskToPerson(item.taskId, currentUser.id, "confirmed"),
            thanks: "Takk! Du har tatt oppgaven.",
          };
      }
    };
    const { result, thanks } = answer();
    if (result.success) showToast(thanks, "success");
    else showToast(result.error || "Kunne ikke lagre svaret.", "info");
  };

  // =========================================================================
  // 2. NESTE I MENIGHETEN
  // Neste gudstjeneste / arrangement som gjelder hele menigheten (fremtidig dato)
  // =========================================================================
  const nextChurchEvent = useMemo(() => {
    // Finn alle fremtidige fellesarrangementer/gudstjenester
    const churchEvents = gatherings.filter((g) => {
      const isChurchWide =
        g.type === "arrangement" ||
        g.title.toLowerCase().includes("gudstjeneste") ||
        g.title.toLowerCase().includes("storsamling") ||
        g.title.toLowerCase().includes("fest") ||
        g.location?.toLowerCase().includes("hovedsalen");
      return isUpcoming(g.startsAt) && isChurchWide;
    });

    if (churchEvents.length === 0) return null;

    // Sorter kronologisk
    const sorted = [...churchEvents].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );

    return sorted[0];
  }, [gatherings, now]);

  // Check if current user has a task in the next church event
  const myTaskInChurchEvent = useMemo(() => {
    if (!nextChurchEvent) return null;
    return myTasks.find((t) => t.gatheringId === nextChurchEvent.id);
  }, [nextChurchEvent, myTasks]);

  // =========================================================================
  // 3. NESTE FOR DEG
  // Brukerens neste relevante aktivitet (f.eks. husfellesskap eller tjenesteaktivitet)
  // Skiller seg fra «Neste i menigheten» når dataene tilsier det.
  // =========================================================================
  const nextPersonalGatheringData = useMemo(() => {
    const userGatherings: Array<{
      gathering: Gathering;
      group: Group;
      attendance?: ReturnType<typeof getPersonAttendance>;
      userTask?: Task;
      isDistinctFromChurchWide: boolean;
    }> = [];

    myGroups.forEach((group) => {
      const gList = getGatheringsForGroup(group.id);
      gList.forEach((gathering) => {
        // Kun fremtidige samlinger
        if (isUpcoming(gathering.startsAt)) {
          const att = getPersonAttendance(gathering.id, currentUser.id);
          const task = myTasks.find((t) => t.gatheringId === gathering.id);
          const isDistinct = nextChurchEvent ? gathering.id !== nextChurchEvent.id : true;
          userGatherings.push({
            gathering,
            group,
            attendance: att,
            userTask: task,
            isDistinctFromChurchWide: isDistinct,
          });
        }
      });
    });

    if (userGatherings.length === 0) return null;

    // Sorter kronologisk
    userGatherings.sort(
      (a, b) =>
        new Date(a.gathering.startsAt).getTime() -
        new Date(b.gathering.startsAt).getTime()
    );

    // Prioriter en samling som er ulik «Neste i menigheten» (f.eks. husfellesskap eller tjenestemøte)
    const distinctPersonal = userGatherings.find((item) => item.isDistinctFromChurchWide);
    return distinctPersonal || userGatherings[0];
  }, [myGroups, getGatheringsForGroup, getPersonAttendance, currentUser.id, myTasks, now, nextChurchEvent]);

  // Helper to get next activity / meeting time for a group
  const getGroupNextActivity = (group: Group): string | null => {
    if (group.meetingSchedule) {
      return `${group.meetingSchedule.weekday} kl. ${group.meetingSchedule.time}`;
    }
    const upcoming = getGatheringsForGroup(group.id).find((g) => isUpcoming(g.startsAt));
    if (upcoming) {
      return formatNorwegianDateTime(upcoming.startsAt);
    }
    return null;
  };

  // Helper to get the latest chat message for a group
  const getGroupLatestMessage = (groupId: string): GroupMessage | null => {
    const msgs = getGroupMessages(groupId);
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  };

  // Navigation helper to open specific group chat
  const handleOpenGroupChat = (group: Group) => {
    if (group.category === "husgruppe") {
      navigate(`/husfellesskap/${group.id}?tab=chat`);
    } else {
      navigate(`/gruppe/${group.id}?tab=chat`);
    }
  };

  // Navigation helper to open group room
  const handleOpenGroupRoom = (group: Group) => {
    if (group.category === "husgruppe") {
      navigate(`/husfellesskap/${group.id}`);
    } else {
      navigate(`/gruppe/${group.id}`);
    }
  };

  return {
    currentUser,
    myTasks,
    semesterPlans,
    feedbackMessage,
    clearFeedbackMessage,
    myGroups,
    hasServiceGroupMembership,
    attentionItems,
    handleAttentionAnswer,
    nextChurchEvent,
    myTaskInChurchEvent,
    nextPersonalGatheringData,
    getGroupNextActivity,
    getGroupLatestMessage,
    handleOpenGroupChat,
    handleOpenGroupRoom,
    getGatheringById,
  };
}

export type MyPageModel = ReturnType<typeof useMyPage>;
