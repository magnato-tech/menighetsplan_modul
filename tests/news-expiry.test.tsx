// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { demoCmsSettings, type CmsNewsArticle } from "../src/data/cmsData";
import type { Gathering } from "../src/types";

// A news article goes out of the lists on the website after its last day: the date set on it,
// or the day of the event it belongs to. In the admin it stays, marked, and can be given a new date.

const { cms, planner, saveNews } = vi.hoisted(() => ({
  cms: { news: [] as unknown[] },
  planner: { gatherings: [] as unknown[], gatheringsReady: true },
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
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], groups: [], ...planner }),
}));

import { NewsModule } from "../src/components/cms/modules/NewsModule";
import { NewsTab } from "../src/pages/admin/tabs/NewsTab";
import type { StudioData } from "../src/pages/admin/studio";
import { PublicArticlePage } from "../src/pages/public/PublicArticlePage";

const article = (id: string, title: string, fields: Partial<CmsNewsArticle> = {}): CmsNewsArticle => ({
  id,
  title,
  slug: id,
  summary: "",
  content: "Tekst.",
  category: "aktuelt",
  author: "Menigheten",
  publishedAt: "2026-10-01T10:00:00.000Z",
  isPublished: true,
  ...fields,
});

const event = (id: string, title: string, startsAt: string, fields: Partial<Gathering> = {}) =>
  ({ id, title, startsAt, groupId: "g", type: "arrangement", ...fields }) as Gathering;

const prayer = event("bonn", "24 timers bønn", "2026-10-10T22:00:00.000Z");
const harvest = event("host", "Høstfest", "2026-10-18T15:00:00.000Z");

/** Monday the 12th of October 2026, in the morning. */
const NOW = Date.parse("2026-10-12T08:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  cms.news = [];
  planner.gatherings = [];
  planner.gatheringsReady = true;
});

const titles = () => screen.queryAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);

describe("Nyhetene på forsiden", () => {
  const show = () =>
    render(
      <MemoryRouter>
        <NewsModule />
      </MemoryRouter>
    );

  test("en nyhet om et arrangement som er holdt, er borte, og en nyhet om et som kommer, står", () => {
    cms.news = [
      article("n1", "24 timers bønn", { gatheringRefId: "bonn" }),
      article("n2", "Velkommen til høstfest", { gatheringRefId: "host" }),
      article("n3", "Nytt fra menigheten"),
    ];
    planner.gatherings = [prayer, harvest];
    show();

    expect(titles()).toEqual(["Velkommen til høstfest", "Nytt fra menigheten"]);
  });

  test("en nyhet med dato vises til og med den dagen, og ikke dagen etter", () => {
    cms.news = [article("n1", "Påmelding til leir", { expiresAt: "2026-10-12" }), article("n2", "Dugnad lørdag", { expiresAt: "2026-10-11" })];
    show();

    expect(titles()).toEqual(["Påmelding til leir"]);
  });

  test("de nyeste som fortsatt gjelder, fyller plassene: en utløpt nyhet tar ikke en av de tre", () => {
    cms.news = [
      article("n1", "Utløpt", { expiresAt: "2026-10-01" }),
      article("n2", "Første"),
      article("n3", "Andre"),
      article("n4", "Tredje"),
      article("n5", "Fjerde"),
    ];
    show();

    expect(titles()).toEqual(["Første", "Andre", "Tredje"]);
  });

  test("er alle utløpt, sier modulen at ingen nyheter er publisert", () => {
    cms.news = [article("n1", "24 timers bønn", { gatheringRefId: "bonn" })];
    planner.gatherings = [prayer];
    show();

    expect(titles()).toEqual([]);
    expect(screen.getByText("Ingen nyhetsartikler publisert for øyeblikket.")).toBeTruthy();
  });

  test("før arrangementene har kommet, vises ikke en nyhet som venter på arrangementet sitt", () => {
    cms.news = [article("n1", "24 timers bønn", { gatheringRefId: "bonn" }), article("n2", "Nytt fra menigheten")];
    planner.gatherings = [];
    planner.gatheringsReady = false;
    show();

    expect(titles()).toEqual(["Nytt fra menigheten"]);
  });
});

describe("En utløpt nyhet åpnet med adressen sin", () => {
  test("kan fortsatt leses", () => {
    cms.news = [article("n1", "24 timers bønn", { gatheringRefId: "bonn", content: "Vi ba i 24 timer." })];
    planner.gatherings = [prayer];
    render(
      <MemoryRouter initialEntries={["/artikkel/n1"]}>
        <Routes>
          <Route path="/artikkel/:id" element={<PublicArticlePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "24 timers bønn" })).toBeTruthy();
    expect(screen.getByText("Vi ba i 24 timer.")).toBeTruthy();
  });
});

describe("Nyhetene i admin", () => {
  const studio = {
    currentUser: { id: "p1", name: "Kari Nordmann" },
    adminGatherings: [prayer, harvest, event("hus", "Husfellesskap", "2026-10-14T17:00:00.000Z", { type: "gruppesamling" })].map((gathering) => ({ gathering })),
  } as unknown as StudioData;
  const showFeedback = vi.fn();

  const show = () =>
    render(
      <MemoryRouter>
        <NewsTab studio={studio} showFeedback={showFeedback} createRequested={false} onCreateHandled={() => {}} />
      </MemoryRouter>
    );
  const row = (title: string) => screen.getByRole("heading", { name: title }).closest("div.rounded-2xl") as HTMLElement;

  test("en utløpt nyhet står i listen, merket med ord, og de andre sier hvor lenge de vises", () => {
    cms.news = [
      article("n1", "24 timers bønn", { gatheringRefId: "bonn" }),
      article("n2", "Velkommen til høstfest", { gatheringRefId: "host" }),
      article("n3", "Påmelding til leir", { expiresAt: "2026-11-01" }),
      article("n4", "Nytt fra menigheten"),
    ];
    show();

    expect(within(row("24 timers bønn")).getByText("Utløpt 11. oktober 2026. Vises ikke lenger på forsiden")).toBeTruthy();
    expect(within(row("Velkommen til høstfest")).getByText("Vises til og med 18. oktober 2026, dagen for arrangementet.")).toBeTruthy();
    expect(within(row("Påmelding til leir")).getByText("Vises til og med 1. november 2026.")).toBeTruthy();
    expect(within(row("Nytt fra menigheten")).queryByText(/Vises til og med|Utløpt/)).toBeNull();
  });

  test("arrangementene som kan velges, er de som kommer og er åpne for menigheten", () => {
    cms.news = [article("n4", "Nytt fra menigheten")];
    show();
    fireEvent.click(within(row("Nytt fra menigheten")).getByRole("button", { name: "Rediger" }));

    const options = within(screen.getByLabelText("Hører til arrangement (valgfritt)")).getAllByRole("option").map((option) => option.textContent);
    expect(options).toHaveLength(2);
    expect(options[0]).toBe("Ikke noe arrangement");
    expect(options[1]).toContain("Høstfest");
  });

  test("velges et arrangement, sier skjemaet hvor lenge nyheten vises, og valget lagres", () => {
    cms.news = [article("n4", "Nytt fra menigheten")];
    show();
    fireEvent.click(within(row("Nytt fra menigheten")).getByRole("button", { name: "Rediger" }));
    expect(screen.getByText("Står på nettsiden til du tar den ut.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Hører til arrangement (valgfritt)"), { target: { value: "host" } });
    expect(screen.getByText("Vises til og med 18. oktober 2026, dagen for arrangementet.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Lagre artikkel" }));
    expect(saveNews).toHaveBeenCalledWith(expect.objectContaining({ id: "n4", gatheringRefId: "host" }));
  });

  test("en dato i «Vises til og med» går foran arrangementet, og kan tas bort igjen", () => {
    cms.news = [article("n2", "Velkommen til høstfest", { gatheringRefId: "host", expiresAt: "2026-10-25" })];
    show();
    fireEvent.click(within(row("Velkommen til høstfest")).getByRole("button", { name: "Rediger" }));

    const form = screen.getByRole("button", { name: "Lagre artikkel" }).closest("form") as HTMLElement;
    expect(within(form).getByText("Vises til og med 25. oktober 2026.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Vises til og med (valgfritt)"), { target: { value: "" } });
    expect(within(form).getByText("Vises til og med 18. oktober 2026, dagen for arrangementet.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Lagre artikkel" }));
    const saved = saveNews.mock.calls[0][0] as CmsNewsArticle;
    expect(saved.expiresAt).toBeUndefined();
    expect(saved.gatheringRefId).toBe("host");
  });

  test("arrangementet en nyhet hører til, står i listen også når det er holdt, så valget ikke forsvinner ved lagring", () => {
    cms.news = [article("n1", "24 timers bønn", { gatheringRefId: "bonn" })];
    show();
    fireEvent.click(within(row("24 timers bønn")).getByRole("button", { name: "Rediger" }));

    const select = screen.getByLabelText("Hører til arrangement (valgfritt)") as HTMLSelectElement;
    expect(select.value).toBe("bonn");
    expect(within(select).getAllByRole("option").map((option) => option.textContent).join(" ")).toContain("24 timers bønn");
  });
});
