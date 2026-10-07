// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageEditModal } from "../src/pages/admin/tabs/pages/PageEditModal";
import { PublicHomePage } from "../src/pages/public/PublicHomePage";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";
import { serializeVisualBlocksToContent, type VisualBlock } from "../src/utils/cmsBlocks";

const { home, omOss } = vi.hoisted(() => ({
  omOss: {
    id: "page-om-oss",
    slug: "om-oss",
    title: "Om oss",
    summary: "Bli kjent med oss.",
    content: "## Om oss",
    isPublished: true,
    inNavMenu: true,
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as CmsPage,
  home: {
    id: "page-forside",
    slug: "",
    title: "Forside",
    summary: "Et åpent hjem for alle generasjoner.",
    heroTitle: "Velkommen til Lillesand Misjonskirke",
    heroCtaText: "Se hva som skjer",
    heroCtaLink: "section:page-forside:hva-skjer",
    heroCtaSecondaryText: "Bli kjent med oss",
    heroCtaSecondaryLink: "page:page-om-oss",
    content: "## Velkommen til menigheten\n\nDette er hilsen.",
    isPublished: true,
    inNavMenu: true,
    linkUrl: "/",
    parentId: null,
    navOrder: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as CmsPage,
}));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: {
      ...demoCmsSettings,
      churchName: "Lillesand Misjonskirke",
      welcomeHeadline: "Velkommen til Lillesand Misjonskirke",
      welcomeSubtext: "Et åpent hjem for alle generasjoner.",
    },
    pages: [home, omOss],
    media: [],
    news: [],
    sermons: [],
    staff: [],
    savePage: vi.fn(),
    getPageBySlug: (slug: string) => (slug === "" || slug === "forside" ? home : undefined),
  }),
}));

vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    currentUser: { id: "p1", name: "Kari Nordmann", globalRole: "admin" },
    currentUserId: "p1",
    setCurrentUserId: vi.fn(),
    getUserGroups: () => [],
    getTasksForPerson: () => [],
    allPersons: [],
    gatherings: [],
    groups: [],
  }),
}));

const legacyContent = "## Velkommen til menigheten\n\nDette er hilsen.";

afterEach(() => {
  home.content = legacyContent;
  cleanup();
});

function visibleBlocks(root: HTMLElement, surface: "editor" | "public") {
  const selector =
    surface === "editor"
      ? `[data-cms-surface="${surface}"] [data-cms-block]`
      : `[data-cms-block]`;
  return [...root.querySelectorAll(selector)]
    .filter((node) => node.getAttribute("data-cms-hidden") !== "true")
    .map((node) => node.getAttribute("data-cms-block"));
}

function renderEditor(content: string) {
  return render(
    <MemoryRouter>
      <PageEditModal
        editingPage={{ ...home, content, blocks: undefined }}
        isNewPage={false}
        availableParentPages={[]}
        onUpdate={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    </MemoryRouter>
  );
}

describe("CMS, forhåndsvisning og nettside viser de samme komponentene", () => {
  test("Hver synlig blokk i redigeringen finnes i iframe-preview og på nettsiden", () => {
    const editorUi = renderEditor(legacyContent);
    const edited = visibleBlocks(editorUi.container, "editor");

    expect(edited).toEqual([
      "module-worship",
      "text",
      "module-calendar",
      "module-news",
      "module-sermon",
      "module-groups",
      "module-giving",
    ]);

    const iframe = editorUi.container.querySelector('iframe[title="Forhåndsvisning av nettsiden"]');
    expect(iframe?.getAttribute("src")).toContain("/?preview=true&embedded=1");

    editorUi.unmount();

    const site = render(
      <MemoryRouter>
        <PublicHomePage pageOverride={home} relaxLinkValidation />
      </MemoryRouter>
    );
    expect(visibleBlocks(site.container, "public")).toEqual(edited);
    const siteText = site.container.textContent || "";
    expect(siteText).toContain(home.heroTitle);
    expect(siteText).toContain(home.summary);
    expect(siteText).toContain("Se hva som skjer");
    expect(siteText).toContain("Dette er hilsen.");
    expect(siteText).toContain("Nyheter og artikler");
    expect(siteText).toContain("Støtt menighetens arbeid");
    expect(siteText).toContain("Bli med i et husfellesskap");
  });

  test("En skjult blokk blir i redigeringen, men ikke i forhåndsvisningen eller på nettsiden", () => {
    const blocks: VisualBlock[] = [
      {
        id: "worship",
        type: "module-worship",
        title: "Neste gudstjeneste",
        isDynamic: true,
        variant: "highlight",
        hidden: true,
      },
      {
        id: "text",
        type: "text",
        title: "Hilsen",
        isDynamic: false,
        rawContent: "## Hilsen\n\nBare teksten.",
      },
    ];
    const content = serializeVisualBlocksToContent(blocks);
    home.content = content;

    const editorUi = renderEditor(content);
    const hidden = editorUi.container.querySelector(
      '[data-cms-surface="editor"] [data-cms-block="module-worship"]'
    );
    expect(hidden?.getAttribute("data-cms-hidden")).toBe("true");
    const visible = visibleBlocks(editorUi.container, "editor");
    expect(visible).toEqual(["text"]);
    expect(
      editorUi.container.querySelector('iframe[title="Forhåndsvisning av nettsiden"]')?.getAttribute("src")
    ).toContain("embedded=1");
    editorUi.unmount();

    const site = render(
      <MemoryRouter>
        <PublicHomePage pageOverride={{ ...home, content }} relaxLinkValidation />
      </MemoryRouter>
    );
    expect(visibleBlocks(site.container, "public")).toEqual(["text"]);
    expect(site.container.textContent).toContain("Bare teksten.");
    expect(site.container.querySelector('[data-cms-block="module-worship"]')).toBeNull();
  });
});
