// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageTreeList } from "../src/pages/admin/tabs/pages/PageTreeList";
import { PageNode } from "../src/utils/menu";
import { CmsPage } from "../src/data/cmsData";

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: { churchName: "Lillesand Menighet", appName: "Menighetsportal", theme: "warm-stone" },
    pages: [],
    media: [],
    news: [],
    sermons: [],
    savePage: vi.fn(),
    getPageBySlug: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

const bliMed: CmsPage = {
  id: "bli-med",
  slug: "bli-med",
  title: "Bli med",
  summary: "",
  content: "## Velkommen",
  isPublished: true,
  inNavMenu: true,
  parentId: null,
  parentPageId: null,
  menuOrder: 1,
  navOrder: 1,
  updatedAt: "2026-01-01T00:00:00Z",
};

const dopp: CmsPage = {
  id: "dopp",
  slug: "dopp",
  title: "Dåp",
  summary: "",
  content: "Tekst",
  isPublished: true,
  inNavMenu: true,
  parentId: "bli-med",
  parentPageId: "bli-med",
  menuOrder: 1,
  navOrder: 1,
  updatedAt: "2026-01-01T00:00:00Z",
};

const enkeltside: CmsPage = {
  id: "kontakt",
  slug: "kontakt",
  title: "Kontakt",
  summary: "",
  content: "Tekst",
  isPublished: true,
  inNavMenu: true,
  parentId: null,
  parentPageId: null,
  menuOrder: 2,
  navOrder: 2,
  updatedAt: "2026-01-01T00:00:00Z",
};

function renderTree(parent: CmsPage, children: CmsPage[], handlers: { onToggleOverview?: (page: CmsPage) => void; onOpenEditPage?: (page: CmsPage) => void } = {}) {
  const hierarchicalPages: PageNode[] = [{ page: parent, children }];
  return render(
    <MemoryRouter>
      <PageTreeList
        hierarchicalPages={hierarchicalPages}
        orphanPages={[]}
        onOpenNewPage={vi.fn()}
        onOpenEditPage={handlers.onOpenEditPage ?? vi.fn()}
        onRequestDelete={vi.fn()}
        onToggleOverview={handlers.onToggleOverview}
      />
    </MemoryRouter>
  );
}

describe("Oversikt-linjen i Sidestruktur", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test("viser linjen «Oversikt: Bli med» med bryteren «Vis i menyen» på, når siden har undersider", () => {
    renderTree(bliMed, [dopp]);

    expect(screen.getByText("Oversikt: Bli med")).toBeDefined();
    const toggle = screen.getByRole("switch", { name: /Vis i menyen/i });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  test("en side uten undersider har ingen Oversikt-linje", () => {
    renderTree(enkeltside, []);

    expect(screen.queryByText(/^Oversikt:/)).toBeNull();
    expect(screen.queryByRole("switch", { name: /Vis i menyen/i })).toBeNull();
  });

  test("klikk på bryteren kaller onToggleOverview med siden og åpner ikke redigering", () => {
    const onToggleOverview = vi.fn();
    const onOpenEditPage = vi.fn();
    renderTree(bliMed, [dopp], { onToggleOverview, onOpenEditPage });

    fireEvent.click(screen.getByRole("switch", { name: /Vis i menyen/i }));

    expect(onToggleOverview).toHaveBeenCalledTimes(1);
    expect(onToggleOverview).toHaveBeenCalledWith(bliMed);
    expect(onOpenEditPage).not.toHaveBeenCalled();
  });

  test("en side som bare er overskrift i menyen viser bryteren av og etiketten «Bare overskrift»", () => {
    renderTree({ ...bliMed, menuOnly: true }, [dopp]);

    const toggle = screen.getByRole("switch", { name: /Vis i menyen/i });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Bare overskrift")).toBeDefined();
  });
});
