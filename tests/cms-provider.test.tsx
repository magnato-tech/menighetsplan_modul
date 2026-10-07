// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID } from "../src/data/collections";
import { demoCmsSettings, emptyCmsSettings, type CmsNewsArticle, type CmsPage, type CmsSermon } from "../src/data/cmsData";
import { clearWriteError, getWriteError } from "../src/services/writeErrors";
import { clearCollections, offline, seed, stored, storedIds } from "./support/offlineFirestore";

// Same setup as data-provider.test.tsx: the real Firestore client, kept offline
vi.mock("../src/firebase", async () => (await import("./support/offlineFirestore")).firebaseModuleMock);

import { CmsProvider, useCms } from "../src/context/CmsContext";

const PAGES_CACHE = "menighetsplan_cms_pages_v3";

const page = (id: string, extra: Partial<CmsPage> = {}): CmsPage => ({
  id,
  slug: id,
  title: id,
  summary: "",
  content: "",
  isPublished: true,
  inNavMenu: true,
  parentId: null,
  navOrder: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});

const article = (id: string, publishedAt: string): CmsNewsArticle => ({
  id,
  title: id,
  slug: id,
  summary: "",
  content: "",
  category: "aktuelt",
  author: "Menigheten",
  publishedAt,
  isPublished: true,
});

const sermon = (id: string, date: string): CmsSermon => ({ id, title: id, speaker: "Pastor", date });

beforeEach(async () => {
  await offline;
  await clearCollections(Object.values(CMS_COLLECTIONS));
  localStorage.clear();
  clearWriteError();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mountProvider() {
  const { result } = renderHook(() => useCms(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <CmsProvider>{children}</CmsProvider>,
  });
  return result;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("Lesing", () => {
  test("Innholdet i databasen vises, nyheter og taler med de nyeste først", async () => {
    seed(CMS_COLLECTIONS.PAGES, [page("om-oss"), page("kontakt")]);
    seed(CMS_COLLECTIONS.NEWS, [article("gammel", "2026-01-01T10:00:00.000Z"), article("ny", "2026-09-01T10:00:00.000Z")]);
    seed(CMS_COLLECTIONS.SERMONS, [sermon("tale-januar", "2026-01-04"), sermon("tale-august", "2026-08-30")]);
    const cms = mountProvider();

    await waitFor(() => {
      expect(ids(cms.current.pages).sort()).toEqual(["kontakt", "om-oss"]);
      expect(ids(cms.current.news)).toEqual(["ny", "gammel"]);
      expect(ids(cms.current.sermons)).toEqual(["tale-august", "tale-januar"]);
    });
    expect(cms.current.getPageBySlug("/Om-Oss")?.id).toBe("om-oss");
    expect(cms.current.getNewsById("ny")?.title).toBe("ny");
    expect(cms.current.getNewsBySlug("GAMMEL")?.id).toBe("gammel");
  });

  test("Standardinnstillingene gjelder til noen er lagret", async () => {
    const cms = mountProvider();
    expect(cms.current.settings).toEqual(emptyCmsSettings);

    seed(CMS_COLLECTIONS.SETTINGS, [{ id: CMS_SETTINGS_DOC_ID, ...demoCmsSettings, churchName: "Testkirken" }]);
    await waitFor(() => expect(cms.current.settings.churchName).toBe("Testkirken"));
  });

  test("Innholdet regnes som hentet først når både sidene og nyhetene har svart", async () => {
    seed(CMS_COLLECTIONS.PAGES, [page("om-oss")]);
    const cms = mountProvider();
    await waitFor(() => expect(ids(cms.current.pages)).toEqual(["om-oss"]));
    // Uten nett sier en tom samling ingenting om hva som finnes, så nyhetene har ikke svart ennå
    expect(cms.current.contentReady).toBe(false);

    seed(CMS_COLLECTIONS.NEWS, [article("ny", "2026-09-01T10:00:00.000Z")]);
    await waitFor(() => expect(cms.current.contentReady).toBe(true));
  });

  test("Uten nett beholdes kopien i nettleseren i stedet for en tom side", async () => {
    localStorage.setItem(PAGES_CACHE, JSON.stringify([page("lagret-fra-sist")]));
    const cms = mountProvider();

    expect(ids(cms.current.pages)).toEqual(["lagret-fra-sist"]);
    // The offline client now reports an empty collection, which must not wipe the copy
    await pause(80);
    expect(ids(cms.current.pages)).toEqual(["lagret-fra-sist"]);
    expect(JSON.parse(localStorage.getItem(PAGES_CACHE)!)).toHaveLength(1);

    // What the database holds takes over as soon as there is something to show
    seed(CMS_COLLECTIONS.PAGES, [page("fra-databasen")]);
    await waitFor(() => expect(ids(cms.current.pages)).toEqual(["fra-databasen"]));
    expect(ids(JSON.parse(localStorage.getItem(PAGES_CACHE)!))).toEqual(["fra-databasen"]);
  });
});

describe("Sider", () => {
  test("En ny side får ID, ryddet adresse og lagres uten tomme felt", async () => {
    const cms = mountProvider();
    void cms.current.savePage({ title: "Om oss", slug: "/Om-Oss", parentId: "" });

    await waitFor(() => expect(cms.current.pages).toHaveLength(1));
    const [saved] = cms.current.pages;
    expect(saved).toMatchObject({ title: "Om oss", slug: "om-oss", parentId: null, status: "published", navOrder: 99 });
    expect(saved.id).toMatch(/^page-/);
    expect(await stored(CMS_COLLECTIONS.PAGES, saved.id)).not.toHaveProperty("linkUrl");
  });

  test("To sider lagret i samme øyeblikk får hver sin ID", async () => {
    const cms = mountProvider();
    void cms.current.savePage({ title: "Første" });
    void cms.current.savePage({ title: "Andre" });

    await waitFor(() => expect(cms.current.pages.map((p) => p.title).sort()).toEqual(["Andre", "Første"]));
  });

  test("Toppbildene og bryterne på forsiden lagres med siden", async () => {
    const cms = mountProvider();
    void cms.current.savePage({ title: "Forside", slug: "forside", linkUrl: "/", heroImage: "a.jpg", heroImages: ["b.jpg", "", "c.jpg", "d.jpg"], heroZoom: false });

    await waitFor(() => expect(cms.current.pages).toHaveLength(1));
    // Two more images at most, empty ones dropped; a switch nobody has touched is on
    expect(cms.current.pages[0]).toMatchObject({ heroImages: ["b.jpg", "c.jpg"], heroZoom: false, heroMenuOverlay: true });
  });

  test("En redigert side erstatter den gamle", async () => {
    seed(CMS_COLLECTIONS.PAGES, [page("om-oss", { title: "Om oss", linkUrl: "/lederskap" })]);
    const cms = mountProvider();
    await waitFor(() => expect(cms.current.pages).toHaveLength(1));

    void cms.current.savePage({ ...cms.current.pages[0], title: "Om menigheten", linkUrl: undefined });
    await waitFor(() => expect(cms.current.pages[0].title).toBe("Om menigheten"));
    expect(cms.current.pages).toHaveLength(1);
    expect(await stored(CMS_COLLECTIONS.PAGES, "om-oss")).not.toHaveProperty("linkUrl");
  });

  test("Når en hovedfane slettes, flyttes underfanene opp i samme skriving", async () => {
    seed(CMS_COLLECTIONS.PAGES, [
      page("utleie"),
      page("kurs", { parentId: "utleie" }),
      page("selskap", { parentId: "utleie" }),
      page("kontakt"),
    ]);
    const cms = mountProvider();
    await waitFor(() => expect(cms.current.pages).toHaveLength(4));

    void cms.current.deletePage("utleie");
    await waitFor(() => expect(ids(cms.current.pages).sort()).toEqual(["kontakt", "kurs", "selskap"]));
    expect(cms.current.pages.every((p) => p.parentId === null)).toBe(true);
    expect((await stored(CMS_COLLECTIONS.PAGES, "kurs"))?.parentId).toBeNull();
    expect((await stored(CMS_COLLECTIONS.PAGES, "selskap"))?.parentId).toBeNull();
    expect(await storedIds(CMS_COLLECTIONS.PAGES)).toEqual(["kontakt", "kurs", "selskap"]);
  });
});

describe("Nyheter, taler og stab", () => {
  test("Nytt innhold får standardverdier og havner riktig i rekkefølgen", async () => {
    seed(CMS_COLLECTIONS.NEWS, [article("fra-i-fjor", "2025-06-01T10:00:00.000Z")]);
    const cms = mountProvider();
    void cms.current.saveNews({ title: "Høstfest" });
    void cms.current.saveSermon({ title: "Nåde", date: "2026-09-27" });
    void cms.current.saveStaff({ name: "Kari Nordmann" });

    await waitFor(() => {
      expect(cms.current.news.map((n) => n.title)).toEqual(["Høstfest", "fra-i-fjor"]);
      expect(cms.current.sermons[0]).toMatchObject({ title: "Nåde", speaker: "Pastor" });
      expect(cms.current.staff[0]).toMatchObject({ name: "Kari Nordmann", role: "Medarbeider", category: "stab" });
    });
    expect(cms.current.news[0]).toMatchObject({ category: "aktuelt", author: "Menigheten", isPublished: true });
  });

  test("Slettet innhold forsvinner", async () => {
    seed(CMS_COLLECTIONS.NEWS, [article("nyhet", "2026-09-01T10:00:00.000Z")]);
    seed(CMS_COLLECTIONS.SERMONS, [sermon("tale", "2026-08-30")]);
    seed(CMS_COLLECTIONS.STAFF, [{ id: "stab-1", name: "Ola", role: "Pastor", email: "", phone: "", category: "pastor" }]);
    const cms = mountProvider();
    await waitFor(() => expect(cms.current.staff).toHaveLength(1));

    void cms.current.deleteNews("nyhet");
    void cms.current.deleteSermon("tale");
    void cms.current.deleteStaff("stab-1");
    await waitFor(() => {
      expect(cms.current.news).toEqual([]);
      expect(cms.current.sermons).toEqual([]);
      expect(cms.current.staff).toEqual([]);
    });
  });
});

describe("Innstillinger", () => {
  test("Lagring endrer bare feltene som er oppgitt", async () => {
    seed(CMS_COLLECTIONS.SETTINGS, [{ id: CMS_SETTINGS_DOC_ID, ...demoCmsSettings, churchName: "Testkirken" }]);
    const cms = mountProvider();
    await waitFor(() => expect(cms.current.settings.churchName).toBe("Testkirken"));

    void cms.current.saveSettings({ tagline: "Ny undertittel" });
    await waitFor(() => expect(cms.current.settings.tagline).toBe("Ny undertittel"));
    expect(cms.current.settings.churchName).toBe("Testkirken");
    expect(await stored(CMS_COLLECTIONS.SETTINGS, CMS_SETTINGS_DOC_ID)).toMatchObject({
      churchName: "Testkirken",
      tagline: "Ny undertittel",
    });
  });
});

describe("Moduler", () => {
  test("ingen modul er på før databasen har svart, og uten forbindelse er svaret ikke kjent", async () => {
    const cms = mountProvider();
    await pause(50);

    expect(cms.current.addons).toEqual({});
    expect(cms.current.addonsState).toBe("loading");
  });

  test("en modul som slås på, er på for den som følger med, og den andre er som den var", async () => {
    seed(CMS_COLLECTIONS.SETTINGS, [{ id: "addons", recordType: "addons", on: { analysebord: true } }]);
    const cms = mountProvider();
    await waitFor(() => expect(cms.current.addonsState).toBe("ready"));
    expect(cms.current.addons).toEqual({ analysebord: true });

    void cms.current.setAddon("nettsidebesok", true);
    await waitFor(() => expect(cms.current.addons).toEqual({ analysebord: true, nettsidebesok: true }));

    void cms.current.setAddon("analysebord", false);
    await waitFor(() => expect(cms.current.addons).toEqual({ nettsidebesok: true }));
    expect(await stored(CMS_COLLECTIONS.SETTINGS, "addons")).toEqual({
      id: "addons",
      recordType: "addons",
      on: { analysebord: false, nettsidebesok: true },
    });
    // The settings of the website are another document, and it is not touched
    expect(await stored(CMS_COLLECTIONS.SETTINGS, CMS_SETTINGS_DOC_ID)).toBeUndefined();
  });
});

describe("Feil", () => {
  test("En lagring databasen avviser svarer nei og meldes til brukeren", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cms = mountProvider();
    // Firestore cannot store a function
    const saved = await cms.current.savePage({ title: "Ødelagt", content: (() => "x") as unknown as string });

    expect(saved).toBe(false);
    expect(getWriteError()?.action).toBe("lagre siden");
    await pause(50);
    expect(cms.current.pages).toEqual([]);
  });
});
