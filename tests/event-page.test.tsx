// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://menigheten.example/" }
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { demoCmsSettings, type CmsNewsArticle } from "../src/data/cmsData";
import type { Gathering } from "../src/types";

// Every event open to everyone has a page of its own on the website: what the planner knows
// about it, and how it is presented. The cards, the calendar and a news article about it lead there.

const { planner, cms } = vi.hoisted(() => ({
  planner: { gatherings: [] as unknown[], gatheringsReady: true },
  cms: { news: [] as unknown[] },
}));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: { ...demoCmsSettings, churchName: "Menigheten" },
    pages: [],
    sermons: [],
    staff: [],
    media: [],
    news: cms.news,
    getNewsById: (id: string) => (cms.news as CmsNewsArticle[]).find((n) => n.id === id),
    getNewsBySlug: () => undefined,
  }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], groups: [], ...planner }),
}));

import { KalenderModule } from "../src/components/cms/modules/KalenderModule";
import { WorshipModule } from "../src/components/cms/modules/WorshipModule";
import { PublicArticlePage } from "../src/pages/public/PublicArticlePage";
import { PublicEventPage } from "../src/pages/public/PublicEventPage";
import { toContractV1 } from "../server/publicApi";
import { toIcalendar, toIcalendarEvent } from "../src/utils/calendarFeed";
import { eventPath, isEventPath } from "../src/utils/gatheringPresentation";
import { seoForPath, type SiteContent } from "../src/utils/siteSeo";

const POSTER = "https://menigheten.example/bilder/hostfest.jpg";
const HOUR = 60 * 60 * 1000;
const fromNow = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

const event = (id: string, title: string, fields: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "g",
  title,
  startsAt: fromNow(7 * 24),
  type: "arrangement",
  visibility: "offentlig",
  isGudstjeneste: false,
  ...fields,
});

const festival = event("host", "Høstfest", {
  location: "Storsalen",
  theme: "Takk",
  bibleText: "Sal 100",
  imageUrl: POSTER,
  imageAlt: "Plakat for høstfesten",
  summary: "Mat, sang og lek for hele familien.",
  content: "## Program\n\nVi starter med felles måltid.",
  linkUrl: "https://pamelding.example/host",
  linkLabel: "Meld deg på",
});

const showPage = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/arrangement/${id}`]}>
      <Routes>
        <Route path="/arrangement/:id" element={<PublicEventPage />} />
      </Routes>
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  planner.gatherings = [];
  planner.gatheringsReady = true;
  cms.news = [];
});

describe("Adressen til et arrangement", () => {
  test("er den samme overalt, og kjennes igjen", () => {
    expect(eventPath("host")).toBe("/arrangement/host");
    expect(eventPath("gathering 1/a")).toBe("/arrangement/gathering%201%2Fa");
    expect(isEventPath("/arrangement/host")).toBe(true);
    expect(isEventPath("/arrangement")).toBe(false);
    expect(isEventPath("/arrangement/host/mer")).toBe(false);
    expect(isEventPath("/hva-skjer")).toBe(false);
  });
});

describe("Arrangementets egen side", () => {
  test("viser det planleggeren vet og det som er skrevet for nettsiden", () => {
    planner.gatherings = [festival];
    showPage("host");

    expect(screen.getByRole("heading", { level: 1, name: "Høstfest" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Plakat for høstfesten" }).getAttribute("src")).toBe(POSTER);
    expect(screen.getByText("Mat, sang og lek for hele familien.")).toBeTruthy();
    expect(screen.getByText("Storsalen")).toBeTruthy();
    expect(screen.getByText(/Takk/).textContent).toContain("(Sal 100)");
    // The longer text is drawn as the text of a page
    expect(screen.getByRole("heading", { name: "Program" })).toBeTruthy();
    expect(screen.getByText("Vi starter med felles måltid.")).toBeTruthy();
  });

  test("knappen fører til lenken, i en ny fane når den går ut av nettsiden", () => {
    planner.gatherings = [festival, event("intern-lenke", "Kurs", { linkUrl: "/bli-med" })];
    showPage("host");
    const button = screen.getByRole("link", { name: "Meld deg på" });
    expect(button.getAttribute("href")).toBe("https://pamelding.example/host");
    expect(button.getAttribute("target")).toBe("_blank");
    cleanup();

    showPage("intern-lenke");
    // Without a text of its own, the button says «Les mer»
    const inside = screen.getByRole("link", { name: "Les mer" });
    expect(inside.getAttribute("href")).toBe("/bli-med");
    expect(inside.getAttribute("target")).toBeNull();
  });

  test("har en kalenderfil med arrangementet, og adressen til siden i den", () => {
    planner.gatherings = [festival];
    showPage("host");
    const file = decodeURIComponent(screen.getByRole("link", { name: "Legg i kalenderen min" }).getAttribute("href") ?? "");

    expect(file.startsWith("data:text/calendar")).toBe(true);
    expect(file).toContain("SUMMARY:Høstfest");
    expect(file).toContain("LOCATION:Storsalen");
    expect(file).toContain("URL:https://menigheten.example/arrangement/host");
  });

  test("et arrangement uten bilde og tekst viser bare det som er kjent", () => {
    planner.gatherings = [event("enkel", "Bønnemøte")];
    showPage("enkel");

    expect(screen.getByRole("heading", { level: 1, name: "Bønnemøte" })).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("Kirken")).toBeTruthy();
    expect(screen.queryByText(/Tema:/)).toBeNull();
  });

  test("slutten vises når den er satt, også når arrangementet går over flere dager", () => {
    planner.gatherings = [
      event("kveld", "Konsert", { startsAt: "2026-10-18T17:00:00.000Z", endsAt: "2026-10-18T19:30:00.000Z" }),
      event("leir", "Høstleir", { startsAt: "2026-10-16T16:00:00.000Z", endsAt: "2026-10-18T12:00:00.000Z" }),
    ];
    showPage("kveld");
    const clock = (iso: string) => new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    expect(screen.getByText(`Kl. ${clock("2026-10-18T17:00:00.000Z")}–${clock("2026-10-18T19:30:00.000Z")}`)).toBeTruthy();
    cleanup();

    showPage("leir");
    expect(screen.getByText(/^Fra kl\. .* til kl\. /)).toBeTruthy();
    expect(screen.getByText(/fredag 16\. oktober 2026 – søndag 18\. oktober 2026/)).toBeTruthy();
  });

  test("et avlyst arrangement sier det med ord, og tilbyr ikke kalenderfilen", () => {
    planner.gatherings = [event("avlyst", "Dugnad", { cancelled: true })];
    showPage("avlyst");

    expect(screen.getByRole("status").textContent).toBe("Arrangementet er avlyst");
    expect(screen.queryByRole("link", { name: "Legg i kalenderen min" })).toBeNull();
  });

  test("et arrangement som er holdt, har fortsatt siden sin, og sier at det er holdt", () => {
    planner.gatherings = [event("holdt", "Sommerfest", { startsAt: fromNow(-30), endsAt: fromNow(-27) })];
    showPage("holdt");

    expect(screen.getByRole("heading", { level: 1, name: "Sommerfest" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Arrangementet er holdt");
    expect(screen.queryByRole("link", { name: "Legg i kalenderen min" })).toBeNull();
  });

  test("et arrangement som pågår, er ikke holdt ennå", () => {
    planner.gatherings = [event("na", "Gudstjeneste", { startsAt: fromNow(-1) })];
    showPage("na");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("nyhetene som hører til arrangementet, står nederst", () => {
    planner.gatherings = [festival];
    cms.news = [
      { id: "n1", title: "Velkommen til høstfest", summary: "Slik blir kvelden.", isPublished: true, gatheringRefId: "host" },
      { id: "n2", title: "Kladd", isPublished: false, gatheringRefId: "host" },
      { id: "n3", title: "Noe annet", isPublished: true },
    ];
    showPage("host");

    const section = screen.getByRole("region", { name: "Les mer om arrangementet" });
    const links = within(section).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/artikkel/n1");
    expect(links[0].textContent).toContain("Velkommen til høstfest");
  });

  test("et internt arrangement og et møte i en gruppe har ingen side, heller ikke for den som har adressen", () => {
    planner.gatherings = [event("styre", "Styremøte", { visibility: "intern" }), event("hus", "Husfellesskap", { type: "gruppesamling" })];
    for (const id of ["styre", "hus", "finnes-ikke"]) {
      showPage(id);
      expect(screen.getByRole("heading", { name: "Arrangementet ble ikke funnet" })).toBeTruthy();
      expect(screen.queryByText("Styremøte")).toBeNull();
      cleanup();
    }
  });

  test("før arrangementene er hentet, sies ingenting å mangle", () => {
    planner.gatheringsReady = false;
    showPage("host");
    expect(screen.getByText("Laster …")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Arrangementet ble ikke funnet" })).toBeNull();
  });
});

describe("Veiene til arrangementets side", () => {
  test("«Neste gudstjeneste» har en lenke dit", () => {
    planner.gatherings = [event("g", "Gudstjeneste", { isGudstjeneste: true })];
    render(
      <MemoryRouter>
        <WorshipModule />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Les mer om arrangementet" }).getAttribute("href")).toBe("/arrangement/g");
  });

  test("kalenderlisten viser bildet og ingressen, og hver rad åpner siden", () => {
    planner.gatherings = [festival, event("enkel", "Bønnemøte", { startsAt: fromNow(8 * 24) })];
    render(
      <MemoryRouter>
        <KalenderModule variant="list" />
      </MemoryRouter>
    );
    const row = (title: string) => screen.getByRole("heading", { name: title }).closest("a") as HTMLElement;

    expect(row("Høstfest").getAttribute("href")).toBe("/arrangement/host");
    expect(within(row("Høstfest")).getByRole("img", { name: "Plakat for høstfesten" }).getAttribute("src")).toBe(POSTER);
    expect(within(row("Høstfest")).getByText("Mat, sang og lek for hele familien.")).toBeTruthy();
    expect(row("Bønnemøte").querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: "Legg til i Google Kalender" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kopier abonnementslenke" })).toBeTruthy();
  });

  test("en nyhet som hører til et arrangement, sier når og hvor, og lenker dit", () => {
    planner.gatherings = [festival, event("styre", "Styremøte", { visibility: "intern" })];
    cms.news = [
      { id: "n1", slug: "n1", title: "Velkommen til høstfest", content: "Tekst.", category: "aktuelt", author: "Menigheten", publishedAt: "2026-10-01T10:00:00.000Z", isPublished: true, gatheringRefId: "host" },
      { id: "n2", slug: "n2", title: "Fra styret", content: "Tekst.", category: "aktuelt", author: "Menigheten", publishedAt: "2026-10-01T10:00:00.000Z", isPublished: true, gatheringRefId: "styre" },
    ];
    const showArticle = (id: string) =>
      render(
        <MemoryRouter initialEntries={[`/artikkel/${id}`]}>
          <Routes>
            <Route path="/artikkel/:id" element={<PublicArticlePage />} />
          </Routes>
        </MemoryRouter>
      );

    showArticle("n1");
    const box = screen.getByRole("link", { name: /Se arrangementet/ });
    expect(box.getAttribute("href")).toBe("/arrangement/host");
    expect(box.textContent).toContain("Høstfest");
    expect(box.textContent).toContain("Storsalen");
    cleanup();

    // An internal event is not told about on the website
    showArticle("n2");
    expect(screen.queryByRole("link", { name: /Se arrangementet/ })).toBeNull();
  });
});

describe("Arrangementet utenfor nettsiden", () => {
  const site: SiteContent = { pages: [], news: [], media: [], settings: { churchName: "Menigheten", appName: "Menighetsplan", tagline: "", welcomeSubtext: "" }, gatherings: [festival, event("styre", "Styremøte", { visibility: "intern" })] };

  test("tittelen og delingskortet har navnet, ingressen og bildet", () => {
    expect(seoForPath("/arrangement/host", site)).toMatchObject({ title: "Høstfest", summary: "Mat, sang og lek for hele familien.", ogImage: POSTER });
    expect(seoForPath("/arrangement/host", site)?.notFound).toBeFalsy();
  });

  test("uten ingress brukes temaet, og et arrangement uten side er ikke funnet", () => {
    const plain = { ...site, gatherings: [event("enkel", "Bønnemøte", { theme: "Bønn for byen" })] };
    expect(seoForPath("/arrangement/enkel", plain)?.summary).toBe("Bønn for byen");
    expect(seoForPath("/arrangement/styre", site)).toMatchObject({ notFound: true, title: "Arrangementet ble ikke funnet" });
    expect(seoForPath("/arrangement/host", { ...site, gatherings: undefined })).toMatchObject({ notFound: true });
  });

  test("kalenderabonnementet har ingressen, og adressen til siden når nettstedet er kjent", () => {
    const feed = toIcalendar([festival], { siteUrl: "https://menigheten.example/" });
    expect(feed).toContain("DESCRIPTION:Mat\\, sang og lek for hele familien.\\n\\nTakk — Sal 100");
    expect(feed).toContain("URL:https://menigheten.example/arrangement/host");
    expect(toIcalendar([festival])).not.toContain("URL:");
  });

  test("kalenderfilen for ett arrangement har arrangementet også når det ligger utenfor abonnementet", () => {
    const farAhead = event("langt", "Jubileum", { startsAt: fromNow(3 * 365 * 24) });
    expect(toIcalendar([farAhead])).not.toContain("SUMMARY:Jubileum");
    const file = toIcalendarEvent(farAhead, { calendarName: "Menigheten" });
    expect(file).toContain("SUMMARY:Jubileum");
    expect(file).toContain("X-WR-CALNAME:Menigheten");
    expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  test("det offentlige API-et gir ingressen som beskrivelse, og ingenting annet nytt", () => {
    const row = (gathering: Gathering) => toContractV1({ gathering, start: new Date(gathering.startsAt), isWorship: false, tags: [] });
    expect(row(festival).beskrivelse).toBe("Mat, sang og lek for hele familien.");
    expect(row(event("enkel", "Bønnemøte")).beskrivelse).toBe("");
    expect(JSON.stringify(row(festival))).not.toContain("pamelding.example");
    expect(JSON.stringify(row(festival))).not.toContain(POSTER);
  });
});
