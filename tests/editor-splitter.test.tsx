// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageEditModal } from "../src/pages/admin/tabs/pages/PageEditModal";
import { usePaneWidth } from "../src/hooks/usePaneWidth";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";

const { savePage } = vi.hoisted(() => ({ savePage: vi.fn(async () => true) }));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: demoCmsSettings,
    pages: [],
    media: [],
    news: [],
    sermons: [],
    staff: [],
    savePage,
    deletePage: vi.fn(),
    reorderPages: vi.fn(),
    getPageBySlug: () => undefined,
  }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ currentUser: { id: "p1", name: "Kari Nordmann", globalRole: "admin" }, allPersons: [], gatherings: [], groups: [] }),
}));

const KEY = "menighetsplan:feltbredde";
const DELER = "Dra for å endre bredden på feltene";

const side: Partial<CmsPage> = {
  id: "page-om-oss",
  slug: "om-oss",
  title: "Om oss",
  blocks: [
    { id: "velkommen", type: "text", title: "Velkommen", isDynamic: false, rawContent: "## Velkommen\nTekst" },
    { id: "kontakt", type: "text", title: "Kontakt", isDynamic: false, rawContent: "## Kontakt\nRing oss" },
  ],
};

// Every media query answers the same, unless `narrowerThan` names a query that should not match.
function stubScreen(matches: boolean, notMatching?: string) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: notMatching && query.includes(notMatching) ? false : matches,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
}

// A ResizeObserver that reports the given width once, when an element is observed.
function stubPreviewWidth(width: number) {
  class StubResizeObserver {
    private callback: (entries: { contentRect: { width: number } }[]) => void;
    constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
      this.callback = callback;
    }
    observe() {
      this.callback([{ contentRect: { width } }]);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
}

const rediger = () =>
  render(
    <MemoryRouter>
      <PageEditModal editingPage={side} isNewPage={false} availableParentPages={[]} onUpdate={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} />
    </MemoryRouter>
  );

// The editor opens in split view from 1024 px wide.
function startInSplitMode() {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1280 });
}

beforeEach(() => {
  startInSplitMode();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  savePage.mockClear();
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
});

describe("usePaneWidth", () => {
  test("leser en lagret bredde", () => {
    window.localStorage.setItem(KEY, "500");
    const { result } = renderHook(() => usePaneWidth(KEY));
    expect(result.current.width).toBe(500);
  });

  test("en ugyldig lagret verdi gir standard (null)", () => {
    window.localStorage.setItem(KEY, "ikke-et-tall");
    const { result } = renderHook(() => usePaneWidth(KEY));
    expect(result.current.width).toBeNull();
  });

  test("setWidth(null) fjerner lagringen", () => {
    const { result } = renderHook(() => usePaneWidth(KEY));
    act(() => result.current.setWidth(600));
    expect(window.localStorage.getItem(KEY)).toBe("600");
    act(() => result.current.setWidth(null));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(result.current.width).toBeNull();
  });
});

describe("Skillelinje mellom feltene og forhåndsvisningen", () => {
  test("med seksjonsliste finnes skillelinjen, og piltastene gjør feltene bredere", () => {
    stubScreen(true);
    window.localStorage.setItem(KEY, "500");
    const view = rediger();
    const skille = view.getByRole("separator", { name: DELER });
    fireEvent.keyDown(skille, { key: "ArrowRight" });
    expect(window.localStorage.getItem(KEY)).toBe("524");
    expect((skille.previousElementSibling as HTMLElement).style.width).toBe("524px");
    fireEvent.keyDown(skille, { key: "ArrowLeft" });
    fireEvent.keyDown(skille, { key: "ArrowLeft" });
    expect(window.localStorage.getItem(KEY)).toBe("476");
  });

  test("uten seksjonsliste finnes skillelinjen også", () => {
    // wide columns (1024 px) but no room for the section list (1600 px)
    stubScreen(true, "1600px");
    window.localStorage.setItem(KEY, "500");
    const view = rediger();
    const skille = view.getByRole("separator", { name: DELER });
    fireEvent.keyDown(skille, { key: "ArrowRight" });
    expect(window.localStorage.getItem(KEY)).toBe("524");
  });

  test("dobbeltklikk fjerner den lagrede bredden", () => {
    stubScreen(true);
    window.localStorage.setItem(KEY, "500");
    const view = rediger();
    fireEvent.doubleClick(view.getByRole("separator", { name: DELER }));
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});

describe("Tekststørrelse i feltene", () => {
  test("«Større tekst» gir zoom 1.15 på feltene, og ikke på forhåndsvisningen", () => {
    stubScreen(true);
    const view = rediger();
    const gruppe = view.getByRole("group", { name: "Tekststørrelse i feltene" });
    expect(gruppe).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Større tekst" }));
    const felt = view.getByText("Tittel i Hero").closest('[style*="zoom"]') as HTMLElement;
    expect(felt.style.zoom).toBe("1.15");
    expect(view.getByTitle("Forhåndsvisning av nettsiden").closest('[style*="zoom"]')).toBeNull();
  });
});

describe("Desktop-forhåndsvisningen", () => {
  test("en smal kolonne skalerer desktop-rammen ned til 1280 px-layouten", () => {
    stubScreen(true);
    stubPreviewWidth(800);
    const view = rediger();
    const ramme = view.getByTitle("Forhåndsvisning av nettsiden") as HTMLIFrameElement;
    expect(ramme.style.width).toBe("1280px");
    expect(ramme.style.transform).toBe("scale(0.625)");
    expect(view.getByText(/vist i 63 %/)).toBeTruthy();
  });
});
