import { describe } from "vitest";
import { assert } from "./assert";
import { readFileSync } from "node:fs";
import { ALL_COLLECTIONS, COLLECTIONS, CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID } from "../src/data/collections";
import { getMockDocuments, getCustomMockDocuments } from "../src/data/mockDocuments";
import { chunk } from "../src/utils/chunk";

describe("Fylling og sletting av databasen", () => {
  // 1. chunk: batches must cover every item exactly once, in order
  assert(JSON.stringify(chunk([1, 2, 3, 4, 5], 2)) === "[[1,2],[3,4],[5]]", "chunk deler i biter med rest til slutt");
  assert(JSON.stringify(chunk([1, 2, 3, 4], 2)) === "[[1,2],[3,4]]", "chunk uten rest");
  assert(chunk([], 400).length === 0, "chunk av tom liste gir ingen biter");
  assert(chunk([1, 2], 400).length === 1, "chunk med færre elementer enn størrelsen gir én bit");
  const many = Array.from({ length: 1001 }, (_, i) => i);
  const pieces = chunk(many, 400);
  assert(
    pieces.length === 3 && pieces.every((p) => p.length <= 400) && pieces.flat().join() === many.join(),
    "chunk av 1001 elementer gir 3 biter på maks 400, uten tap"
  );
  try {
    chunk([1], 0);
    assert(false, "chunk med størrelse 0 skal kaste feil");
  } catch (err) {
    assert(err instanceof RangeError, "chunk med størrelse 0 kaster RangeError");
  }

  // 2. Everything that can be populated can also be deleted
  const documents = getMockDocuments();
  const populated = [...new Set(documents.map((d) => d.collection))];
  assert(
    populated.every((name) => ALL_COLLECTIONS.includes(name)),
    "Alle samlinger som fylles med mockdata er også med i slettingen"
  );
  const collectionsWithoutMockSeed = new Set<string>([
    CMS_COLLECTIONS.MEDIA,
    COLLECTIONS.MEMBERSHIP_APPLICATIONS,
    COLLECTIONS.MEMBERSHIP_CLERK_TASKS,
  ]);
  assert(
    [...Object.values(COLLECTIONS), ...Object.values(CMS_COLLECTIONS)].every(
      (name) => populated.includes(name) || collectionsWithoutMockSeed.has(name)
    ),
    "Mockdata dekker alle samlingene appen bruker (mediebibliotek fylles ved opplasting)"
  );
  assert(new Set(ALL_COLLECTIONS).size === ALL_COLLECTIONS.length, "Ingen samling er oppført to ganger");

  // 3. Mock documents are addressable and unique
  assert(documents.every((d) => typeof d.id === "string" && d.id.trim() !== ""), "Alle mock-dokumenter har en ID");
  const paths = documents.map((d) => `${d.collection}/${d.id}`);
  assert(new Set(paths).size === paths.length, "Ingen mock-dokumenter deler samme sti");
  assert(
    paths.includes(`${CMS_COLLECTIONS.SETTINGS}/${CMS_SETTINGS_DOC_ID}`),
    "Innstillingene skrives til cms_settings/global"
  );

  // 4. References inside the mock data point at documents that exist
  const ids = (name: string) => new Set(documents.filter((d) => d.collection === name).map((d) => d.id));
  const rows = (name: string) => documents.filter((d) => d.collection === name).map((d) => d.data as Record<string, any>);
  const persons = ids(COLLECTIONS.PERSONS);
  const groups = ids(COLLECTIONS.GROUPS);
  const gatherings = ids(COLLECTIONS.GATHERINGS);
  const tasks = ids(COLLECTIONS.TASKS);
  assert(rows(COLLECTIONS.GATHERINGS).every((g) => groups.has(g.groupId)), "Alle samlinger peker på en gruppe som finnes");
  assert(
    rows(COLLECTIONS.TASKS).every(
      (t) => gatherings.has(t.gatheringId) && (!t.groupId || groups.has(t.groupId))
    ),
    "Alle oppgaver peker på en samling og eventuelt team som finnes"
  );
  assert(
    rows(COLLECTIONS.ASSIGNMENTS).every((a) => tasks.has(a.taskId) && persons.has(a.personId)),
    "Alle tildelinger peker på en oppgave og person som finnes"
  );
  assert(
    rows(COLLECTIONS.GROUPS).every((g) => [...g.memberIds, ...g.leaderIds].every((id: string) => persons.has(id))),
    "Alle gruppemedlemmer og ledere finnes som personer"
  );

  // 5. The security rules must name every collection, or the admin functions are denied
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const missing = ALL_COLLECTIONS.filter((name) => !rules.includes(`match /${name}/{`));
  assert(missing.length === 0, `firestore.rules har en regel for hver samling (mangler: ${missing.join(", ") || "ingen"})`);

  // 6. Configurable custom mock data maintain relational integrity
  const customDocs = getCustomMockDocuments({ personCount: 8, groupCount: 4, gatheringCount: 5, taskCount: 6 });
  const cPersons = new Set(customDocs.filter((d) => d.collection === COLLECTIONS.PERSONS).map((d) => d.id));
  const cGroups = new Set(customDocs.filter((d) => d.collection === COLLECTIONS.GROUPS).map((d) => d.id));
  const cGatherings = new Set(customDocs.filter((d) => d.collection === COLLECTIONS.GATHERINGS).map((d) => d.id));
  const cTasks = new Set(customDocs.filter((d) => d.collection === COLLECTIONS.TASKS).map((d) => d.id));
  const cRows = (name: string) => customDocs.filter((d) => d.collection === name).map((d) => d.data as Record<string, any>);

  assert(cPersons.size === 8, "getCustomMockDocuments genererer nøyaktig 8 personer");
  assert(cGroups.size === 4, "getCustomMockDocuments genererer nøyaktig 4 grupper");
  assert(cGatherings.size <= 5, "getCustomMockDocuments genererer maksimalt 5 samlinger");
  assert(
    cRows(COLLECTIONS.GROUPS).every((g) => [...g.memberIds, ...g.leaderIds].every((id: string) => cPersons.has(id))),
    "Tilpassede grupper peker kun på inkluderte personer"
  );
  assert(cRows(COLLECTIONS.GATHERINGS).every((g) => cGroups.has(g.groupId)), "Tilpassede samlinger peker kun på inkluderte grupper");
  assert(
    cRows(COLLECTIONS.TASKS).every((t) => cGatherings.has(t.gatheringId) && cGroups.has(t.groupId)),
    "Tilpassede oppgaver peker kun på gyldige samlinger og grupper"
  );
  assert(
    cRows(COLLECTIONS.ASSIGNMENTS).every((a) => cTasks.has(a.taskId) && cPersons.has(a.personId)),
    "Tilpassede tildelinger peker kun på gyldige oppgaver og personer"
  );

  // 7. Fullscale 32-person mock dataset verification
  const fullDocs = getCustomMockDocuments({ personCount: 32, groupCount: 14, gatheringCount: 19, taskCount: 21 });
  const fPersons = fullDocs.filter((d) => d.collection === COLLECTIONS.PERSONS);
  const fGroups = fullDocs.filter((d) => d.collection === COLLECTIONS.GROUPS);
  assert(fPersons.length === 32, "Fullskala oppsett genererer nøyaktig 32 personer");
  assert(fGroups.length === 14, "Fullskala oppsett genererer 14 grupper");
  const staffMembers = fPersons.filter((p: any) => p.data.isStaff === true);
  assert(staffMembers.length >= 8, "Fullskala oppsett inneholder minst 8 stabsmedlemmer");
  const pastors = staffMembers.filter((p: any) => p.data.staffCategory === "pastor");
  assert(pastors.length >= 3, "Fullskala oppsett inneholder minst 3 pastorer");

  // 8. Planner collections vs CMS collections separation
  const plannerCols = new Set(Object.values(COLLECTIONS));
  const cmsCols = new Set(Object.values(CMS_COLLECTIONS));
  for (const c of plannerCols) {
    assert(!cmsCols.has(c as any), `Planlegger-samling ${c} overlapper ikke med CMS-samlinger`);
  }
});
