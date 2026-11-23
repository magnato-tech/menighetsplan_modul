// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminCmsPanel } from "../src/components/admin/AdminCmsPanel";
import { PageEditModal } from "../src/pages/admin/tabs/pages/PageEditModal";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";

const { savePage, testPages } = vi.hoisted(() => ({
  savePage: vi.fn(async () => true),
  // Same array every render, so the panel's effects do not run again on each render
  testPages: [
    { id: "page-forside", slug: "", title: "Forside", summary: "", content: "Velkommen", isPublished: true, inNavMenu: true, menuOrder: 1, parentPageId: null, updatedAt: "" },
    { id: "page-om-oss", slug: "om-oss", title: "Om oss", summary: "", content: "Tekst om oss", isPublished: true, inNavMenu: true, menuOrder: 2, parentPageId: null, updatedAt: "" },
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

// Stubs matchMedia so that every media query answers the same.
function stubScreen(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
}

const panel = (props: { createRequested?: boolean } = {}) =>
  render(
    <MemoryRouter>
      <AdminCmsPanel showFeedback={vi.fn()} {...props} />
    </MemoryRouter>
  );
const rad = (id: string) => document.getElementById(`side-${id}`);

const side: Partial<CmsPage> = {
  id: "page-om-oss",
  slug: "om-oss",
  title: "Om oss",
  blocks: [
    { id: "velkommen", type: "text", title: "Velkommen", isDynamic: false, rawContent: "## Velkommen\nTekst" },
    { id: "kontakt", type: "text", title: "Kontakt", isDynamic: false, rawContent: "## Kontakt\nRing oss" },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  savePage.mockClear();
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
});

describe("Sider & Innhold åpner alltid Sidestruktur", () => {
  test("en lagret visning «rediger» gir likevel Sidestruktur når panelet åpnes", () => {
    window.localStorage.setItem("menighetsplan:sider-visning", "rediger");
    const view = panel();
    expect(view.queryByText("Rediger side: Forside")).toBeNull();
    expect(rad("page-om-oss")).not.toBeNull();
    expect(within(view.getByRole("group", { name: "Velg visning" })).getByRole("button", { name: "Sidestruktur" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("en forespørsel om ny side åpner likevel editoren", () => {
    const view = panel({ createRequested: true });
    expect(view.getByPlaceholderText("f.eks. Om oss, Barn & Unge, Kontakt")).toBeTruthy();
    expect(rad("page-om-oss")).toBeNull();
    expect(within(view.getByRole("group", { name: "Velg visning" })).getByRole("button", { name: "Rediger" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("et nytt trykk på «Sider & Innhold» i menyen viser Sidestruktur, også når panelet alt er åpent", () => {
    const view = render(
      <MemoryRouter>
        <AdminCmsPanel showFeedback={vi.fn()} showTreeRequest={0} />
      </MemoryRouter>
    );
    const visning = () => within(view.getByRole("group", { name: "Velg visning" }));
    fireEvent.click(visning().getByRole("button", { name: "Rediger" }));
    expect(visning().getByRole("button", { name: "Rediger" }).getAttribute("aria-pressed")).toBe("true");

    view.rerender(
      <MemoryRouter>
        <AdminCmsPanel showFeedback={vi.fn()} showTreeRequest={1} />
      </MemoryRouter>
    );
    expect(visning().getByRole("button", { name: "Sidestruktur" }).getAttribute("aria-pressed")).toBe("true");
    expect(rad("page-om-oss")).not.toBeNull();
  });
});

describe("Seksjonslisten skjult: stripe med ››", () => {
  test("«››» viser listen igjen", () => {
    stubScreen(true);
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1800 });
    window.localStorage.setItem("menighetsplan:seksjoner-skjult", "1");
    const view = render(
      <MemoryRouter>
        <PageEditModal editingPage={side} isNewPage={false} availableParentPages={[]} onUpdate={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(view.queryByRole("navigation", { name: "Seksjoner på siden" })).toBeNull();
    const knapp = view.getByRole("button", { name: "Vis seksjoner" });
    expect(knapp.textContent).toBe("››");
    expect(knapp.getAttribute("title")).toBe("Vis seksjoner");
    // The old toolbar button «Seksjoner» is gone
    expect(view.queryByRole("button", { name: "Seksjoner" })).toBeNull();

    fireEvent.click(knapp);
    expect(view.getByRole("navigation", { name: "Seksjoner på siden" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Skjul seksjoner" })).toBeTruthy();
  });
});
