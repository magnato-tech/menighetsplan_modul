import path from "node:path";
import { describe, expect, test } from "vitest";
import { readDemoSets } from "../scripts/reset-demo";
import { CMS_COLLECTIONS } from "../src/data/collections";
import { FULL_DEMO_COUNTS, getCustomMockDocuments } from "../src/data/mockDocuments";
import type { DatasetDocument } from "../src/utils/dataset";
import { withoutPictures, withoutStaffPictures } from "../src/utils/demoPortraits";
import { siteDocuments } from "../src/utils/demoReset";

// A real congregation's website is shown in the demo without the pictures of its staff: the
// demo presents the product, and nobody's picture is used for that without a yes.

const PORTRAIT = "https://menigheten.example/bilder/kari.jpg";
const BUILDING = "https://menigheten.example/bilder/kirken.jpg";

const card = (url: string, name: string, title = "Pastor") => `:::media-left[${url}]\n<!-- media-alt: ${name} -->\n### ${name}\n${title}\n:::`;

describe("Bilder tatt ut av teksten på en side", () => {
  test("en blokk med bilde og tekst blir stående som teksten alene, uten beskrivelsen av bildet", () => {
    expect(withoutPictures(card(PORTRAIT, "Kari Nordmann"))).toBe("### Kari Nordmann\nPastor");
  });

  test("resten av siden er som den var: overskrifter, tekst og andre blokker", () => {
    const page = `## Våre ansatte\nVelkommen.\n\n${card(PORTRAIT, "Kari Nordmann")}\n\n:::module-calendar[grid]\n:::\n\nTa kontakt.`;
    expect(withoutPictures(page)).toBe("## Våre ansatte\nVelkommen.\n\n### Kari Nordmann\nPastor\n\n:::module-calendar[grid]\n:::\n\nTa kontakt.");
  });

  test("bare bildene det spørres etter, tas ut", () => {
    const page = `${card(PORTRAIT, "Kari Nordmann")}\n\n:::media-right[${BUILDING}]\n### Kirken vår\nBygget i 1962.\n:::`;
    const without = withoutPictures(page, (block) => block.text.includes("Kari Nordmann"));
    expect(without).toBe(`### Kari Nordmann\nPastor\n\n:::media-right[${BUILDING}]\n### Kirken vår\nBygget i 1962.\n:::`);
  });

  test("den som spør, får adressen til bildet og teksten ved siden av", () => {
    const seen: { url: string; text: string }[] = [];
    withoutPictures(card(PORTRAIT, "Kari Nordmann"), (block) => (seen.push(block), false));
    expect(seen).toEqual([{ url: PORTRAIT, text: "<!-- media-alt: Kari Nordmann -->\n### Kari Nordmann\nPastor" }]);
  });

  test("en blokk som ikke er avsluttet, og en tekst uten bilder, går også", () => {
    expect(withoutPictures(`:::media-left[${PORTRAIT}]\n### Kari Nordmann`)).toBe("### Kari Nordmann");
    expect(withoutPictures("## Om oss\nVi er en menighet.")).toBe("## Om oss\nVi er en menighet.");
    expect(withoutPictures("")).toBe("");
  });
});

describe("En nettside uten bilder av de ansatte", () => {
  const collections: Record<string, DatasetDocument[]> = {
    cms_staff: [
      { id: "s1", name: "Kari Nordmann", role: "Pastor", imageUrl: `${PORTRAIT}?w=640` },
      { id: "s2", name: "Ola Hansen", role: "Daglig leder", imageUrl: "https://menigheten.example/bilder/ola.jpg" },
      { id: "s3", name: "Ingrid Berg", role: "Ungdomsleder" },
    ],
    cms_pages: [
      // The congregation's own page about its staff
      { id: "p-ansatte", title: "Ansatte", heroImage: BUILDING, heroImages: [BUILDING], content: `${card(PORTRAIT, "Kari Nordmann")}\n\n${card("https://menigheten.example/bilder/vaktmester.jpg", "Per Vaktmester", "Vaktmester")}\n\nOla Hansen treffes på kontoret.` },
      // A page about something else, where one of the staff is pictured
      { id: "p-ungdom", title: "Ungdom", heroImage: BUILDING, content: `:::media-right[${BUILDING}]\n### Fredagsklubben\nHver fredag.\n:::\n\n${card("https://menigheten.example/bilder/ingrid.jpg", "Ingrid Berg", "Ungdomsleder")}` },
      // The same picture as in the register, used with no name beside it
      { id: "p-om", title: "Om oss", content: `:::media-left[${PORTRAIT}]\n### Velkommen\nVi gleder oss til å møte deg.\n:::` },
    ],
    cms_news: [
      { id: "n1", title: "Ny pastor", imageUrl: PORTRAIT, content: "Vi ønsker velkommen." },
      { id: "n2", title: "Dugnad", imageUrl: BUILDING, content: "Ta med rake." },
    ],
    cms_settings: [{ id: "global", churchName: "Menigheten", heroImageUrl: BUILDING }],
  };
  const without = withoutStaffPictures(collections);
  const page = (id: string) => without.cms_pages.find((p) => p.id === id)!;

  test("ingen i staben har bilde, og navn og tittel står", () => {
    expect(without.cms_staff).toEqual([
      { id: "s1", name: "Kari Nordmann", role: "Pastor" },
      { id: "s2", name: "Ola Hansen", role: "Daglig leder" },
      { id: "s3", name: "Ingrid Berg", role: "Ungdomsleder" },
    ]);
  });

  test("siden om de ansatte har ingen bilder, heller ikke av dem som ikke står i registeret", () => {
    expect(page("p-ansatte").content).toBe("### Kari Nordmann\nPastor\n\n### Per Vaktmester\nVaktmester\n\nOla Hansen treffes på kontoret.");
    expect(page("p-ansatte")).not.toHaveProperty("heroImage");
    expect(page("p-ansatte")).not.toHaveProperty("heroImages");
  });

  test("på en annen side tas bare bildet ved siden av en ansatt ut", () => {
    expect(page("p-ungdom").content).toBe(`:::media-right[${BUILDING}]\n### Fredagsklubben\nHver fredag.\n:::\n\n### Ingrid Berg\nUngdomsleder`);
    expect(page("p-ungdom").heroImage).toBe(BUILDING);
  });

  test("et bilde fra registeret tas ut der det ellers er brukt, også når det er bedt om i en annen størrelse", () => {
    expect(page("p-om").content).toBe("### Velkommen\nVi gleder oss til å møte deg.");
    expect(without.cms_news.find((n) => n.id === "n1")).not.toHaveProperty("imageUrl");
  });

  test("bilder som ikke er av de ansatte, står", () => {
    expect(without.cms_news.find((n) => n.id === "n2")!.imageUrl).toBe(BUILDING);
    expect(without.cms_settings).toEqual(collections.cms_settings);
  });

  test("settet som ble gitt inn, er ikke endret", () => {
    expect(collections.cms_staff[0].imageUrl).toBe(`${PORTRAIT}?w=640`);
    expect(String(collections.cms_pages[0].content)).toContain(":::media-left");
  });
});

describe("Settene som følger med appen, slik de vises i demoen", () => {
  const sets = readDemoSets(path.resolve(__dirname, "..", "public", "demosett"));
  const example = getCustomMockDocuments(FULL_DEMO_COUNTS, Date.parse("2026-10-09T10:00:00Z"));

  test.each(sets.map((set) => [set.name, set] as const))("%s: ingen bilder av de ansatte er med", (_name, { set }) => {
    const staff = set.collections[CMS_COLLECTIONS.STAFF] ?? [];
    const portraits = staff.map((member) => String(member.imageUrl ?? "").split("?")[0]).filter(Boolean);
    const names = staff.map((member) => String(member.name)).filter((name) => name.length >= 5);
    expect(names.length).toBeGreaterThan(0);

    const site = siteDocuments(example, set, Date.parse("2026-10-09T10:00:00Z"));
    const shown = (collection: string) => site.filter((d) => d.collection === collection).map((d) => d.data as Record<string, unknown>);

    // Nobody in the register has a picture, and everybody is still there by name
    expect(shown(CMS_COLLECTIONS.STAFF).filter((member) => "imageUrl" in member)).toEqual([]);
    expect(shown(CMS_COLLECTIONS.STAFF).map((member) => member.name).sort()).toEqual(staff.map((member) => member.name).sort());

    // No picture from the register is used anywhere in what is shown
    const everything = JSON.stringify(site.map((d) => d.data));
    expect(portraits.filter((url) => everything.includes(url))).toEqual([]);

    // No picture stands beside the name of one of the staff
    const beside: string[] = [];
    for (const page of shown(CMS_COLLECTIONS.PAGES)) {
      withoutPictures(String(page.content ?? ""), (block) => {
        if (names.some((name) => block.text.includes(name))) beside.push(String(page.title));
        return false;
      });
    }
    expect(beside).toEqual([]);

    // The congregation's own page about its staff has no pictures at all
    const aboutPeople = shown(CMS_COLLECTIONS.PAGES).filter((page) => names.filter((name) => String(page.content ?? "").includes(name)).length >= 2);
    expect(aboutPeople.length).toBeGreaterThan(0);
    for (const page of aboutPeople) expect(String(page.content)).not.toMatch(/:::media-(left|right)/);
  });

  test("bilder som ikke er av de ansatte, vises fortsatt", () => {
    const pictures = sets.map(({ set }) => {
      const site = siteDocuments(example, set, Date.parse("2026-10-09T10:00:00Z"));
      return (JSON.stringify(site.map((d) => d.data)).match(/:::media-(left|right)\[/g) ?? []).length;
    });
    expect(pictures.every((count) => count > 0)).toBe(true);
  });
});
