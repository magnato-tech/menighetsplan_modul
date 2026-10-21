// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageEditModal } from "../src/pages/admin/tabs/pages/PageEditModal";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";
import type { VisualBlock } from "../src/utils/cmsBlocks";

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

// Two text blocks. Plain "##" text parses to one block, so the blocks are given directly.
const side: Partial<CmsPage> = {
  id: "page-om-oss",
  slug: "om-oss",
  title: "Om oss",
  blocks: [
    { id: "velkommen", type: "text", title: "Velkommen", isDynamic: false, rawContent: "## Velkommen\nTekst" },
    { id: "kontakt", type: "text", title: "Kontakt", isDynamic: false, rawContent: "## Kontakt\nRing oss" },
  ],
};
const LISTE = "Seksjoner på siden";

// The editor starts in "edit" mode when the window is narrower than 1024px.
function startInEditMode() {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 800 });
}

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

const rediger = (onUpdate = vi.fn()) =>
  render(
    <MemoryRouter>
      <PageEditModal editingPage={side} isNewPage={false} availableParentPages={[]} onUpdate={onUpdate} onSave={vi.fn()} onClose={vi.fn()} />
    </MemoryRouter>
  );

// The blocks from the last change the page reported.
function sisteBlokker(onUpdate: ReturnType<typeof vi.fn>): VisualBlock[] {
  const calls = onUpdate.mock.calls;
  return (calls[calls.length - 1][0] as { blocks: VisualBlock[] }).blocks;
}

beforeEach(() => {
  startInEditMode();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  savePage.mockClear();
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
});

describe("Seksjonslisten på brede skjermer", () => {
  test("listen viser alle seksjonene, og bare feltene for toppbildet vises først", () => {
    stubScreen(true);
    const view = rediger();
    const nav = within(view.getByRole("navigation", { name: LISTE }));
    for (const rad of ["Sideinnstillinger", "Toppbilde", "Velkommen", "Kontakt", "Søk og deling", "Publisering"]) {
      expect(nav.getByText(rad)).toBeTruthy();
    }
    expect(view.getByText("Tittel i Hero")).toBeTruthy();
    expect(view.queryByPlaceholderText("f.eks. Om oss, Barn & Unge, Kontakt")).toBeNull();
  });

  test("å trykke på «Søk og deling» viser SEO-feltene, og ikke toppbildet", () => {
    stubScreen(true);
    const view = rediger();
    const nav = within(view.getByRole("navigation", { name: LISTE }));
    fireEvent.click(nav.getByText("Søk og deling").closest("button")!);
    expect(view.getByText("Meta-beskrivelse for søkemotorer")).toBeTruthy();
    expect(view.queryByText("Tittel i Hero")).toBeNull();
  });

  test("øyet skjuler den første blokken på nettsiden", () => {
    stubScreen(true);
    const onUpdate = vi.fn();
    const view = rediger(onUpdate);
    fireEvent.click(view.getAllByRole("button", { name: "Skjul på nettsiden" })[0]);
    const blokker = sisteBlokker(onUpdate);
    expect(blokker[0].title).toBe("Velkommen");
    expect(blokker[0].hidden).toBe(true);
  });

  test("Alt+pil ned på «Velkommen» flytter blokken etter «Kontakt»", () => {
    stubScreen(true);
    const onUpdate = vi.fn();
    const view = rediger(onUpdate);
    const velkommen = view.getByText("Velkommen").closest("button")!;
    fireEvent.keyDown(velkommen, { key: "ArrowDown", altKey: true });
    expect(sisteBlokker(onUpdate).map((block) => block.title)).toEqual(["Kontakt", "Velkommen"]);
  });

  test("«Skjul seksjoner» skjuler listen, og «Vis seksjoner» henter den igjen", () => {
    stubScreen(true);
    const view = rediger();
    fireEvent.click(view.getByRole("button", { name: "Skjul seksjoner" }));
    expect(view.queryByRole("navigation", { name: LISTE })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Vis seksjoner" }));
    expect(view.getByRole("navigation", { name: LISTE })).toBeTruthy();
  });
});

describe("Smal skjerm", () => {
  test("ingen liste, alle seksjonene under hverandre, og en velger for å hoppe mellom dem", () => {
    stubScreen(false);
    const view = rediger();
    expect(view.queryByRole("navigation", { name: LISTE })).toBeNull();
    expect(view.getByText("Tittel i Hero")).toBeTruthy();
    // The SEO fields are folded away until the section is opened
    fireEvent.click(view.getByText("Søkemotoroptimalisering (SEO) & Delingskort").closest("button")!);
    expect(view.getByText("Meta-beskrivelse for søkemotorer")).toBeTruthy();
    expect(view.getByLabelText("Gå til seksjon")).toBeTruthy();
  });
});
