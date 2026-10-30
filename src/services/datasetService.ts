import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { ALL_COLLECTIONS, CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID, COLLECTIONS } from "../data/collections";
import { chunk } from "../utils/chunk";
import { DATA_PARTS, documentsToDelete, keepParts, type DataPart } from "../utils/dataParts";
import { buildDataset, type Dataset, type DatasetDocument } from "../utils/dataset";
import { sanitizeForFirestore } from "../utils/firestoreData";
import { ADDONS_RECORD } from "../utils/addons";
import { TRAFFIC_RECORD } from "../utils/siteTraffic";
import { HEADCOUNT_RECORD } from "./headcounts";
import { OPERATING_MODE_RECORD, ensureDeletionAllowed } from "./operatingMode";
import { SURFACES_RECORD } from "../data/settingsRecords";
import type { TestdataServiceResult } from "./testdataService";
import { VOLUNTEER_ROLE_RECORD } from "./volunteerRoles";

// Firestore accepts at most 500 writes per batch
const BATCH_SIZE = 400;

/**
 * Collections that are stored as marked documents in cms_settings for now (see volunteerRoles.ts
 * and headcounts.ts). A dataset names them as the collections they are, so a file made today
 * still fits the day they get collections of their own.
 */
/** Marked documents in cms_settings that say how the app is set up or used, not what it contains. */
const NOT_CONTENT = new Set<unknown>([OPERATING_MODE_RECORD, TRAFFIC_RECORD, ADDONS_RECORD, SURFACES_RECORD]);

const KEPT_IN_SETTINGS: Record<string, string> = {
  [COLLECTIONS.VOLUNTEER_ROLES]: VOLUNTEER_ROLE_RECORD,
  [COLLECTIONS.GATHERING_HEADCOUNTS]: HEADCOUNT_RECORD,
};

const collectionOfMark = (recordType: unknown): string | undefined =>
  Object.keys(KEPT_IN_SETTINGS).find((name) => KEPT_IN_SETTINGS[name] === recordType);

/** Where a collection named in a dataset is stored today. */
const storedIn = (collectionName: string): string =>
  collectionName in KEPT_IN_SETTINGS ? CMS_COLLECTIONS.SETTINGS : collectionName;

const isPermissionDenied = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === "permission-denied";

interface DatabaseContents {
  /** Every document, under the collection it belongs to (not the one it happens to be stored in). */
  collections: Record<string, DatasetDocument[]>;
  /** Collections the rules in force would not let us read. */
  unreadable: string[];
}

/**
 * Reads the whole database.
 *
 * The rules deployed on a project can be older than the app and turn away a collection the
 * app has since been given (see CLAUDE.md). Such a collection is left out and named. Any
 * other failure is thrown: what is built on a half-read database would be wrong.
 */
async function readDatabase(): Promise<DatabaseContents> {
  const collections: Record<string, DatasetDocument[]> = {};
  const unreadable: string[] = [];
  const add = (collectionName: string, document: DatasetDocument) => {
    (collections[collectionName] ??= []).push(document);
  };

  for (const collectionName of ALL_COLLECTIONS) {
    if (collectionName in KEPT_IN_SETTINGS) continue;
    let snapshot;
    try {
      snapshot = await getDocs(collection(db, collectionName));
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
      unreadable.push(collectionName);
      continue;
    }
    for (const docSnap of snapshot.docs) {
      const { recordType, ...fields } = docSnap.data();
      // Whether the app is in demo or production is not content, and neither are the visit counts
      // or the choice of add-ons: they are neither downloaded nor emptied here (see
      // services/siteTraffic.ts and services/addons.ts)
      if (collectionName === CMS_COLLECTIONS.SETTINGS && NOT_CONTENT.has(recordType)) continue;
      const kept = collectionName === CMS_COLLECTIONS.SETTINGS ? collectionOfMark(recordType) : undefined;
      if (kept) add(kept, { ...fields, id: docSnap.id });
      else add(collectionName, { ...docSnap.data(), id: docSnap.id });
    }
  }
  return { collections, unreadable };
}

export interface ExportedDataset {
  dataset: Dataset;
  /** Collections the rules in force would not let us read. They are not in the dataset. */
  unreadable: string[];
}

/**
 * The database as one dataset: everything, or only the website or only the planner
 * (see utils/dataParts.ts). Uploaded images stay in the image store; the dataset holds the
 * references to them. A collection that cannot be read is named, so the caller can say that
 * the file is not everything.
 */
export async function exportDataset(
  name: string,
  description = "",
  now: Date = new Date(),
  parts: readonly DataPart[] = DATA_PARTS
): Promise<ExportedDataset> {
  const { collections, unreadable } = await readDatabase();
  return { dataset: buildDataset(name, description, keepParts(collections, parts), now), unreadable };
}

/** Where a document from a dataset is stored, and in what form. */
function storedForm(collectionName: string, document: DatasetDocument): { collection: string; data: object } {
  const mark = KEPT_IN_SETTINGS[collectionName];
  if (mark) return { collection: CMS_COLLECTIONS.SETTINGS, data: { ...document, recordType: mark } };
  if (collectionName === CMS_COLLECTIONS.SETTINGS && document.id === CMS_SETTINGS_DOC_ID) {
    // The settings document is addressed by its place, not by a field in it
    const { id: _id, ...settings } = document;
    return { collection: collectionName, data: settings };
  }
  return { collection: collectionName, data: document };
}

/**
 * Writes every document in the dataset. A document already in the database under the same id
 * is replaced by the one in the file; everything else in the database is left as it is.
 * Nothing is deleted here: emptying the database first is a separate, deliberate step.
 */
export async function importDataset(dataset: Dataset): Promise<TestdataServiceResult> {
  const startTime = Date.now();
  const result: TestdataServiceResult = { success: true, counts: {}, total: 0, failures: [] };

  for (const [collectionName, documents] of Object.entries(dataset.collections)) {
    try {
      for (const piece of chunk(documents, BATCH_SIZE)) {
        const batch = writeBatch(db);
        for (const document of piece) {
          const stored = storedForm(collectionName, document);
          batch.set(doc(db, stored.collection, document.id), sanitizeForFirestore(stored.data));
        }
        await batch.commit();
      }
      result.counts[collectionName] = documents.length;
      result.total += documents.length;
    } catch (error) {
      console.error(`Datasett: ${collectionName} feilet:`, error);
      result.failures.push({
        collection: collectionName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  result.success = result.failures.length === 0;
  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Whether the given parts of the database hold anything. Asked at the moment a dataset is
 * about to be brought in, so the answer does not depend on what a screen has loaded so far.
 */
export async function databaseHasContent(parts: readonly DataPart[] = DATA_PARTS): Promise<boolean> {
  const { collections } = await readDatabase();
  return Object.keys(keepParts(collections, parts)).length > 0;
}

export interface ClearedDatabase {
  deleted: number;
  failures: { collection: string; message: string }[];
}

/**
 * Empties the given parts of the database, so a dataset can take the place of what was there.
 * The other part is left alone; see documentsToDelete for what follows an event that goes.
 * There is no undo: the caller takes a copy first (see exportDataset).
 *
 * If the database cannot be read in full, nothing is deleted: which documents belong to which
 * part is only known when all of them are seen. A collection the rules in force turn away is
  * passed over, as in exportDataset: the app cannot have stored anything there.
 *
 * Throws when the app is in production (see operatingMode.ts): nothing is emptied then.
 */
export async function clearDatabase(parts: readonly DataPart[] = DATA_PARTS): Promise<ClearedDatabase> {
  await ensureDeletionAllowed();
  const cleared: ClearedDatabase = { deleted: 0, failures: [] };
  let contents: DatabaseContents;
  try {
    contents = await readDatabase();
  } catch (error) {
    console.error("Datasett: databasen kunne ikke leses før tømming:", error);
    cleared.failures.push({ collection: "", message: error instanceof Error ? error.message : String(error) });
    return cleared;
  }

  const byCollection = new Map<string, string[]>();
  for (const { collection: collectionName, id } of documentsToDelete(contents.collections, parts)) {
    byCollection.set(collectionName, [...(byCollection.get(collectionName) ?? []), id]);
  }
  for (const [collectionName, ids] of byCollection) {
    try {
      for (const piece of chunk(ids, BATCH_SIZE)) {
        const batch = writeBatch(db);
        for (const id of piece) batch.delete(doc(db, storedIn(collectionName), id));
        await batch.commit();
      }
      cleared.deleted += ids.length;
    } catch (error) {
      console.error(`Datasett: sletting av ${collectionName} feilet:`, error);
      cleared.failures.push({
        collection: collectionName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return cleared;
}
