// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { demoCmsSettings, type CmsNewsArticle } from "../src/data/cmsData";

// A news article can have a picture with a description for screen readers. The editor sets both,
// the website shows the picture on the news card and at the top of the article, and the description as alt text.

const { cms, saveNews } = vi.hoisted(() => ({
  cms: { news: [] as unknown[] },
  saveNews: vi.fn(async (_article: unknown) => true),
}));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: { ...demoCmsSettings, churchName: "Menigheten" },
    pages: [],
    media: [],
    sermons: [],
    staff: [],
    news: cms.news,
    saveNews,
    deleteNews: vi.fn(async () => true),
    getNewsById: (id: string) => (cms.news as CmsNewsArticle[]).find((n) => n.id === id),
    getNewsBySlug: (slug: string) => (cms.news as CmsNewsArticle[]).find((n) => n.slug === slug),
  }),
}));
// The library: one picture with a description of its own, chosen with one press
vi.mock("../src/components/admin/StockImageGrid", () => ({
  StockImageGrid: ({ onSelect }: { onSelect?: (url: string, image: { altText: string }) => void }) => (
    <button type="button" onClick={() => onSelect?.("https://example.org/brod.jpg", { altText: "Brød på en åpen bibel" })}>
      Brød og bibel
    </button>
  ),
}));
vi.mock("../src/components/admin/MediaLibraryPanel", () => ({ MediaLibraryPanel: () => null }));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], groups: [], gatherings: [], gatheringsReady: true }),
}));

import { NewsModule } from "../src/components/cms/modules/NewsModule";
import { NewsTab } from "../src/pages/admin/tabs/NewsTab";
import type { StudioData } from "../src/pages/admin/studio";
import { PublicArticlePage } from "../src/pages/public/PublicArticlePage";

const article = (id: string, title: string, fields: Partial<CmsNewsArticle> = {}): CmsNewsArticle => ({
  id,
  title,
  slug: id,
  summary: "Kort ingress.",
  content: "Tekst.",
  category: "aktuelt",
  author: "Menigheten",
  publishedAt: "2026-10-01T10:00:00.000Z",
  isPublished: true,
  ...fields,
});

const DESCRIPTION_LABEL = "Beskrivelse for skjermleser (valgfritt for dekor)";

beforeEach(() => {
  cms.news = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  cms.news = [];
});

describe("Bilde på nyhetsartikler i admin", () => {
  const studio = {
    currentUser: { id: "p1", name: "Kari Nordmann" },
    adminGatherings: [],
  } as unknown as StudioData;

  const show = () =>
    render(
      <MemoryRouter>
        <NewsTab studio={studio} showFeedback={vi.fn()} createRequested={false} onCreateHandled={() => {}} />
      </MemoryRouter>
    );
  const row = (title: string) => screen.getByRole("heading", { name: title }).closest("div.rounded-2xl") as HTMLElement;

  test("redaktøren ser feltet «Bilde» og beskrivelsen for skjermleser, og begge lagres", () => {
    cms.news = [article("n1", "Dugnad", { imageUrl: "https://example.org/dugnad.png", imageAlt: "Folk pakker kasser", expiresAt: "2027-01-31" })];
    show();
    fireEvent.click(within(row("Dugnad")).getByRole("button", { name: "Rediger" }));

    expect(screen.getByText("Bilde")).toBeTruthy();
    const description = screen.getByLabelText(DESCRIPTION_LABEL) as HTMLInputElement;
    expect(description.value).toBe("Folk pakker kasser");

    fireEvent.change(description, { target: { value: "Folk som pakker kasser i kirkestua" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre artikkel" }));

    expect(saveNews).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n1", imageUrl: "https://example.org/dugnad.png", imageAlt: "Folk som pakker kasser i kirkestua" })
    );
  });

  test("et bilde valgt fra biblioteket lagres sammen med beskrivelsen det har med seg", () => {
    cms.news = [article("n3", "Søndag", { expiresAt: "2027-01-31" })];
    show();
    fireEvent.click(screen.getByRole("button", { name: "Rediger" }));
    fireEvent.click(screen.getByRole("button", { name: /Bibliotek/ }));
    fireEvent.click(screen.getByRole("button", { name: "Brød og bibel" }));

    // Both are kept: the picture is not lost when the description is filled in right after it
    expect(screen.getByRole("button", { name: "Fjern bilde" })).toBeTruthy();
    expect((screen.getByLabelText(DESCRIPTION_LABEL) as HTMLInputElement).value).toBe("Brød på en åpen bibel");
    fireEvent.click(screen.getByRole("button", { name: "Lagre artikkel" }));

    expect(saveNews).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n3", imageUrl: "https://example.org/brod.jpg", imageAlt: "Brød på en åpen bibel" })
    );
  });

  test("fjerner man bildet, lagres bildeadressen som tom tekst", () => {
    cms.news = [article("n2", "Leir", { imageUrl: "https://example.org/leir.png", imageAlt: "Teltleiren", expiresAt: "2027-01-31" })];
    show();
    fireEvent.click(screen.getByRole("button", { name: "Rediger" }));
    fireEvent.click(screen.getByRole("button", { name: "Fjern bilde" }));
    fireEvent.click(screen.getByRole("button", { name: "Lagre artikkel" }));

    expect(saveNews).toHaveBeenCalledWith(expect.objectContaining({ id: "n2", imageUrl: "" }));
  });

  test("en ny artikkel starter med tomt bilde og tom beskrivelse", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Ny artikkel" }));
    fireEvent.change(screen.getByPlaceholderText("f.eks. Flott oppstart for høstens søndagsskole"), { target: { value: "Ny nyhet" } });
    fireEvent.change(screen.getByLabelText("Vises til og med (valgfritt)"), { target: { value: "2027-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre artikkel" }));

    expect(saveNews).toHaveBeenCalledWith(expect.objectContaining({ title: "Ny nyhet", imageUrl: "", imageAlt: "" }));
  });
});

describe("Bildet vises med beskrivelsen på nettsiden", () => {
  const showList = () =>
    render(
      <MemoryRouter>
        <NewsModule />
      </MemoryRouter>
    );
  const showArticle = (id: string) =>
    render(
      <MemoryRouter initialEntries={[`/artikkel/${id}`]}>
        <Routes>
          <Route path="/artikkel/:id" element={<PublicArticlePage />} />
        </Routes>
      </MemoryRouter>
    );

  test("nyhetskortet bruker beskrivelsen som alt-tekst", () => {
    cms.news = [article("n1", "Dugnad", { imageUrl: "https://example.org/dugnad.png", imageAlt: "Folk pakker kasser" })];
    showList();

    expect(screen.getByRole("img", { name: "Folk pakker kasser" })).toBeTruthy();
  });

  test("artikkelsiden bruker beskrivelsen som alt-tekst", () => {
    cms.news = [article("n1", "Dugnad", { imageUrl: "https://example.org/dugnad.png", imageAlt: "Folk pakker kasser" })];
    showArticle("n1");

    expect(screen.getByRole("img", { name: "Folk pakker kasser" })).toBeTruthy();
  });

  test("uten beskrivelse er bildet dekor med tom alt-tekst", () => {
    cms.news = [article("n1", "Dugnad", { imageUrl: "https://example.org/dugnad.png" })];
    const { container } = showArticle("n1");

    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });
});
