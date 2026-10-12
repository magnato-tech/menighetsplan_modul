import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CMS_COLLECTIONS, CMS_SETTINGS_DOC_ID } from "../src/data/collections";
import { listDemoSets, loadDemoSet, type DemoSetInfo } from "../src/services/demoSets";
import { countByPart } from "../src/utils/dataParts";
import { parseDataset } from "../src/utils/dataset";

// The demo sets themselves, as they lie in public/demosett/. They are made by a tool outside this
// repository and replaced when a website is fetched again, so what the app relies on is checked here.

const folder = join(__dirname, "..", "public", "demosett");
const read = (file: string) => readFileSync(join(folder, file), "utf8");
const index = JSON.parse(read("index.json")) as DemoSetInfo[];

/** Serves the files in public/demosett the way the web server does. */
const serveFolder = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const file = url.replace(/^\/demosett\//, "");
      try {
        const text = read(file);
        return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
      } catch {
        return { ok: false, status: 404, text: async () => "", json: async () => null };
      }
    })
  );

afterEach(() => vi.unstubAllGlobals());

describe("Demosettene som følger med appen", () => {
  test("listen har minst én menighet, og hver har sin egen fil", () => {
    expect(index.length).toBeGreaterThan(0);
    expect(new Set(index.map((set) => set.id)).size).toBe(index.length);
    for (const set of index) expect(set.file).toMatch(/^[a-z0-9-]+\.json$/);
  });

  test.each(index)("$name: et gyldig datasett med bare nettsiden, slik listen sier", (set) => {
    const parsed = parseDataset(read(set.file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.total).toBe(set.documents);
    expect(parsed.skipped).toEqual([]);
    // Nothing for the planner: choosing a congregation must never bring persons in
    expect(countByPart(parsed.dataset.collections).planner).toBe(0);
    const settings = parsed.dataset.collections[CMS_COLLECTIONS.SETTINGS]?.find((d) => d.id === CMS_SETTINGS_DOC_ID);
    expect(settings?.churchName).toBe(set.name);
    expect(parsed.dataset.collections[CMS_COLLECTIONS.PAGES].length).toBeGreaterThan(0);
  });

  // A congregation that has said yes to being shown as its own website stands, keeps its contact details
  const withoutContactDetails = index.filter((set) => set.asPublished !== true);
  const asPublished = index.filter((set) => set.asPublished === true);

  test("de fleste settene er uten kontaktopplysninger: det er unntaket å vises slik nettsiden er", () => {
    expect(withoutContactDetails.length).toBeGreaterThan(asPublished.length);
  });

  test.each(asPublished)("$name vises slik nettsiden er: menighetens telefon og e-post er med", (set) => {
    const dataset = JSON.parse(read(set.file)) as { collections: Record<string, Record<string, unknown>[]> };
    const settings = dataset.collections[CMS_COLLECTIONS.SETTINGS][0];
    expect(String(settings.email)).toMatch(/@/);
    expect(String(settings.phone)).toMatch(/\d/);
  });

  test.each(withoutContactDetails)("$name: ingen e-postadresser og ingen telefonnumre", (set) => {
    const text = read(set.file);
    const dataset = JSON.parse(text) as { collections: Record<string, Record<string, unknown>[]> };
    // Web addresses are left out of the search: the digits in a file name are not a phone number
    const prose = text.replace(/https?:\/\/[^"\\\])\s]+/gi, "");

    expect(prose.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []).toEqual([]);
    expect(prose.match(/(?:mailto|tel):/gi) ?? []).toEqual([]);
    expect(prose.match(/(?<![\d.#])(?:\+47 ?)?\d{3} ?\d{2} ?\d{3}(?!\d|\.\d)/g) ?? []).toEqual([]);
    for (const person of dataset.collections[CMS_COLLECTIONS.STAFF] ?? []) {
      expect([person.email, person.phone]).toEqual(["", ""]);
    }
    const settings = dataset.collections[CMS_COLLECTIONS.SETTINGS][0];
    expect([settings.email, settings.phone]).toEqual(["", ""]);
  });
});

describe("Demosettene hentes først når de trengs", () => {
  test("listen leses fra mappen, og et valgt sett leses som datasett", async () => {
    serveFolder();
    const list = await listDemoSets();
    expect(list).toEqual(index);

    const dataset = await loadDemoSet(list[0]);
    expect(Object.values(dataset.collections).reduce((sum, documents) => sum + documents.length, 0)).toBe(list[0].documents);
    expect(fetch).toHaveBeenCalledWith(`/demosett/${list[0].file}`);
  });

  test("en oppføring som ikke peker på en fil i mappen, tas ikke med", async () => {
    const good = index[0];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [good, { ...good, id: "x", file: "../hemmelig.json" }, { id: "y" }, null] }))
    );
    expect(await listDemoSets()).toEqual([good]);
  });

  test("finnes ikke listen eller filen, eller er filen ikke et datasett, sies det fra", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(listDemoSets()).rejects.toThrow("Listen over menigheter kunne ikke hentes (404).");
    await expect(loadDemoSet({ file: "borte.json", name: "Borte" })).rejects.toThrow("Innholdet for Borte kunne ikke hentes (404).");

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => "<html>", json: async () => ({}) })));
    await expect(loadDemoSet({ file: "feil.json", name: "Feil" })).rejects.toThrow("Innholdet for Feil kunne ikke leses");
    await expect(listDemoSets()).rejects.toThrow("ukjent format");
  });
});
