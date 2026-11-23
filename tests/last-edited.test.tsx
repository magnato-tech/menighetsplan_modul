// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CMS_COLLECTIONS } from "../src/data/collections";
import type { CmsPage } from "../src/data/cmsData";
import { clearCollections, offline, stored } from "./support/offlineFirestore";

// Same database setup as cms-provider.test.tsx: the real Firestore client, kept offline
// The real module for everything else (the register service reads its auth), the offline database for db
vi.mock("../src/firebase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/firebase")>()),
  ...(await import("./support/offlineFirestore")).firebaseModuleMock,
}));

import { CmsProvider, useCms } from "../src/context/CmsContext";
import { FirebaseDataContext, type FirebaseDataContextType } from "../src/context/FirebaseDataContext";
import { PageTreeList } from "../src/pages/admin/tabs/pages/PageTreeList";
import { buildPageTree, findOrphanPages } from "../src/utils/menu";
import { editedWhen, lastEditedText } from "../src/utils/lastEdited";

// 22. november 2026, kl. 15:30 (local time)
const NOW = new Date(2026, 10, 22, 15, 30).getTime();
const at = (year: number, month: number, day: number, hour = 0, minute = 0) => new Date(year, month, day, hour, minute).toISOString();
const NAMES: Record<string, string> = { p1: "Kristine Vik" };
const nameOf = (personId: string) => NAMES[personId];

describe("Når en side eller nyhet sist ble endret", () => {
  test("samme dag skrives «i dag», med klokkeslett når det skal vises", () => {
    expect(editedWhen(at(2026, 10, 22, 14, 5), NOW, true)).toBe("i dag kl. 14:05");
    expect(editedWhen(at(2026, 10, 22, 14, 5), NOW, false)).toBe("i dag");
  });

  test("dagen før skrives «i går»", () => {
    expect(editedWhen(at(2026, 10, 21, 9, 0), NOW, false)).toBe("i går");
    expect(editedWhen(at(2026, 10, 21, 9, 0), NOW, true)).toBe("i går kl. 09:00");
  });

  test("tidligere dager skrives med dato og forkortet månedsnavn", () => {
    expect(editedWhen(at(2026, 10, 3, 8, 7), NOW, false)).toBe("3. nov.");
    expect(editedWhen(at(2026, 10, 3, 8, 7), NOW, true)).toBe("3. nov. kl. 08:07");
    expect(editedWhen(at(2026, 4, 3, 8, 7), NOW, false)).toBe("3. mai");
  });

  test("fra et annet år skrives også årstallet", () => {
    expect(editedWhen(at(2025, 4, 3, 8, 7), NOW, false)).toBe("3. mai 2025");
    expect(editedWhen(at(2025, 4, 3, 8, 7), NOW, true)).toBe("3. mai 2025 kl. 08:07");
  });

  test("ugyldig tidspunkt gir ingen tekst", () => {
    expect(editedWhen("ikke en dato", NOW, false)).toBeNull();
  });

  test("teksten har navnet på den som endret, med klokkeslett på forespørsel", () => {
    expect(lastEditedText({ updatedAt: at(2026, 10, 20, 14, 5), updatedBy: "p1" }, nameOf, NOW, { withTime: true })).toBe(
      "Endret 20. nov. kl. 14:05 av Kristine Vik"
    );
  });

  test("uten klokkeslett og med «i går»", () => {
    expect(lastEditedText({ updatedAt: at(2026, 10, 21, 9, 0), updatedBy: "p1" }, nameOf, NOW)).toBe("Endret i går av Kristine Vik");
  });

  test("en person som ikke finnes i listen gir bare tidspunktet", () => {
    expect(lastEditedText({ updatedAt: at(2026, 10, 20, 14, 5), updatedBy: "ukjent" }, nameOf, NOW, { withTime: true })).toBe(
      "Endret 20. nov. kl. 14:05"
    );
  });

  test("uten registrert person gir bare tidspunktet", () => {
    expect(lastEditedText({ updatedAt: at(2026, 10, 20, 14, 5) }, nameOf, NOW)).toBe("Endret 20. nov.");
  });

  test("uten tidspunkt vises ingenting", () => {
    expect(lastEditedText({ updatedBy: "p1" }, nameOf, NOW)).toBeNull();
    expect(lastEditedText({ updatedAt: "", updatedBy: "p1" }, nameOf, NOW)).toBeNull();
  });
});

const editor = { id: "p1", name: "Kristine Vik" };

/** Mounts the CMS provider, with or without someone logged in (App.tsx passes the person in). */
function mountProvider(loggedIn: boolean) {
  const { result } = renderHook(() => useCms(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <CmsProvider editorId={loggedIn ? editor.id : undefined}>{children}</CmsProvider>
    ),
  });
  return result;
}

beforeEach(async () => {
  await offline;
  await clearCollections(Object.values(CMS_COLLECTIONS));
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Lagring", () => {
  test("en lagret side får tidspunkt og id til den innloggede personen", async () => {
    const cms = mountProvider(true);
    void cms.current.savePage({ title: "Om oss", slug: "om-oss" });

    await waitFor(() => expect(cms.current.pages).toHaveLength(1));
    const [saved] = cms.current.pages;
    expect(saved.updatedBy).toBe("p1");
    expect(Math.abs(Date.now() - Date.parse(saved.updatedAt))).toBeLessThan(60_000);
    expect(await stored(CMS_COLLECTIONS.PAGES, saved.id)).toMatchObject({ updatedBy: "p1", updatedAt: saved.updatedAt });
  });

  test("en lagret nyhet får tidspunkt og id til den innloggede personen", async () => {
    const cms = mountProvider(true);
    void cms.current.saveNews({ title: "Ny sak", slug: "ny-sak" });

    await waitFor(() => expect(cms.current.news).toHaveLength(1));
    const [saved] = cms.current.news;
    expect(saved.updatedBy).toBe("p1");
    expect(Math.abs(Date.now() - Date.parse(saved.updatedAt!))).toBeLessThan(60_000);
    expect(await stored(CMS_COLLECTIONS.NEWS, saved.id)).toMatchObject({ updatedBy: "p1", updatedAt: saved.updatedAt });
  });

  test("uten innlogget person settes ingen redaktør, men tidspunktet settes", async () => {
    const cms = mountProvider(false);
    void cms.current.saveNews({ title: "Uten innlogging", slug: "uten-innlogging" });
    void cms.current.savePage({ title: "Side uten innlogging", slug: "side-uten" });

    await waitFor(() => expect(cms.current.news).toHaveLength(1));
    await waitFor(() => expect(cms.current.pages).toHaveLength(1));
    const [news] = cms.current.news;
    const [page] = cms.current.pages;
    expect(news.updatedBy).toBeUndefined();
    expect(page.updatedBy).toBeUndefined();
    expect(news.updatedAt).toBeTruthy();
    expect(page.updatedAt).toBeTruthy();
    expect(await stored(CMS_COLLECTIONS.NEWS, news.id)).not.toHaveProperty("updatedBy");
    expect(await stored(CMS_COLLECTIONS.PAGES, page.id)).not.toHaveProperty("updatedBy");
  });
});

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
  updatedAt: new Date().toISOString(),
  ...extra,
});

const renderTree = (pages: CmsPage[], persons: Record<string, string>) => {
  const firebase = {
    allPersons: Object.entries(persons).map(([id, name]) => ({ id, name, globalRole: "member" })),
  } as unknown as FirebaseDataContextType;
  // The list is shown as on a phone, without the menu bar
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  render(
    <MemoryRouter>
      <FirebaseDataContext.Provider value={firebase}>
        <CmsProvider>
          <PageTreeList
            hierarchicalPages={buildPageTree(pages)}
            orphanPages={findOrphanPages(pages)}
            onOpenNewPage={vi.fn()}
            onOpenEditPage={vi.fn()}
            onRequestDelete={vi.fn()}
          />
        </CmsProvider>
      </FirebaseDataContext.Provider>
    </MemoryRouter>
  );
};

const rowOf = (id: string) => document.getElementById(`side-${id}`) as HTMLElement;

describe("Sidestrukturen viser når og av hvem", () => {
  test("en hovedside viser «Endret … av …» med klokkeslett", () => {
    renderTree([page("om-oss", { title: "Om oss", updatedBy: "p1" })], { p1: "Kristine Vik" });
    expect(within(rowOf("om-oss")).getByText(/^Endret i dag kl\. \d{2}:\d{2} av Kristine Vik$/)).toBeTruthy();
  });

  test("en underside viser «Endret … av …» uten klokkeslett", () => {
    renderTree(
      [page("om-oss", { title: "Om oss" }), page("historie", { title: "Historie", parentId: "om-oss", updatedBy: "p1" })],
      { p1: "Kristine Vik" }
    );
    expect(within(rowOf("historie")).getByText("Endret i dag av Kristine Vik")).toBeTruthy();
  });

  test("uten kjent person vises bare «Endret …»", () => {
    renderTree([page("om-oss", { title: "Om oss", updatedBy: "ukjent" })], {});
    expect(within(rowOf("om-oss")).getByText(/^Endret i dag kl\. \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.queryByText(/ av /)).toBeNull();
  });

  test("uten tidspunkt vises ingen linje", () => {
    renderTree([page("om-oss", { title: "Om oss", updatedAt: "" })], { p1: "Kristine Vik" });
    expect(screen.queryByText(/^Endret/)).toBeNull();
  });
});
