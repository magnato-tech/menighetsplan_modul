import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import {
  Person,
  Group,
  Gathering,
  Task,
  Assignment,
  GroupMessage,
  GatheringAttendance,
  GatheringHeadcount,
  VolunteerRole,
} from "../types";
import { CMS_COLLECTIONS, COLLECTIONS } from "../data/collections";
import {
  NewPersonInput,
  NewGroupInput,
  NewGatheringInput,
  NewTaskInput,
  NewVolunteerRoleInput,
  buildPerson,
  buildGroup,
  buildGathering,
  buildTask,
  buildAssignment,
  buildAttendance,
  buildHeadcount,
  buildGroupMessage,
  buildVolunteerRole,
} from "../data/newDocuments";
import { testConnection } from "../firebase";
import { subscribeVolunteerRoles } from "../services/volunteerRoles";
import { deleteHeadcount, saveHeadcount, subscribeHeadcounts } from "../services/headcounts";
import { reportWriteError } from "../services/writeErrors";
import {
  subscribeCollection,
  createDocument,
  updateDocument,
  deleteDocument,
  addGroupMember,
  removeGroupMember,
  setGroupNotifications,
  saveAssignmentChange,
  setAnalyticsModuleHidden as storeAnalyticsModuleHidden,
} from "../services/firestore";
import { signOut as signOutOfAccount, subscribeAccount } from "../services/auth";
import { isInGroup } from "../utils/groups";
import { sessionOf, standInSession, type AccountState, type Session } from "../utils/session";
import type { HeadcountInput } from "../utils/headcount";
import { AssignmentChange, applyAssignmentChange, holdsSlot, isAcuteForfall, taskStatusFor } from "../utils/staffing";

export interface ModuleConfig {
  kalender: "on" | "off";
  meldinger: "on" | "off";
}

/**
 * What an action answers. `success` means the change was accepted and is on its way to
 * the database, not that the server has stored it. See `save` below.
 */
export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface FirebaseDataContextType {
  // State
  isFirestoreConnected: boolean;
  /** Who is using the app: signed out, signed in without being in the register, or a person in it (see utils/session.ts). */
  session: Session;
  /**
   * The person using the app. It is someone only while `session` is a member, which it always is
   * on the pages behind sign-in (see SessionGate). Elsewhere it is nobody: no name, no id, and
   * no role beyond a member's.
   */
  currentUser: Person;
  signOut: () => Promise<void>;
  /** On a developer's own machine only: go in as a person without signing in. Absent in the published app. */
  standInAs?: (personId: string) => void;
  allPersons: Person[];
  groups: Group[];
  gatherings: Gathering[];
  tasks: Task[];
  assignments: Assignment[];
  groupMessages: GroupMessage[];
  attendances: GatheringAttendance[];
  /** Oppmøtetall: how many were actually there. Internal, like the responses. */
  headcounts: GatheringHeadcount[];
  volunteerRoles: VolunteerRole[];

  // Module configuration
  moduleConfig: ModuleConfig;
  setModuleStatus: (moduleName: keyof ModuleConfig, status: "on" | "off") => void;
  toggleKalender: () => void;
  toggleMeldinger: () => void;

  // Lookups in the data above
  /** The tasks the person has said yes to. */
  getTasksForPerson: (personId: string) => Task[];
  getTaskById: (taskId: string) => Task | undefined;
  getGatheringById: (gatheringId: string) => Gathering | undefined;
  getGroupById: (groupId: string) => Group | undefined;
  getPersonById: (personId: string) => Person | undefined;
  getAllAssignmentsForTask: (taskId: string) => Assignment[];
  getUserGroups: (personId: string) => Group[];
  isPersonInGroup: (personId: string, groupId: string) => boolean;
  getGroupMessages: (groupId: string) => GroupMessage[];
  getGatheringAttendances: (gatheringId: string) => GatheringAttendance[];
  getPersonAttendance: (gatheringId: string, personId: string) => GatheringAttendance | undefined;
  getUpcomingGatheringForGroup: (groupId: string) => Gathering | undefined;
  getGatheringsForGroup: (groupId: string) => Gathering[];
  getGroupNotificationsEnabled: (groupId: string, personId?: string) => boolean;

  // Actions
  createGathering: (data: NewGatheringInput) => ActionResult & { gathering?: Gathering };
  updateGathering: (gatheringId: string, updates: Partial<Gathering>) => ActionResult;
  deleteGathering: (gatheringId: string) => ActionResult;
  sendGatheringInvitation: (gatheringId: string) => ActionResult;
  // Who is on a task. Each of these also stores the task status that follows from the change.
  /** "confirmed" when the person has already said yes, "pending" to ask them. */
  assignTaskToPerson: (taskId: string, personId: string, response: "confirmed" | "pending") => ActionResult;
  /** The person pulls out of the task: a forfall if they had said yes, a no if they had only been asked. */
  reportAbsence: (taskId: string, personId: string, reason?: string) => ActionResult;
  updateAssignmentStatus: (assignmentId: string, response: Assignment["response"]) => ActionResult;
  removeAssignment: (assignmentId: string) => ActionResult;
  updateGroupName: (groupId: string, newName: string) => ActionResult;
  updateGroup: (groupId: string, updates: Partial<Group>) => ActionResult;
  createGroup: (data: NewGroupInput) => ActionResult & { group?: Group };
  addPerson: (data: NewPersonInput) => ActionResult & { person?: Person };
  updatePerson: (personId: string, updates: Partial<Person>) => ActionResult;
  addGroupMember: (groupId: string, personId: string) => ActionResult;
  removeGroupMember: (groupId: string, personId: string) => ActionResult;
  createTask: (data: NewTaskInput) => ActionResult & { task?: Task };
  deleteTask: (taskId: string) => ActionResult;
  updateTask: (taskId: string, updates: Partial<Task>) => ActionResult;
  updateTaskInstruction: (taskId: string, instruction: string) => ActionResult;
  updateTaskNeededCount: (taskId: string, neededCount: number | undefined) => ActionResult;
  sendGroupMessage: (groupId: string, content: string, imageUrl?: string) => ActionResult & { message?: GroupMessage };
  deleteGroupMessage: (messageId: string) => ActionResult;
  toggleGroupNotifications: (groupId: string, personId?: string, forceState?: boolean) => { success: boolean; enabled: boolean };
  respondToGathering: (gatheringId: string, personId: string, status: "attending" | "declined") => ActionResult;
  /** Stores how many were there. A new count for the same gathering replaces the old one. */
  registerHeadcount: (gatheringId: string, input: HeadcountInput) => ActionResult;
  removeHeadcount: (gatheringId: string) => ActionResult;
  /** Hides or shows a module on the analysis board, for the person using the app. */
  setAnalyticsModuleHidden: (moduleId: string, hidden: boolean) => ActionResult;
  showAllAnalyticsModules: () => ActionResult;
  createVolunteerRole: (data: NewVolunteerRoleInput) => ActionResult & { role?: VolunteerRole };
  updateVolunteerRole: (roleId: string, updates: Partial<VolunteerRole>) => ActionResult;
  deleteVolunteerRole: (roleId: string) => ActionResult;
}

export const FirebaseDataContext = createContext<FirebaseDataContextType | undefined>(undefined);

/**
 * Starts a write and lets it finish in the background. Firestore applies it locally at
 * once, so the snapshot listeners show the change without waiting for the server.
 * If the write fails, the user is told and the listeners put back what is actually stored.
 */
function save(action: string, write: () => Promise<unknown>): { success: true } {
  // Data Firestore cannot store makes it throw straight away instead of rejecting
  new Promise((resolve) => resolve(write())).catch((error) => reportWriteError(action, error));
  return { success: true };
}

const byStart = (a: Gathering, b: Gathering) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

interface FirebaseDataProviderProps {
  children: React.ReactNode;
  /**
   * False on the public website. Tasks, assignments, chat messages, responses and
   * headcounts are then never fetched, so a visitor's browser does not receive them.
   */
  internal?: boolean;
}

/** Stands where a person is asked for and nobody is signed in. */
const NOBODY: Person = { id: "", name: "", globalRole: "member" };

// A developer's own machine has no sign-in set up, so there a person from the register can be
// stood in for (see SignInPage). The published app is built without this: nobody gets in
// without signing in. The choice lasts for the browser tab.
const CAN_STAND_IN = import.meta.env.DEV;
const STAND_IN_KEY = "menighetsplan_utvikler_som";

function storedStandIn(): string | null {
  if (!CAN_STAND_IN) return null;
  try {
    return sessionStorage.getItem(STAND_IN_KEY);
  } catch {
    // Blocked storage only means the stand-in is not remembered when the page is loaded again
    return null;
  }
}

function storeStandIn(personId: string | null): void {
  try {
    if (personId === null) sessionStorage.removeItem(STAND_IN_KEY);
    else sessionStorage.setItem(STAND_IN_KEY, personId);
  } catch {
    // See storedStandIn
  }
}

export const FirebaseDataProvider: React.FC<FirebaseDataProviderProps> = ({ children, internal = true }) => {
  // Firestore is the only source of data. Everything is empty until the first snapshot
  // arrives, and no action changes these lists by hand: a write reaches them through
  // the listeners, so what is shown is always what the database client holds.
  const [persons, setPersons] = useState<Person[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [attendances, setAttendances] = useState<GatheringAttendance[]>([]);
  const [headcounts, setHeadcounts] = useState<GatheringHeadcount[]>([]);
  const [volunteerRoles, setVolunteerRoles] = useState<VolunteerRole[]>([]);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);
  const [accountState, setAccountState] = useState<AccountState>({ status: "loading" });
  // Whether the register has been received. Until then nobody can be said to be missing from it.
  const [registerReady, setRegisterReady] = useState(false);
  const [standInId, setStandInId] = useState<string | null>(storedStandIn);

  useEffect(() => subscribeAccount(setAccountState), []);

  const [moduleConfig, setModuleConfig] = useState<ModuleConfig>(() => {
    try {
      const saved = localStorage.getItem("menighetsplan_modules");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return { kalender: "on", meldinger: "on" };
  });

  // Check connection on mount
  useEffect(() => {
    let isMounted = true;
    testConnection().then((connected) => {
      if (isMounted) setIsFirestoreConnected(connected);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen in real-time to Firestore collections
  useEffect(() => {
    const unsubscribers = [
      subscribeCollection<Person>(COLLECTIONS.PERSONS, (list) => {
        setPersons(list);
        setRegisterReady(true);
      }),
      subscribeCollection<Group>(COLLECTIONS.GROUPS, setGroups),
      subscribeCollection<Gathering>(COLLECTIONS.GATHERINGS, setGatherings),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  // Who is using the app. The register decides who an account is; the stand-in is only on a developer's machine.
  const session = useMemo<Session>(() => {
    const real = sessionOf(accountState, persons, registerReady);
    if (real.status === "signedOut" && standInId !== null) return standInSession(standInId, persons, registerReady);
    return real;
  }, [accountState, persons, registerReady, standInId]);
  const isMember = session.status === "member";

  // Planning data, only behind the public website, and only for someone who is in the register
  useEffect(() => {
    if (!internal || !isMember) {
      // Nothing of it is kept in the browser of someone who has signed out, or on the public website
      setTasks([]);
      setAssignments([]);
      setGroupMessages([]);
      setAttendances([]);
      setHeadcounts([]);
      setVolunteerRoles([]);
      return;
    }
    const unsubscribers = [
      subscribeCollection<Task>(COLLECTIONS.TASKS, setTasks),
      subscribeCollection<Assignment>(COLLECTIONS.ASSIGNMENTS, setAssignments),
      subscribeCollection<GroupMessage>(COLLECTIONS.GROUP_MESSAGES, setGroupMessages),
      subscribeCollection<GatheringAttendance>(COLLECTIONS.GATHERING_ATTENDANCES, setAttendances),
      subscribeHeadcounts(setHeadcounts),
      subscribeVolunteerRoles(setVolunteerRoles),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [internal, isMember]);

  const currentUser = session.status === "member" ? session.person : NOBODY;

  const signOut = useCallback(async () => {
    storeStandIn(null);
    setStandInId(null);
    await signOutOfAccount();
  }, []);

  const standInAs = useMemo(
    () =>
      CAN_STAND_IN
        ? (personId: string) => {
            storeStandIn(personId);
            setStandInId(personId);
          }
        : undefined,
    []
  );

  const setModuleStatus = useCallback((moduleName: keyof ModuleConfig, status: "on" | "off") => {
    setModuleConfig((prev) => {
      const next = { ...prev, [moduleName]: status };
      try {
        localStorage.setItem("menighetsplan_modules", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleKalender = useCallback(() => {
    setModuleStatus("kalender", moduleConfig.kalender === "on" ? "off" : "on");
  }, [moduleConfig.kalender, setModuleStatus]);

  const toggleMeldinger = useCallback(() => {
    setModuleStatus("meldinger", moduleConfig.meldinger === "on" ? "off" : "on");
  }, [moduleConfig.meldinger, setModuleStatus]);

  // Lookups, grouped by the lists they read so each group is only rebuilt when its lists change
  const personLookups = useMemo(
    () => ({
      getPersonById: (personId: string) => persons.find((p) => p.id === personId),
    }),
    [persons]
  );

  const groupLookups = useMemo(
    () => ({
      getGroupById: (groupId: string) => groups.find((g) => g.id === groupId),
      getUserGroups: (personId: string) => groups.filter((g) => isInGroup(g, personId)),
      isPersonInGroup: (personId: string, groupId: string) => {
        const group = groups.find((g) => g.id === groupId);
        return group !== undefined && isInGroup(group, personId);
      },
      getGroupNotificationsEnabled: (groupId: string, personId: string = currentUser.id) => {
        const group = groups.find((g) => g.id === groupId);
        return group?.notificationPreferences?.[personId] !== false;
      },
    }),
    [groups, currentUser.id]
  );

  const gatheringLookups = useMemo(
    () => ({
      getGatheringById: (gatheringId: string) => gatherings.find((g) => g.id === gatheringId),
      getGatheringsForGroup: (groupId: string) => gatherings.filter((g) => g.groupId === groupId).sort(byStart),
      getUpcomingGatheringForGroup: (groupId: string): Gathering | undefined => {
        const now = new Date();
        return gatherings
          .filter((g) => g.groupId === groupId && !g.cancelled && new Date(g.startsAt) >= now)
          .sort(byStart)[0];
      },
    }),
    [gatherings]
  );

  const taskLookups = useMemo(
    () => ({
      getTaskById: (taskId: string) => tasks.find((t) => t.id === taskId),
      getTasksForPerson: (personId: string) => {
        const taskIds = assignments.filter((a) => a.personId === personId && a.response === "confirmed").map((a) => a.taskId);
        return tasks.filter((t) => taskIds.includes(t.id));
      },
      getAllAssignmentsForTask: (taskId: string) => assignments.filter((a) => a.taskId === taskId),
    }),
    [tasks, assignments]
  );

  const messageLookups = useMemo(
    () => ({
      getGroupMessages: (groupId: string) =>
        groupMessages
          .filter((m) => m.groupId === groupId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    }),
    [groupMessages]
  );

  const attendanceLookups = useMemo(
    () => ({
      getGatheringAttendances: (gatheringId: string) => attendances.filter((a) => a.gatheringId === gatheringId),
      getPersonAttendance: (gatheringId: string, personId: string) =>
        attendances.find((a) => a.gatheringId === gatheringId && a.personId === personId),
    }),
    [attendances]
  );

  // Actions that need nothing but their arguments
  const actions = useMemo(() => {
    const updateGroup = (groupId: string, updates: Partial<Group>, action = "lagre endringene i gruppen") =>
      save(action, () => updateDocument(COLLECTIONS.GROUPS, groupId, updates));

    return {
      createGathering: (data: NewGatheringInput) => {
        const gathering = buildGathering(data);
        return { ...save("lagre samlingen", () => createDocument(COLLECTIONS.GATHERINGS, gathering)), gathering };
      },
      updateGathering: (gatheringId: string, updates: Partial<Gathering>) =>
        save("lagre endringene i samlingen", () => updateDocument(COLLECTIONS.GATHERINGS, gatheringId, updates)),
      deleteGathering: (gatheringId: string) =>
        save("slette samlingen", () => deleteDocument(COLLECTIONS.GATHERINGS, gatheringId)),
      sendGatheringInvitation: (gatheringId: string) =>
        save("registrere at invitasjonen er sendt", () =>
          updateDocument(COLLECTIONS.GATHERINGS, gatheringId, {
            invitationSent: true,
            invitationSentAt: new Date().toISOString(),
          })
        ),

      createTask: (data: NewTaskInput) => {
        const task = buildTask(data);
        return { ...save("lagre oppgaven", () => createDocument(COLLECTIONS.TASKS, task)), task };
      },
      deleteTask: (taskId: string) => save("slette oppgaven", () => deleteDocument(COLLECTIONS.TASKS, taskId)),

      createGroup: (data: NewGroupInput) => {
        const group = buildGroup(data);
        return { ...save("lagre gruppen", () => createDocument(COLLECTIONS.GROUPS, group)), group };
      },
      updateGroup: (groupId: string, updates: Partial<Group>) => updateGroup(groupId, updates),
      updateGroupName: (groupId: string, newName: string) =>
        updateGroup(groupId, { name: newName.trim() }, "lagre gruppenavnet"),
      addGroupMember: (groupId: string, personId: string) =>
        save("legge til medlemmet i gruppen", () => addGroupMember(groupId, personId)),
      removeGroupMember: (groupId: string, personId: string) =>
        save("fjerne medlemmet fra gruppen", () => removeGroupMember(groupId, personId)),

      addPerson: (data: NewPersonInput) => {
        const person = buildPerson(data);
        return { ...save("lagre personen", () => createDocument(COLLECTIONS.PERSONS, person)), person };
      },
      updatePerson: (personId: string, updates: Partial<Person>) =>
        save("lagre endringene i personen", () => updateDocument(COLLECTIONS.PERSONS, personId, updates)),

      deleteGroupMessage: (messageId: string) =>
        save("slette meldingen", () => deleteDocument(COLLECTIONS.GROUP_MESSAGES, messageId)),

      respondToGathering: (gatheringId: string, personId: string, status: "attending" | "declined") => {
        const attendance = buildAttendance(gatheringId, personId, status);
        return save("lagre svaret", () => createDocument(COLLECTIONS.GATHERING_ATTENDANCES, attendance));
      },
      removeHeadcount: (gatheringId: string) => save("fjerne oppmøtetallet", () => deleteHeadcount(gatheringId)),

      createVolunteerRole: (data: NewVolunteerRoleInput) => {
        const role = buildVolunteerRole(data);
        return {
          ...save("lagre rollen", () =>
            createDocument(CMS_COLLECTIONS.SETTINGS, { ...role, recordType: "volunteerRole" })
          ),
          role,
        };
      },
      updateVolunteerRole: (roleId: string, updates: Partial<VolunteerRole>) =>
        save("lagre endringene i rollen", () =>
          updateDocument(CMS_COLLECTIONS.SETTINGS, roleId, {
            ...updates,
            recordType: "volunteerRole",
            updatedAt: new Date().toISOString(),
          })
        ),
      deleteVolunteerRole: (roleId: string) =>
        save("slette rollen", () => deleteDocument(CMS_COLLECTIONS.SETTINGS, roleId)),
    };
  }, []);

  // Actions that also read the current data
  const registerHeadcount = useCallback(
    (gatheringId: string, input: HeadcountInput) => {
      const headcount = buildHeadcount(gatheringId, input, currentUser.id);
      return save("lagre oppmøtetallet", () => saveHeadcount(headcount));
    },
    [currentUser]
  );

  const analyticsLayoutActions = useMemo(
    () => ({
      setAnalyticsModuleHidden: (moduleId: string, hidden: boolean) =>
        save("lagre valget på analysebordet", () => storeAnalyticsModuleHidden(currentUser.id, moduleId, hidden)),
      showAllAnalyticsModules: () =>
        save("vise alle modulene på analysebordet", () =>
          updateDocument(COLLECTIONS.PERSONS, currentUser.id, { analyticsHiddenModules: undefined })
        ),
    }),
    [currentUser.id]
  );

  const sendGroupMessage = useCallback(
    (groupId: string, content: string, imageUrl?: string) => {
      const message = buildGroupMessage(groupId, currentUser, content, imageUrl);
      return { ...save("sende meldingen", () => createDocument(COLLECTIONS.GROUP_MESSAGES, message)), message };
    },
    [currentUser]
  );

  // Staffing. A task's status follows from its need and its assignments (see taskStatusFor),
  // so every action that changes either one stores the resulting status in the same write.
  const staffingActions = useMemo(() => {
    const assignmentsOf = (taskId: string) => assignments.filter((a) => a.taskId === taskId);

    const updateTask = (taskId: string, updates: Partial<Task>, action = "lagre endringene i oppgaven") => {
      const task = tasks.find((t) => t.id === taskId);
      const changesNeed = task !== undefined && "neededCount" in updates && !("status" in updates);
      const fields = changesNeed
        ? { ...updates, status: taskStatusFor({ ...task, ...updates }, assignmentsOf(taskId)) }
        : updates;
      return save(action, () => updateDocument(COLLECTIONS.TASKS, taskId, fields));
    };

    const changeAssignments = (taskId: string, change: AssignmentChange, action: string, acuteForfall = false) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return { success: false, error: "Oppgaven finnes ikke lenger." };
      const after = applyAssignmentChange(assignmentsOf(taskId), change);
      return save(action, () => saveAssignmentChange(taskId, change, taskStatusFor(task, after, acuteForfall)));
    };

    /** Whether pulling out of the task now comes too close to the gathering. */
    const isAcuteNow = (taskId: string, now: Date) => {
      const task = tasks.find((t) => t.id === taskId);
      const gathering = gatherings.find((g) => g.id === task?.gatheringId);
      return isAcuteForfall(gathering?.startsAt, now);
    };

    return {
      updateTask: (taskId: string, updates: Partial<Task>) => updateTask(taskId, updates),
      updateTaskInstruction: (taskId: string, instruction: string) =>
        updateTask(taskId, { instruction }, "lagre instruksen"),
      updateTaskNeededCount: (taskId: string, neededCount: number | undefined) =>
        updateTask(taskId, { neededCount }, "lagre bemanningsbehovet"),

      assignTaskToPerson: (taskId: string, personId: string, response: "confirmed" | "pending") =>
        changeAssignments(taskId, { add: buildAssignment(taskId, personId, response) }, "lagre tildelingen"),

      updateAssignmentStatus: (assignmentId: string, response: Assignment["response"]) => {
        const assignment = assignments.find((a) => a.id === assignmentId);
        if (!assignment) return { success: false, error: "Tildelingen finnes ikke lenger." };
        const now = new Date();
        // Back to "pending" means the person has not answered after all
        const fields = { response, respondedAt: response === "pending" ? undefined : now.toISOString() };
        const pullsOut = response === "withdrawn" || response === "declined";
        return changeAssignments(
          assignment.taskId,
          { update: [{ id: assignmentId, fields }] },
          "lagre svaret på oppgaven",
          pullsOut && isAcuteNow(assignment.taskId, now)
        );
      },

      removeAssignment: (assignmentId: string) => {
        const assignment = assignments.find((a) => a.id === assignmentId);
        if (!assignment) return { success: false, error: "Tildelingen finnes ikke lenger." };
        return changeAssignments(assignment.taskId, { remove: assignmentId }, "fjerne tildelingen");
      },

      reportAbsence: (taskId: string, personId: string, reason?: string) => {
        const mine = assignments.filter((a) => a.taskId === taskId && a.personId === personId && holdsSlot(a));
        if (mine.length === 0) return { success: false, error: "Personen står ikke på denne oppgaven." };
        const now = new Date();
        const update = mine.map((a) => ({
          id: a.id,
          fields: {
            response: a.response === "confirmed" ? ("withdrawn" as const) : ("declined" as const),
            respondedAt: now.toISOString(),
            withdrawalReason: reason?.trim() || undefined,
          },
        }));
        return changeAssignments(taskId, { update }, "registrere forfallet", isAcuteNow(taskId, now));
      },
    };
  }, [tasks, assignments, gatherings]);

  const { getGroupNotificationsEnabled } = groupLookups;
  const toggleGroupNotifications = useCallback(
    (groupId: string, personId: string = currentUser.id, forceState?: boolean) => {
      const enabled = forceState ?? !getGroupNotificationsEnabled(groupId, personId);
      save("lagre varslingsvalget", () => setGroupNotifications(groupId, personId, enabled));
      return { success: true, enabled };
    },
    [getGroupNotificationsEnabled, currentUser.id]
  );

  const contextValue: FirebaseDataContextType = useMemo(
    () => ({
      isFirestoreConnected,
      session,
      currentUser,
      signOut,
      standInAs,
      allPersons: persons,
      groups,
      gatherings,
      tasks,
      assignments,
      groupMessages,
      attendances,
      headcounts,
      volunteerRoles,
      moduleConfig,
      setModuleStatus,
      toggleKalender,
      toggleMeldinger,
      ...personLookups,
      ...groupLookups,
      ...gatheringLookups,
      ...taskLookups,
      ...messageLookups,
      ...attendanceLookups,
      ...actions,
      ...staffingActions,
      sendGroupMessage,
      registerHeadcount,
      ...analyticsLayoutActions,
      toggleGroupNotifications,
    }),
    [
      isFirestoreConnected,
      session,
      currentUser,
      signOut,
      standInAs,
      persons,
      groups,
      gatherings,
      tasks,
      assignments,
      groupMessages,
      attendances,
      headcounts,
      volunteerRoles,
      moduleConfig,
      setModuleStatus,
      toggleKalender,
      toggleMeldinger,
      personLookups,
      groupLookups,
      gatheringLookups,
      taskLookups,
      messageLookups,
      attendanceLookups,
      actions,
      staffingActions,
      sendGroupMessage,
      registerHeadcount,
      analyticsLayoutActions,
      toggleGroupNotifications,
    ]
  );

  return <FirebaseDataContext.Provider value={contextValue}>{children}</FirebaseDataContext.Provider>;
};

export const useFirebase = (): FirebaseDataContextType => {
  const context = useContext(FirebaseDataContext);
  if (!context) {
    throw new Error("useFirebase must be used within a FirebaseDataProvider");
  }
  return context;
};
