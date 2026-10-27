import { beforeEach, describe, expect, test, vi } from "vitest";

// An in-memory stand-in for Firestore (the same as in dataset-service.test.ts), so the test sees
// exactly what filling and clearing test data leaves in a database that also holds a website.
const { store, failing } = vi.hoisted(() => ({
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  failing: new Map<string, string>(),
}));

vi.mock("../src/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => {
  const table = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };
  return {
    collection: (_db: unknown, name: string) => ({ name }),
    doc: (_db: unknown, name: string, id: string) => ({ name, id }),
    getDocs: async ({ name }: { name: string }) => {
      if (failing.has(name)) throw Object.assign(new Error(`Lesing feilet: ${failing.get(name)}`), { code: failing.get(name) });
      const docs = [...table(name).entries()].map(([id, data]) => ({ id, ref: { name, id }, data: () => data }));
      return { docs, size: docs.length, empty: docs.length === 0 };
    },
    writeBatch: () => {
      const operations: (() => void)[] = [];
      return {
        set: (ref: { name: string; id: string }, data: Record<string, unknown>) => operations.push(() => table(ref.name).set(ref.id, data)),
        delete: (ref: { name: string; id: string }) => operations.push(() => table(ref.name).delete(ref.id)),
        commit: async () => operations.forEach((operation) => operation()),
      };
    },
    onSnapshot: () => () => {},
  };
});

import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID, COLLECTIONS } from "../src/data/collections";
import { initialCmsPages } from "../src/data/cmsData";
import { initialGatherings } from "../src/data/mockData";
import { populateDemoPersons, populateWithMockData, restoreFullMockDatabase } from "../src/services/databaseAdmin";
import { clearTestdata, deleteGroupsTestdata, generateDemoWebsite, generateTestdata } from "../src/services/testdataService";

const ids = (name: string) => [...(store.get(name)?.keys() ?? [])].sort();
const count = (name: string) => store.get(name)?.size ?? 0;
const snapshotOf = (names: string[]) => JSON.stringify(names.map((name) => [name, [...(store.get(name)?.entries() ?? [])]]));
const open = { type: "arrangement", visibility: "offentlig", isPublic: true };
const WEBSITE = [CMS_COLLECTIONS.PAGES, CMS_COLLECTIONS.NEWS, CMS_COLLECTIONS.SERMONS, CMS_COLLECTIONS.STAFF];

// A congregation's own website, brought in with a dataset: pages, settings, and events owned by a calendar group
beforeEach(() => {
  store.clear();
  failing.clear();
  store.set(CMS_COLLECTIONS.PAGES, new Map([["lmk-forside", { id: "lmk-forside", slug: "", title: "Lillesand Misjonskirke" }]]));
  store.set(CMS_COLLECTIONS.SETTINGS, new Map([[CMS_SETTINGS_DOC_ID, { churchName: "Lillesand Misjonskirke" }]]));
  store.set(COLLECTIONS.GROUPS, new Map([["lmk-kalender", { id: "lmk-kalender", name: "Felleskalender", memberIds: [], leaderIds: [] }]]));
  store.set(COLLECTIONS.GATHERINGS, new Map([["lmk-arr-1", { id: "lmk-arr-1", title: "Gudstjeneste", groupId: "lmk-kalender", ...open }]]));
});

describe("Testdata fyller planleggeren og lar nettsiden være", () => {
  test("«Populer database» legger inn personer, grupper og roller, og ingenting annet", async () => {
    const website = snapshotOf([...WEBSITE, COLLECTIONS.GATHERINGS]);
    const result = await generateTestdata({ personCount: 32, groupCount: 14, roleCount: 14 });

    expect(result.failures).toEqual([]);
    expect(count(COLLECTIONS.PERSONS)).toBe(32);
    expect(count(COLLECTIONS.GROUPS)).toBe(14 + 1);
    // The pages and the congregation's own events are as they were: no demo page, no demo service
    expect(snapshotOf([...WEBSITE, COLLECTIONS.GATHERINGS])).toBe(website);
    expect(store.get(CMS_COLLECTIONS.SETTINGS)!.get(CMS_SETTINGS_DOC_ID)).toEqual({ churchName: "Lillesand Misjonskirke" });
    for (const name of [COLLECTIONS.TASKS, COLLECTIONS.ASSIGNMENTS, COLLECTIONS.GATHERING_ATTENDANCES]) expect(count(name)).toBe(0);
    // The volunteer roles are the planner's, though they are stored next to the settings
    const kept = [...store.get(CMS_COLLECTIONS.SETTINGS)!.values()];
    expect(kept.filter((d) => d.recordType === "volunteerRole").length).toBeGreaterThan(0);
    expect(kept.some((d) => d.recordType === "gatheringHeadcount")).toBe(false);
    expect(Object.keys(result.counts)).not.toContain(CMS_COLLECTIONS.PAGES);
    expect(Object.keys(result.counts)).not.toContain(COLLECTIONS.GATHERINGS);
  });

  test("demo-samlingene følger med når de er bedt om, fortsatt uten å røre sidene", async () => {
    const pages = snapshotOf(WEBSITE);
    await generateTestdata({ personCount: 32, groupCount: 14, roleCount: 14, gatheringCount: 19, taskCount: 24 });

    expect(count(COLLECTIONS.GATHERINGS)).toBe(14);
    expect(count(COLLECTIONS.TASKS)).toBeGreaterThan(0);
    expect(snapshotOf(WEBSITE)).toBe(pages);
    expect(store.get(CMS_COLLECTIONS.SETTINGS)!.get(CMS_SETTINGS_DOC_ID)).toEqual({ churchName: "Lillesand Misjonskirke" });
  });

  test("personer fra Personer- og Stab-fanen kommer uten samlinger og uten sider", async () => {
    await populateDemoPersons();

    expect(count(COLLECTIONS.PERSONS)).toBe(32);
    expect(ids(COLLECTIONS.GATHERINGS)).toEqual(["lmk-arr-1"]);
    expect(ids(CMS_COLLECTIONS.PAGES)).toEqual(["lmk-forside"]);
  });

  test("demo-planleggeren på nytt tar med samlingene, men ikke sidene", async () => {
    await restoreFullMockDatabase();

    expect(count(COLLECTIONS.GATHERINGS)).toBe(30);
    expect(ids(CMS_COLLECTIONS.PAGES)).toEqual(["lmk-forside"]);
  });

  test("demo-nettsiden legges inn for seg, og rører ikke planleggeren", async () => {
    const planner = snapshotOf([COLLECTIONS.PERSONS, COLLECTIONS.GROUPS, COLLECTIONS.GATHERINGS, COLLECTIONS.TASKS]);
    const result = await generateDemoWebsite();

    expect(result.failures).toEqual([]);
    expect(count(CMS_COLLECTIONS.PAGES)).toBe(initialCmsPages.length + 1);
    expect(count(CMS_COLLECTIONS.NEWS)).toBeGreaterThan(0);
    // The settings are the demo congregation's now, which is why the admin is asked first
    expect(store.get(CMS_COLLECTIONS.SETTINGS)!.get(CMS_SETTINGS_DOC_ID)).not.toEqual({ churchName: "Lillesand Misjonskirke" });
    expect([...store.get(CMS_COLLECTIONS.SETTINGS)!.values()].some((d) => d.recordType)).toBe(false);
    expect(snapshotOf([COLLECTIONS.PERSONS, COLLECTIONS.GROUPS, COLLECTIONS.GATHERINGS, COLLECTIONS.TASKS])).toBe(planner);
  });

  test("hele demosettet er begge delene sammen", async () => {
    store.clear();
    const result = await populateWithMockData();

    expect(result.failures).toEqual([]);
    expect(count(COLLECTIONS.PERSONS)).toBe(32);
    expect(count(COLLECTIONS.GATHERINGS)).toBe(19);
    expect(count(CMS_COLLECTIONS.PAGES)).toBe(initialCmsPages.length);
    expect(result.total).toBe([...store.values()].reduce((sum, table) => sum + table.size, 0));
  });
});

describe("Tømming av testdata lar nettsidens arrangementer stå", () => {
  beforeEach(async () => {
    await generateTestdata({ personCount: 32, groupCount: 14, roleCount: 14, gatheringCount: 19, taskCount: 24 });
    // A simulated service, and a group's own meeting made in the planner
    store.get(COLLECTIONS.GATHERINGS)!.set("sim-gudstjeneste-1", { id: "sim-gudstjeneste-1", groupId: "lmk-kalender", ...open });
    store.get(COLLECTIONS.GATHERINGS)!.set("husmote", { id: "husmote", groupId: "group-1", type: "gruppesamling", visibility: "offentlig" });
  });

  test("demo-samlinger, simulerte og interne går; det menigheten har hentet inn, står", async () => {
    // The demo set has services open to everyone too. They are test data all the same.
    expect(initialGatherings.some((g) => g.type !== "gruppesamling" && g.isPublic !== false)).toBe(true);
    const result = await clearTestdata();

    expect(result.failures).toEqual([]);
    expect(ids(COLLECTIONS.GATHERINGS)).toEqual(["lmk-arr-1"]);
    expect(ids(COLLECTIONS.GROUPS)).toEqual(["lmk-kalender"]);
    expect(ids(CMS_COLLECTIONS.PAGES)).toEqual(["lmk-forside"]);
    expect(ids(CMS_COLLECTIONS.SETTINGS)).toEqual([CMS_SETTINGS_DOC_ID]);
    for (const name of [COLLECTIONS.PERSONS, COLLECTIONS.TASKS, COLLECTIONS.ASSIGNMENTS, COLLECTIONS.GROUP_MESSAGES]) {
      expect(count(name)).toBe(0);
    }
    // The result counts what was deleted, not what was read
    expect(result.counts[COLLECTIONS.GATHERINGS]).toBe(15);
    expect(result.counts[COLLECTIONS.GROUPS]).toBe(14);
  });

  test("«Slett kun grupper» lar også kalendergruppen og arrangementene stå", async () => {
    await deleteGroupsTestdata();

    expect(ids(COLLECTIONS.GATHERINGS)).toEqual(["lmk-arr-1"]);
    expect(ids(COLLECTIONS.GROUPS)).toEqual(["lmk-kalender"]);
    expect(count(COLLECTIONS.PERSONS)).toBe(32);
  });

  test("en kalendergruppe uten arrangementer igjen er ikke lenger nettsidens", async () => {
    store.get(COLLECTIONS.GATHERINGS)!.delete("lmk-arr-1");
    await clearTestdata();

    // Its only event was the simulated one, which is test data
    expect(ids(COLLECTIONS.GROUPS)).toEqual([]);
    expect(ids(COLLECTIONS.GATHERINGS)).toEqual([]);
  });

  test("kan ikke gruppene leses, røres verken grupper eller samlinger, og resten tømmes", async () => {
    const before = snapshotOf([COLLECTIONS.GATHERINGS, COLLECTIONS.GROUPS]);
    failing.set(COLLECTIONS.GROUPS, "unavailable");
    const result = await clearTestdata();

    expect(result.success).toBe(false);
    expect(result.failures.map((f) => f.collection).sort()).toEqual([COLLECTIONS.GATHERINGS, COLLECTIONS.GROUPS].sort());
    failing.clear();
    expect(snapshotOf([COLLECTIONS.GATHERINGS, COLLECTIONS.GROUPS])).toBe(before);
    expect(count(COLLECTIONS.PERSONS)).toBe(0);
  });
});
