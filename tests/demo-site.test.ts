// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { chooseDemoSite, readChosenDemoSite } from "../src/services/demoSite";
import { addressAfterSwitch, collectionPrefixOf, parseDemoSiteId, siteInAddress } from "../src/utils/demoSite";

// In the demo a visitor chooses which congregation to look at. The choice is the visitor's own,
// and decides which collections the app reads.

const KEY = "menighetsplan_demo_menighet";
const openAt = (address: string) => window.history.replaceState(null, "", address);

afterEach(() => {
  window.localStorage.clear();
  openAt("/");
  vi.resetModules();
  vi.doUnmock("../src/demoSite");
});

describe("Hvilken menighet et valg gjelder", () => {
  test("en menighet heter det samme som settet sitt, og bare små bokstaver og tall godtas", () => {
    expect(parseDemoSiteId("sogne")).toBe("sogne");
    expect(parseDemoSiteId("kirke2")).toBe("kirke2");
    for (const value of ["", "Sogne", "sogne-mk", "sogne/..", "søgne", "a".repeat(25), null, undefined, 7]) {
      expect(parseDemoSiteId(value)).toBeNull();
    }
  });

  test("eksempelmenigheten har de vanlige samlingene, og en annen menighet har sin id foran", () => {
    expect(collectionPrefixOf(null)).toBe("");
    expect(collectionPrefixOf("sogne")).toBe("sogne-");
  });

  test("en adresse kan be om en menighet, om eksempelmenigheten, eller om ingen", () => {
    expect(siteInAddress("?menighet=sogne")).toBe("sogne");
    expect(siteInAddress("?tab=cms-sider&menighet=floy")).toBe("floy");
    expect(siteInAddress("?menighet=eksempel")).toBeNull();
    expect(siteInAddress("")).toBeUndefined();
    expect(siteInAddress("?tab=cms-sider")).toBeUndefined();
    // Something that cannot be a congregation is not a choice
    expect(siteInAddress("?menighet=../admin")).toBeUndefined();
    expect(siteInAddress("?menighet=")).toBeUndefined();
  });

  test("etter et bytte starter man på forsiden av nettsiden, og blir stående i admin og på Min side", () => {
    expect(addressAfterSwitch("/om-oss", "", true)).toBe("/");
    expect(addressAfterSwitch("/", "?menighet=floy", true)).toBe("/");
    expect(addressAfterSwitch("/admin", "?tab=cms-sider", false)).toBe("/admin?tab=cms-sider");
    expect(addressAfterSwitch("/admin", "?tab=cms-sider&menighet=floy", false)).toBe("/admin?tab=cms-sider");
    expect(addressAfterSwitch("/minside", "?menighet=floy", false)).toBe("/minside");
  });
});

describe("Valget i nettleseren", () => {
  test("uten valg er det eksempelmenigheten", () => {
    expect(readChosenDemoSite()).toBeNull();
  });

  test("valget huskes, og tar den besøkende til forsiden av den nye menigheten", () => {
    openAt("/om-oss");
    const go = vi.fn();
    chooseDemoSite("sogne", go);

    expect(go).toHaveBeenCalledWith("/");
    expect(readChosenDemoSite()).toBe("sogne");
  });

  test("i admin blir man stående på samme fane", () => {
    openAt("/admin?tab=cms-sider");
    const go = vi.fn();
    chooseDemoSite("floy", go);
    expect(go).toHaveBeenCalledWith("/admin?tab=cms-sider");
  });

  test("å velge eksempelmenigheten glemmer valget", () => {
    chooseDemoSite("sogne", vi.fn());
    chooseDemoSite(null, vi.fn());
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(readChosenDemoSite()).toBeNull();
  });

  test("en lenke som nevner en menighet, går foran det som var valgt, og huskes", () => {
    chooseDemoSite("sogne", vi.fn());
    openAt("/?menighet=floy");
    expect(readChosenDemoSite()).toBe("floy");
    openAt("/");
    expect(readChosenDemoSite()).toBe("floy");

    openAt("/?menighet=eksempel");
    expect(readChosenDemoSite()).toBeNull();
    openAt("/");
    expect(readChosenDemoSite()).toBeNull();
  });

  test("noe annet enn en menighet i nettleserens lager er ikke et valg", () => {
    window.localStorage.setItem(KEY, "../persons");
    expect(readChosenDemoSite()).toBeNull();
  });
});

describe("Samlingene appen leser", () => {
  const collectionsFor = async (site: string | null) => {
    vi.resetModules();
    vi.doMock("../src/demoSite", () => ({ DEMO_SITE: site }));
    return import("../src/data/collections");
  };

  test("hos en menighet, og for eksempelmenigheten i demoen, er navnene de vanlige", async () => {
    const { COLLECTIONS, CMS_COLLECTIONS, ALL_COLLECTIONS, PLAIN_COLLECTIONS } = await collectionsFor(null);
    expect(COLLECTIONS.PERSONS).toBe("persons");
    expect(CMS_COLLECTIONS.PAGES).toBe("cms_pages");
    expect(ALL_COLLECTIONS).toEqual(PLAIN_COLLECTIONS);
  });

  test("for en valgt menighet har hver samling menighetens id foran, og ingen deles med en annen", async () => {
    const sogne = await collectionsFor("sogne");
    expect(sogne.COLLECTIONS.PERSONS).toBe("sogne-persons");
    expect(sogne.CMS_COLLECTIONS.SETTINGS).toBe("sogne-cms_settings");
    expect(sogne.ALL_COLLECTIONS).toEqual(sogne.PLAIN_COLLECTIONS.map((name) => `sogne-${name}`));

    const floy = await collectionsFor("floy");
    const example = await collectionsFor(null);
    const all = [...sogne.ALL_COLLECTIONS, ...floy.ALL_COLLECTIONS, ...example.ALL_COLLECTIONS];
    expect(new Set(all).size).toBe(all.length);
  });

  test("ingen fil skriver navnet på en samling selv: da ville den lest eksempelmenigheten uansett hvem som er valgt", () => {
    const filesUnder = (folder: string): string[] =>
      readdirSync(folder).flatMap((name) => {
        const file = path.join(folder, name);
        if (statSync(file).isDirectory()) return name === "tests" ? [] : filesUnder(file);
        return /\.tsx?$/.test(name) ? [file] : [];
      });
    const root = path.resolve(__dirname, "..", "src");
    const named = filesUnder(root)
      .filter((file) => /\b(collection|doc)\(\s*db\s*,\s*["'`]/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(root, file).replace(/\\/g, "/"));
    // The one exception asks whether the database answers at all, and is nobody's content
    expect(named).toEqual(["firebase.ts"]);
  });

  test("innstillingene til en menighet kan slås opp før den er valgt", async () => {
    const { settingsCollectionOf, CMS_COLLECTIONS } = await collectionsFor("floy");
    expect(settingsCollectionOf("sogne")).toBe("sogne-cms_settings");
    expect(settingsCollectionOf(null)).toBe("cms_settings");
    expect(settingsCollectionOf("floy")).toBe(CMS_COLLECTIONS.SETTINGS);
  });
});
