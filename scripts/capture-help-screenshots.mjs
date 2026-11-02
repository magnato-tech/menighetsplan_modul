/**
 * Captures the pictures of the admin's help articles into public/help/hjelp-<id>.png.
 *
 * Run against the demo (default http://localhost:5199), optionally only some articles:
 *   node scripts/capture-help-screenshots.mjs
 *   node scripts/capture-help-screenshots.mjs sider-hero bemanning
 * HELP_BASE overrides the address. HELP_CHROME may point at a Chrome/Chromium executable.
 *
 * The script only looks: it opens tabs, dialogs and editors, and clicks view toggles and
 * "Rediger innhold". It never presses a button that saves, creates, sends or deletes. A picture is
 * written only when it was captured, so a failed one keeps the old file.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.HELP_BASE ?? "http://localhost:5199";
const VIEW_W = 1280;
const VIEW_H = 900;
const TOP = 40; // below the demo bar
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "help");
const ARTICLES = path.join(ROOT, "src", "pages", "admin", "help", "articles.ts");

// Articles kept as they are. They are retaken only when named on the command line.
const KEEP = new Set();
// The text the admin shows for tabs the demo does not have (DemoGate.tsx).
const GATE_TEXT = "Ikke med i demoen";

// Each job: the article id, the address, a text that shows the page has its data, and what to capture.
// `before` only opens views (an editor, a dialog, a toggle). `target` cuts a section of the page editor.
const JOBS = [
  { id: "kom-i-gang", route: "/admin?tab=dashboard", ready: "Kommende arrangementer",
    shot: (page) => regionShot(page, { x: 0, y: TOP, width: 936, height: VIEW_H - TOP }) },
  { id: "oversikt", route: "/admin?tab=dashboard", ready: "Kommende arrangementer",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "sider-sidetre", route: "/admin?tab=cms-sider", ready: "Sider & Innhold på nettsiden",
    before: async (page) => {
      await page.locator("button", { hasText: /^Sidestruktur$/ }).first().click();
      await page.getByText("Kollaps alle").first().waitFor({ state: "visible", timeout: 20000 });
    },
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "sider-redigere", route: "/admin?tab=cms-sider", ready: "Rediger side:",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "sider-innhold", route: "/admin?tab=cms-sider", ready: "Rediger side:",
    before: async (page) => {
      await openBlock(page, "block-text-1");
    },
    target: '[data-cms-editor-target="block-text-1"]' },
  { id: "sider-lagre", route: "/admin?tab=cms-sider", ready: "Rediger side:",
    shot: async (page) => {
      const editor = await boxOf(page, "[data-page-editor]");
      const bar = await boxOf(page, 'button:has-text("Historikk")');
      return regionShot(page, { x: editor.x, y: editor.y, width: editor.width, height: bar.y + bar.height + 16 - editor.y });
    } },
  { id: "sider-hero", route: "/admin?tab=cms-sider", ready: "Rediger side:",
    target: '[data-page-section="hero"]' },
  { id: "sider-moduler", route: "/admin?tab=cms-sider", ready: "Rediger side:",
    before: async (page) => {
      await page.locator("button", { hasText: "Legg til blokk eller modul" }).first().click();
      await page.getByText("Felles blokkbibliotek").first().waitFor({ state: "visible", timeout: 20000 });
      await page.waitForTimeout(500);
    },
    shot: async (page) => regionShot(page, await dialogCardBox(page, "Felles blokkbibliotek")) },
  { id: "sider-hvaskjer", route: "/admin?tab=cms-sider", ready: "Rediger side:",
    before: async (page) => {
      await openBlock(page, "block-module-calendar-2");
    },
    target: '[data-cms-editor-target="block-module-calendar-2"]' },
  { id: "sider-publisering", route: "/admin?tab=cms-sider", ready: "Rediger side:",
    target: '[data-page-section="publish"]' },
  { id: "sider-sok", route: "/admin?tab=cms-sider", ready: "Rediger side:",
    before: async (page) => {
      await page.locator('[data-page-section="seo"] button').first().click();
      await page.waitForTimeout(700);
    },
    target: '[data-page-section="seo"]' },
  { id: "forside", route: "/admin?tab=cms-overstyringer", ready: "Arrangementer på nettsiden",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "nyheter", route: "/admin?tab=cms-nyheter", ready: "Aktuelt & Nyhetsartikler",
    before: async (page) => {
      await page.locator("button", { hasText: "Ny artikkel" }).first().click();
      await page.getByText("Skriv ny artikkel").first().waitFor({ state: "visible", timeout: 20000 });
    },
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "taler", route: "/admin?tab=cms-taler", ready: "Taler & Prekenarkiv",
    before: async (page) => {
      await page.locator("button", { hasText: "Legg til tale" }).first().click();
      await page.getByText("Legg til ny tale").first().waitFor({ state: "visible", timeout: 20000 });
    },
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "lederskap", route: "/admin?tab=cms-stab", ready: "Ansatte i staben",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "mediebibliotek", route: "/admin?tab=cms-medier", ready: "Last opp nytt bilde",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "tema", route: "/admin?tab=cms-design", ready: "Kuraterte Menighetstemaer",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "innstillinger", route: "/admin?tab=cms-innstillinger", ready: "Menighet & Merkevare",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "arrangementer", route: "/admin?tab=planlegger-samlinger", ready: "Måned",
    before: async (page) => {
      await page.locator("button", { hasText: "Måned" }).first().click();
      await page.waitForTimeout(800);
    },
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "bemanning", route: "/admin/samling/gathering-1?vis=bemanning", ready: "Lovsang & musikk",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "oppgaver", route: "/admin?tab=planlegger-oppgaver", ready: "Trenger oppfølging",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "grupper", route: "/admin?tab=planlegger-grupper", ready: "Administrer gruppe",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  // Below the title row: the register's header has a button for test data, which help pictures leave out.
  { id: "personer", route: "/admin?tab=planlegger-personer", ready: "Personregister",
    shot: async (page) => regionShot(page, { ...(await mainArea(page)), y: 132, height: VIEW_H - 132 }) },
  { id: "maler", route: "/admin?tab=planlegger-maler", ready: "Maler for arrangementer",
    shot: async (page) => regionShot(page, { ...(await mainArea(page)), height: 290 }) },
  { id: "semesterplan", route: "/admin?tab=planlegger-semesterplan", ready: "Ny semesterplan",
    shot: async (page) => regionShot(page, { ...(await mainArea(page)), height: 340 }) },
  { id: "roller", route: "/admin?tab=planlegger-roller", ready: "Ny rolle",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "arshjul", route: "/admin?tab=arshjul", ready: "Menighetens årshjul",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "epost", route: "/admin?tab=epost", ready: "Slik ser den ut",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  // Tabs the demo does not show (DemoGate): these report and keep the old file.
  { id: "analysebord", route: "/admin?tab=analyse", ready: "Analysebord",
    shot: async (page) => regionShot(page, await mainArea(page)) },
  { id: "flater", route: "/admin?tab=database-admin", ready: "Flater i løsningen",
    shot: async (page) => regionShot(page, await mainArea(page)) },
];

// The articles and whether they have a picture (utenBilde), read from the source.
async function articleIds() {
  const source = await readFile(ARTICLES, "utf8");
  const blocks = source.split(/\n(?=const \w+: HelpArticle = \{)/).slice(1);
  return blocks
    .map((block) => ({ id: block.match(/id: "([^"]+)"/)?.[1], noPicture: /utenBilde: true/.test(block) }))
    .filter((article) => article.id);
}

async function launchBrowser() {
  if (process.env.HELP_CHROME) return chromium.launch({ headless: true, executablePath: process.env.HELP_CHROME });
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    // The Chromium build for this Playwright version may not be installed; use the Chrome on the machine.
    try {
      return await chromium.launch({ headless: true, channel: "chrome" });
    } catch {
      throw error;
    }
  }
}

async function openPage(page, job) {
  await page.goto(BASE + job.route, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    ([ready, gate]) => document.body.textContent.includes(ready) || document.body.textContent.includes(gate),
    [job.ready, GATE_TEXT],
    { timeout: 60000 }
  );
  if (await page.getByText(GATE_TEXT).first().isVisible().catch(() => false)) {
    throw new Error(`«${GATE_TEXT}»: fanen finnes ikke i demoen`);
  }
  await page.getByText(job.ready).first().waitFor({ state: "visible", timeout: 30000 });
  // Pictures on the page (uploads, previews) and the layout are given time to settle.
  await page.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
}

// Opens a block's fields with its «Rediger innhold» button, and waits until the block is in edit mode.
async function openBlock(page, blockId) {
  const block = page.locator(`[data-cms-editor-target="${blockId}"]`).first();
  await block.locator('button[title="Rediger innhold"]').first().click();
  await block.locator('button[title="Ferdig med redigering"]').first().waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(500);
}

// The card of a dialog: the element around its title that is narrower than the screen. The dialog's own
// element is the full-screen backdrop, so the card is found from the title instead.
async function dialogCardBox(page, title) {
  const box = await page.evaluate((text) => {
    const leaf = [...document.querySelectorAll("body *")].find((el) => el.children.length === 0 && el.textContent.trim() === text);
    if (!leaf) return null;
    let card = leaf;
    while (card.parentElement && card.parentElement.getBoundingClientRect().width < window.innerWidth - 2) card = card.parentElement;
    const r = card.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, title);
  if (!box) throw new Error(`fant ikke dialogen «${title}»`);
  return box;
}

async function boxOf(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 20000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`ingen plassering for ${selector}`);
  return box;
}

// The admin's content column: from its left edge to the right edge of the screen, below the demo bar.
async function mainArea(page) {
  const main = await boxOf(page, "main");
  const x = Math.max(0, Math.round(main.x));
  return { x, y: TOP, width: VIEW_W - x, height: VIEW_H - TOP };
}

// Scrolls the editor's field column (its nearest scrolling ancestor) so that the element's top sits just
// inside the column.
async function alignTop(page, locator) {
  await locator.evaluate((el) => {
    let node = el.parentElement;
    while (node && !(/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight)) {
      node = node.parentElement;
    }
    if (!node) throw new Error("fant ikke feltkolonnen");
    node.scrollTop += el.getBoundingClientRect().top - node.getBoundingClientRect().top - 8;
  });
  await page.waitForTimeout(300);
}

// The visible top and bottom of the field column that holds the element, in viewport pixels.
async function columnOf(locator) {
  return locator.evaluate((el) => {
    let node = el.parentElement;
    while (node && !(/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight)) {
      node = node.parentElement;
    }
    if (!node) throw new Error("fant ikke feltkolonnen");
    const r = node.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });
}

// A picture of part of the viewport, in viewport pixels, clipped to the screen.
async function regionShot(page, region) {
  const x0 = Math.max(0, Math.floor(region.x));
  const y0 = Math.max(0, Math.floor(region.y));
  const x1 = Math.min(VIEW_W, Math.ceil(region.x + region.width));
  const y1 = Math.min(VIEW_H, Math.ceil(region.y + region.height));
  return page.screenshot({
    animations: "disabled",
    clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
  });
}

// A section of the page editor: the editor's width, from the top of the field column down to the
// section's bottom (or the column's, when the section is longer than the screen).
async function sectionShot(page, job) {
  const target = page.locator(job.target).first();
  await target.waitFor({ state: "visible", timeout: 20000 });
  await alignTop(page, target);
  // A section at the end of the column cannot scroll to the top, and the column can run below the screen.
  // A section that fits the screen is then brought whole into view by scrolling the page.
  let section = await target.boundingBox();
  const overflow = section.y + section.height + 16 - VIEW_H;
  if (overflow > 0 && section.height + 40 <= VIEW_H - TOP) {
    await page.evaluate((amount) => window.scrollBy(0, amount), overflow);
    await page.waitForTimeout(300);
    section = await target.boundingBox();
  }
  const column = await columnOf(target);
  const editor = await boxOf(page, "[data-page-editor]");
  const top = Math.max(TOP, column.top, section.y - 12);
  const bottom = Math.min(VIEW_H, column.bottom, section.y + section.height + 16);
  return regionShot(page, { x: editor.x, y: top, width: editor.width, height: bottom - top });
}

async function captureJob(browser, job) {
  const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 1 });
  // The demo lets the admin in as a person from the register (STAND_IN_KEY in FirebaseDataContext.tsx).
  // No theme keys are set, so the admin shows its default light look.
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("menighetsplan_utvikler_som", "person-1");
    } catch {
      // Blocked storage: the stand-in is simply not set
    }
  });
  const page = await context.newPage();
  try {
    await openPage(page, job);
    if (job.before) await job.before(page);
    const buffer = job.target ? await sectionShot(page, job) : await job.shot(page);
    await writeFile(path.join(OUT_DIR, `hjelp-${job.id}.png`), buffer);
    console.log(`✓ hjelp-${job.id}.png`);
    return true;
  } catch (error) {
    console.log(`✗ hjelp-${job.id}.png: ${error.message.split("\n")[0]}`);
    return false;
  } finally {
    await context.close();
  }
}

async function main() {
  const wanted = new Set(process.argv.slice(2));
  const articles = await articleIds();
  const jobIds = new Set(JOBS.map((job) => job.id));
  for (const article of articles) {
    if (!article.noPicture && !jobIds.has(article.id) && !KEEP.has(article.id)) {
      console.log(`! artikkelen «${article.id}» har bilde, men ingen bildeoppgave`);
    }
  }
  for (const id of KEEP) {
    if (wanted.size === 0 || wanted.has(id)) console.log(`- hjelp-${id}.png beholdes (tatt nylig)`);
  }
  const jobs = JOBS.filter((job) => (wanted.size > 0 ? wanted.has(job.id) : !KEEP.has(job.id)));

  const browser = await launchBrowser();
  let captured = 0;
  try {
    // One job after another, each in its own browser context, so no view state carries over.
    for (const job of jobs) {
      if (await captureJob(browser, job)) captured += 1;
    }
  } finally {
    await browser.close();
  }
  console.log(`${captured} av ${jobs.length} bilder tatt`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
