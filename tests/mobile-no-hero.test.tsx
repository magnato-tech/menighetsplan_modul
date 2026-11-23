// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";
import type { Gathering } from "../src/types";
import { CMS_PREVIEW_TARGET_HERO } from "../src/utils/cmsBlocks";

// On a phone (below sm, 640px) the big picture at the top of the front page is replaced by a thin band with the
// headline, and the worship card shows date, time and place on one line. jsdom has no layout, so these tests check
// the classes that Tailwind's responsive prefixes switch on.

const { planner, home, omOss } = vi.hoisted(() => {
  const home = {
    id: "page-forside",
    slug: "",
    title: "Forside",
    summary: "Åpent hjerte for Gud og medmennesker",
    content: "",
    isPublished: true,
    inNavMenu: true,
    linkUrl: "/",
    parentId: null,
    navOrder: 1,
    updatedAt: "2026-10-06T12:00:00.000Z",
    heroImage: "https://example.org/ett.jpg",
  } as CmsPage;
  const omOss: CmsPage = { id: "page-om-oss", slug: "om-oss", title: "Om oss", summary: "", content: "Tekst", isPublished: true, inNavMenu: true, parentId: null, navOrder: 2, updatedAt: "2026-10-06T12:00:00.000Z" };
  return { planner: { gatherings: [] as unknown[] }, home, omOss };
});

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: { ...demoCmsSettings, churchName: "Søgne Misjonskirke" },
    pages: [home, omOss],
    media: [],
    news: [],
    sermons: [],
    staff: [],
    savePage: vi.fn(),
    getPageBySlug: (slug: string) => (slug === "" || slug === "forside" ? home : slug === "om-oss" ? omOss : undefined),
    surfaces: { minSide: true, ownWebsite: true, externalSiteUrl: "", externalCalendarUrl: "", dismissedUids: [] as string[], keptUids: [] as string[] },
    surfacesState: "ready" as const,
  }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    currentUser: { id: "p1", name: "Kari Nordmann", globalRole: "member" },
    session: { status: "member", person: { id: "p1", name: "Kari Nordmann", globalRole: "member" } },
    setCurrentUserId: vi.fn(),
    getUserGroups: () => [],
    getTasksForPerson: () => [],
    allPersons: [],
    groups: [],
    gatheringsReady: true,
    gatherings: planner.gatherings,
  }),
}));
vi.mock("../src/components/UserSwitcher", () => ({ UserSwitcher: () => null }));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn().mockResolvedValue([]) }));
vi.mock("../src/demo", () => ({ DEMO: null }));

import { PublicHomePage } from "../src/pages/public/PublicHomePage";
import { WorshipModule } from "../src/components/cms/modules/WorshipModule";

const POSTER = "https://menigheten.example/bilder/hostfest.jpg";
const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const gudstjeneste = (fields: Partial<Gathering> = {}): Gathering => ({
  id: "g",
  groupId: "g",
  title: "Gudstjeneste & dåp",
  startsAt: inAWeek,
  type: "arrangement",
  visibility: "offentlig",
  isGudstjeneste: true,
  location: "Hovedsalen og kafeen",
  ...fields,
});

afterEach(() => {
  cleanup();
  planner.gatherings = [];
});

describe("Telefon: ingen stort toppbilde på forsiden", () => {
  const band = (container: HTMLElement) => container.querySelector(`div[data-cms-preview-target="${CMS_PREVIEW_TARGET_HERO}"]`) as HTMLElement;
  const stort = (container: HTMLElement) => container.querySelector(`section[data-cms-preview-target="${CMS_PREVIEW_TARGET_HERO}"]`) as HTMLElement;

  test("under menyen ligger en tynn hvit linje med tittelen, som bare vises på telefon", () => {
    const { container } = render(
      <MemoryRouter>
        <PublicHomePage pageOverride={{ ...home, heroTitle: "Velkommen til Søgne" }} />
      </MemoryRouter>
    );
    const linje = band(container);
    expect(linje).toBeTruthy();
    expect(linje.className).toContain("sm:hidden");
    expect(linje.className).toContain("bg-white");
    expect(linje.className).toContain("px-4 py-3");
    expect(linje.className).toContain("border-b border-stone-200");
    const tittel = linje.querySelector("h1")!;
    expect(tittel.textContent).toBe("Velkommen til Søgne");
    expect(tittel.className).toContain("text-xl font-black text-stone-900");
  });

  test("det store toppbildet med mørk bakgrunn er skjult på telefon og vises fra sm og opp", () => {
    const { container } = render(
      <MemoryRouter>
        <PublicHomePage pageOverride={{ ...home, heroTitle: "Velkommen til Søgne" }} />
      </MemoryRouter>
    );
    const bilde = stort(container);
    expect(bilde.className.split(" ")).toContain("hidden");
    expect(bilde.className).toContain("sm:flex");
    expect(bilde.className).toContain("bg-gradient-to-b");
  });

  test("uten bilde er det store feltet skjult på telefon og vises som blokk fra sm og opp", () => {
    const { container } = render(
      <MemoryRouter>
        <PublicHomePage pageOverride={{ ...home, heroImage: "", heroTitle: "Velkommen" }} />
      </MemoryRouter>
    );
    expect(stort(container).className.split(" ")).toContain("hidden");
    expect(stort(container).className).toContain("sm:block");
    expect(band(container).querySelector("h1")!.textContent).toBe("Velkommen");
  });

  test("knappene under tittelen i linjen er små", () => {
    const { container } = render(
      <MemoryRouter>
        <PublicHomePage pageOverride={{ ...home, heroTitle: "Velkommen", heroCtaText: "Se programmet", heroCtaLink: "/om-oss", showHeroPrimaryCta: true }} />
      </MemoryRouter>
    );
    const knapp = [...band(container).querySelectorAll("a")].find((a) => a.textContent?.includes("Se programmet"));
    expect(knapp).toBeTruthy();
    expect(knapp!.className).toContain("text-xs");
    expect(knapp!.getAttribute("href")).toBe("/om-oss");
  });
});

describe("Telefon: gudstjenesten under bildet", () => {
  test("dato, klokke og sted står på én linje under tittelen, bare på telefon", () => {
    planner.gatherings = [gudstjeneste({ imageUrl: POSTER })];
    const { container } = render(
      <MemoryRouter>
        <WorshipModule />
      </MemoryRouter>
    );
    const linje = [...container.querySelectorAll("p")].find((p) => p.className.includes("sm:hidden"));
    expect(linje).toBeTruthy();
    expect(linje!.textContent).toMatch(/^.+ · kl\. \d{2}:\d{2} · Hovedsalen og kafeen$/);
  });

  test("den grå boksen med kalender, klokke og sted er skjult på telefon og vises fra sm og opp", () => {
    planner.gatherings = [gudstjeneste({ imageUrl: POSTER })];
    const { container } = render(
      <MemoryRouter>
        <WorshipModule />
      </MemoryRouter>
    );
    const boks = [...container.querySelectorAll("div")].find((d) => d.className.includes("bg-stone-50"))!;
    expect(boks.className.split(" ")).toContain("hidden");
    expect(boks.className).toContain("sm:flex");
    expect(boks.textContent).toContain("Hovedsalen og kafeen");
  });

  test("bildet er lavt og bredt på telefon, og høyden slipper fra sm og opp", () => {
    planner.gatherings = [gudstjeneste({ imageUrl: POSTER })];
    const { container } = render(
      <MemoryRouter>
        <WorshipModule />
      </MemoryRouter>
    );
    const bilde = container.querySelector("img")!;
    expect(bilde.className).toContain("h-28");
    expect(bilde.className).toContain("sm:h-auto");
  });
});
