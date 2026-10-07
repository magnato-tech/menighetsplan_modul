// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageEditModal, scrollPreviewToTarget } from "../src/pages/admin/tabs/pages/PageEditModal";
import { PublicHomePage } from "../src/pages/public/PublicHomePage";
import { CMS_PREVIEW_TARGET_HERO } from "../src/utils/cmsBlocks";
import { demoCmsSettings } from "../src/data/cmsData";

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: {
      ...demoCmsSettings,
      churchName: "Lillesand Misjonskirke",
      welcomeHeadline: "Velkommen",
      welcomeSubtext: "Ingress",
    },
    pages: [],
    media: [],
    news: [],
    sermons: [],
    staff: [],
    savePage: vi.fn(),
    getPageBySlug: vi.fn(),
  }),
}));

vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    currentUser: { id: "p1", name: "Kari", globalRole: "admin" },
    setCurrentUserId: vi.fn(),
    getUserGroups: () => [],
    getTasksForPerson: () => [],
    allPersons: [],
    gatherings: [],
    groups: [],
  }),
}));

afterEach(() => cleanup());

function mockPreviewScrollRoot(container: HTMLElement) {
  const scrollRoot = container.querySelector(".cms-preview-scroll-root") as HTMLElement;
  expect(scrollRoot).toBeTruthy();
  if (!scrollRoot.scrollTo) {
    scrollRoot.scrollTo = () => {};
  }
  return vi.spyOn(scrollRoot, "scrollTo").mockImplementation(() => {});
}

function rect(top: number, height: number) {
  return {
    top,
    bottom: top + height,
    left: 0,
    right: 400,
    width: 400,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("Hero-knapper og hovedbilde", () => {
  test("skjuler primærknapp i preview når bryteren er av", () => {
    const onUpdate = vi.fn();
    render(
      <MemoryRouter>
        <PageEditModal
          editingPage={{
            title: "Forside",
            slug: "forside",
            summary: "Ingress",
            heroCtaText: "Se hva som skjer",
            showHeroPrimaryCta: false,
            showHeroSecondaryCta: true,
            heroCtaSecondaryText: "Bli kjent med oss",
          }}
          isNewPage={false}
          availableParentPages={[]}
          onUpdate={onUpdate}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Vis på siden").length).toBeGreaterThanOrEqual(2);
    const iframe = document.querySelector('iframe[title="Forhåndsvisning av nettsiden"]');
    expect(iframe?.getAttribute("src")).toContain("preview=true&embedded=1");

    render(
      <MemoryRouter>
        <PublicHomePage
          pageOverride={{
            slug: "forside",
            showHeroPrimaryCta: false,
            showHeroSecondaryCta: true,
            heroCtaSecondaryText: "Bli kjent med oss",
            heroCtaText: "Se hva som skjer",
            content: "",
          }}
          relaxLinkValidation
        />
      </MemoryRouter>
    );
    expect(document.body.textContent).not.toContain("Se hva som skjer");
    expect(document.body.textContent).toContain("Bli kjent med oss");
  });

  test("viser opplastet hovedbilde i preview og på forsiden", () => {
    const heroImage = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD";
    const { container, unmount } = render(
      <MemoryRouter>
        <PageEditModal
          editingPage={{
            title: "Forside",
            slug: "forside",
            summary: "Ingress",
            heroImage,
          }}
          isNewPage={false}
          availableParentPages={[]}
          onUpdate={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    const iframe = container.querySelector('iframe[title="Forhåndsvisning av nettsiden"]');
    expect(iframe?.getAttribute("src")).toContain("preview=true&embedded=1");
    unmount();

    render(
      <MemoryRouter>
        <PublicHomePage
          pageOverride={{
            slug: "forside",
            title: "Forside",
            summary: "Ingress",
            heroImage,
            content: "",
          }}
        />
      </MemoryRouter>
    );

    const publicImg = document.querySelector(
      `[data-cms-preview-target="${CMS_PREVIEW_TARGET_HERO}"] img`
    ) as HTMLImageElement | null;
    expect(publicImg?.getAttribute("src")).toBe(heroImage);
  });

  test("merker blokk og sender fokus til iframe-preview", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    const postMessage = vi.fn();
    const mockDoc = document.implementation.createHTMLDocument("preview");
    const calendarPreview = mockDoc.createElement("div");
    calendarPreview.setAttribute("data-cms-preview-target", "block-module-calendar-2");
    mockDoc.body.appendChild(calendarPreview);

    const { container } = render(
      <MemoryRouter>
        <PageEditModal
          editingPage={{
            title: "Forside",
            slug: "forside",
            content: `:::module-worship[highlight]\n:::\n\n## Hilsen\n\nTekst.\n\n:::module-calendar[grid]\n:::`,
          }}
          isNewPage={false}
          availableParentPages={[]}
          onUpdate={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    const iframe = container.querySelector('iframe[title="Forhåndsvisning av nettsiden"]') as HTMLIFrameElement;
    Object.defineProperty(iframe, "contentWindow", { value: { postMessage }, configurable: true });
    Object.defineProperty(iframe, "contentDocument", { value: mockDoc, configurable: true });

    const scrollTo = mockPreviewScrollRoot(container);
    const calendarCard = container.querySelector('[data-cms-editor-target="block-module-calendar-2"]');
    expect(calendarCard).toBeTruthy();

    if (calendarCard instanceof HTMLElement) {
      fireEvent.click(calendarCard);
    }

    expect(calendarCard?.className).toContain("ring-indigo-400");
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    expect(calendarPreview.getAttribute("data-cms-preview-focused")).toBe("true");
    scrollTo.mockRestore();
  });

  test("ruller preview når Rediger innhold åpnes på blokk", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    const mediaContent = `:::module-groups[banner]\n:::\n\n:::media-left[https://example.com/kirke.jpg]\n### Fellesskap\nAlle er velkommen.\n:::`;
    const mediaBlockId = "block-media-left-1";
    const mockDoc = document.implementation.createHTMLDocument("preview");
    const mediaPreview = mockDoc.createElement("div");
    mediaPreview.setAttribute("data-cms-preview-target", mediaBlockId);
    mockDoc.body.appendChild(mediaPreview);

    const { container } = render(
      <MemoryRouter>
        <PageEditModal
          editingPage={{
            title: "Fellesskap",
            slug: "fellesskap",
            content: mediaContent,
          }}
          isNewPage={false}
          availableParentPages={[]}
          onUpdate={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    const iframe = container.querySelector('iframe[title="Forhåndsvisning av nettsiden"]') as HTMLIFrameElement;
    Object.defineProperty(iframe, "contentDocument", { value: mockDoc, configurable: true });
    const scrollTo = mockPreviewScrollRoot(container);

    const editButton = container.querySelector(
      `[data-cms-editor-target="${mediaBlockId}"] button`
    ) as HTMLButtonElement | null;
    expect(editButton?.textContent).toContain("Rediger innhold");
    fireEvent.click(editButton!);

    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    expect(mediaPreview.getAttribute("data-cms-preview-focused")).toBe("true");
    scrollTo.mockRestore();
  });

  test("ruller preview når markert blokk ligger under folden", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });

    const { container } = render(
      <MemoryRouter>
        <PageEditModal
          editingPage={{
            title: "Forside",
            slug: "forside",
            content: `:::module-worship[highlight]\n:::\n\n## Hilsen\n\nTekst.\n\n:::module-calendar[grid]\n:::`,
          }}
          isNewPage={false}
          availableParentPages={[]}
          onUpdate={vi.fn()}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    );

    const scrollRoot = container.querySelector(".cms-preview-scroll-root") as HTMLElement;
    const mockDoc = document.implementation.createHTMLDocument("preview");
    const calendarPreview = mockDoc.createElement("div");
    calendarPreview.setAttribute("data-cms-preview-target", "block-module-calendar-2");
    mockDoc.body.appendChild(calendarPreview);
    const iframe = container.querySelector('iframe[title="Forhåndsvisning av nettsiden"]') as HTMLIFrameElement;
    Object.defineProperty(iframe, "contentDocument", { value: mockDoc, configurable: true });
    expect(scrollRoot).toBeTruthy();
    expect(calendarPreview).toBeTruthy();

    vi.spyOn(scrollRoot, "getBoundingClientRect").mockReturnValue(rect(0, 400));
    vi.spyOn(calendarPreview, "getBoundingClientRect").mockReturnValue(rect(900, 120));
    Object.defineProperty(scrollRoot, "scrollTop", { value: 0, writable: true, configurable: true });
    if (!scrollRoot.scrollTo) scrollRoot.scrollTo = () => {};
    const scrollTo = vi.spyOn(scrollRoot, "scrollTo").mockImplementation(() => {});

    const calendarCard = container.querySelector('[data-cms-editor-target="block-module-calendar-2"]');
    if (calendarCard instanceof HTMLElement) {
      fireEvent.click(calendarCard);
    }

    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    const call = scrollTo.mock.calls[0]?.[0] as { top?: number } | undefined;
    expect(call?.top).toBeGreaterThan(0);
    scrollTo.mockRestore();
  });
});

describe("scrollPreviewToTarget", () => {
  test("ruller ikke når blokken allerede er synlig", () => {
    const scrollRoot = document.createElement("div");
    const target = document.createElement("div");
    scrollRoot.appendChild(target);
    scrollRoot.scrollTo = vi.fn();

    vi.spyOn(scrollRoot, "getBoundingClientRect").mockReturnValue(rect(0, 400));
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(rect(50, 100));

    const scrolled = scrollPreviewToTarget(scrollRoot, target);
    expect(scrolled).toBe(false);
    expect(scrollRoot.scrollTo).not.toHaveBeenCalled();
  });

  test("ruller med positiv top når blokken ligger under folden", () => {
    const scrollRoot = document.createElement("div");
    const target = document.createElement("div");
    scrollRoot.appendChild(target);
    Object.defineProperty(scrollRoot, "scrollTop", { value: 0, writable: true });
    scrollRoot.scrollTo = vi.fn();

    vi.spyOn(scrollRoot, "getBoundingClientRect").mockReturnValue(rect(0, 400));
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(rect(800, 120));

    const scrolled = scrollPreviewToTarget(scrollRoot, target);
    expect(scrolled).toBe(true);
    expect(scrollRoot.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: expect.any(Number), behavior: "smooth" })
    );
    const call = (scrollRoot.scrollTo as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      top: number;
    };
    expect(call.top).toBeGreaterThan(0);
  });
});
