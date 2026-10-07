// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PageTreeList } from "../pages/admin/tabs/pages/PageTreeList";
import { PageEditModal } from "../pages/admin/tabs/pages/PageEditModal";
import { PublicStaticPage } from "../pages/public/PublicStaticPage";
import { MemoryRouter } from "react-router-dom";
import { PageNode } from "../utils/menu";
import { CmsPage } from "../data/cmsData";
import { afterEach } from "vitest";

const mockGetPageBySlug = vi.fn();

// Mock CmsContext and FirebaseDataContext
vi.mock("../context/CmsContext", () => ({
  useCms: () => ({
    settings: {
      churchName: "Lillesand Menighet",
      appName: "Menighetsportal",
      theme: "warm-stone",
    },
    pages: [],
    media: [],
    news: [],
    sermons: [],
    savePage: vi.fn(),
    getPageBySlug: mockGetPageBySlug,
  }),
}));

vi.mock("../context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    currentUser: { id: "p1", name: "Kari Nordmann", isStaff: true, globalRole: "admin" },
    setCurrentUserId: vi.fn(),
    getUserGroups: vi.fn().mockReturnValue([]),
    getTasksForPerson: vi.fn().mockReturnValue([]),
    allPersons: [
      { id: "p1", name: "Kari Nordmann", isStaff: true, isPublicProfile: true, publicTitle: "Hovedpastor" },
    ],
    gatherings: [],
    groups: [],
  }),
}));

afterEach(() => {
  cleanup();
});

describe("PageTreeList: Kollaps og utvidelse av sidehierarkiet", () => {
  const dummyParent: CmsPage = {
    id: "parent-1",
    slug: "om-oss",
    title: "Om oss",
    summary: "Bli kjent med oss",
    content: "## Velkommen",
    isPublished: true,
    inNavMenu: true,
    parentId: null,
    parentPageId: null,
    menuOrder: 1,
    navOrder: 1,
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const dummyChild1: CmsPage = {
    id: "child-1",
    slug: "historie",
    title: "Vår historie",
    summary: "Historien vår",
    content: "Tekst",
    isPublished: true,
    inNavMenu: true,
    parentId: "parent-1",
    parentPageId: "parent-1",
    menuOrder: 1,
    navOrder: 1,
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const dummyChild2: CmsPage = {
    id: "child-2",
    slug: "visjon",
    title: "Vår visjon",
    summary: "Visjon og verdier",
    content: "Tekst",
    isPublished: true,
    inNavMenu: true,
    parentId: "parent-1",
    parentPageId: "parent-1",
    menuOrder: 2,
    navOrder: 2,
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const hierarchicalPages: PageNode[] = [
    {
      page: dummyParent,
      children: [dummyChild1, dummyChild2],
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test("rendrer underfaner i utvidet tilstand som standard og viser foldepil og antallsmerke", () => {
    render(
      <MemoryRouter>
        <PageTreeList
          hierarchicalPages={hierarchicalPages}
          orphanPages={[]}
          onOpenNewPage={vi.fn()}
          onOpenEditPage={vi.fn()}
          onRequestDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    // Hovedfane og begge underfaner er synlige i DOM-en
    expect(screen.getByText("Om oss")).toBeDefined();
    expect(screen.getByText("Vår historie")).toBeDefined();
    expect(screen.getByText("Vår visjon")).toBeDefined();

    // Verifiser antall underfaner merke
    expect(screen.getByText(/2 underfaner/i)).toBeDefined();
  });

  test("kan kollapse underfaner ved å klikke på foldepilen", () => {
    render(
      <MemoryRouter>
        <PageTreeList
          hierarchicalPages={hierarchicalPages}
          orphanPages={[]}
          onOpenNewPage={vi.fn()}
          onOpenEditPage={vi.fn()}
          onRequestDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    // Finn knappen for å kollapse underfaner
    const foldButton = screen.getByRole("button", { name: /^Kollaps underfaner/i });
    expect(foldButton).toBeDefined();

    // Klikk for å kollapse
    fireEvent.click(foldButton);

    // Underfanene skjules fra listen
    expect(screen.queryByText("Vår historie")).toBeNull();
    expect(screen.queryByText("Vår visjon")).toBeNull();

    // Viser opplysning om at 2 underfaner er skjult
    expect(screen.getByText(/2 underfaner er skjult/i)).toBeDefined();

    // Klikk på nytt for å utvide igjen
    const expandButton = screen.getByRole("button", { name: /^Vis underfaner/i });
    fireEvent.click(expandButton);

    expect(screen.getByText("Vår historie")).toBeDefined();
    expect(screen.getByText("Vår visjon")).toBeDefined();
  });

  test("felleskontroller 'Kollaps alle' og 'Utvid alle' fungerer for hele hierarkiet", () => {
    render(
      <MemoryRouter>
        <PageTreeList
          hierarchicalPages={hierarchicalPages}
          orphanPages={[]}
          onOpenNewPage={vi.fn()}
          onOpenEditPage={vi.fn()}
          onRequestDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    const collapseAllBtn = screen.getByRole("button", { name: /^Kollaps alle$/i });
    expect(collapseAllBtn).toBeDefined();

    fireEvent.click(collapseAllBtn);
    expect(screen.queryByText("Vår historie")).toBeNull();

    const expandAllBtn = screen.getByRole("button", { name: /^Utvid alle$/i });
    expect(expandAllBtn).toBeDefined();

    fireEvent.click(expandAllBtn);
    expect(screen.getByText("Vår historie")).toBeDefined();
  });

  test("kan utvide og kollapse ved dobbeltklikk på selve boksen", () => {
    render(
      <MemoryRouter>
        <PageTreeList
          hierarchicalPages={hierarchicalPages}
          orphanPages={[]}
          onOpenNewPage={vi.fn()}
          onOpenEditPage={vi.fn()}
          onRequestDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    // Initialt er underfaner synlige
    expect(screen.getByText("Vår historie")).toBeDefined();

    // Finn tittel-elementet på hovedsiden og utfør dobbeltklikk
    const titleElem = screen.getByText("Om oss");
    fireEvent.doubleClick(titleElem);

    // Nå skal underfaner være kollapset
    expect(screen.queryByText("Vår historie")).toBeNull();
    expect(screen.getByText(/2 underfaner er skjult/i)).toBeDefined();

    // Dobbeltklikk på nytt skal utvide igjen
    fireEvent.doubleClick(titleElem);
    expect(screen.getByText("Vår historie")).toBeDefined();
  });

  test("dobbeltklikk på handlingsknapper trigger ikke utilsiktet kollaps", () => {
    const onOpenEditPage = vi.fn();
    render(
      <MemoryRouter>
        <PageTreeList
          hierarchicalPages={hierarchicalPages}
          orphanPages={[]}
          onOpenNewPage={vi.fn()}
          onOpenEditPage={onOpenEditPage}
          onRequestDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    // Finn Rediger-knappen for hovedsiden
    const editButtons = screen.getAllByRole("button", { name: /Rediger/i });
    const mainEditBtn = editButtons[0];

    // Dobbeltklikk på Rediger-knappen
    fireEvent.doubleClick(mainEditBtn);

    // Underfaner skal FORTSATT være synlige
    expect(screen.getByText("Vår historie")).toBeDefined();
    expect(screen.getByText("Vår visjon")).toBeDefined();
  });
});

describe("PageEditModal & PublicStaticPage: Ekte forhåndsvisning i ny fane", () => {
  const samplePage: Partial<CmsPage> = {
    id: "test-page-1",
    title: "Gudstjenester",
    slug: "gudstjenester",
    summary: "Oversikt over våre søndagssamlinger",
    content: ":::callout[info] Velkommen hjem\nVi feirer gudstjeneste hver søndag kl. 11:00\n:::",
    heroImage: "https://example.com/hero.jpg",
    isPublished: false, // draft
  };

  test("PageEditModal beholder preview-området med ekte frontend-rendering og 'Forhåndsvis i ny fane'", () => {
    sessionStorage.clear();
    render(
      <MemoryRouter>
        <PageEditModal
          editingPage={samplePage}
          isNewPage={false}
          availableParentPages={[]}
          onUpdate={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    // Verifiser at modus-knapper (Rediger, Splitt, Forhåndsvis) finnes
    expect(screen.getByRole("button", { name: /^Rediger$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Splitt$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Forhåndsvis$/i })).toBeDefined();

    // Verifiser at ekte nettside-rendering finnes i preview-området som iframe
    expect(screen.getByText(/Ekte nettside-rendering/i)).toBeDefined();
    const iframe = document.querySelector('iframe[title="Forhåndsvisning av nettsiden"]');
    expect(iframe?.getAttribute("src")).toContain("/gudstjenester?preview=true&embedded=1");

    // Verifiser at 'Forhåndsvis i ny fane' lenke finnes og har preview=true
    const previewLinks = screen.getAllByRole("link", { name: /Forhåndsvis i ny fane/i });
    expect(previewLinks.length).toBeGreaterThan(0);
    const previewLink = previewLinks[0] as HTMLAnchorElement;
    expect(previewLink.getAttribute("href")).toContain("/gudstjenester?preview=true");
    expect(previewLink.getAttribute("target")).toBe("_blank");

    // Klikk på forhåndsvisningslenken
    fireEvent.click(previewLink);

    // Verifiser at utkastet er lagret i sessionStorage
    const storedDraft = sessionStorage.getItem("cms_preview_draft_gudstjenester");
    expect(storedDraft).toBeDefined();
    expect(JSON.parse(storedDraft!).title).toBe("Gudstjenester");
  });

  test("Hero-rammen er låst og statisk innhold redigeres som felt, ikke som modulkode", () => {
    const onUpdate = vi.fn();
    render(
      <MemoryRouter>
        <PageEditModal
          editingPage={{
            ...samplePage,
            heroTitle: "Velkommen hit",
            content: "## Pastorhilsen\n\nVarm velkomst til høsten.\n\n:::module-worship[highlight]\n:::",
          }}
          isNewPage={false}
          availableParentPages={[]}
          onUpdate={onUpdate}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Låst øverst · Kan ikke flyttes eller slettes/i)).toBeDefined();
    expect(screen.getByDisplayValue("Velkommen hit")).toBeDefined();
    expect(screen.getByText("Neste gudstjeneste")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Rå Markdown/i })).toBeNull();
    expect(screen.queryByText(/:::module-worship/)).toBeNull();

    const pastorCard = [...document.querySelectorAll("[data-cms-editor-target]")].find((el) =>
      el.textContent?.includes("Pastorhilsen")
    );
    const editPastor = pastorCard?.querySelector(
      'button[title="Rediger innhold"]'
    ) as HTMLButtonElement | null;
    expect(editPastor).toBeTruthy();
    fireEvent.click(editPastor!);
    expect(screen.getByDisplayValue("Pastorhilsen")).toBeDefined();
    expect(screen.getByDisplayValue("Varm velkomst til høsten.")).toBeDefined();

    const [primaryButton] = screen.getAllByPlaceholderText("Knappetekst");
    fireEvent.change(primaryButton, { target: { value: "Se kalenderen" } });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ heroCtaText: "Se kalenderen" }));
  });

  test("PublicStaticPage med lagret utkast i session viser upublisert side i preview", () => {
    mockGetPageBySlug.mockReturnValue(undefined);
    sessionStorage.setItem(
      "cms_preview_draft_id_test-page-1",
      JSON.stringify({
        ...samplePage,
        revision: 1,
        publicPath: "/gudstjenester",
      })
    );
    sessionStorage.setItem("cms_preview_active", JSON.stringify(samplePage));

    render(
      <MemoryRouter initialEntries={["/gudstjenester?preview=true"]}>
        <PublicStaticPage forcedSlug="gudstjenester" />
      </MemoryRouter>
    );

    expect(screen.getByText("Forhåndsvisning av utkast")).toBeDefined();
    expect(screen.getByText("Status: Kladd (upublisert)")).toBeDefined();
    expect(screen.getByText("Gudstjenester")).toBeDefined();
    expect(screen.getByText("Oversikt over våre søndagssamlinger")).toBeDefined();
    expect(screen.getByText("Velkommen hjem")).toBeDefined();
  });
});
