import { describe, expect, test } from "vitest";
import type { CmsPage } from "../src/data/cmsData";
import { buildPageRecord } from "../src/utils/pageRecord";

// Every field of a page, set to something other than its default. `Required` makes the type check
// fail when a field is added to CmsPage and not here, so a new field cannot be forgotten on Lagre.
const full: Required<CmsPage> = {
  id: "page-forside",
  slug: "forside",
  title: "Forside",
  summary: "Ingressen",
  content: "Tekst",
  blocks: [],
  showHero: true,
  isPublished: true,
  status: "published",
  parentPageId: "page-om-oss",
  parentId: "page-om-oss",
  menuOrder: 3,
  navOrder: 3,
  inNavMenu: false,
  linkUrl: "/",
  updatedAt: "2026-10-01T10:00:00.000Z",
  updatedBy: "p1",
  heroImage: "https://example.org/ett.jpg",
  heroImageAlt: "Kirken",
  heroImages: ["https://example.org/to.jpg"],
  heroZoom: false,
  heroMenuOverlay: false,
  heroHeight: "low",
  heroTitleStyle: "calm",
  showHeroSubtext: false,
  heroTitle: "Velkommen",
  heroCtaText: "Se hva som skjer",
  heroCtaLink: "/hva-skjer",
  heroCtaSecondaryText: "Bli kjent",
  heroCtaSecondaryLink: "/om-oss",
  showHeroPrimaryCta: false,
  showHeroSecondaryCta: false,
  metaDescription: "Beskrivelse",
  ogImage: "https://example.org/del.jpg",
  publishAt: "2026-09-01T10:00:00.000Z",
  publishedAt: "2026-09-01T10:00:00.000Z",
};

// Fields the saving sets itself, and why
const SET_ON_SAVE: (keyof CmsPage)[] = [
  "updatedAt", // the time of saving
  "status", // follows from isPublished and publishAt
  "showHero", // always on
  "blocks", // the blocks are stored as the page text (content)
  "updatedBy", // not kept
];

describe("Når en side lagres", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");
  const record = buildPageRecord(full, now, () => "ny");

  test("blir hvert felt i redigeringen med", () => {
    const lost = (Object.keys(full) as (keyof CmsPage)[])
      .filter((key) => !SET_ON_SAVE.includes(key))
      .filter((key) => JSON.stringify(record[key]) !== JSON.stringify(full[key]));
    expect(lost).toEqual([]);
  });

  test("valgene for toppbildet og undertittelen blir stående etter lagring", () => {
    expect(record.showHeroSubtext).toBe(false);
    expect(record.heroHeight).toBe("low");
    expect(record.heroTitleStyle).toBe("calm");
  });

  test("en side uten valgene lagres slik den alltid har sett ut", () => {
    const plain = buildPageRecord({ title: "Om oss", slug: "om-oss" }, now, () => "ny");
    expect(plain.showHeroSubtext).toBe(true);
    expect(plain.heroHeight).toBe("medium");
    expect(plain.heroTitleStyle).toBe("bold");
    expect(plain.id).toBe("ny");
    expect(plain.status).toBe("published");
  });
});
