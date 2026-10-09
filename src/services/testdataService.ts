import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { sanitizeForFirestore } from "../utils/firestoreData";
import { COLLECTIONS, CMS_COLLECTIONS } from "../data/collections";
import {
  getCustomMockDocuments,
  getMockDocuments,
  storedFormOf,
  type MockDocument,
  type CustomMockCounts,
} from "../data/mockDocuments";
import { initialGatherings } from "../data/mockData";
import { isSimulatedDocument } from "../data/simulatedChurchLife";
import { chunk } from "../utils/chunk";
import { calendarGroupIds, isWebsiteGathering } from "../utils/dataParts";
import type { DatasetDocument } from "../utils/dataset";
import { VOLUNTEER_ROLE_RECORD } from "./volunteerRoles";
import { isHeadcountRecord } from "./headcounts";
import { ensureDeletionAllowed } from "./operatingMode";

// Firestore støtter maksimalt 500 operasjoner per batch write
const BATCH_SIZE = 400;

// Test data is the planner's: persons, groups, roles and, when asked for, the demo gatherings with
// their tasks. The website (pages, news, sermons, staff, settings and the events a congregation
// has brought in) is filled and emptied apart from it. See utils/dataParts.ts.
const WEBSITE_COLLECTIONS = new Set<string>(Object.values(CMS_COLLECTIONS));

/** The demo gatherings and what hangs on them. Written together, or not at all. */
const GATHERING_COLLECTIONS = new Set<string>([
  COLLECTIONS.GATHERINGS,
  COLLECTIONS.TASKS,
  COLLECTIONS.ASSIGNMENTS,
  COLLECTIONS.GATHERING_ATTENDANCES,
  COLLECTIONS.GATHERING_HEADCOUNTS,
]);

const DEMO_GATHERING_IDS = new Set<string>(initialGatherings.map((g) => g.id));

/**
 * The events and groups that are the website's own, as "collection/id", and so are left alone
 * when test data is cleared: an event open to everyone that is neither a demo gathering nor a
 * simulated one, and a group that only exists to own such events.
 */
async function websiteDocumentsToKeep(): Promise<Set<string>> {
  const read = async (name: string): Promise<DatasetDocument[]> =>
    (await getDocs(collection(db, name))).docs.map((d) => ({ ...d.data(), id: d.id }));
  const [gatherings, groups] = await Promise.all([read(COLLECTIONS.GATHERINGS), read(COLLECTIONS.GROUPS)]);

  const keptGatherings = gatherings.filter(
    (g) => isWebsiteGathering(g) && !DEMO_GATHERING_IDS.has(g.id) && !isSimulatedDocument(g.id, {})
  );
  const owners = new Set(keptGatherings.map((g) => g.groupId));
  const keptGroups = [...calendarGroupIds({ [COLLECTIONS.GROUPS]: groups, [COLLECTIONS.GATHERINGS]: gatherings })].filter(
    (id) => owners.has(id)
  );
  return new Set([
    ...keptGatherings.map((g) => `${COLLECTIONS.GATHERINGS}/${g.id}`),
    ...keptGroups.map((id) => `${COLLECTIONS.GROUPS}/${id}`),
  ]);
}

export interface TestdataCounts extends CustomMockCounts {
  personCount?: number;
  groupCount?: number;
  roleCount?: number;
  gatheringCount?: number;
  taskCount?: number;
}

export interface GenerateTestdataOptions extends TestdataCounts {
  /**
   * Hvis satt til true, tømmes eksisterende testdata (personer, grupper, roller/oppgaver)
   * før ny generering starter. Nettsiden og dens arrangementer bevares.
   */
  clearExisting?: boolean;
}

export interface ClearTestdataOptions {
  /** Slett testpersoner (standard: true) */
  persons?: boolean;
  /** Slett grupper (standard: true) */
  groups?: boolean;
  /** Slett oppgavetildelinger (standard: true) */
  roles?: boolean;
  /** Slett rollebiblioteket (standard: true) */
  volunteerRoles?: boolean;
  /** Slett samlinger (standard: true) */
  gatherings?: boolean;
  /** Slett oppgaver (standard: true) */
  tasks?: boolean;
  /** Slett gruppemeldinger (standard: true) */
  groupMessages?: boolean;
  /** Slett svar på samlinger og registrerte oppmøtetall (standard: true) */
  attendance?: boolean;
  /**
   * Sikkerhetssperre: Bevar alltid CMS-innhold (sider, artikler, taler, offentlige profiler og innstillinger).
   * Standard: true.
   */
  preserveCms?: boolean;
}

export interface TestdataServiceResult {
  success: boolean;
  /** Antall dokumenter skrevet eller slettet per samling */
  counts: Record<string, number>;
  total: number;
  /** Eventuelle feil under kjøring per samling */
  failures: { collection: string; message: string }[];
  durationMs?: number;
}

function createEmptyResult(): TestdataServiceResult {
  return {
    success: true,
    counts: {},
    total: 0,
    failures: [],
  };
}

function recordFailure(
  result: TestdataServiceResult,
  collectionName: string,
  error: unknown
): void {
  console.error(`TestdataService: Feil for samling '${collectionName}':`, error);
  result.success = false;
  result.failures.push({
    collection: collectionName,
    message: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Tømmer spesifiserte testdata-samlinger fra Firestore.
 * Standardinnstillingen sletter alle planlegger-relaterte data (personer, grupper, roller/tildelinger),
 * men BEVARER nettsiden: sider, artikler, taler og innstillinger, og de offentlige arrangementene
 * en menighet har hentet inn, med gruppen som eier dem (se websiteDocumentsToKeep).
 */
export async function clearTestdata(
  options: ClearTestdataOptions = {}
): Promise<TestdataServiceResult> {
  // Kaster når appen står i produksjon: da tømmes ingenting (se operatingMode.ts)
  await ensureDeletionAllowed();
  const startTime = Date.now();
  const result = createEmptyResult();

  const {
    persons = true,
    groups = true,
    roles = true,
    volunteerRoles = true,
    gatherings = true,
    tasks = true,
    groupMessages = true,
    attendance = true,
  } = options;

  // Bestem hvilke samlinger som skal slettes
  const targetCollections: string[] = [];
  if (persons) targetCollections.push(COLLECTIONS.PERSONS);
  if (groups) targetCollections.push(COLLECTIONS.GROUPS);
  if (roles || tasks) targetCollections.push(COLLECTIONS.ASSIGNMENTS);
  if (tasks) targetCollections.push(COLLECTIONS.TASKS);
  if (gatherings) targetCollections.push(COLLECTIONS.GATHERINGS);
  if (groupMessages) targetCollections.push(COLLECTIONS.GROUP_MESSAGES);
  if (attendance) {
    targetCollections.push(COLLECTIONS.GATHERING_ATTENDANCES);
    targetCollections.push(COLLECTIONS.GATHERING_HEADCOUNTS);
  }
  if (volunteerRoles) targetCollections.push(COLLECTIONS.VOLUNTEER_ROLES);

  // Sikre at CMS-samlinger aldri slettes
  const protectedCollections = new Set(Object.values(CMS_COLLECTIONS));
  let safeCollections = targetCollections.filter(
    (name) => !protectedCollections.has(name as any)
  );

  // Which events and groups are the website's is only known when both collections are read.
  // If they cannot be, neither is touched: deleting on a guess would take the website's calendar.
  let kept = new Set<string>();
  const shared: string[] = [COLLECTIONS.GATHERINGS, COLLECTIONS.GROUPS];
  if (safeCollections.some((name) => shared.includes(name))) {
    try {
      kept = await websiteDocumentsToKeep();
    } catch (error) {
      for (const name of shared) {
        if (safeCollections.includes(name)) recordFailure(result, name, error);
      }
      safeCollections = safeCollections.filter((name) => !shared.includes(name));
    }
  }

  for (const collectionName of safeCollections) {
    try {
      if (collectionName === COLLECTIONS.VOLUNTEER_ROLES || collectionName === COLLECTIONS.GATHERING_HEADCOUNTS) {
        // Both are stored in cms_settings, marked by recordType (see volunteerRoles.ts and headcounts.ts)
        const snap = await getDocs(collection(db, CMS_COLLECTIONS.SETTINGS));
        const markedDocs = snap.docs.filter((d) =>
          collectionName === COLLECTIONS.VOLUNTEER_ROLES
            ? d.data().recordType === VOLUNTEER_ROLE_RECORD
            : isHeadcountRecord(d.data())
        );
        if (markedDocs.length > 0) {
          for (const piece of chunk(markedDocs, BATCH_SIZE)) {
            const batch = writeBatch(db);
            for (const docSnap of piece) batch.delete(docSnap.ref);
            await batch.commit();
          }
        }
        result.counts[collectionName] = markedDocs.length;
        result.total += markedDocs.length;
        continue;
      }
      const snap = await getDocs(collection(db, collectionName));
      const doomed = snap.docs.filter((docSnap) => !kept.has(`${collectionName}/${docSnap.id}`));
      for (const piece of chunk(doomed, BATCH_SIZE)) {
        const batch = writeBatch(db);
        for (const docSnap of piece) {
          batch.delete(docSnap.ref);
        }
        await batch.commit();
      }
      result.counts[collectionName] = doomed.length;
      result.total += doomed.length;
    } catch (error) {
      recordFailure(result, collectionName, error);
    }
  }

  result.durationMs = Date.now() - startTime;
  result.success = result.failures.length === 0;
  return result;
}

/**
 * Sletter kun testpersoner og tilhørende tildelinger i Firestore.
 */
export async function deletePersonsTestdata(): Promise<TestdataServiceResult> {
  return clearTestdata({
    persons: true,
    roles: true,
    groups: false,
    gatherings: false,
    tasks: false,
    groupMessages: false,
    attendance: false,
  });
}

/**
 * Sletter kun testgrupper og tilhørende samlinger/oppgaver i Firestore.
 */
export async function deleteGroupsTestdata(): Promise<TestdataServiceResult> {
  return clearTestdata({
    persons: false,
    roles: false,
    groups: true,
    gatherings: true,
    tasks: true,
    groupMessages: true,
    attendance: true,
  });
}

/**
 * Sletter roller og tildelinger i Firestore.
 */
export async function deleteRolesTestdata(): Promise<TestdataServiceResult> {
  return clearTestdata({
    persons: false,
    groups: false,
    roles: true,
    volunteerRoles: true,
    gatherings: false,
    tasks: false,
    groupMessages: false,
    attendance: false,
  });
}

/** Skriver dokumentene samling for samling, og fører antall og feil i resultatet. */
async function writeDocuments(result: TestdataServiceResult, documents: MockDocument[]): Promise<void> {
  const byCollection = new Map<string, MockDocument[]>();
  for (const docItem of documents) {
    const list = byCollection.get(docItem.collection) || [];
    list.push(docItem);
    byCollection.set(docItem.collection, list);
  }

  for (const [collectionName, items] of byCollection) {
    try {
      for (const piece of chunk(items, BATCH_SIZE)) {
        const batch = writeBatch(db);
        for (const item of piece) {
          const stored = storedFormOf(item);
          batch.set(doc(db, stored.collection, stored.id), sanitizeForFirestore(stored.data));
        }
        await batch.commit();
      }
      result.counts[collectionName] = items.length;
      result.total += items.length;
    } catch (error) {
      recordFailure(result, collectionName, error);
    }
  }
}

/**
 * Genererer et konsistent sett med testdata for planleggeren: personer, grupper, gruppemeldinger
 * og tjenesteroller. Demo-samlingene, med oppgaver, tildelinger og oppmøte, følger bare med når
 * gatheringCount er satt over null. Nettsiden (sider, nyheter, taler, stab og innstillinger)
 * skrives aldri herfra; se generateDemoWebsite.
 */
export async function generateTestdata(
  options: GenerateTestdataOptions = {}
): Promise<TestdataServiceResult> {
  const startTime = Date.now();
  const result = createEmptyResult();

  // 1. Tøm eksisterende hvis valgt
  if (options.clearExisting) {
    const clearRes = await clearTestdata();
    if (!clearRes.success) {
      result.failures.push(...clearRes.failures);
    }
  }

  // 2. Klargjør mock-dokumenter med konsistente relasjoner
  const withGatherings = (options.gatheringCount ?? 0) > 0;
  const counts: CustomMockCounts = {
    personCount: options.personCount !== undefined ? Math.max(1, options.personCount) : 32,
    groupCount: options.groupCount !== undefined ? Math.max(1, options.groupCount) : 14,
    roleCount: options.roleCount !== undefined ? Math.max(0, options.roleCount) : 14,
    gatheringCount: withGatherings ? options.gatheringCount : undefined,
    taskCount: withGatherings ? options.taskCount : undefined,
  };

  const plannerDocs = getCustomMockDocuments(counts).filter(
    (docItem) =>
      !WEBSITE_COLLECTIONS.has(docItem.collection) && (withGatherings || !GATHERING_COLLECTIONS.has(docItem.collection))
  );

  // 3. Skriv dokumenter med batched writes til Firestore
  await writeDocuments(result, plannerDocs);

  result.durationMs = Date.now() - startTime;
  result.success = result.failures.length === 0;
  return result;
}

/**
 * Skriver demo-nettsiden: sidene, nyhetene, talene, staben og innstillingene som følger med appen.
 * Et dokument med samme id overskrives; alt annet blir stående. Planleggeren skrives aldri herfra.
 */
export async function generateDemoWebsite(): Promise<TestdataServiceResult> {
  const startTime = Date.now();
  const result = createEmptyResult();
  await writeDocuments(
    result,
    getMockDocuments().filter((docItem) => WEBSITE_COLLECTIONS.has(docItem.collection))
  );
  result.durationMs = Date.now() - startTime;
  result.success = result.failures.length === 0;
  return result;
}

/**
 * Genererer nøyaktig 32 testpersoner med varierende tilhørighet og roller i Firestore.
 * Dekker administrasjon, pastorer, stab, lovsangsledelse, teknisk team og husfellesskap.
 */
export async function generate32TestPersons(options?: {
  clearExisting?: boolean;
  groupCount?: number;
  roleCount?: number;
}): Promise<TestdataServiceResult> {
  return generateTestdata({
    personCount: 32,
    groupCount: options?.groupCount ?? 14,
    roleCount: options?.roleCount ?? 14,
    clearExisting: options?.clearExisting ?? true,
  });
}

/**
 * Tømmer alle planlegger-samlinger (personer, grupper, samlinger, oppgaver,
 * tildelinger, gruppemeldinger og oppmøte). Bevarer nettsiden: sider, artikler, taler,
 * innstillinger og de offentlige arrangementene som er hentet inn.
 */
export async function clearPlannerTestData(): Promise<TestdataServiceResult> {
  return clearTestdata();
}

/**
 * Bakoverkompatibel alias for å skrive et tilpasset testsett til Firestore.
 */
export async function populateCustomMockData(
  counts?: CustomMockCounts,
  options?: { clearPlannerFirst?: boolean }
): Promise<TestdataServiceResult> {
  return generateTestdata({
    ...counts,
    clearExisting: options?.clearPlannerFirst,
  });
}

