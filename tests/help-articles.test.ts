import { describe, expect, test } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  defaultHelpArticleId,
  findHelpArticle,
  helpArticleIdForTab,
  helpArticles,
  helpButtonNames,
  searchHelp,
} from "../src/pages/admin/help/articles";
import { helpArticleImageSrc } from "../src/pages/admin/help/HelpArticleView";
import { STUDIO_TABS, studioTabUrl } from "../src/pages/admin/studio";

// Hjelp in the admin: one article per task, a picture from the demo for each, every tab in the menu
// covered, and every button the help names found in the app.

const articles = helpArticles();

/** All the app's own source text, except the help itself, to look the names of buttons up in. */
function appSource(dir: string): string {
  return readdirSync(dir)
    .map((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return appSource(full);
      if (!/\.tsx?$/.test(name) || full.includes(path.join("admin", "help"))) return "";
      return readFileSync(full, "utf8");
    })
    .join("\n");
}

describe("Artiklene", () => {
  test("hver har et eget anker, og et ukjent anker åpner Kom i gang", () => {
    const ids = articles.map((article) => article.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(findHelpArticle(defaultHelpArticleId).id).toBe(defaultHelpArticleId);
    expect(findHelpArticle("finnes-ikke").id).toBe(defaultHelpArticleId);
  });

  test("hver har vei dit, en innledning og høyst seks korte steg (Nytt i høst har tolv: seks gamle og seks nye)", () => {
    for (const article of articles) {
      expect(article.hvor, article.id).toBeTruthy();
      expect(article.intro, article.id).toBeTruthy();
      expect(article.steg.length, article.id).toBeGreaterThan(0);
      expect(article.steg.length, article.id).toBeLessThanOrEqual(article.id === "nytt" ? 12 : 6);
    }
  });

  test("Nytt i høst har tittelen, og de seks nye punktene om planleggingen", () => {
    const nytt = findHelpArticle("nytt");
    expect(nytt.title).toBe("Nytt i høst");
    expect(nytt.steg.length).toBe(12);
    expect(nytt.steg.some((step) => step.includes("**Semesterplan**"))).toBe(true);
    expect(nytt.steg.some((step) => step.includes("**Flater i løsningen**"))).toBe(true);
  });

  test("Flater i løsningen har skjermbilde, og åpnes fra Database og Testdata", () => {
    const flater = findHelpArticle("flater");
    expect(flater.id).toBe("flater");
    expect(flater.title).toBe("Flater i løsningen");
    // The picture is taken outside the demo, which does not show the Database page; until then, none
    expect(flater.utenBilde).toBe(true);
    expect(helpArticleImageSrc(flater.id)).toBe("/help/hjelp-flater.png");
    expect(flater.hvor).toContain("Flater i løsningen");
    expect(helpArticleIdForTab("database-admin", "planlegging")).toBe("flater");
    expect(findHelpArticle("kirkens-kalender").seOgsa).toContain("flater");
  });

  test("hver med bilde har et skjermbilde", () => {
    for (const article of articles.filter((candidate) => !candidate.utenBilde)) {
      const imagePath = path.join(process.cwd(), "public", helpArticleImageSrc(article.id).slice(1));
      expect(existsSync(imagePath), article.id).toBe(true);
    }
  });

  test("lenkene under «Se også» går til artikler som finnes", () => {
    const ids = new Set(articles.map((article) => article.id));
    for (const article of articles) {
      for (const id of article.seOgsa ?? []) expect(ids.has(id), `${article.id} → ${id}`).toBe(true);
    }
  });

  test("knappene hjelpen nevner, finnes i appen", () => {
    const source = appSource(path.join(process.cwd(), "src"));
    for (const article of articles) {
      for (const name of helpButtonNames(article)) expect(source.includes(name), `${article.id}: «${name}»`).toBe(true);
    }
  });
});

describe("Hjelp for fanen man kom fra", () => {
  test("hver fane i menyen har sin artikkel", () => {
    const own = STUDIO_TABS.filter((tab) => !["dashboard", "cms-hjelp", "database-admin", "demo-oppsett"].includes(tab));
    for (const tab of own) expect(articles.find((article) => article.tabs?.includes(tab)), tab).toBeTruthy();
  });

  test("fra Aktuelt & Nyheter åpnes nyhetsartikkelen, fra Oversikt den for delen man er i", () => {
    expect(helpArticleIdForTab("cms-nyheter", "nettside")).toBe("nyheter");
    expect(helpArticleIdForTab("dashboard", "planlegging")).toBe("oversikt");
    expect(helpArticleIdForTab("dashboard", "nettside")).toBe("kom-i-gang");
    expect(studioTabUrl("cms-hjelp")).toBe("/admin?tab=cms-hjelp");
  });
});

describe("Søket", () => {
  test("finner artiklene med ordene, de med ordet i tittelen først", () => {
    expect(searchHelp("historikk").map((article) => article.id)).toContain("sider-lagre");
    expect(searchHelp("siste dag").map((article) => article.id)).toContain("nyheter");
    expect(searchHelp("Kalender")[0].title).toBe("Kalender");
    expect(searchHelp("")).toEqual([]);
    expect(searchHelp("finnesikkeiappen")).toEqual([]);
  });
});
