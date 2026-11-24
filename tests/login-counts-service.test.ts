import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", async () => (await import("./helpers/memoryFirestore")).firestoreMock);

import { failing, store } from "./helpers/memoryFirestore";
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID } from "../src/data/collections";
import { recordLoginCount } from "../src/services/siteTraffic";
import { MIN_SIDE_OPENED } from "../src/utils/siteTraffic";

const settings = () => store.get(CMS_COLLECTIONS.SETTINGS)!;
const stored = (date: string) => settings().get(`traffic-${date}`);
// Tuesday 24 November 2026 at 12:00 in Norway
const noon = new Date("2026-11-24T11:00:00.000Z");
// The writes are sent without being waited for, as on the website. This lets them land.
const landed = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  store.clear();
  failing.clear();
  store.set(CMS_COLLECTIONS.SETTINGS, new Map<string, Record<string, unknown>>([[CMS_SETTINGS_DOC_ID, { churchName: "Lillesand Misjonskirke" }]]));
});

describe("Innlogginger telles som summer i dagens dokument", () => {
  test("en innlogging legges til under actions, og Min side telles ved siden av", async () => {
    recordLoginCount("innlogging-google", noon);
    recordLoginCount("innlogging-google", noon);
    recordLoginCount(MIN_SIDE_OPENED, noon);
    await landed();

    expect(stored("2026-11-24")).toEqual({
      recordType: "siteTraffic",
      date: "2026-11-24",
      actions: { "innlogging-google": 2, "minside-aapnet": 1 },
    });
  });

  test("dokumentet får ingen nye felt på toppnivå, så reglene i firestore.rules holder", async () => {
    recordLoginCount("innlogging-lenke", noon);
    await landed();

    expect(Object.keys(stored("2026-11-24") as object).sort()).toEqual(["actions", "date", "recordType"]);
  });
});
