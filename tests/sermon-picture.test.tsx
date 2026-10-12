// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings, type CmsMedia, type CmsSermon } from "../src/data/cmsData";

// A sermon can have a picture. It is shown with the sermon in the archive, and with the newest
// sermon on the front page. A sermon without one is shown as before.

const { cms } = vi.hoisted(() => ({
  cms: {
    sermons: [] as unknown[],
    media: [] as unknown[],
  },
}));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: { ...demoCmsSettings, churchName: "Menigheten" }, pages: [], news: [], staff: [], ...cms }),
}));

import { SermonModule } from "../src/components/cms/modules/SermonModule";
import { PublicSermonsPage } from "../src/pages/public/PublicSermonsPage";

const POSTER = "https://menigheten.example/bilder/fred.jpg?w=640";

const fromLibrary: CmsMedia = {
  id: "media-1",
  title: "Plakat",
  altText: "",
  tags: [],
  status: "ready",
  approvedForAi: false,
  source: "upload",
  sourcePath: "media/media-1/source.jpg",
  variants: { web: "https://lager.example/web.jpg", thumb: "https://lager.example/thumb.jpg", og: "https://lager.example/og.jpg" },
  width: 1600,
  height: 900,
  byteSize: 1000,
  updatedAt: "2026-10-12T10:00:00.000Z",
};

const sermon = (id: string, title: string, date: string, imageUrl?: string): CmsSermon => ({
  id,
  title,
  speaker: "Kari Nordmann",
  date,
  ...(imageUrl === undefined ? {} : { imageUrl }),
});

const pictureOf = (title: string): HTMLImageElement | null => {
  const card = screen.getByRole("heading", { name: title }).closest("div.bg-white") as HTMLElement;
  return within(card).queryByRole("presentation") as HTMLImageElement | null;
};

afterEach(() => {
  cleanup();
  cms.sermons = [];
  cms.media = [];
});

describe("Bildet til en tale i talearkivet", () => {
  const show = () =>
    render(
      <MemoryRouter>
        <PublicSermonsPage />
      </MemoryRouter>
    );

  test("en tale med bilde vises med bildet, og en tale uten vises uten", () => {
    cms.sermons = [sermon("t1", "Fred", "2026-09-27T12:00:00.000Z", POSTER), sermon("t2", "Glede", "2026-09-14T12:00:00.000Z")];
    show();

    expect(pictureOf("Fred")?.getAttribute("src")).toBe(POSTER);
    expect(pictureOf("Glede")).toBeNull();
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  test("et bilde fra mediebiblioteket vises i utgaven for nettsiden", () => {
    cms.sermons = [sermon("t1", "Fred", "2026-09-27T12:00:00.000Z", "media:media-1")];
    cms.media = [fromLibrary];
    show();

    expect(pictureOf("Fred")?.getAttribute("src")).toBe("https://lager.example/web.jpg");
  });

  test("et tomt felt, og et bilde som er slettet fra biblioteket, tegner ingen tom ramme", () => {
    cms.sermons = [sermon("t1", "Fred", "2026-09-27T12:00:00.000Z", ""), sermon("t2", "Glede", "2026-09-14T12:00:00.000Z", "media:borte")];
    show();

    expect(document.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("Bildet til den nyeste talen på forsiden", () => {
  const show = () =>
    render(
      <MemoryRouter>
        <SermonModule />
      </MemoryRouter>
    );

  test("vises når talen har et bilde", () => {
    cms.sermons = [sermon("t1", "Fred", "2026-09-27T12:00:00.000Z", POSTER), sermon("t2", "Glede", "2026-09-14T12:00:00.000Z")];
    show();

    expect(screen.getByRole("heading", { name: "Fred" })).toBeTruthy();
    expect(document.querySelector("img")?.getAttribute("src")).toBe(POSTER);
  });

  test("vises ikke når talen ikke har et bilde", () => {
    cms.sermons = [sermon("t2", "Glede", "2026-09-14T12:00:00.000Z"), sermon("t1", "Fred", "2026-09-01T12:00:00.000Z", POSTER)];
    show();

    expect(screen.getByRole("heading", { name: "Glede" })).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });
});
