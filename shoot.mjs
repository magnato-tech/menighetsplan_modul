import { chromium, devices } from "playwright";
import fs from "node:fs";
const base = process.argv[2];
fs.rmSync("out", { recursive: true, force: true });
fs.mkdirSync("out");
const log = [];
const browser = await chromium.launch();
const go = async (page, p) => {
  await page.evaluate((x) => { history.pushState({}, "", x); dispatchEvent(new PopStateEvent("popstate")); }, p);
  await page.waitForTimeout(3500);
};
const ctxFor = async (opts) => {
  const ctx = await browser.newContext({ ...opts, locale: "nb-NO", timezoneId: "Europe/Oslo" });
  await ctx.addInitScript(() => { try { localStorage.setItem("menighetsplan_studio_content", "light"); } catch {} });
  return ctx;
};
const enter = async (page) => {
  await page.goto(base + "/admin", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /Administrator/ }).first().click();
  await page.waitForTimeout(4000);
};
const step = async (name, fn) => { try { await fn(); log.push("ok " + name); } catch (e) { log.push(`FAIL ${name} ${String(e).split("\n")[0].slice(0, 200)}`); } };

// PC: one picture per slide
{
  const ctx = await ctxFor({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const shot = async (name) => { await page.waitForTimeout(1200); await page.screenshot({ path: `out/pc-${name}.png` }); };
  await enter(page);
  const tabs = { "d-oversikt": "dashboard", "b-admin": "planlegger-oppgaver", "d-arrangementer": "planlegger-samlinger", "d-grupper": "planlegger-grupper", "d-personer": "planlegger-personer", "d-maler": "planlegger-maler", "d-arshjul": "arshjul", "d-epost": "epost", "d-roller": "planlegger-roller",
    "e-sider": "cms-sider", "e-nyheter": "cms-nyheter", "e-taler": "cms-taler", "e-stab": "cms-stab", "e-medier": "cms-medier", "e-design": "cms-design", "e-innstillinger": "cms-innstillinger", "e-overstyringer": "cms-overstyringer", "e-hjelp": "cms-hjelp" };
  for (const [slide, tab] of Object.entries(tabs)) await step(slide, async () => { await go(page, "/admin?tab=" + tab); await shot(slide); });
  await step("e-oversikt", async () => { await go(page, "/admin?tab=cms-sider"); await page.getByRole("button", { name: /^Oversikt/ }).first().click(); await page.waitForTimeout(2500); await shot("e-oversikt"); });
  await step("d-gruppe", async () => { await go(page, "/admin?tab=planlegger-grupper"); await page.getByText("Lyd og bilde", { exact: true }).first().click(); await page.waitForTimeout(3000); if (!page.url().includes("/admin/gruppe/")) { await page.getByRole("link", { name: /Administrer gruppe/ }).first().click(); await page.waitForTimeout(3000); } await shot("d-gruppe"); });
  await step("d-samling", async () => { await go(page, "/admin/samling/gathering-1?vis=bemanning"); await shot("d-samling"); });
  await ctx.close();
}
// Mobile
{
  const ctx = await ctxFor(devices["iPhone 13"]);
  const page = await ctx.newPage();
  const shot = async (name, full = true) => { await page.waitForTimeout(1200); await page.screenshot({ path: `out/mobil-${name}.png`, fullPage: full }); };
  await enter(page);
  await step("m-oversikt", async () => { await shot("oversikt"); });
  await step("m-bemanning", async () => { await go(page, "/admin/samling/gathering-1?vis=bemanning"); await shot("bemanning"); });
  await step("m-personmeny", async () => { await page.locator("div[id^=roster-] [aria-haspopup=menu]").first().click(); await shot("personmeny", false); await page.mouse.click(2, 300); await page.waitForTimeout(600); });
  await step("m-tildel", async () => { await page.getByRole("button", { name: "Tildel", exact: true }).first().click(); await shot("tildel", false); await page.getByRole("button", { name: "Lukk" }).click(); });
  await step("m-program", async () => { await page.getByRole("tab", { name: /Program/ }).click(); await shot("program"); });
  await ctx.close();
}
fs.writeFileSync("out/log.txt", log.join("\n") + "\n");
await browser.close();
