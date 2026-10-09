import { collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { ALL_COLLECTIONS } from "../data/collections";
import { chunk } from "../utils/chunk";
import { FULL_DEMO_COUNTS } from "../data/mockDocuments";
import { ensureDeletionAllowed } from "./operatingMode";
import {
  clearTestdata,
  clearPlannerTestData,
  generateTestdata,
  generateDemoWebsite,
  generate32TestPersons,
  deletePersonsTestdata,
  deleteGroupsTestdata,
  deleteRolesTestdata,
  populateCustomMockData,
  type TestdataServiceResult,
  type TestdataCounts,
  type GenerateTestdataOptions,
  type ClearTestdataOptions,
} from "./testdataService";

// Firestore accepts at most 500 writes per batch
const BATCH_SIZE = 400;

export type DatabaseAdminResult = TestdataServiceResult;

export {
  clearTestdata,
  clearPlannerTestData,
  generateTestdata,
  generate32TestPersons,
  deletePersonsTestdata,
  deleteGroupsTestdata,
  deleteRolesTestdata,
  populateCustomMockData,
  type TestdataServiceResult,
  type TestdataCounts,
  type GenerateTestdataOptions,
  type ClearTestdataOptions,
};

function emptyResult(): DatabaseAdminResult {
  return { success: true, counts: {}, total: 0, failures: [] };
}

function recordFailure(result: DatabaseAdminResult, collectionName: string, error: unknown) {
  console.error(`Database admin: ${collectionName} failed:`, error);
  result.success = false;
  result.failures.push({
    collection: collectionName,
    message: error instanceof Error ? error.message : String(error),
  });
}

// The demo content comes in two parts that are filled apart from each other (see utils/dataParts.ts):
// the planner (persons, groups, gatherings, tasks, roles) and the website (pages, news, sermons,
// staff, settings). A congregation's own website can then stay while the planner gets test persons.

/** The demo persons, groups and roles. No gatherings, and nothing on the website. */
export async function populateDemoPersons(): Promise<DatabaseAdminResult> {
  return generateTestdata({ personCount: 32, groupCount: 14, roleCount: 14 });
}

/**
 * Writes the full mock data set, planner and website both. Documents with the same id are overwritten;
 * other documents are left as they are. If clearPlannerFirst is set to true, planner test data is cleared first.
 */
export async function populateWithMockData(options?: { clearPlannerFirst?: boolean }): Promise<DatabaseAdminResult> {
  const planner = await populateCustomMockData(FULL_DEMO_COUNTS, options);
  const website = await generateDemoWebsite();
  const failures = [...planner.failures, ...website.failures];
  return {
    success: failures.length === 0,
    counts: { ...planner.counts, ...website.counts },
    total: planner.total + website.total,
    failures,
  };
}

/** Fills the planner with the full demo set: persons, groups, gatherings, tasks and tjenesteroller. */
export async function restoreFullMockDatabase(): Promise<DatabaseAdminResult> {
  return populateCustomMockData(FULL_DEMO_COUNTS, { clearPlannerFirst: false });
}

/**
 * Permanently deletes every document in every collection the app uses.
 * There is no undo. Throws when the app is in production (see operatingMode.ts).
 */
export async function deleteAllData(): Promise<DatabaseAdminResult> {
  await ensureDeletionAllowed();
  const result = emptyResult();

  for (const collectionName of ALL_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, collectionName));
      for (const piece of chunk(snap.docs, BATCH_SIZE)) {
        const batch = writeBatch(db);
        for (const docSnap of piece) {
          batch.delete(docSnap.ref);
        }
        await batch.commit();
      }
      result.counts[collectionName] = snap.size;
      result.total += snap.size;
    } catch (error) {
      recordFailure(result, collectionName, error);
    }
  }
  result.success = result.failures.length === 0;
  return result;
}
