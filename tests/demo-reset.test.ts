import { describe, expect, test } from "vitest";
import path from "node:path";
import { readDemoSets, resetDemo, type DemoSet } from "../scripts/reset-demo";
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID, COLLECTIONS, PLAIN_COLLECTIONS } from "../src/data/collections";
import { FULL_DEMO_COUNTS, getCustomMockDocuments, storedFormOf, type MockDocument } from "../src/data/mockDocuments";
import { HEADCOUNT_RECORD, OPERATING_MODE_DOC_ID, OPERATING_MODE_RECORD, VOLUNTEER_ROLE_RECORD } from "../src/data/settingsRecords";
import {
  firestoreFieldsOf,
  firestoreValueOf,
  pathOf,
  planReset,
  resetRefusal,
  resetTargetOf,
  siteDocuments,
  type FirestoreValue,
  type ResetTarget,
  type SiteSet,
} from "../src/utils/demoReset";
import { upcomingPublicGatherings } from "../src/utils/gatherings";
import type { Gathering } from "../src/types";

// The demo's database is reset from outside the app. Only the demo's: these are the rules for
// which database it may be, what is written and removed, and the reset run against a stand-in
// for the database.

const DEMO_ENV = { VITE_FIREBASE_PROJECT_ID: "demo-prosjektet", VITE_DEMO: "true" };
const NOW = Date.parse("2026-10-09T10:00:00Z");

describe("Hvilken database som kan nullstilles", () => {
  test("demoens, når den som ber om det, har skrevet navnet på den", () => {
    expect(resetRefusal(DEMO_ENV, "demo-prosjektet")).toBeNull();
    expect(resetTargetOf(DEMO_ENV)).toEqual({ projectId: "demo-prosjektet", databaseId: "(default)" });
  });

  test("aldri en menighets: uten demo-innstillingen nektes det, også når navnet stemmer", () => {
    for (const demo of [undefined, "", "false", "TRUE", "1", "ja"]) {
      const refusal = resetRefusal({ VITE_FIREBASE_PROJECT_ID: "menigheten", VITE_DEMO: demo }, "menigheten");
      expect(refusal).toMatch(/Bare demoen kan nullstilles/);
    }
  });

  test("ikke uten at navnet er skrevet, og ikke når det er et annet enn innstillingene peker på", () => {
    expect(resetRefusal(DEMO_ENV, undefined)).toMatch(/npm run reset-demo -- demo-prosjektet/);
    expect(resetRefusal(DEMO_ENV, "")).toMatch(/npm run reset-demo -- demo-prosjektet/);
    expect(resetRefusal(DEMO_ENV, "et-annet-prosjekt")).toMatch(/«et-annet-prosjekt».*«demo-prosjektet»/);
  });

  test("ikke når innstillingene ikke sier hvilken database det gjelder", () => {
    expect(resetRefusal({ VITE_DEMO: "true" }, "demo-prosjektet")).toMatch(/VITE_FIREBASE_PROJECT_ID mangler/);
    expect(resetTargetOf({ VITE_FIREBASE_PROJECT_ID: "  " })).toBeNull();
  });

  test("en database med eget navn brukes når innstillingene har det", () => {
    expect(resetTargetOf({ ...DEMO_ENV, VITE_FIREBASE_DATABASE_ID: "egen-database" })).toEqual({
      projectId: "demo-prosjektet",
      databaseId: "egen-database",
    });
    // An empty name is the default database
    expect(resetTargetOf({ ...DEMO_ENV, VITE_FIREBASE_DATABASE_ID: "" })?.databaseId).toBe("(default)");
  });
});

describe("Et dokument slik databasen tar imot det", () => {
  test("hver type verdi", () => {
    expect(firestoreValueOf("Gudstjeneste")).toEqual({ stringValue: "Gudstjeneste" });
    expect(firestoreValueOf(true)).toEqual({ booleanValue: true });
    expect(firestoreValueOf(null)).toEqual({ nullValue: null });
    expect(firestoreValueOf(74)).toEqual({ integerValue: "74" });
    expect(firestoreValueOf(0)).toEqual({ integerValue: "0" });
    expect(firestoreValueOf(0.5)).toEqual({ doubleValue: 0.5 });
    expect(firestoreValueOf(["a", 1])).toEqual({ arrayValue: { values: [{ stringValue: "a" }, { integerValue: "1" }] } });
    expect(firestoreValueOf([])).toEqual({ arrayValue: { values: [] } });
    expect(firestoreValueOf({ weekday: "Onsdag" })).toEqual({ mapValue: { fields: { weekday: { stringValue: "Onsdag" } } } });
  });

  test("et felt uten verdi er ikke med", () => {
    expect(firestoreFieldsOf({ name: "Kari", phone: undefined, groups: [{ id: "g1", note: undefined }] })).toEqual({
      name: { stringValue: "Kari" },
      groups: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: "g1" } } } }] } },
    });
  });

  test("det som ikke kan lagres, stopper nullstillingen", () => {
    expect(() => firestoreValueOf(Number.NaN)).toThrow();
    expect(() => firestoreValueOf(() => 1)).toThrow();
  });

  test("hele demoinnholdet kan gjøres om", () => {
    for (const document of getCustomMockDocuments(FULL_DEMO_COUNTS, NOW)) {
      expect(() => firestoreFieldsOf(storedFormOf(document).data)).not.toThrow();
    }
  });
});

describe("Hva en nullstilling skriver og fjerner", () => {
  const demo = getCustomMockDocuments(FULL_DEMO_COUNTS, NOW);

  test("tjenesteroller og oppmøtetall lagres blant innstillingene, merket, og resten der det hører hjemme", () => {
    const role = demo.find((d) => d.collection === COLLECTIONS.VOLUNTEER_ROLES)!;
    const count = demo.find((d) => d.collection === COLLECTIONS.GATHERING_HEADCOUNTS)!;
    const person = demo.find((d) => d.collection === COLLECTIONS.PERSONS)!;

    expect(storedFormOf(role)).toMatchObject({ collection: CMS_COLLECTIONS.SETTINGS, id: role.id, data: { recordType: VOLUNTEER_ROLE_RECORD } });
    expect(storedFormOf(count)).toMatchObject({ collection: CMS_COLLECTIONS.SETTINGS, id: count.id, data: { recordType: HEADCOUNT_RECORD } });
    expect(storedFormOf(person)).toBe(person);
  });

  test("hvert dokument i demoinnholdet skrives, på hver sin plass", () => {
    const plan = planReset([{ site: null, documents: demo }], []);
    expect(plan.write.length).toBe(demo.length);
    expect(new Set(plan.write.map(pathOf)).size).toBe(demo.length);
    expect(plan.write.map(pathOf)).toContain(`${CMS_COLLECTIONS.SETTINGS}/${CMS_SETTINGS_DOC_ID}`);
    expect(plan.remove).toEqual([]);
  });

  test("det en besøkende har lagt inn, fjernes, og det som hører til innholdet, blir ikke fjernet", () => {
    const existing = ["persons/person-1", "persons/lagt-inn-av-en-besokende", "cms_pages/en-ny-side", "cms_settings/global", "cms_settings/site-traffic-2026-10"];
    expect(planReset([{ site: null, documents: demo }], existing).remove).toEqual([
      "persons/lagt-inn-av-en-besokende",
      "cms_pages/en-ny-side",
      "cms_settings/site-traffic-2026-10",
    ]);
  });

  test("to dokumenter på samme plass stopper nullstillingen før noe er gjort", () => {
    const twice: MockDocument[] = [
      { collection: "persons", id: "p1", data: {} },
      { collection: "persons", id: "p1", data: {} },
    ];
    expect(() => planReset([{ site: null, documents: twice }], [])).toThrow(/samme plass/);
  });

  test("hver menighet får sine egne samlinger: de vanlige navnene med menighetens id foran", () => {
    const person: MockDocument = { collection: "persons", id: "p1", data: { name: "Kari" } };
    const role: MockDocument = { collection: COLLECTIONS.VOLUNTEER_ROLES, id: "role-1", data: { id: "role-1", name: "Lyd" } };
    const plan = planReset(
      [
        { site: null, documents: [person, role] },
        { site: "sogne", documents: [person, role] },
      ],
      ["persons/p1", "sogne-persons/p1", "sogne-persons/lagt-inn", "sogne-cms_settings/role-1"]
    );

    expect(plan.write.map(pathOf)).toEqual(["persons/p1", "cms_settings/role-1", "sogne-persons/p1", "sogne-cms_settings/role-1"]);
    // The same person in two congregations is two documents, and neither is in the way of the other
    expect(plan.remove).toEqual(["sogne-persons/lagt-inn"]);
  });
});

// ---------- A congregation with its own website ----------

const SET_FETCHED = "2026-10-06T16:00:00.000Z";
/** A small set, shaped as the files in public/demosett/ are. */
const sogne: SiteSet = {
  createdAt: SET_FETCHED,
  collections: {
    cms_settings: [{ id: "global", churchName: "Søgne Misjonskirke", address: "Kirkeveien 1" }],
    cms_pages: [{ id: "sogne-forside", slug: "", title: "Forside", updatedAt: "2026-10-01T10:00:00.000Z" }],
    cms_news: [{ id: "sogne-nyhet", title: "Nytt fra Søgne", publishedAt: "2026-10-05T08:00:00.000Z", isPublished: true }],
    groups: [{ id: "group-kalender", name: "Kalender", memberIds: [], leaderIds: [] }],
    gatherings: [
      {
        id: "gathering-sogne-1",
        groupId: "group-kalender",
        title: "Gudstjeneste",
        startsAt: "2026-10-11T09:00:00.000Z",
        type: "arrangement",
        visibility: "offentlig",
        isPublic: true,
        isGudstjeneste: true,
      },
    ],
    // Not the website: a set is only ever the website
    persons: [{ id: "en-ekte-person", name: "Skal ikke med" }],
  },
};

describe("En menighet med sin egen nettside i demoen", () => {
  const example = getCustomMockDocuments(FULL_DEMO_COUNTS, NOW);
  const site = siteDocuments(example, sogne, NOW);
  const rows = <T,>(documents: MockDocument[], collection: string) =>
    documents.filter((d) => d.collection === collection).map((d) => d.data as T);
  const ids = (documents: MockDocument[], collection: string) => documents.filter((d) => d.collection === collection).map((d) => d.id);

  test("uten et sett er menigheten eksempelmenigheten slik den er", () => {
    expect(siteDocuments(example, null, NOW)).toBe(example);
  });

  test("nettsiden er menighetens egen, og ingenting av eksempelmenighetens nettside er igjen", () => {
    expect(ids(site, CMS_COLLECTIONS.PAGES)).toEqual(["sogne-forside"]);
    expect(ids(site, CMS_COLLECTIONS.NEWS)).toEqual(["sogne-nyhet"]);
    expect(ids(site, CMS_COLLECTIONS.SERMONS)).toEqual([]);
    expect(ids(site, CMS_COLLECTIONS.STAFF)).toEqual([]);
    // The settings are stored by their place, without an id in them
    expect(rows(site, CMS_COLLECTIONS.SETTINGS)).toEqual([{ churchName: "Søgne Misjonskirke", address: "Kirkeveien 1" }]);
  });

  test("planleggeren er eksempelmenighetens: personer, grupper og tjenesteroller følger med", () => {
    expect(ids(site, COLLECTIONS.PERSONS)).toEqual(ids(example, COLLECTIONS.PERSONS));
    expect(ids(site, COLLECTIONS.VOLUNTEER_ROLES)).toEqual(ids(example, COLLECTIONS.VOLUNTEER_ROLES));
    expect(ids(site, COLLECTIONS.GROUPS)).toEqual([...ids(example, COLLECTIONS.GROUPS), "group-kalender"]);
    // Nobody from a congregation's own register is ever in a set that is shown
    expect(ids(site, COLLECTIONS.PERSONS)).not.toContain("en-ekte-person");
  });

  test("kalenderen åpen for alle er menighetens egen, og de interne samlingene er eksempelmenighetens", () => {
    const gatherings = rows<Gathering>(site, COLLECTIONS.GATHERINGS);
    const open = gatherings.filter((g) => g.visibility !== "intern");
    expect(open.map((g) => g.id)).toEqual(["gathering-sogne-1"]);
    expect(gatherings.some((g) => g.id === "gathering-hus-1")).toBe(true);
    expect(gatherings.some((g) => g.id === "gathering-1")).toBe(false);
  });

  test("ingenting peker på noe som er tatt ut: hver oppgave har samlingen sin, og hver tildeling oppgaven sin", () => {
    const gatherings = new Set(ids(site, COLLECTIONS.GATHERINGS));
    const tasks = new Set(ids(site, COLLECTIONS.TASKS));
    expect(tasks.size).toBeGreaterThan(0);
    for (const task of rows<{ gatheringId: string }>(site, COLLECTIONS.TASKS)) expect(gatherings.has(task.gatheringId)).toBe(true);
    for (const assignment of rows<{ taskId: string }>(site, COLLECTIONS.ASSIGNMENTS)) expect(tasks.has(assignment.taskId)).toBe(true);
    for (const answer of rows<{ gatheringId: string }>(site, COLLECTIONS.GATHERING_ATTENDANCES)) expect(gatherings.has(answer.gatheringId)).toBe(true);
    for (const count of rows<{ gatheringId: string }>(site, COLLECTIONS.GATHERING_HEADCOUNTS)) expect(gatherings.has(count.gatheringId)).toBe(true);
  });

  test("datoene i settet flyttes hele uker fra uka det ble hentet", () => {
    const start = (now: number) =>
      rows<Gathering>(siteDocuments(example, sogne, now), COLLECTIONS.GATHERINGS).find((g) => g.id === "gathering-sogne-1")!.startsAt;
    // The same week as it was fetched: as it stands. Sunday 11 October at 11:00 in Norway
    expect(start(Date.parse("2026-10-09T10:00:00Z"))).toBe("2026-10-11T09:00:00.000Z");
    // Four weeks on the clocks have been set back, and the service is still on a Sunday at 11:00
    expect(start(Date.parse("2026-11-05T10:00:00Z"))).toBe("2026-11-08T10:00:00.000Z");
  });
});

describe("Settene som følger med appen", () => {
  const sets = readDemoSets(path.resolve(__dirname, "..", "public", "demosett"));
  const example = getCustomMockDocuments(FULL_DEMO_COUNTS, NOW);

  test("alle kan leses, og hvert har en id som kan stå foran navnet på en samling", () => {
    expect(sets.length).toBeGreaterThan(0);
    expect(new Set(sets.map((set) => set.id)).size).toBe(sets.length);
    for (const set of sets) expect(set.id).toMatch(/^[a-z0-9]+$/);
  });

  test.each(sets.map((set) => [set.name, set] as const))("%s: nettsiden kan lagres, og har menighetens navn", (_name, { set }) => {
    const site = siteDocuments(example, set, NOW);
    const settings = site.find((d) => d.collection === CMS_COLLECTIONS.SETTINGS && d.id === CMS_SETTINGS_DOC_ID)!;
    expect(typeof (settings.data as { churchName?: unknown }).churchName).toBe("string");
    expect((settings.data as { churchName: string }).churchName).not.toMatch(/fjordvik/i);
    expect(site.some((d) => d.collection === CMS_COLLECTIONS.PAGES)).toBe(true);
    for (const document of site) expect(() => firestoreFieldsOf(storedFormOf(document).data)).not.toThrow();
    // Every document lies in a collection the app knows, so the reset finds it again
    for (const document of site) expect(PLAIN_COLLECTIONS).toContain(document.collection);
  });

  test("alle menighetene til sammen har hver sin plass i databasen", () => {
    const sites = [{ site: null, documents: example }, ...sets.map(({ id, set }) => ({ site: id, documents: siteDocuments(example, set, NOW) }))];
    const plan = planReset(sites, []);
    expect(new Set(plan.write.map(pathOf)).size).toBe(plan.write.length);
  });

  test("uka settene ble hentet, har hver menighet noe i kalenderen", () => {
    // Asked the day the sets were fetched: later weeks give the same picture, a week at a time
    for (const { set } of sets) {
      const fetched = Date.parse(set.createdAt);
      const gatherings = rows(siteDocuments(example, set, fetched));
      expect(upcomingPublicGatherings(gatherings, fetched).length).toBeGreaterThan(0);
    }
    function rows(documents: MockDocument[]): Gathering[] {
      return documents.filter((d) => d.collection === COLLECTIONS.GATHERINGS).map((d) => d.data as Gathering);
    }
  });
});

// ---------- A stand-in for the database, answering as it does to requests from outside the app ----------

const TARGET: ResetTarget = { projectId: "demo-prosjektet", databaseId: "(default)" };
const ROOT = "https://firestore.googleapis.com/v1/projects/demo-prosjektet/databases/(default)/documents";
const NAME = "projects/demo-prosjektet/databases/(default)/documents/";

type Fields = Record<string, FirestoreValue>;

function database(initial: Record<string, Fields> = {}, options: { pageSize?: number; refuse?: number; loseWrites?: boolean } = {}) {
  const stored = new Map<string, Fields>(Object.entries(initial));
  const requests: string[] = [];
  const answer = (status: number, body: unknown) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) }) as Response;

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push(`${init?.method ?? "GET"} ${url.slice(ROOT.length)}`);
    if (options.refuse) return answer(options.refuse, { error: { message: "Missing or insufficient permissions." } });

    if (url === `${ROOT}:commit`) {
      const { writes } = JSON.parse(String(init?.body)) as { writes: { update?: { name: string; fields: Fields }; delete?: string }[] };
      expect(writes.length).toBeLessThanOrEqual(500);
      if (!options.loseWrites) {
        for (const write of writes) {
          if (write.update) stored.set(write.update.name.slice(NAME.length), write.update.fields);
          if (write.delete) stored.delete(write.delete.slice(NAME.length));
        }
      }
      return answer(200, { writeResults: writes.map(() => ({})) });
    }

    // A collection is read a page at a time
    const { pathname, searchParams } = new URL(url);
    const collection = decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1));
    const all = [...stored.keys()].filter((path) => path.startsWith(`${collection}/`)).sort();
    const from = Number(searchParams.get("pageToken") ?? 0);
    const size = options.pageSize ?? 300;
    const page = all.slice(from, from + size).map((path) => ({ name: NAME + path, fields: stored.get(path) }));
    return answer(200, page.length === 0 ? {} : { documents: page, ...(from + size < all.length ? { nextPageToken: String(from + size) } : {}) });
  }) as typeof fetch;

  return { stored, requests, fetchFn };
}

describe("Nullstillingen av demoen", () => {
  const wanted = planReset([{ site: null, documents: getCustomMockDocuments(FULL_DEMO_COUNTS, NOW) }], []).write;

  test("en tom database fylles med hele demoinnholdet", async () => {
    const db = database();
    const result = await resetDemo(TARGET, NOW, db.fetchFn);

    expect(result).toEqual({ weeks: 5, written: wanted.length, removed: 0, sites: [{ site: null, written: wanted.length }] });
    expect([...db.stored.keys()].sort()).toEqual(wanted.map(pathOf).sort());
    expect(db.stored.get("cms_settings/global")?.churchName).toEqual({ stringValue: "Fjordvik menighet" });
  });

  test("det besøkende har endret, skrives over, og det de har lagt inn, fjernes", async () => {
    const db = database({
      "cms_settings/global": { churchName: { stringValue: "Endret av en besøkende" }, etEkstraFelt: { booleanValue: true } },
      "persons/lagt-inn": { name: { stringValue: "En besøkende" } },
      "cms_pages/en-ny-side": { title: { stringValue: "Ny side" } },
      "cms_media/et-bilde": { title: { stringValue: "Bilde" } },
    });
    const result = await resetDemo(TARGET, NOW, db.fetchFn);

    expect(result.removed).toBe(3);
    expect(db.stored.get("cms_settings/global")).toEqual(firestoreFieldsOf(wanted.find((d) => pathOf(d) === "cms_settings/global")!.data));
    expect([...db.stored.keys()].sort()).toEqual(wanted.map(pathOf).sort());
  });

  test("en nullstilling til gir samme database", async () => {
    const db = database();
    await resetDemo(TARGET, NOW, db.fetchFn);
    const first = JSON.stringify([...db.stored.entries()].sort());
    const again = await resetDemo(TARGET, NOW, db.fetchFn);

    expect(again.removed).toBe(0);
    expect(JSON.stringify([...db.stored.entries()].sort())).toBe(first);
  });

  test("uka etter ligger samlingene sju dager senere", async () => {
    const db = database();
    await resetDemo(TARGET, NOW, db.fetchFn);
    const start = () => Date.parse((db.stored.get("gatherings/gathering-1")!.startsAt as { stringValue: string }).stringValue);
    const thisWeek = start();
    await resetDemo(TARGET, NOW + 7 * 24 * 60 * 60 * 1000, db.fetchFn);

    expect(start() - thisWeek).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("en samling som fyller flere sider, leses helt", async () => {
    const strays = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`persons/besokende-${i}`, { name: { stringValue: `Besøkende ${i}` } }]));
    const db = database(strays, { pageSize: 3 });
    const result = await resetDemo(TARGET, NOW, db.fetchFn);

    expect(result.removed).toBe(7);
    expect([...db.stored.keys()].some((path) => path.startsWith("persons/besokende-"))).toBe(false);
  });

  test("med et sett får menigheten sine egne samlinger ved siden av eksempelmenighetens", async () => {
    const sets: DemoSet[] = [{ id: "sogne", name: "Søgne Misjonskirke", set: sogne }];
    const db = database({ "sogne-cms_pages/laget-av-en-besokende": { title: { stringValue: "Ny side" } } });
    const result = await resetDemo(TARGET, NOW, db.fetchFn, sets);

    expect(result.sites.map(({ site }) => site)).toEqual([null, "sogne"]);
    expect(result.removed).toBe(1);
    // The example congregation is where it always is, and whole
    for (const document of wanted) expect(db.stored.has(pathOf(document))).toBe(true);
    // Søgne has its own website, and the example congregation's persons, under its own names
    expect(db.stored.get("sogne-cms_settings/global")?.churchName).toEqual({ stringValue: "Søgne Misjonskirke" });
    expect([...db.stored.keys()].filter((place) => place.startsWith("sogne-cms_pages/"))).toEqual(["sogne-cms_pages/sogne-forside"]);
    expect(db.stored.has("sogne-persons/person-1")).toBe(true);
    expect(db.stored.get("cms_settings/global")?.churchName).toEqual({ stringValue: "Fjordvik menighet" });
  });

  test("en database som står i produksjon, røres ikke", async () => {
    const before = {
      [`cms_settings/${OPERATING_MODE_DOC_ID}`]: { recordType: { stringValue: OPERATING_MODE_RECORD }, mode: { stringValue: "production" } },
      "persons/en-ekte-person": { name: { stringValue: "Ekte" } },
    };
    const db = database(before);

    await expect(resetDemo(TARGET, NOW, db.fetchFn)).rejects.toThrow(/står i produksjon/);
    expect(Object.fromEntries(db.stored)).toEqual(before);
    expect(db.requests.some((request) => request.startsWith("POST"))).toBe(false);
  });

  test("en database som nekter, gir en feil som sier hva den svarte", async () => {
    const db = database({}, { refuse: 403 });
    await expect(resetDemo(TARGET, NOW, db.fetchFn)).rejects.toThrow(/svarte 403/);
  });

  test("står ikke demoinnholdet i databasen etterpå, meldes det som feil", async () => {
    const db = database({}, { loseWrites: true });
    await expect(resetDemo(TARGET, NOW, db.fetchFn)).rejects.toThrow(/ikke som den skal/);
  });
});
