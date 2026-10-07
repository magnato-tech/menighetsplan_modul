// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NewsModule } from "../src/components/cms/modules/NewsModule";
import { PublicArticlePage } from "../src/pages/public/PublicArticlePage";
import { parseCmsContent } from "../src/components/cms/CmsContentRenderer";
import { demoCmsSettings, type CmsNewsArticle } from "../src/data/cmsData";

const { news } = vi.hoisted(() => ({
  news: [
    {
      id: "news-alpha",
      title: "Alpha Youth",
      slug: "alpha-youth",
      summary: "Vi starter opp 16. oktober.",
      content: "Meld deg på [her](https://example.org/skjema). Velkommen!\n\n[Knapp: Les mer](/alphakurs)",
      category: "ungdom",
      author: "Lillesand Misjonskirke",
      publishedAt: "2026-10-06T12:00:00.000Z",
      isPublished: true,
      imageUrl: "https://example.org/alpha.png",
    },
    {
      id: "news-uten-bilde",
      title: "Høsten 2026",
      slug: "hosten-2026",
      summary: "Få med deg det som skjer.",
      content: "Første avsnitt.\n\nAndre avsnitt.",
      category: "aktuelt",
      author: "Lillesand Misjonskirke",
      publishedAt: "2026-10-05T12:00:00.000Z",
      isPublished: true,
    },
  ] as CmsNewsArticle[],
}));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: { ...demoCmsSettings, churchName: "Lillesand Misjonskirke" },
    // A button is only drawn when it leads to a page that exists
    pages: [
      { id: "page-alphakurs", slug: "alphakurs", title: "Alpha Youth", summary: "", content: "", isPublished: true, inNavMenu: true, updatedAt: "2026-10-06T12:00:00.000Z" },
    ],
    media: [],
    news,
    sermons: [],
    staff: [],
    getNewsById: (id: string) => news.find((n) => n.id === id),
    getNewsBySlug: (slug: string) => news.find((n) => n.slug === slug),
  }),
}));

vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], gatherings: [], groups: [] }),
}));

afterEach(cleanup);

const showArticle = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/artikkel/${id}`]}>
      <Routes>
        <Route path="/artikkel/:id" element={<PublicArticlePage />} />
      </Routes>
    </MemoryRouter>
  );

describe("Nyheter på nettsiden", () => {
  test("nyhetskortene viser bildet til nyheten, og en nyhet uten bilde vises uten", () => {
    const { container } = render(
      <MemoryRouter>
        <NewsModule />
      </MemoryRouter>
    );

    const images = [...container.querySelectorAll("img")];
    expect(images.map((img) => img.getAttribute("src"))).toEqual(["https://example.org/alpha.png"]);
    expect(images[0].closest("a")?.getAttribute("href")).toBe("/artikkel/news-alpha");
    expect(screen.getByText("Høsten 2026")).toBeTruthy();
  });

  test("artikkelsiden viser bildet", () => {
    const { container } = showArticle("news-alpha");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://example.org/alpha.png");
  });

  test("artikkelteksten tegnes som på en side: lenker og knapper virker, og ingen kode står igjen", () => {
    const { container } = showArticle("news-alpha");
    const body = container.querySelector("article")!;

    expect(body.textContent).not.toMatch(/\]\(|\[Knapp|\*\*/);
    expect(body.querySelector('a[href="https://example.org/skjema"]')?.textContent).toContain("her");
    expect(body.querySelector('a[href="/alphakurs"]')?.textContent).toContain("Les mer");
  });

  test("en artikkel i ren tekst beholder avsnittene sine", () => {
    const { container } = showArticle("news-uten-bilde");
    const body = container.querySelector("article")!;

    expect(container.querySelector("img")).toBeNull();
    expect([...body.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["Første avsnitt.", "Andre avsnitt."]);
  });
});

describe("Bilde med tekst", () => {
  const media = (content: string) => {
    const block = parseCmsContent(content)[0];
    if (block.type !== "media") throw new Error(`ventet bilde med tekst, fikk ${block.type}`);
    return block;
  };

  test("tittelen leses også når bildet har en bildetekst, slik redigereren lagrer blokken", () => {
    const block = media(":::media-right[https://example.org/kopp.jpg]\n<!-- media-alt: Verdier -->\n### ROTFESTET\nVi er en del av kirken.\n:::");

    expect(block.title).toBe("ROTFESTET");
    expect(block.imageAlt).toBe("Verdier");
    expect(block.body).toBe("Vi er en del av kirken.");
  });

  test("tittelen leses som før når bildet ikke har bildetekst", () => {
    const block = media(":::media-left[https://example.org/kopp.jpg]\n### RAUS\nGud er raus.\n:::");

    expect(block.title).toBe("RAUS");
    expect(block.imageAlt).toBeUndefined();
    expect(block.body).toBe("Gud er raus.");
  });

  test("en blokk med bare bildetekst og brødtekst har ingen tittel", () => {
    const block = media(":::media-left[https://example.org/kopp.jpg]\n<!-- media-alt: Kaffekopp -->\nBare tekst.\n:::");

    expect(block.title).toBeUndefined();
    expect(block.body).toBe("Bare tekst.");
  });
});
