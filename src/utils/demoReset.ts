import { OPTIONAL_SETTINGS, REQUIRED_SETTINGS, readDemoInstallation, type InstallationEnv } from "../installation";
import { storedFormOf, type MockDocument } from "../data/mockDocuments";
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID } from "../data/collections";
import { documentsToDelete, keepParts } from "./dataParts";
import type { Dataset, DatasetDocument } from "./dataset";
import { withoutStaffPictures } from "./demoPortraits";
import { collectionPrefixOf } from "./demoSite";
import { weeksBetween, withLiveDates } from "./liveDates";

// The rules for resetting the demo's database: which database may be reset, what each
// congregation in the demo is made of, what is written and removed, and how a document is handed
// to the database from outside the app. The reset itself, which talks to the database, is
// scripts/reset-demo.ts.
//
// The demo is the only installation that is ever reset. In the app nothing empties its database
// (see ensureDeletionAllowed in services/operatingMode.ts), so it is done from outside, each night.

export interface ResetTarget {
  projectId: string;
  /** "(default)" unless the installation names its database. */
  databaseId: string;
}

const settingOf = (env: InstallationEnv, name: string): string | undefined => {
  const value = env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

/** The database the settings point at, or null when they name no project. */
export function resetTargetOf(env: InstallationEnv): ResetTarget | null {
  const projectId = settingOf(env, REQUIRED_SETTINGS.projectId);
  if (!projectId) return null;
  return { projectId, databaseId: settingOf(env, OPTIONAL_SETTINGS.firestoreDatabaseId) ?? "(default)" };
}

/**
 * Why the database of these settings may not be reset, in words for the one who asked, or null
 * when it may. It must be the demo's, and the one who asks must have written its name: a reset
 * removes everything a database holds, and no congregation's database is ever to be hit by it.
 */
export function resetRefusal(env: InstallationEnv, confirmedProject: string | undefined): string | null {
  const target = resetTargetOf(env);
  if (!target) {
    return `Innstillingene sier ikke hvilken database det gjelder (${REQUIRED_SETTINGS.projectId} mangler). Ingenting er gjort.`;
  }
  if (readDemoInstallation(env) === null) {
    return "Bare demoen kan nullstilles, og disse innstillingene hører ikke til demoen. Ingenting er gjort.";
  }
  if (!confirmedProject) {
    return `Skriv navnet på databasen som skal nullstilles: npm run reset-demo -- ${target.projectId}`;
  }
  if (confirmedProject !== target.projectId) {
    return `Du ba om å nullstille «${confirmedProject}», men innstillingene peker på «${target.projectId}». Ingenting er gjort.`;
  }
  return null;
}

// ---------- What each congregation in the demo is made of ----------

/** A document's place in the database: "persons/person-1". */
export const pathOf = (document: { collection: string; id: string }): string => `${document.collection}/${document.id}`;

/** A congregation's set, as far as the reset reads it: its documents, and when they were fetched. */
export type SiteSet = Pick<Dataset, "collections" | "createdAt">;

/** The documents of one congregation in the demo: the example congregation is null (see utils/demoSite.ts). */
export interface SiteContent {
  site: string | null;
  documents: MockDocument[];
}

/**
 * The documents of a congregation whose website has been made into a set: the set's website,
 * and the example congregation's planner. It is what «Velg menighet» under Database leaves in a
 * database that held the example: the example's website is taken out, with what hangs on its
 * events, and the set's website is put in. Without a set it is the example as it is.
 *
 * The dates in a set are moved whole weeks from the week it was fetched in, like the example's
 * (see utils/liveDates.ts), so the calendar on the website is never all in the past. The
 * pictures of the congregation's staff are left out (see utils/demoPortraits.ts).
 */
export function siteDocuments(example: MockDocument[], set: SiteSet | null, now: number): MockDocument[] {
  if (!set) return example;

  const exampleCollections: Record<string, DatasetDocument[]> = {};
  for (const document of example) {
    (exampleCollections[document.collection] ??= []).push({ ...document.data, id: document.id });
  }
  const gone = new Set(documentsToDelete(exampleCollections, ["website"]).map(pathOf));

  const weeks = weeksBetween(set.createdAt.slice(0, 10), now);
  const website = Object.entries(keepParts(withoutStaffPictures(set.collections), ["website"])).flatMap(([collection, documents]) =>
    documents.map((document): MockDocument => {
      // The settings document is addressed by its place, not by a field in it
      const { id, ...withoutId } = document;
      const isSettings = collection === CMS_COLLECTIONS.SETTINGS && id === CMS_SETTINGS_DOC_ID;
      return { collection, id, data: withLiveDates(isSettings ? withoutId : document, weeks) };
    })
  );

  // Should the two share a place, the congregation's own document is the one that stands
  const fromSet = new Set(website.map(pathOf));
  return [...example.filter((document) => !gone.has(pathOf(document)) && !fromSet.has(pathOf(document))), ...website];
}

// ---------- What is written and what is removed ----------

export interface ResetPlan {
  /** Every document of every congregation, in the form and the collection it is stored in. */
  write: MockDocument[];
  /** The places of the documents that are not part of the demo content, and so are removed. */
  remove: string[];
}

/**
 * What a reset does to a database that holds `existing`: every document of every congregation
 * is written over what is there, and everything else is removed. Written first and removed
 * after, so the demo is never empty while someone looks at it.
 *
 * A congregation's documents are stored under its own collections: the plain names with the
 * congregation's id in front, and the plain names alone for the example congregation.
 *
 * `left` are the places of documents that are neither content nor a visitor's: how the owner
 * has set up the demo. They are not written and not removed.
 */
export function planReset(sites: readonly SiteContent[], existing: readonly string[], left: readonly string[] = []): ResetPlan {
  const write = sites.flatMap(({ site, documents }) =>
    documents.map(storedFormOf).map((document) => ({ ...document, collection: collectionPrefixOf(site) + document.collection }))
  );
  const kept = new Set(write.map(pathOf));
  if (kept.size !== write.length) {
    throw new Error("To av dokumentene i demoinnholdet har samme plass i databasen.");
  }
  if (left.some((path) => kept.has(path))) {
    throw new Error("Et dokument i demoinnholdet ligger der oppsettet av demoen skal ligge.");
  }
  return { write, remove: existing.filter((path) => !kept.has(path) && !left.includes(path)) };
}

// ---------- A document as the database takes it from outside the app ----------

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

/** A value as it is written in a request to the database. The app's own client does the same when it stores a document. */
export function firestoreValueOf(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Tallet ${value} kan ikke lagres.`);
    return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.filter((item) => item !== undefined).map(firestoreValueOf) } };
  }
  if (typeof value === "object") return { mapValue: { fields: firestoreFieldsOf(value) } };
  throw new Error(`En verdi av typen ${typeof value} kan ikke lagres.`);
}

/** The fields of a document. A field that is undefined is left out, as the database has no such value. */
export function firestoreFieldsOf(data: object): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, firestoreValueOf(value)])
  );
}
