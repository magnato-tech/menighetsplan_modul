import { chromium, devices } from "playwright";
import fs from "node:fs";
const base = process.argv[2];
fs.rmSync("out", { recursive: true, force: true });
fs.mkdirSync("out");
const log = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "nb-NO", timezoneId: "Europe/Oslo" });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && log.push("console: " + m.text().slice(0, 200)));
const shot = async (name, full = true) => { await page.waitForTimeout(1200); await page.screenshot({ path: `out/${name}.png`, fullPage: full }); log.push("shot " + name + " " + page.url()); };
const step = async (name, fn) => { try { await fn(); } catch (e) { log.push(`FAIL ${name}: ${String(e).slice(0, 300)}`); } };
await step("open", async () => {
  const res = await page.goto(base + "/admin", { waitUntil: "networkidle", timeout: 60000 });
  log.push("status " + res?.status());
  await shot("01-inngang", false);
});
await step("door", async () => {
  const admin = page.getByRole("button", { name: /Administrator/ }).first();
  if (await admin.count()) { await admin.click(); await page.waitForLoadState("networkidle"); }
  else { const link = page.getByRole("link", { name: /Administrator/ }).first(); if (await link.count()) { await link.click(); } }
  await page.waitForTimeout(3000);
  await shot("02-oversikt");
});
await step("bemanning", async () => {
  await page.getByRole("link", { name: /Neste/ }).first().click();
  await page.waitForTimeout(3000);
  await shot("03-bemanning");
});
await step("personmeny", async () => {
  await page.locator("[aria-haspopup=menu]").first().click();
  await shot("04-personmeny", false);
  await page.mouse.click(5, 5);
});
await step("tildel", async () => {
  await page.getByRole("button", { name: "Tildel" }).first().click();
  await shot("05-tildel", false);
  await page.getByRole("button", { name: "Lukk" }).click();
});
await step("program", async () => {
  await page.getByRole("tab", { name: /Program/ }).click();
  await shot("06-program");
});
await step("arrangementer", async () => {
  await page.goto(base + "/admin?tab=planlegger-samlinger", { waitUntil: "networkidle" });
  await shot("07-arrangementer");
});
await step("oppfolging", async () => {
  await page.goto(base + "/admin?tab=planlegger-oppgaver", { waitUntil: "networkidle" });
  await shot("08-oppfolging");
});
fs.writeFileSync("out/log.txt", log.join("\n") + "\n");
await browser.close();
