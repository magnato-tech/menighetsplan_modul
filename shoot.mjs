import { chromium, devices } from "playwright";
import fs from "node:fs";
const base = process.argv[2];
fs.rmSync("out", { recursive: true, force: true });
fs.mkdirSync("out");
const log = [];
const browser = await chromium.launch();
const run = async (prefix, ctxOptions, script) => {
  const ctx = await browser.newContext({ ...ctxOptions, locale: "nb-NO", timezoneId: "Europe/Oslo" });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && log.push(`${prefix} console: ` + m.text().slice(0, 200)));
  page.on("pageerror", (e) => log.push(`${prefix} pageerror: ` + String(e).slice(0, 300)));
  const shot = async (name, full = true) => {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `out/${prefix}-${name}.png`, fullPage: full });
    log.push(`${prefix} shot ${name} ${page.url()}`);
  };
  const step = async (name, fn) => {
    try { await fn(); } catch (e) { log.push(`${prefix} FAIL ${name}: ${String(e).split("\n")[0].slice(0, 300)}`); }
  };
  await script(page, shot, step);
  await ctx.close();
};
const enterAs = async (page, role) => {
  await page.goto(base + "/admin", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const button = page.getByRole("button", { name: new RegExp(role) }).first();
  const link = page.getByRole("link", { name: new RegExp(role) }).first();
  if (await button.count()) await button.click();
  else if (await link.count()) await link.click();
  await page.waitForTimeout(4000);
};

await run("mobil", devices["iPhone 13"], async (page, shot, step) => {
  await step("inn", async () => { await enterAs(page, "^Administrator"); await shot("01-oversikt"); });
  await step("bemanning", async () => {
    await page.getByRole("link", { name: /Neste/ }).first().click();
    await page.waitForTimeout(4000);
    await shot("02-bemanning");
    fs.writeFileSync("out/gathering-url.txt", page.url());
  });
  await step("personmeny", async () => { await page.locator("[aria-haspopup=menu]").first().click(); await shot("03-personmeny", false); await page.keyboard.press("Escape"); await page.mouse.click(2, 300); });
  await step("tildel", async () => { await page.getByRole("button", { name: "Tildel", exact: true }).first().click(); await shot("04-tildel", false); await page.getByRole("button", { name: "Lukk" }).click(); });
  await step("instruks", async () => { await page.getByRole("button", { name: /Instruks/ }).first().click(); await shot("05-instruks", false); await page.keyboard.press("Escape"); });
  await step("meny", async () => { await page.goto(page.url()); await page.waitForTimeout(3000); await page.getByRole("button", { name: "Flere valg" }).click(); await shot("06-flere-valg", false); await page.mouse.click(2, 600); });
  await step("program", async () => { await page.getByRole("tab", { name: /Program/ }).click(); await shot("07-program"); });
  await step("arrangementer", async () => { await page.goto(base + "/admin?tab=planlegger-samlinger", { waitUntil: "networkidle" }); await shot("08-arrangementer"); });
  await step("oppfolging", async () => { await page.goto(base + "/admin?tab=planlegger-oppgaver", { waitUntil: "networkidle" }); await shot("09-oppfolging"); });
});

await run("leder", devices["iPhone 13"], async (page, shot, step) => {
  await step("inn", async () => { await enterAs(page, "Tjenestegruppeleder"); await shot("01-start", false); });
  await step("samling", async () => {
    const url = fs.existsSync("out/gathering-url.txt") ? fs.readFileSync("out/gathering-url.txt", "utf8") : "";
    const id = url.match(/samling\/([^?#/]+)/)?.[1];
    await page.goto(`${base}/leder/samling/${id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await shot("02-bemanning");
    await page.getByRole("tab", { name: /Program/ }).click();
    await shot("03-program");
  });
});

await run("pc", { viewport: { width: 1280, height: 900 } }, async (page, shot, step) => {
  await step("inn", async () => { await enterAs(page, "^Administrator"); await shot("01-oversikt", false); });
  await step("bemanning", async () => {
    const url = fs.readFileSync("out/gathering-url.txt", "utf8");
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await shot("02-bemanning", false);
    const card = page.locator("[id^=roster-]").first();
    await card.screenshot({ path: "out/hjelp-bemanning-kort.png" });
  });
  await step("oppfolging", async () => {
    await page.goto(base + "/admin?tab=planlegger-oppgaver", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await shot("03-oppfolging", false);
  });
});
fs.writeFileSync("out/log.txt", log.join("\n") + "\n");
await browser.close();
