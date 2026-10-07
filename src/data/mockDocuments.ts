import { COLLECTIONS, CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID } from "./collections";
import {
  initialPersons,
  initialGroups,
  initialGatherings,
  initialTasks,
  initialAssignments,
  initialGroupMessages,
  initialGatheringAttendances,
  initialGatheringHeadcounts,
} from "./mockData";
import {
  initialCmsPages,
  initialCmsNews,
  initialCmsSermons,
  initialCmsStaff,
  demoCmsSettings,
} from "./cmsData";
import { Person, Group } from "../types";
import { buildInitialVolunteerRoles } from "./defaultVolunteerRoles";
import { enrichTasksWithVolunteerRoles } from "./mockTaskVolunteerRoles";

export interface MockDocument {
  collection: string;
  id: string;
  data: object;
}

export interface CustomMockCounts {
  personCount?: number;
  groupCount?: number;
  gatheringCount?: number;
  taskCount?: number;
  roleCount?: number;
}

const EXTRA_FIRST_NAMES = [
  "Eskil", "Ida", "Sander", "Live", "Tobias", "Emilie", "Marius", "Silje", "Simen", "Hedda",
  "Vetle", "Oda", "Jesper", "Tuva", "Kasper", "Sunniva", "Ulrik", "Synne", "Mikkel", "Thea",
  "Robin", "Amalie", "Sondre", "Vilde", "Aksel", "Nora", "Kristoffer", "Malin", "Haakon", "Sigrid"
];
const EXTRA_LAST_NAMES = [
  "Haugen", "Johannessen", "Røed", "Tangen", "Bjerke", "Moe", "Brekke", "Solli", "Ellingsen", "Lunde",
  "Foss", "Dahl", "Lian", "Sande", "Myhre", "Knutsen", "Nygård", "Moen", "Aas", "Bakke"
];

function getExtendedPersons(count: number, roleCount?: number): Person[] {
  let persons: Person[];
  if (count <= initialPersons.length) {
    persons = initialPersons.slice(0, count);
  } else {
    persons = [...initialPersons];
    for (let i = initialPersons.length + 1; i <= count; i++) {
      const fn = EXTRA_FIRST_NAMES[(i - 33) % EXTRA_FIRST_NAMES.length];
      const ln = EXTRA_LAST_NAMES[(i - 33) % EXTRA_LAST_NAMES.length];
      persons.push({
        id: `person-${i}`,
        name: `${fn} ${ln}`,
        phone: `9${String(1000000 + i * 1713).slice(-7)}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@eksempel.no`,
        globalRole: "member",
        isStaff: false,
      });
    }
  }

  // If roleCount is given, configure leadership/staff/admin flags for the top N persons
  if (roleCount !== undefined) {
    const targetRoles = Math.min(roleCount, persons.length);
    persons = persons.map((p, idx) => {
      if (idx < targetRoles) {
        return {
          ...p,
          globalRole: idx === 0 ? "admin" : p.globalRole,
          isStaff: p.isStaff ?? (idx < 8),
          staffRole: p.staffRole ?? (idx === 0 ? "Hovedpastor" : idx < 3 ? "Pastor" : "Teamleder"),
        };
      }
      return p;
    });
  }

  return persons;
}

function getExtendedGroups(count: number): Group[] {
  if (count <= initialGroups.length) {
    return initialGroups.slice(0, count);
  }
  const groups: Group[] = [...initialGroups];
  for (let i = initialGroups.length + 1; i <= count; i++) {
    groups.push({
      id: `group-extra-${i}`,
      name: `Husfellesskap Gruppe ${i - initialGroups.length + 4}`,
      category: "husgruppe",
      memberIds: ["person-1"],
      leaderIds: ["person-1"],
      meetingSchedule: {
        weekday: "Onsdag",
        time: "19:00",
        frequency: "annenhver uke",
      },
    });
  }
  return groups;
}

/**
 * Generates mock documents with configurable counts while maintaining relational integrity.
 */
export function getCustomMockDocuments(counts?: CustomMockCounts): MockDocument[] {
  const pCount = counts?.personCount !== undefined ? Math.max(1, counts.personCount) : initialPersons.length;
  const gCount = counts?.groupCount !== undefined ? Math.max(1, counts.groupCount) : initialGroups.length;
  const gatCount = counts?.gatheringCount !== undefined ? Math.max(1, counts.gatheringCount) : initialGatherings.length;
  const tCount = counts?.taskCount !== undefined ? Math.max(1, counts.taskCount) : initialTasks.length;

  // 1. Persons
  const persons = getExtendedPersons(pCount, counts?.roleCount);
  const personIds = new Set(persons.map((p) => p.id));
  const fallbackPersonId = persons[0]?.id || "person-1";

  // 2. Groups (clean references to only included persons)
  const rawGroups = getExtendedGroups(gCount);
  const groups = rawGroups.map((g) => {
    let memberIds = (g.memberIds || []).filter((id) => personIds.has(id));
    let leaderIds = (g.leaderIds || []).filter((id) => personIds.has(id));
    let deputyLeaderIds = (g.deputyLeaderIds || []).filter((id) => personIds.has(id));

    if (memberIds.length === 0 && leaderIds.length === 0) {
      memberIds = [fallbackPersonId];
      leaderIds = [fallbackPersonId];
    } else if (leaderIds.length === 0 && memberIds.length > 0) {
      leaderIds = [memberIds[0]];
    }

    return {
      ...g,
      memberIds,
      leaderIds,
      deputyLeaderIds,
    };
  });
  const groupIds = new Set(groups.map((g) => g.id));

  // 3. Gatherings (must belong to included groups and refer to included persons)
  const candidateGatherings = initialGatherings.filter((g) => groupIds.has(g.groupId));
  const gatherings = candidateGatherings.slice(0, gatCount).map((g) => ({
    ...g,
    hostPersonId: g.hostPersonId && personIds.has(g.hostPersonId) ? g.hostPersonId : undefined,
  }));
  const gatheringIds = new Set(gatherings.map((g) => g.id));

  // 4. Tasks (must belong to included gatherings and groups)
  const candidateTasks = initialTasks.filter(
    (t) => gatheringIds.has(t.gatheringId) && (!t.groupId || groupIds.has(t.groupId))
  );
  const tasks = enrichTasksWithVolunteerRoles(candidateTasks.slice(0, tCount));
  const taskIds = new Set(tasks.map((t) => t.id));

  // 5. Assignments (must belong to included tasks and persons)
  const assignments = initialAssignments.filter(
    (a) => taskIds.has(a.taskId) && personIds.has(a.personId)
  );

  // 6. Group messages, responses and headcounts
  const groupMessages = initialGroupMessages.filter((m) => groupIds.has(m.groupId));
  const attendances = initialGatheringAttendances.filter(
    (att) => gatheringIds.has(att.gatheringId) && personIds.has(att.personId)
  );
  const headcounts = initialGatheringHeadcounts.filter((count) => gatheringIds.has(count.gatheringId));

  const sets: [string, { id: string }[]][] = [
    [COLLECTIONS.PERSONS, persons],
    [COLLECTIONS.GROUPS, groups],
    [COLLECTIONS.GATHERINGS, gatherings],
    [COLLECTIONS.TASKS, tasks],
    [COLLECTIONS.ASSIGNMENTS, assignments],
    [COLLECTIONS.GROUP_MESSAGES, groupMessages],
    [COLLECTIONS.GATHERING_ATTENDANCES, attendances],
    [COLLECTIONS.GATHERING_HEADCOUNTS, headcounts],
    [COLLECTIONS.VOLUNTEER_ROLES, buildInitialVolunteerRoles()],
    [CMS_COLLECTIONS.PAGES, initialCmsPages],
    [CMS_COLLECTIONS.NEWS, initialCmsNews],
    [CMS_COLLECTIONS.SERMONS, initialCmsSermons],
    [CMS_COLLECTIONS.STAFF, initialCmsStaff],
  ];

  const documents: MockDocument[] = sets.flatMap(([collection, items]) =>
    items.map((item) => ({ collection, id: item.id, data: item }))
  );
  documents.push({ collection: CMS_COLLECTIONS.SETTINGS, id: CMS_SETTINGS_DOC_ID, data: demoCmsSettings });
  return documents;
}

/**
 * Every mock document, addressed by collection and document id.
 * This is demo content only and has no relation to a real congregation.
 */
export function getMockDocuments(): MockDocument[] {
  return getCustomMockDocuments();
}
