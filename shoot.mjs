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
const run = async (prefix, opts) => {
  const ctx = await browser.newContext({ ...opts, locale: "nb-NO", timezoneId: "Europe/Oslo" });
  await ctx.addInitScript(() => { try { localStorage.setItem("menighetsplan_studio_content", "light"); } catch {} });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log.push(`${prefix} pageerror ${String(e).slice(0, 200)}`));
  const shot = async (name, full = true) => { await page.waitForTimeout(1200); await page.screenshot({ path: `out/${prefix}-${name}.png`, fullPage: full }); log.push(`${prefix} ${name}`); };
  try {
    await page.goto(base + "/admin", { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /Administrator/ }).first().click();
    await page.waitForTimeout(4000);
    const tabs = ["dashboard", "planlegger-oppgaver", "planlegger-samlinger", "planlegger-grupper", "planlegger-personer", "planlegger-roller", "planlegger-maler", "arshjul", "analyse", "cms-sider", "cms-nyheter", "cms-design", "epost"];
    for (const t of tabs) { try { await go(page, "/admin?tab=" + t); await shot(t, prefix === "mobil"); } catch (e) { log.push(`${prefix} FAIL ${t} ${String(e).slice(0,150)}`); } }
    await go(page, "/admin/samling/gathering-1?vis=bemanning"); await shot("samling", false);
    await go(page, "/admin/oppgave/task-1"); await shot("oppgave", false);
  } catch (e) { log.push(`${prefix} FAIL ${String(e).slice(0, 200)}`); }
  await ctx.close();
};
await run("pc", { viewport: { width: 1280, height: 900 } });
await run("mobil", devices["iPhone 13"]);
fs.writeFileSync("out/log.txt", log.join("\n") + "\n");
await browser.close();
