// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings, type CmsNewsArticle } from "../src/data/cmsData";
import type { Gathering } from "../src/types";
import { countNewsByFilter, filterNews, newsStatusOf } from "../src/utils/newsStatus";

// The admin list of news shows each article as a row with a status: Kladd, Planlagt, Går ut, Gått ut
// or Publisert, and a filter row above it that narrows the list down.

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
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], groups: [], gatherings: [], gatheringsReady: true }),
}));

import { NewsTab } from "../src/pages/admin/tabs/NewsTab";
import type { StudioData } from "../src/pages/admin/studio";

const article = (id: string, title: string, fields: Partial<CmsNewsArticle> = {}): CmsNewsArticle => ({
  id,
  title,
  slug: id,
  summary: "",
  content: "Tekst.",
  category: "aktuelt",
  author: "Menigheten",
  publishedAt: "2026-11-01T10:00:00.000Z",
  isPublished: true,
  ...fields,
});

/** Monday the 23rd of November 2026, in the morning in Norway. */
const NOW = Date.parse("2026-11-23T08:00:00.000Z");
const noEvents: Gathering[] = [];

describe("Status på nyhetsartikler", () => {
  test("en artikkel som ikke er publisert, er kladd", () => {
    expect(newsStatusOf(article("a", "Utkast", { isPublished: false }), noEvents, NOW)).toEqual({ kind: "kladd", label: "Kladd" });
  });

  test("en publisert artikkel med dato fram i tid er planlagt, med datoen den går ut i", () => {
    const planned = article("a", "Kommer", { publishedAt: "2026-12-01T10:00:00.000Z" });
    expect(newsStatusOf(planned, noEvents, NOW)).toEqual({ kind: "planlagt", label: "Planlagt 1. des." });
  });

  test("en artikkel som har gått ut sin siste dag, er gått ut", () => {
    const ended = article("a", "Gammel", { expiresAt: "2026-11-20" });
    expect(newsStatusOf(ended, noEvents, NOW)).toEqual({ kind: "gatt-ut", label: "Gått ut" });
  });

  test("en artikkel som går ut innen 14 dager, sier datoen", () => {
    const ending = article("a", "Påmelding", { expiresAt: "2026-12-04" });
    expect(newsStatusOf(ending, noEvents, NOW)).toEqual({ kind: "gar-ut", label: "Går ut 4. des." });
  });

  test("en artikkel som går ut først etter 14 dager, er bare publisert", () => {
    const later = article("a", "Leir", { expiresAt: "2026-12-08" });
    expect(newsStatusOf(later, noEvents, NOW)).toEqual({ kind: "publisert", label: "Publisert" });
  });

  test("en artikkel uten siste dag er publisert", () => {
    expect(newsStatusOf(article("a", "Nytt"), noEvents, NOW).kind).toBe("publisert");
  });

  test("en artikkel om et arrangement går ut dagen etter arrangementet, og får status etter det", () => {
    const event = { id: "ev", startsAt: "2026-11-20T17:00:00.000Z", endsAt: "2026-11-20T19:00:00.000Z" } as Gathering;
    expect(newsStatusOf(article("a", "Etter arrangement", { gatheringRefId: "ev" }), [event], NOW).kind).toBe("gatt-ut");
  });
});

describe("Filter på nyhetsartikler", () => {
  const articles = [
    article("kladd", "Kladd", { isPublished: false }),
    article("plan", "Planlagt", { publishedAt: "2026-12-01T10:00:00.000Z" }),
    article("ende", "Går ut", { expiresAt: "2026-12-04" }),
    article("gatt", "Gått ut", { expiresAt: "2026-11-20" }),
    article("vanlig", "Vanlig"),
  ];
  const ids = (list: CmsNewsArticle[]) => list.map((a) => a.id);

  test("«alle» viser alle, i samme rekkefølge som de kom", () => {
    expect(ids(filterNews(articles, "alle", noEvents, NOW))).toEqual(["kladd", "plan", "ende", "gatt", "vanlig"]);
  });

  test("«publisert» viser de publiserte, også de som går ut og de som har gått ut, men ikke kladder og planlagte", () => {
    expect(ids(filterNews(articles, "publisert", noEvents, NOW))).toEqual(["ende", "gatt", "vanlig"]);
  });

  test("«gar-ut» viser bare de som går ut snart", () => {
    expect(ids(filterNews(articles, "gar-ut", noEvents, NOW))).toEqual(["ende"]);
  });

  test("«kladd» og «planlagt» viser hver sin", () => {
    expect(ids(filterNews(articles, "kladd", noEvents, NOW))).toEqual(["kladd"]);
    expect(ids(filterNews(articles, "planlagt", noEvents, NOW))).toEqual(["plan"]);
  });

  test("tallene for hvert filter stemmer med listene", () => {
    expect(countNewsByFilter(articles, noEvents, NOW)).toEqual({ alle: 5, publisert: 3, kladd: 1, planlagt: 1, "gar-ut": 1 });
  });
});

describe("Nyhetslisten i admin som tabell", () => {
  const studio = {
    currentUser: { id: "p1", name: "Kari Nordmann" },
    adminGatherings: [],
  } as unknown as StudioData;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    cms.news = [];
  });

  const show = () =>
    render(
      <MemoryRouter>
        <NewsTab studio={studio} showFeedback={vi.fn()} createRequested={false} onCreateHandled={() => {}} />
      </MemoryRouter>
    );
  const row = (title: string) => screen.getByText(title).closest("tr") as HTMLElement;
  const filterButton = (label: RegExp) => screen.getByRole("button", { name: label });

  test("hver artikkel står i en rad med statuspille, og filterknappene viser antall", () => {
    cms.news = [
      article("kladd", "Utkast til leir", { isPublished: false }),
      article("plan", "Julekonsert", { publishedAt: "2026-12-01T10:00:00.000Z" }),
      article("ende", "Påmelding til leir", { expiresAt: "2026-12-04" }),
      article("vanlig", "Nytt fra menigheten"),
    ];
    show();

    expect(within(row("Utkast til leir")).getByText("Kladd")).toBeTruthy();
    expect(within(row("Julekonsert")).getByText("Planlagt 1. des.")).toBeTruthy();
    expect(within(row("Påmelding til leir")).getByText("Går ut 4. des.")).toBeTruthy();
    expect(within(row("Nytt fra menigheten")).getByText("Publisert")).toBeTruthy();

    const group = screen.getByRole("group", { name: "Vis nyheter" });
    expect(within(group).getByRole("button", { name: /Alle/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: /Kladd/ }).textContent).toContain("1");
    expect(within(group).getByRole("button", { name: /Går snart ut/ }).textContent).toContain("1");
  });

  test("filterknappene viser bare artiklene de gjelder for", () => {
    cms.news = [
      article("kladd", "Utkast til leir", { isPublished: false }),
      article("vanlig", "Nytt fra menigheten"),
    ];
    show();

    fireEvent.click(filterButton(/^Kladd/));
    expect(filterButton(/^Kladd/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Nytt fra menigheten")).toBeNull();
    expect(screen.getByText("Utkast til leir")).toBeTruthy();

    fireEvent.click(filterButton(/^Publisert/));
    expect(screen.queryByText("Utkast til leir")).toBeNull();
    expect(screen.getByText("Nytt fra menigheten")).toBeTruthy();
  });

  test("et filter uten artikler sier det med ord", () => {
    cms.news = [article("vanlig", "Nytt fra menigheten")];
    show();

    fireEvent.click(filterButton(/^Planlagt/));
    expect(screen.getByText("Ingen nyheter her.")).toBeTruthy();
    expect(screen.queryByText("Nytt fra menigheten")).toBeNull();
  });
});
