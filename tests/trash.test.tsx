// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { CMS_COLLECTIONS } from "../src/data/collections";
import type { CmsNewsArticle, CmsPage, CmsSermon } from "../src/data/cmsData";
import { clearWriteError, getWriteError } from "../src/services/writeErrors";
import { clearCollections, offline, seed } from "./support/offlineFirestore";

// The recycle bin is kept in memory here, in place of the records the service layer stores in cms_settings
const { store, cmsStub } = vi.hoisted(() => ({
  store: { trash: [] as any[], failTrash: false },
  cmsStub: { value: null as null | Record<string, unknown> },
}));

vi.mock("../src/firebase", async () => (await import("./support/offlineFirestore")).firebaseModuleMock);
vi.mock("../src/services/contentVersions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/services/contentVersions")>()),
  moveToTrash: vi.fn(async (records: any[]) => {
    if (store.failTrash) throw new Error("Nettet er borte");
    store.trash.push(...records);
  }),
  fetchTrashRecords: vi.fn(async () => store.trash.map((r) => ({ ...r }))),
  deleteTrashRecord: vi.fn(async (id: string) => {
    store.trash = store.trash.filter((r) => r.id !== id);
  }),
}));
// Writes to the content itself are recorded, not sent
vi.mock("../src/services/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/services/firestore")>()),
  setDocument: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
  deletePage: vi.fn(async () => {}),
}));
// The tab is tested with a stub of the context; everything else uses the real provider
vi.mock("../src/context/CmsContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/context/CmsContext")>();
  return { ...actual, useCms: () => cmsStub.value ?? actual.useCms() };
});

import { CmsProvider, useCms } from "../src/context/CmsContext";
import * as firestore from "../src/services/firestore";
import * as contentVersions from "../src/services/contentVersions";
import { keptVersionsOf, versionsToPrune, type ContentVersion } from "../src/utils/contentVersions";
import { groupTrash, trashLabel, trashRecordOf, type TrashItem, type TrashRecord } from "../src/utils/trash";
import { TrashTab } from "../src/pages/admin/tabs/TrashTab";
import type { StudioData } from "../src/pages/admin/studio";

const DAY = 24 * 60 * 60 * 1000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

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

const article = (id: string): CmsNewsArticle => ({
  id,
  title: `Nyhet ${id}`,
  slug: id,
  summary: "",
  content: "",
  category: "aktuelt",
  author: "Menigheten",
  publishedAt: "2026-09-01T10:00:00.000Z",
  isPublished: true,
});

const sermon = (id: string): CmsSermon => ({ id, title: `Tale ${id}`, speaker: "Pastor", date: "2026-08-30" });

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  await offline;
  await clearCollections(Object.values(CMS_COLLECTIONS));
  localStorage.clear();
  clearWriteError();
  store.trash = [];
  store.failTrash = false;
  cmsStub.value = null;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();

});

function mountProvider(editorId?: string) {
  const { result } = renderHook(() => useCms(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <CmsProvider editorId={editorId}>{children}</CmsProvider>,
  });
  return result;
}

describe("Sletting går til papirkurven", () => {
  test("å slette en nyhet lagrer en papirkurv-post med kopien og hvem som slettet, før nyheten slettes", async () => {
    seed(CMS_COLLECTIONS.NEWS, [article("nyhet")]);
    const cms = mountProvider("person-kari");
    await waitFor(() => expect(cms.current.news).toHaveLength(1));

    expect(await cms.current.deleteNews("nyhet")).toBe(true);

    expect(store.trash).toHaveLength(1);
    expect(store.trash[0]).toMatchObject({
      kind: "news",
      targetId: "nyhet",
      title: "Nyhet nyhet",
      deleted: true,
      deletedBy: "person-kari",
      root: true,
      snapshot: expect.objectContaining({ id: "nyhet", title: "Nyhet nyhet" }),
    });
    const trashWritten = vi.mocked(contentVersions.moveToTrash).mock.invocationCallOrder[0];
    const deleted = vi.mocked(firestore.deleteDocument).mock.invocationCallOrder[0];
    expect(trashWritten).toBeLessThan(deleted);
    expect(firestore.deleteDocument).toHaveBeenCalledWith(CMS_COLLECTIONS.NEWS, "nyhet");
  });

  test("å slette en tale lagrer den i papirkurven som tale", async () => {
    seed(CMS_COLLECTIONS.SERMONS, [sermon("tale")]);
    const cms = mountProvider();
    await waitFor(() => expect(cms.current.sermons).toHaveLength(1));

    await cms.current.deleteSermon("tale");
    expect(store.trash[0]).toMatchObject({ kind: "sermon", targetId: "tale", title: "Tale tale" });
    expect(firestore.deleteDocument).toHaveBeenCalledWith(CMS_COLLECTIONS.SERMONS, "tale");
  });

  test("feiler papirkurv-lagringen, slettes ingenting, og feilen meldes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed(CMS_COLLECTIONS.NEWS, [article("nyhet")]);
    const cms = mountProvider();
    await waitFor(() => expect(cms.current.news).toHaveLength(1));
    store.failTrash = true;

    expect(await cms.current.deleteNews("nyhet")).toBe(false);
    expect(firestore.deleteDocument).not.toHaveBeenCalled();
    expect(getWriteError()?.action).toBe("flytte til papirkurven");
  });

  test("en side slettes med undersidene sine: én post per side, med samme gruppe", async () => {
    seed(CMS_COLLECTIONS.PAGES, [
      page("utleie"),
      page("kurs", { parentId: "utleie" }),
      page("selskap", { parentId: "utleie" }),
      page("kontakt"),
    ]);
    const cms = mountProvider("person-kari");
    await waitFor(() => expect(cms.current.pages).toHaveLength(4));

    expect(await cms.current.deletePage("utleie")).toBe(true);

    expect(store.trash.map((r) => r.targetId).sort()).toEqual(["kurs", "selskap", "utleie"]);
    expect(new Set(store.trash.map((r) => r.deletionGroup)).size).toBe(1);
    expect(store.trash.find((r) => r.targetId === "utleie")).toMatchObject({ root: true, kind: "page" });
    expect(store.trash.find((r) => r.targetId === "kurs")).toMatchObject({ root: false });
    // The sub-pages are kept as they were, before they were moved up
    expect(store.trash.find((r) => r.targetId === "kurs")?.snapshot).toMatchObject({ parentId: "utleie" });
    expect(firestore.deletePage).toHaveBeenCalledWith("utleie", ["kurs", "selskap"]);
  });
});

describe("Henting fra papirkurven", () => {
  test("papirkurven viser nyeste først, og det som er eldre enn 30 dager slettes for godt", async () => {
    store.trash = [
      trashRecordOf("gammel", "news", article("gammel"), { deletedAt: iso(40), deletionGroup: "g1", root: true }),
      trashRecordOf("i-forrige-uke", "news", article("uke"), { deletedAt: iso(5), deletionGroup: "g2", root: true }),
      trashRecordOf("i-gaar", "sermon", sermon("gaar"), { deletedAt: iso(1), deletionGroup: "g3", root: true }),
    ];
    const cms = mountProvider();

    const list = await cms.current.fetchTrash();

    expect(list.map((item) => item.members[0].targetId)).toEqual(["gaar", "uke"]);
    expect(store.trash.map((r) => r.id).sort()).toEqual(["i-forrige-uke", "i-gaar"]);
    expect(contentVersions.deleteTrashRecord).toHaveBeenCalledWith("gammel");
  });

  test("å hente tilbake en side med undersider skriver alle tilbake med samme id-er, og tømmer papirkurven for dem", async () => {
    store.trash = [
      trashRecordOf("r-utleie", "page", page("utleie", { title: "Utleie" }), { deletedAt: iso(1), deletionGroup: "g", root: true }),
      trashRecordOf("r-kurs", "page", page("kurs", { parentId: "utleie" }), { deletedAt: iso(1), deletionGroup: "g", root: false }),
    ];
    const cms = mountProvider();
    const [item] = await cms.current.fetchTrash();

    expect(item.members).toHaveLength(2);
    expect(trashLabel(item)).toBe("Utleie (med 1 underside)");
    expect(await cms.current.restoreFromTrash(item)).toBe(true);

    expect(firestore.setDocument).toHaveBeenCalledWith(CMS_COLLECTIONS.PAGES, "utleie", expect.objectContaining({ id: "utleie", title: "Utleie" }));
    expect(firestore.setDocument).toHaveBeenCalledWith(CMS_COLLECTIONS.PAGES, "kurs", expect.objectContaining({ id: "kurs", parentId: "utleie" }));
    expect(store.trash).toEqual([]);
  });
});

describe("Historikken og papirkurven", () => {
  const version = (id: string, replacedAt: string): ContentVersion => ({
    id,
    kind: "news",
    targetId: "nyhet",
    savedAt: replacedAt,
    replacedAt,
    title: "Nyhet",
    snapshot: { id: "nyhet" },
  });
  const asStored = (record: object) => ({ ...record, recordType: "contentVersion" }) as Record<string, unknown>;

  test("historikken for en side eller nyhet viser ikke papirkurv-poster", () => {
    const trash = asStored(trashRecordOf("papir-1", "news", article("nyhet"), { deletedAt: iso(1), deletionGroup: "g", root: true }));
    const records = [asStored(version("v-1", iso(2))), trash];

    expect(keptVersionsOf(records, "news", "nyhet").map((v) => v.id)).toEqual(["v-1"]);
    expect(keptVersionsOf(records, "page", "nyhet")).toEqual([]);
  });

  test("å beskjære de eldste versjonene fjerner aldri en papirkurv-post", () => {
    const trash = asStored(trashRecordOf("papir-1", "news", article("nyhet"), { deletedAt: iso(1), deletionGroup: "g", root: true }));
    const records = [asStored(version("v-1", iso(3))), asStored(version("v-2", iso(2))), trash];

    const kept = keptVersionsOf(records, "news", "nyhet");
    expect(versionsToPrune(kept, 1)).toEqual(["v-1"]);
    expect(versionsToPrune(kept, 1)).not.toContain("papir-1");
  });
});

describe("Fanen Papirkurv", () => {
  const studio = { adminPersons: [{ person: { id: "person-kari", name: "Kari Nordmann" }, groups: [], leaderInGroups: [], deputyInGroups: [] }] } as unknown as StudioData;

  test("viser det som er slettet, og «Hent tilbake» henter det tilbake", async () => {
    const records: TrashRecord[] = [
      trashRecordOf("r-om-oss", "page", page("om-oss", { title: "Om oss" }), { deletedAt: iso(2), deletedBy: "person-kari", deletionGroup: "g1", root: true }),
      trashRecordOf("r-barn", "page", page("barn", { parentId: "om-oss" }), { deletedAt: iso(2), deletedBy: "person-kari", deletionGroup: "g1", root: false }),
      trashRecordOf("r-nyhet", "news", article("nyhet"), { deletedAt: iso(1), deletionGroup: "g2", root: true }),
    ];
    const restoreFromTrash = vi.fn(async (_item: TrashItem) => true);
    const fetchTrash = vi.fn(async () => groupTrash(records));
    const showFeedback = vi.fn();
    cmsStub.value = { fetchTrash, restoreFromTrash };

    render(<TrashTab studio={studio} showFeedback={showFeedback} />);

    expect(await screen.findByText("Om oss (med 1 underside)")).toBeTruthy();
    expect(screen.getByText("Nyhet nyhet")).toBeTruthy();
    expect(screen.getByText(/Kari Nordmann/)).toBeTruthy();

    // The newest first: the article, then the page
    fireEvent.click(screen.getAllByRole("button", { name: "Hent tilbake" })[1]);
    await waitFor(() => expect(restoreFromTrash).toHaveBeenCalledTimes(1));
    expect(restoreFromTrash.mock.calls[0][0]).toMatchObject({ title: "Om oss", deletionGroup: "g1" });
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("«Om oss» er hentet tilbake"));
    await pause(10);
  });

  test("en tom papirkurv sier det", async () => {
    cmsStub.value = { fetchTrash: vi.fn(async () => []), restoreFromTrash: vi.fn() };
    render(<TrashTab studio={studio} showFeedback={vi.fn()} />);
    expect(await screen.findByText("Papirkurven er tom.")).toBeTruthy();
  });
});
