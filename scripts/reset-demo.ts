import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';
import { ALL_COLLECTIONS, CMS_COLLECTIONS } from '../src/data/collections';
import { DEMO_CONTENT_WEEK, FULL_DEMO_COUNTS, getCustomMockDocuments } from '../src/data/mockDocuments';
import { OPERATING_MODE_DOC_ID, operatingModeOf } from '../src/data/settingsRecords';
import { chunk } from '../src/utils/chunk';
import { firestoreFieldsOf, pathOf, planReset, resetRefusal, resetTargetOf, type ResetTarget } from '../src/utils/demoReset';
import { weeksBetween } from '../src/utils/liveDates';

// Resets the demo: fills its database with the example congregation, with the dates counted from
// today, and removes everything else that is in it. Run every night (.github/workflows), and by
// hand when the demo content has changed:
//
//   npm run reset-demo -- <navnet på demoens Firebase-prosjekt>
//
// The settings are the demo installation's own: .env.demodb.local on a developer's machine, the
// environment where it runs by itself. Only the demo is ever reset (see src/utils/demoReset.ts).
//
// The demo's database has open rules, so it is reached without signing in, and the script needs
// nothing but the name of the project. A congregation's database has closed rules and refuses.

// Well below what one request may hold (500 writes)
const WRITES_PER_REQUEST = 200;

type Fetch = typeof fetch;

interface StoredDocument {
  name: string;
  fields?: Record<string, { stringValue?: string }>;
}

const rootOf = (target: ResetTarget) =>
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(target.projectId)}/databases/${target.databaseId}/documents`;

async function ask<T>(fetchFn: Fetch, what: string, url: string, body?: unknown): Promise<T> {
  const response = await fetchFn(
    url,
    body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Databasen svarte ${response.status} da skriptet skulle ${what}: ${text.slice(0, 600)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Every document in a collection, as the database holds it. */
async function readCollection(fetchFn: Fetch, target: ResetTarget, collection: string): Promise<StoredDocument[]> {
  const documents: StoredDocument[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${rootOf(target)}/${encodeURIComponent(collection)}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const page = await ask<{ documents?: StoredDocument[]; nextPageToken?: string }>(fetchFn, `lese ${collection}`, url);
    documents.push(...(page.documents ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return documents;
}

/** "persons/person-1" from the full name the database gives a document. */
const pathInDatabase = (name: string) => name.slice(name.indexOf('/documents/') + '/documents/'.length);

async function readAll(fetchFn: Fetch, target: ResetTarget): Promise<StoredDocument[]> {
  const perCollection = await Promise.all(ALL_COLLECTIONS.map((collection) => readCollection(fetchFn, target, collection)));
  return perCollection.flat();
}

export interface ResetResult {
  weeks: number;
  written: number;
  removed: number;
}

/**
 * Resets the database `target` points at. The caller has made sure it is the demo's
 * (resetRefusal). Throws, with nothing removed, if the database says it is in production.
 */
export async function resetDemo(target: ResetTarget, now: number, fetchFn: Fetch = fetch): Promise<ResetResult> {
  const nameOf = (path: string) => `projects/${target.projectId}/databases/${target.databaseId}/documents/${path}`;

  // Made before anything is touched: content that cannot be stored stops the reset here
  const demoDocuments = getCustomMockDocuments(FULL_DEMO_COUNTS, now);
  const before = await readAll(fetchFn, target);

  const modeDocument = before.find((d) => pathInDatabase(d.name) === `${CMS_COLLECTIONS.SETTINGS}/${OPERATING_MODE_DOC_ID}`);
  const mode = operatingModeOf({
    recordType: modeDocument?.fields?.recordType?.stringValue,
    mode: modeDocument?.fields?.mode?.stringValue,
  });
  if (mode === 'production') {
    throw new Error('Databasen står i produksjon, og da nullstilles den ikke. Ingenting er gjort.');
  }

  const plan = planReset(demoDocuments, before.map((d) => pathInDatabase(d.name)));
  const writes = [
    ...plan.write.map((document) => ({ update: { name: nameOf(pathOf(document)), fields: firestoreFieldsOf(document.data) } })),
    ...plan.remove.map((path) => ({ delete: nameOf(path) })),
  ];
  for (const piece of chunk(writes, WRITES_PER_REQUEST)) {
    await ask(fetchFn, 'skrive demoinnholdet', `${rootOf(target)}:commit`, { writes: piece });
  }

  // The database is read once more, and must hold the demo content and nothing else
  const wanted = new Set(plan.write.map(pathOf));
  const after = (await readAll(fetchFn, target)).map((d) => pathInDatabase(d.name));
  const missing = [...wanted].filter((path) => !after.includes(path));
  const extra = after.filter((path) => !wanted.has(path));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Databasen er ikke som den skal etter nullstillingen. Mangler: ${missing.slice(0, 5).join(', ') || 'ingen'}. For mye: ${extra.slice(0, 5).join(', ') || 'ingen'}.`
    );
  }

  return { weeks: weeksBetween(DEMO_CONTENT_WEEK, now), written: plan.write.length, removed: plan.remove.length };
}

async function main() {
  const env = { ...loadEnv('demodb', process.cwd(), 'VITE_'), ...process.env };
  const refusal = resetRefusal(env, process.argv[2]);
  if (refusal) throw new Error(refusal);

  const target = resetTargetOf(env)!;
  console.log(`Nullstiller demoen: ${target.projectId}`);
  const result = await resetDemo(target, Date.now());
  console.log(`Skrevet: ${result.written} dokumenter. Fjernet: ${result.removed} som ikke hører til demoinnholdet.`);
  console.log(`Datoene er flyttet ${result.weeks} uker fram fra uka innholdet er skrevet for (${DEMO_CONTENT_WEEK}).`);
  console.log('Kontrollert: databasen har demoinnholdet og ingenting annet.');
}

// Only when the file is run, not when a test reads resetDemo from it
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
