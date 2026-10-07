import { ALL_COLLECTIONS, CMS_COLLECTIONS, COLLECTIONS } from "../data/collections";

// A dataset is the content of the database as one file: every document, grouped by collection.
// "Last ned datasett" writes one and "Hent inn datasett" reads one, so content can be kept safe,
// moved between installations, or swapped: the demo content out, a congregation's own content in.

export const DATASET_FORMAT = "menighetsplan-datasett";
export const DATASET_VERSION = 1;

export interface DatasetDocument {
  id: string;
  [field: string]: unknown;
}

export interface Dataset {
  format: typeof DATASET_FORMAT;
  version: number;
  name: string;
  description?: string;
  /** When the file was made, as an exact moment (ISO 8601). */
  createdAt: string;
  collections: Record<string, DatasetDocument[]>;
}

/** What each collection is called in the admin screens. */
export const COLLECTION_LABELS: Record<string, string> = {
  [CMS_COLLECTIONS.SETTINGS]: "Innstillinger",
  [CMS_COLLECTIONS.PAGES]: "Sider",
  [CMS_COLLECTIONS.NEWS]: "Nyheter",
  [CMS_COLLECTIONS.SERMONS]: "Taler",
  [CMS_COLLECTIONS.STAFF]: "Stab",
  [CMS_COLLECTIONS.MEDIA]: "Bilder",
  [COLLECTIONS.PERSONS]: "Personer",
  [COLLECTIONS.GROUPS]: "Grupper",
  [COLLECTIONS.GATHERINGS]: "Samlinger",
  [COLLECTIONS.TASKS]: "Oppgaver",
  [COLLECTIONS.ASSIGNMENTS]: "Tildelinger",
  [COLLECTIONS.VOLUNTEER_ROLES]: "Tjenesteroller",
  [COLLECTIONS.GROUP_MESSAGES]: "Meldinger i grupper",
  [COLLECTIONS.GATHERING_ATTENDANCES]: "Svar på samlinger",
  [COLLECTIONS.GATHERING_HEADCOUNTS]: "Oppmøtetall",
};

export const collectionLabel = (name: string): string => COLLECTION_LABELS[name] ?? name;

/** The collections in the order the admin lists them: the website first, then the planner. */
const DISPLAY_ORDER = Object.keys(COLLECTION_LABELS);
const byDisplayOrder = (a: string, b: string) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b);

export interface DatasetCount {
  collection: string;
  label: string;
  count: number;
}

/** How many documents the dataset holds per collection, empty collections left out. */
export function countDataset(dataset: Pick<Dataset, "collections">): DatasetCount[] {
  return Object.keys(dataset.collections)
    .filter((name) => dataset.collections[name].length > 0)
    .sort(byDisplayOrder)
    .map((name) => ({ collection: name, label: collectionLabel(name), count: dataset.collections[name].length }));
}

export const totalDocuments = (dataset: Pick<Dataset, "collections">): number =>
  Object.values(dataset.collections).reduce((sum, documents) => sum + documents.length, 0);

/** Puts documents read from the database into the file format. Empty collections are left out. */
export function buildDataset(
  name: string,
  description: string,
  collections: Record<string, DatasetDocument[]>,
  now: Date = new Date()
): Dataset {
  const kept: Record<string, DatasetDocument[]> = {};
  for (const collectionName of Object.keys(collections).sort(byDisplayOrder)) {
    const documents = collections[collectionName];
    if (documents.length === 0) continue;
    kept[collectionName] = [...documents].sort((a, b) => a.id.localeCompare(b.id));
  }
  return {
    format: DATASET_FORMAT,
    version: DATASET_VERSION,
    name: name.trim() || "Datasett uten navn",
    ...(description.trim() ? { description: description.trim() } : {}),
    createdAt: now.toISOString(),
    collections: kept,
  };
}

/** The text of the file. Indented, so the file can be read and compared by eye. */
export const serializeDataset = (dataset: Dataset): string => JSON.stringify(dataset, null, 2) + "\n";

/** A file name from the dataset name and the day it was made, e.g. `menigheten-2026-10-06.json`. */
export function datasetFileName(dataset: Pick<Dataset, "name" | "createdAt">): string {
  const base = dataset.name
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "datasett"}-${dataset.createdAt.slice(0, 10)}.json`;
}

export type ParsedDataset =
  | {
      ok: true;
      dataset: Dataset;
      counts: DatasetCount[];
      total: number;
      /** Collections in the file that this version of the app does not have. They are not brought in. */
      skipped: string[];
    }
  | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads the text of a dataset file. Nothing is brought in from a file that is not whole:
 * a document without an id, or two with the same id in one collection, stops the whole file.
 * The messages are shown to the person in admin as they stand.
 */
export function parseDataset(text: string): ParsedDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Filen kan ikke leses. Den er ikke et datasett fra Menighetsplan." };
  }
  if (!isRecord(raw) || raw.format !== DATASET_FORMAT || !isRecord(raw.collections)) {
    return { ok: false, error: "Filen er ikke et datasett fra Menighetsplan." };
  }
  if (typeof raw.version !== "number" || raw.version > DATASET_VERSION) {
    return {
      ok: false,
      error: "Datasettet er laget i en nyere utgave av Menighetsplan enn denne, og kan ikke hentes inn her.",
    };
  }

  const collections: Record<string, DatasetDocument[]> = {};
  const skipped: string[] = [];
  for (const [collectionName, documents] of Object.entries(raw.collections)) {
    if (!ALL_COLLECTIONS.includes(collectionName)) {
      skipped.push(collectionName);
      continue;
    }
    const label = collectionLabel(collectionName);
    if (!Array.isArray(documents)) {
      return { ok: false, error: `Datasettet er skadet: «${label}» er ikke en liste.` };
    }
    const seen = new Set<string>();
    for (const document of documents) {
      if (!isRecord(document) || typeof document.id !== "string" || !document.id.trim() || document.id.includes("/")) {
        return { ok: false, error: `Datasettet er skadet: noe under «${label}» mangler en gyldig nøkkel.` };
      }
      if (seen.has(document.id)) {
        return { ok: false, error: `Datasettet er skadet: «${label}» har to oppføringer med samme nøkkel.` };
      }
      seen.add(document.id);
    }
    if (documents.length > 0) collections[collectionName] = documents as DatasetDocument[];
  }

  const dataset: Dataset = {
    format: DATASET_FORMAT,
    version: raw.version,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Datasett uten navn",
    ...(typeof raw.description === "string" && raw.description.trim() ? { description: raw.description.trim() } : {}),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    collections,
  };
  const total = totalDocuments(dataset);
  if (total === 0) {
    return { ok: false, error: "Datasettet er tomt. Det er ingenting å hente inn." };
  }
  return { ok: true, dataset, counts: countDataset(dataset), total, skipped };
}
