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
import {
  CMS_COLLECTIONS,
  COLLECTIONS,
  GROUP_DIRECTORY_COLLECTION,
  GROUP_LEADER_EMAILS_COLLECTION,
} from "../data/collections";
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
  subscribeDocument,
  subscribePublicPart,
  subscribeWhere,
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
import { isInGroup, leadsGroup } from "../utils/groups";
import { groupFromPublicCard, personFromCard, type GroupDirectoryCard, type GroupLeaderEmail, type PublicGroupCard } from "../utils/groupAccess";
import { mayStandIn, sessionOf, sessionOfLogin, standInSession, type AccountState, type LoginState, type Session } from "../utils/session";
import { readOwnLogin, subscribePublicGroupCards, subscribePublicProfiles } from "../services/registerMirror";
import { useRegisterMirror } from "../hooks/useRegisterMirror";
import { useLeadersAsMembers } from "../hooks/useLeadersAsMembers";
import { DEMO } from "../demo";
import type { HeadcountInput } from "../utils/headcount";
import { absenceFields, AssignmentChange, applyAssignmentChange, holdsSlot, isAcuteForfall, taskStatusFor } from "../utils/staffing";

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
  /**
   * Go in as a person without signing in. Only on a developer's own machine and in the demo
   * installation: a congregation's published app is without it.
   */
  standInAs?: (personId: string) => void;
  /** Whether the person register has arrived. Until then nobody can be said to be missing from it. */
  registerReady: boolean;
  /** Whether the events have arrived. Until then nothing can be said to be over, or missing. */
  gatheringsReady: boolean;
  allPersons: Person[];
  /** Whether this browser holds the whole register. A member in a closed database does not. */
  hasFullRegister: boolean;
  groups: Group[];
  /** Loads the names on one gathering, for a member who does not hold every assignment. */
  watchGatheringAssignments: (gatheringId: string) => () => void;
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
  reportAbsence: (taskId: string, personId: string) => ActionResult;
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
// stood in for (see SignInPage). The demo lets every visitor in the same way (see DemoDoor). A
// congregation's published app is built without this: nobody gets in without signing in. The
// choice lasts for the browser tab.
const CAN_STAND_IN = mayStandIn({ developerMachine: import.meta.env.DEV, demo: DEMO !== null });
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
  // Whether what was received is the register itself, and not only the public copies of it
  const [registerWhole, setRegisterWhole] = useState(false);
  const [gatheringsReady, setGatheringsReady] = useState(false);
  const [listsReady, setListsReady] = useState(false);
  const [planningReady, setPlanningReady] = useState(false);
  const [publicPersons, setPublicPersons] = useState<Person[]>([]);
  const [ownPerson, setOwnPerson] = useState<Person | null>(null);
  const [ownReady, setOwnReady] = useState(false);
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [publicCards, setPublicCards] = useState<PublicGroupCard[]>([]);
  const [directoryCards, setDirectoryCards] = useState<GroupDirectoryCard[]>([]);
  const [leaderEmails, setLeaderEmails] = useState<GroupLeaderEmail[]>([]);
  const [watchedGatheringIds, setWatchedGatheringIds] = useState<string[]>([]);
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

  // The login of the account that is signed in: which person in the register it is (see
  // utils/logins.ts). It is the one thing someone who has signed in may read before the
  // database knows them. Where anyone can go in without signing in, it is not asked for.
  const [login, setLogin] = useState<LoginState>({ status: "none" });
  const signedInEmail = accountState.status === "signedIn" && accountState.account.emailVerified ? accountState.account.email : null;
  useEffect(() => {
    if (CAN_STAND_IN || !signedInEmail) {
      setLogin({ status: "none" });
      return;
    }
    let current = true;
    setLogin({ status: "loading" });
    readOwnLogin(signedInEmail).then(
      (found) => current && setLogin(found ? { status: "found", personId: found.personId, role: found.role } : { status: "missing" }),
      (error) => {
        // An address the database will not answer for, is treated as nobody's: the pages behind sign-in stay closed
        console.error("Innloggingen kunne ikke slås opp:", error);
        if (current) setLogin({ status: "missing" });
      }
    );
    return () => {
      current = false;
    };
  }, [signedInEmail]);

  // The register, the groups and the events.
  // An administrator, and the demo, get all of it. A member gets their own person, their own
  // groups and the public cards. A visitor gets the public copies and the public cards.
  const fullRegister = CAN_STAND_IN || (login.status === "found" && login.role === "admin");
  const memberAccess = !CAN_STAND_IN && login.status === "found" && login.role === "member";
  const memberId = memberAccess ? login.personId : null;
  useEffect(() => {
    setRegisterReady(false);
    setRegisterWhole(false);
    setGatheringsReady(false);
    setListsReady(false);
    setOwnReady(false);
    setOwnPerson(null);
    const onGatherings = (list: Gathering[]) => {
      setGatherings(list);
      setGatheringsReady(true);
    };
    const stops: (() => void)[] = [];
    if (fullRegister) {
      stops.push(
        subscribeCollection<Person>(COLLECTIONS.PERSONS, (list) => {
          setPersons(list);
          setRegisterWhole(true);
          setRegisterReady(true);
        }),
        subscribeCollection<Group>(COLLECTIONS.GROUPS, (list) => {
          setGroups(list);
          setListsReady(true);
        }),
        subscribeCollection<Gathering>(COLLECTIONS.GATHERINGS, onGatherings)
      );
    } else if (memberAccess && memberId) {
      stops.push(
        subscribeDocument<Person>(COLLECTIONS.PERSONS, memberId, (person) => {
          setOwnPerson(person);
          setOwnReady(true);
        }),
        subscribePublicProfiles((list) => setPublicPersons(list)),
        subscribeCollection<Gathering>(COLLECTIONS.GATHERINGS, onGatherings),
        subscribePublicGroupCards((cards) => setPublicCards(cards))
      );
      const parts = new Map<string, Group[]>();
      const publish = () => {
        const byId = new Map<string, Group>();
        for (const list of parts.values()) for (const group of list) byId.set(group.id, group);
        setOwnedGroups([...byId.values()]);
      };
      for (const field of ["memberIds", "leaderIds", "deputyLeaderIds"] as const) {
        stops.push(
          subscribeWhere<Group>(COLLECTIONS.GROUPS, field, "array-contains", memberId, (list) => {
            parts.set(field, list);
            publish();
            setListsReady(true);
          })
        );
      }
    } else if (login.status !== "loading") {
      stops.push(
        subscribePublicProfiles((list) => {
          setPublicPersons(list);
          setRegisterReady(true);
        }),
        subscribePublicGroupCards((cards) => {
          setPublicCards(cards);
          setListsReady(true);
        }),
        subscribePublicPart<Gathering>(COLLECTIONS.GATHERINGS, onGatherings)
      );
    }
    return () => stops.forEach((stop) => stop());
  }, [fullRegister, memberAccess, memberId, login.status]);

  // Who is using the app. Where anyone can stand in, the register decides who an account is, and
  // the stand-in is someone from it. Elsewhere the account's own login decides, and the register
  // counts only once all of it has arrived: the public copies are not the register.
  const sessionPersons = fullRegister ? persons : ownPerson ? [ownPerson] : [];
  const sessionReady = fullRegister ? registerReady && (CAN_STAND_IN || registerWhole) : ownReady || login.status !== "found";
  const session = useMemo<Session>(() => {
    if (!CAN_STAND_IN) return sessionOfLogin(accountState, login, sessionPersons, sessionReady);
    const real = sessionOf(accountState, persons, registerReady);
    if (real.status === "signedOut" && standInId !== null) return standInSession(standInId, persons, registerReady);
    return real;
  }, [accountState, login, persons, sessionPersons, sessionReady, registerReady, standInId]);

  const visibleGroups = useMemo(() => {
    if (fullRegister) return groups;
    const byId = new Map(publicCards.map((card) => [card.id, groupFromPublicCard(card)]));
    for (const group of ownedGroups) byId.set(group.id, group);
    return [...byId.values()];
  }, [fullRegister, groups, publicCards, ownedGroups]);

  const visiblePersons = useMemo(() => {
    if (fullRegister) return persons;
    const byId = new Map(publicPersons.map((person) => [person.id, person]));
    if (ownPerson) byId.set(ownPerson.id, ownPerson);
    return [...byId.values()];
  }, [fullRegister, persons, publicPersons, ownPerson]);

  // An administrator's own browser keeps the logins and the copies in step with the register
  // (see hooks/useRegisterMirror.ts). Not where anyone can stand in: there the database is open.
  const keepsTheBooks = !CAN_STAND_IN && registerWhole && session.status === "member" && session.person.globalRole === "admin";
  useRegisterMirror(persons, keepsTheBooks, signedInEmail, {
    groups,
    gatherings,
    tasks,
    assignments,
    listsReady,
    planningReady,
  });
  // The same browser sees to it that whoever leads a group stands among its members
  useLeadersAsMembers(groups, keepsTheBooks);
  const isMember = session.status === "member";

  const myGroupIds = useMemo(() => (memberId ? ownedGroups.map((group) => group.id).sort() : []), [memberId, ownedGroups]);
  const groupGatheringIds = useMemo(
    () => (memberId ? gatherings.filter((gathering) => myGroupIds.includes(gathering.groupId)).map((gathering) => gathering.id).sort() : []),
    [memberId, gatherings, myGroupIds]
  );
  const ledGroupIds = useMemo(
    () => (memberId ? ownedGroups.filter((group) => leadsGroup(group, memberId)).map((group) => group.id).sort() : []),
    [memberId, ownedGroups]
  );

  useEffect(() => {
    if (!memberId) {
      setDirectoryCards([]);
      setLeaderEmails([]);
      return;
    }
    const stops: (() => void)[] = [];
    const cards = new Map<string, GroupDirectoryCard[]>();
    const publishCards = () => setDirectoryCards([...cards.values()].flat());
    for (const groupId of myGroupIds) {
      stops.push(
        subscribeWhere<GroupDirectoryCard>(GROUP_DIRECTORY_COLLECTION, "groupId", "==", groupId, (list) => {
          cards.set(groupId, list);
          publishCards();
        })
      );
    }
    if (myGroupIds.length === 0) setDirectoryCards([]);
    const mails = new Map<string, GroupLeaderEmail[]>();
    const publishMails = () => setLeaderEmails([...mails.values()].flat());
    for (const groupId of ledGroupIds) {
      stops.push(
        subscribeWhere<GroupLeaderEmail>(GROUP_LEADER_EMAILS_COLLECTION, "groupId", "==", groupId, (list) => {
          mails.set(groupId, list);
          publishMails();
        })
      );
    }
    if (ledGroupIds.length === 0) setLeaderEmails([]);
    return () => stops.forEach((stop) => stop());
  }, [memberId, myGroupIds.join("|"), ledGroupIds.join("|")]);

  // Planning data, only behind the public website, and only for someone who is in the register.
  // A member does not subscribe to every assignment or every group message.
  useEffect(() => {
    if (!internal || !isMember) {
      setTasks([]);
      setAssignments([]);
      setGroupMessages([]);
      setAttendances([]);
      setHeadcounts([]);
      setVolunteerRoles([]);
      setPlanningReady(false);
      return;
    }
    if (fullRegister) {
      const stops = [
        subscribeCollection<Task>(COLLECTIONS.TASKS, (list) => {
          setTasks(list);
          setPlanningReady(true);
        }),
        subscribeCollection<Assignment>(COLLECTIONS.ASSIGNMENTS, setAssignments),
        subscribeCollection<GroupMessage>(COLLECTIONS.GROUP_MESSAGES, setGroupMessages),
        subscribeCollection<GatheringAttendance>(COLLECTIONS.GATHERING_ATTENDANCES, setAttendances),
        subscribeHeadcounts(setHeadcounts),
        subscribeVolunteerRoles(setVolunteerRoles),
      ];
      return () => stops.forEach((stop) => stop());
    }
    const stops: (() => void)[] = [
      subscribeCollection<Task>(COLLECTIONS.TASKS, (list) => {
        setTasks(list);
        setPlanningReady(true);
      }),
      subscribeHeadcounts(setHeadcounts),
      subscribeVolunteerRoles(setVolunteerRoles),
    ];
    const assignmentParts = new Map<string, Assignment[]>();
    const publishAssignments = () => {
      const byId = new Map<string, Assignment>();
      for (const list of assignmentParts.values()) for (const item of list) byId.set(item.id, item);
      setAssignments([...byId.values()]);
    };
    if (memberId) {
      stops.push(
        subscribeWhere<Assignment>(COLLECTIONS.ASSIGNMENTS, "personId", "==", memberId, (list) => {
          assignmentParts.set("self", list);
          publishAssignments();
        })
      );
    }
    for (const groupId of myGroupIds) {
      stops.push(
        subscribeWhere<Assignment>(COLLECTIONS.ASSIGNMENTS, "gatheringGroupId", "==", groupId, (list) => {
          assignmentParts.set(`group:${groupId}`, list);
          publishAssignments();
        })
      );
    }
    for (const gatheringId of watchedGatheringIds) {
      stops.push(
        subscribeWhere<Assignment>(COLLECTIONS.ASSIGNMENTS, "gatheringId", "==", gatheringId, (list) => {
          assignmentParts.set(`gathering:${gatheringId}`, list);
          publishAssignments();
        })
      );
    }
    const messageParts = new Map<string, GroupMessage[]>();
    const publishMessages = () => {
      const byId = new Map<string, GroupMessage>();
      for (const list of messageParts.values()) for (const item of list) byId.set(item.id, item);
      setGroupMessages([...byId.values()]);
    };
    for (const groupId of myGroupIds) {
      stops.push(
        subscribeWhere<GroupMessage>(COLLECTIONS.GROUP_MESSAGES, "groupId", "==", groupId, (list) => {
          messageParts.set(groupId, list);
          publishMessages();
        })
      );
    }
    if (myGroupIds.length === 0) setGroupMessages([]);
    const attendanceParts = new Map<string, GatheringAttendance[]>();
    const publishAttendances = () => {
      const byId = new Map<string, GatheringAttendance>();
      for (const list of attendanceParts.values()) for (const item of list) byId.set(item.id, item);
      setAttendances([...byId.values()]);
    };
    if (memberId) {
      stops.push(
        subscribeWhere<GatheringAttendance>(COLLECTIONS.GATHERING_ATTENDANCES, "personId", "==", memberId, (list) => {
          attendanceParts.set("self", list);
          publishAttendances();
        })
      );
    }
    for (const gatheringId of groupGatheringIds) {
      stops.push(
        subscribeWhere<GatheringAttendance>(COLLECTIONS.GATHERING_ATTENDANCES, "gatheringId", "==", gatheringId, (list) => {
          attendanceParts.set(`gathering:${gatheringId}`, list);
          publishAttendances();
        })
      );
    }
    if (!memberId && groupGatheringIds.length === 0) setAttendances([]);
    return () => stops.forEach((stop) => stop());
  }, [internal, isMember, fullRegister, memberId, myGroupIds.join("|"), groupGatheringIds.join("|"), watchedGatheringIds.join("|")]);

  const watchGatheringAssignments = useCallback((gatheringId: string) => {
    if (!gatheringId || fullRegister) return () => {};
    setWatchedGatheringIds((prev) => (prev.includes(gatheringId) ? prev : [...prev, gatheringId]));
    return () => setWatchedGatheringIds((prev) => prev.filter((id) => id !== gatheringId));
  }, [fullRegister]);

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
      getPersonById: (personId: string) => {
        if (ownPerson?.id === personId) return ownPerson;
        if (fullRegister) return persons.find((person) => person.id === personId);
        const card = directoryCards.find((item) => item.personId === personId);
        if (card) {
          const email = leaderEmails.find((item) => item.personId === personId && ledGroupIds.includes(item.groupId))?.email;
          return personFromCard(card, email);
        }
        return visiblePersons.find((person) => person.id === personId);
      },
    }),
    [persons, ownPerson, fullRegister, directoryCards, leaderEmails, ledGroupIds, visiblePersons]
  );

  const groupLookups = useMemo(
    () => ({
      getGroupById: (groupId: string) => visibleGroups.find((g) => g.id === groupId),
      getUserGroups: (personId: string) => visibleGroups.filter((g) => isInGroup(g, personId)),
      isPersonInGroup: (personId: string, groupId: string) => {
        const group = visibleGroups.find((g) => g.id === groupId);
        return group !== undefined && isInGroup(group, personId);
      },
      getGroupNotificationsEnabled: (groupId: string, personId: string = currentUser.id) => {
        const group = visibleGroups.find((g) => g.id === groupId);
        return group?.notificationPreferences?.[personId] !== false;
      },
    }),
    [visibleGroups, currentUser.id]
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

      assignTaskToPerson: (taskId: string, personId: string, response: "confirmed" | "pending") => {
        const task = tasks.find((item) => item.id === taskId);
        const gathering = gatherings.find((item) => item.id === task?.gatheringId);
        const personName =
          (personId === currentUser.id ? currentUser.name : undefined) ||
          visiblePersons.find((person) => person.id === personId)?.name ||
          directoryCards.find((card) => card.personId === personId)?.name ||
          "";
        const nameGroup = visibleGroups.find((group) => personId !== currentUser.id && leadsGroup(group, currentUser.id) && isInGroup(group, personId));
        const place = task && gathering && personName
          ? {
              personName,
              gatheringId: gathering.id,
              gatheringGroupId: gathering.groupId,
              gatheringPublic: gathering.isPublic === true,
              ...(nameGroup ? { nameGroupId: nameGroup.id } : {}),
            }
          : undefined;
        return changeAssignments(taskId, { add: buildAssignment(taskId, personId, response, place) }, "lagre tildelingen");
      },

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

      reportAbsence: (taskId: string, personId: string) => {
        const mine = assignments.filter((a) => a.taskId === taskId && a.personId === personId && holdsSlot(a));
        if (mine.length === 0) return { success: false, error: "Personen står ikke på denne oppgaven." };
        const respondedAt = new Date().toISOString();
        const update = mine.map((assignment) => ({ id: assignment.id, fields: absenceFields(assignment.response, respondedAt) }));
        return changeAssignments(taskId, { update }, "registrere forfallet", isAcuteNow(taskId, new Date(respondedAt)));
      },
    };
  }, [tasks, assignments, gatherings, currentUser, visiblePersons, directoryCards, visibleGroups]);

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
      registerReady,
      gatheringsReady,
      allPersons: visiblePersons,
      hasFullRegister: fullRegister,
      groups: visibleGroups,
      watchGatheringAssignments,
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
      registerReady,
      gatheringsReady,
      visiblePersons,
      fullRegister,
      visibleGroups,
      watchGatheringAssignments,
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
