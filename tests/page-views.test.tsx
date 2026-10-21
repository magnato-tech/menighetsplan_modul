// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminCmsPanel } from "../src/components/admin/AdminCmsPanel";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";

const { savePage, testPages } = vi.hoisted(() => ({
  savePage: vi.fn(async () => true),
  // Same array every render, so the panel's effects do not run again on each render
  testPages: [
    { id: "page-forside", slug: "", title: "Forside", summary: "", content: "Velkommen", isPublished: true, inNavMenu: true, menuOrder: 1, parentPageId: null, updatedAt: "" },
    { id: "page-om-oss", slug: "om-oss", title: "Om oss", summary: "", content: "Tekst om oss", isPublished: true, inNavMenu: true, menuOrder: 2, parentPageId: null, updatedAt: "" },
    { id: "page-kontakt", slug: "kontakt", title: "Kontakt", summary: "", content: "Ring oss", isPublished: false, inNavMenu: true, menuOrder: 3, parentPageId: null, updatedAt: "" },
  ] as unknown as CmsPage[],
}));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: demoCmsSettings,
    pages: testPages,
    media: [],
    news: [],
    sermons: [],
    staff: [],
    savePage,
    deletePage: vi.fn(async () => true),
    reorderPages: vi.fn(async () => true),
    getPageBySlug: () => undefined,
  }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ currentUser: { id: "p1", name: "Kari Nordmann", globalRole: "admin" }, allPersons: [], gatherings: [], groups: [] }),
}));

const panel = () =>
  render(
    <MemoryRouter>
      <AdminCmsPanel showFeedback={vi.fn()} />
    </MemoryRouter>
  );

// The switch at the top: «Rediger» and «Sidestruktur». The editor has its own «Rediger» button, so the group is used.
const bryter = (view: ReturnType<typeof panel>) => within(view.getByRole("group", { name: "Velg visning" }));
const rad = (id: string) => document.getElementById(`side-${id}`) as HTMLElement;

afterEach(() => {
  cleanup();
  savePage.mockClear();
  window.localStorage.clear();
});

describe("Visning: Rediger eller Sidestruktur", () => {
  test("standard er Rediger, med forsiden åpen og uten fanetreet", () => {
    const view = panel();
    expect(view.getByText("Rediger side: Forside")).toBeTruthy();
    expect(bryter(view).getByRole("button", { name: "Rediger" }).getAttribute("aria-pressed")).toBe("true");
    expect(view.queryByText("+ Underfane")).toBeNull();
    expect(rad("page-om-oss")).toBeNull();
  });

  test("Sidestruktur viser treet og ingen redigering, og husker valget ved ny visning", () => {
    let view = panel();
    fireEvent.click(bryter(view).getByRole("button", { name: "Sidestruktur" }));
    expect(view.queryByText("Rediger side: Forside")).toBeNull();
    expect(rad("page-om-oss")).not.toBeNull();
    expect(bryter(view).getByRole("button", { name: "Sidestruktur" }).getAttribute("aria-pressed")).toBe("true");

    cleanup();
    view = panel();
    expect(view.queryByText("Rediger side: Forside")).toBeNull();
    expect(rad("page-om-oss")).not.toBeNull();
  });

  test("Rediger på en rad i treet åpner den siden i redigeringen, og bryteren viser Rediger", () => {
    const view = panel();
    fireEvent.click(bryter(view).getByRole("button", { name: "Sidestruktur" }));
    const knapp = within(rad("page-om-oss")).getAllByRole("button").find((b) => b.textContent?.trim() === "Rediger")!;
    fireEvent.click(knapp);
    expect(view.getByText("Rediger side: Om oss")).toBeTruthy();
    expect(rad("page-om-oss")).toBeNull();
    expect(bryter(view).getByRole("button", { name: "Rediger" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("publisert status spør først, Avbryt lar siden stå publisert", () => {
    const view = panel();
    fireEvent.click(bryter(view).getByRole("button", { name: "Sidestruktur" }));
    fireEvent.click(within(rad("page-om-oss")).getByRole("button", { name: "Publisert side. Klikk for å sette til kladd." }));
    const dialog = view.getByRole("dialog");
    expect(dialog.textContent).toContain("Ta «Om oss» bort fra nettsiden?");
    fireEvent.click(within(dialog).getByText("Avbryt"));
    expect(view.queryByRole("dialog")).toBeNull();
    expect(savePage).not.toHaveBeenCalled();
  });

  test("Sett til kladd lagrer siden med isPublished false", async () => {
    const view = panel();
    fireEvent.click(bryter(view).getByRole("button", { name: "Sidestruktur" }));
    fireEvent.click(within(rad("page-om-oss")).getByRole("button", { name: "Publisert side. Klikk for å sette til kladd." }));
    fireEvent.click(within(view.getByRole("dialog")).getByText("Sett til kladd"));
    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(1));
    expect((savePage.mock.calls[0] as unknown as [Partial<CmsPage>])[0]).toMatchObject({ id: "page-om-oss", isPublished: false });
  });
});
