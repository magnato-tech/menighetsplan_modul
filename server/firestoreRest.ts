// Reading the database the way a visitor who is not signed in reads it, without the Firebase
// client: plain requests to Firestore's own address. A function at the hosting (see
// server/vercel) starts faster without the client, and it is given nothing a visitor is not:
// the database's rules decide what comes back.

/** A value as Firestore's address gives it: one key that names the type. */
export type RestValue = Record<string, unknown>;
export type RestFields = Record<string, RestValue>;
export interface RestDocument {
  name: string;
  fields?: RestFields;
}

/** What is asked with: `fetch` itself, or a stand-in in a test. */
export type Fetch = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface RestDatabase {
  projectId: string;
  /** A named database. Left out for the default one. */
  databaseId?: string;
}

/** Thrown when the database refuses or cannot answer. `status` is what it answered with. */
export class FirestoreRestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "FirestoreRestError";
  }
}

const documentsOf = ({ projectId, databaseId }: RestDatabase): string =>
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId || "(default)")}/documents`;

/** One value as the app holds it. A time becomes the text it is stored as elsewhere in the app. */
export function decodeValue(value: RestValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) return decodeFields((value.mapValue as { fields?: RestFields }).fields);
  if ("arrayValue" in value) return ((value.arrayValue as { values?: RestValue[] }).values ?? []).map(decodeValue);
  if ("referenceValue" in value) return value.referenceValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("bytesValue" in value) return value.bytesValue;
  return undefined;
}

export function decodeFields(fields: RestFields | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([key, value]) => [key, decodeValue(value)]));
}

/** A document as the app holds it. The id is the one stored in it, or else the document's own name. */
export function decodeDocument(document: RestDocument): Record<string, unknown> & { id: string } {
  const data = decodeFields(document.fields);
  const stored = typeof data.id === "string" && data.id ? data.id : null;
  return { ...data, id: stored ?? document.name.slice(document.name.lastIndexOf("/") + 1) };
}

/** What is sent to ask for the documents of a collection where a field is true. */
export function whereTrueQuery(collectionId: string, field: string) {
  return {
    structuredQuery: {
      from: [{ collectionId }],
      where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { booleanValue: true } } },
    },
  };
}

/**
 * The documents of a collection where a field is true: the question the website asks for the
 * events a visitor may see (subscribePublicPart in src/services/firestore.ts).
 */
export async function readWhereTrue(database: RestDatabase, collectionId: string, field: string, ask: Fetch): Promise<(Record<string, unknown> & { id: string })[]> {
  const response = await ask(`${documentsOf(database)}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(whereTrueQuery(collectionId, field)),
  });
  if (!response.ok) throw new FirestoreRestError(`Databasen svarte ${response.status} for ${collectionId}`, response.status);
  const rows = (await response.json()) as { document?: RestDocument; error?: { code?: number; message?: string } }[];
  if (!Array.isArray(rows)) throw new FirestoreRestError(`Databasen svarte ikke med en liste for ${collectionId}`, 502);
  const failed = rows.find((row) => row.error);
  if (failed?.error) throw new FirestoreRestError(failed.error.message || `Databasen svarte med en feil for ${collectionId}`, failed.error.code ?? 502);
  return rows.flatMap((row) => (row.document ? [decodeDocument(row.document)] : []));
}

/** One document, or null when it is not there or may not be read. */
export async function readDocument(database: RestDatabase, path: string, ask: Fetch): Promise<(Record<string, unknown> & { id: string }) | null> {
  const response = await ask(`${documentsOf(database)}/${path}`);
  if (!response.ok) return null;
  return decodeDocument((await response.json()) as RestDocument);
}
