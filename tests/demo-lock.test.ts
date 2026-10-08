import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", async () => (await import("./helpers/memoryFirestore")).firestoreMock);
// The demo installation
vi.mock("../src/demo", () => ({ DEMO: {} }));

import { snapshotOfAll, store } from "./helpers/memoryFirestore";
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID, COLLECTIONS } from "../src/data/collections";
import { deleteAllData } from "../src/services/databaseAdmin";
import { clearDatabase } from "../src/services/datasetService";
import { DEMO_LOCK_MESSAGE, ensureDeletionAllowed, readOperatingMode } from "../src/services/operatingMode";
import { clearTestdata, deletePersonsTestdata } from "../src/services/testdataService";
import { NOT_IN_DEMO, isTabInDemo } from "../src/pages/admin/demoTabs";
import { STUDIO_TABS } from "../src/pages/admin/studio";

beforeEach(() => {
  store.clear();
  store.set(CMS_COLLECTIONS.PAGES, new Map([["page-om-oss", { id: "page-om-oss", title: "Om oss" }]]));
  store.set(CMS_COLLECTIONS.SETTINGS, new Map<string, Record<string, unknown>>([[CMS_SETTINGS_DOC_ID, { churchName: "Menigheten" }]]));
  store.set(COLLECTIONS.PERSONS, new Map([["p1", { id: "p1", name: "Kari" }]]));
});

describe("Demoen kan ikke tømmes fra appen", () => {
  test("alt som tømmer databasen, nekter, og ingenting er slettet", async () => {
    const before = snapshotOfAll();
    // The database itself says demo, which is the mode where emptying is otherwise allowed
    expect(await readOperatingMode()).toBe("demo");

    await expect(ensureDeletionAllowed()).rejects.toThrow(DEMO_LOCK_MESSAGE);
    await expect(clearDatabase()).rejects.toThrow(DEMO_LOCK_MESSAGE);
    await expect(clearDatabase(["website"])).rejects.toThrow(DEMO_LOCK_MESSAGE);
    await expect(clearTestdata()).rejects.toThrow(DEMO_LOCK_MESSAGE);
    await expect(deletePersonsTestdata()).rejects.toThrow(DEMO_LOCK_MESSAGE);
    await expect(deleteAllData()).rejects.toThrow(DEMO_LOCK_MESSAGE);

    expect(snapshotOfAll()).toEqual(before);
  });

  test("fanene som tømmer eller bytter ut databasen, og tilleggsmodulene, er ikke med i demoen", () => {
    expect([...NOT_IN_DEMO].sort()).toEqual(["analyse", "database-admin", "moduler", "nettsidebesok"]);
    expect(STUDIO_TABS.filter((tab) => !isTabInDemo(tab)).sort()).toEqual([...NOT_IN_DEMO].sort());
    for (const tab of ["dashboard", "cms-sider", "planlegger-samlinger", "planlegger-personer", "planlegger-grupper"] as const) {
      expect(isTabInDemo(tab)).toBe(true);
    }
  });
});
