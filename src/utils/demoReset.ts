import { OPTIONAL_SETTINGS, REQUIRED_SETTINGS, readDemoInstallation, type InstallationEnv } from "../installation";
import { storedFormOf, type MockDocument } from "../data/mockDocuments";

// The rules for resetting the demo's database: which database may be reset, what is written and
// removed, and how a document is handed to the database from outside the app. The reset itself,
// which talks to the database, is scripts/reset-demo.ts.
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

// ---------- What is written and what is removed ----------

/** A document's place in the database: "persons/person-1". */
export const pathOf = (document: { collection: string; id: string }): string => `${document.collection}/${document.id}`;

export interface ResetPlan {
  /** The demo documents, each in the form and the collection it is stored in. */
  write: MockDocument[];
  /** The places of the documents that are not part of the demo content, and so are removed. */
  remove: string[];
}

/**
 * What a reset does to a database that holds `existing`: every demo document is written over
 * what is there, and everything else is removed. Written first and removed after, so the demo
 * is never empty while someone looks at it.
 */
export function planReset(demoDocuments: MockDocument[], existing: readonly string[]): ResetPlan {
  const write = demoDocuments.map(storedFormOf);
  const kept = new Set(write.map(pathOf));
  if (kept.size !== write.length) {
    throw new Error("To av dokumentene i demoinnholdet har samme plass i databasen.");
  }
  return { write, remove: existing.filter((path) => !kept.has(path)) };
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
