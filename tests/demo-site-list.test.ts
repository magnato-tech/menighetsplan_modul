import { beforeEach, describe, expect, test, vi } from "vitest";

// Which congregations the demo offers: the sets that come with the app, and that lie ready in
// the demo's database.

type Answer = "there" | "missing" | "refused" | "unreachable";

const { state } = vi.hoisted(() => ({
  state: {
    sets: [] as { id: string; name: string; file: string; source: string; fetchedAt: string; documents: number }[] | null,
    /** What the database answers when asked for a congregation's settings, by collection. */
    settings: {} as Record<string, Answer>,
    asked: [] as string[],
    site: null as string | null,
  },
}));

vi.mock("../src/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ collection, id }),
  getDoc: async (reference: { collection: string; id: string }) => {
    state.asked.push(`${reference.collection}/${reference.id}`);
    const answer = state.settings[reference.collection] ?? "missing";
    if (answer === "refused") throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
    if (answer === "unreachable") throw Object.assign(new Error("The client is offline."), { code: "unavailable" });
    return { exists: () => answer === "there" };
  },
}));
vi.mock("../src/services/demoSets", () => ({
  listDemoSets: async () => {
    if (state.sets === null) throw new Error("Listen over menigheter kunne ikke hentes (500).");
    return state.sets;
  },
}));
vi.mock("../src/demoSite", () => ({
  get DEMO_SITE() {
    return state.site;
  },
}));

const set = (id: string, name: string, source: string) => ({ id, name, file: `${id}.json`, source, fetchedAt: "2026-10-06T16:00:00.000Z", documents: 100 });

/** The list as a visitor who has just opened the demo gets it. */
const listDemoSites = async () => {
  vi.resetModules();
  return (await import("../src/services/demoSiteList")).listDemoSites();
};

beforeEach(() => {
  state.sets = [set("sogne", "Søgne Misjonskirke", "sognemisjonskirke.no"), set("floy", "Flekkerøy misjonskirke", "fløymk.no")];
  state.settings = {};
  state.asked = [];
  state.site = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Menighetene demoen tilbyr", () => {
  test("bare de som ligger i demoens database, etter navn", async () => {
    state.settings = { "sogne-cms_settings": "there", "floy-cms_settings": "there" };
    expect(await listDemoSites()).toEqual([
      { id: "floy", name: "Flekkerøy misjonskirke", source: "fløymk.no" },
      { id: "sogne", name: "Søgne Misjonskirke", source: "sognemisjonskirke.no" },
    ]);
    expect(state.asked.sort()).toEqual(["floy-cms_settings/global", "sogne-cms_settings/global"]);
  });

  test("et sett som ikke er lagt i databasen ennå, tilbys ikke", async () => {
    state.settings = { "sogne-cms_settings": "there" };
    expect((await listDemoSites())?.map((site) => site.id)).toEqual(["sogne"]);
  });

  test("en database som nekter, har ingen menighet å vise, heller ikke den som var valgt", async () => {
    state.settings = { "sogne-cms_settings": "refused", "floy-cms_settings": "refused" };
    state.site = "sogne";
    expect(await listDemoSites()).toEqual([]);
  });

  test("kan databasen ikke nås, blir den besøkende hos menigheten sin, og ingen andre tilbys", async () => {
    state.settings = { "sogne-cms_settings": "unreachable", "floy-cms_settings": "unreachable" };
    state.site = "sogne";
    expect((await listDemoSites())?.map((site) => site.id)).toEqual(["sogne"]);
  });

  test("et sett med et navn som ikke kan stå foran en samling, tilbys ikke og spørres ikke etter", async () => {
    state.sets = [set("../persons", "Ikke en menighet", "eksempel.no"), set("sogne", "Søgne Misjonskirke", "sognemisjonskirke.no")];
    state.settings = { "sogne-cms_settings": "there" };
    expect((await listDemoSites())?.map((site) => site.id)).toEqual(["sogne"]);
    expect(state.asked).toEqual(["sogne-cms_settings/global"]);
  });

  test("uten sett spørres ikke databasen", async () => {
    state.sets = [];
    expect(await listDemoSites()).toEqual([]);
    expect(state.asked).toEqual([]);
  });

  test("kan lista over sett ikke hentes, er svaret at ingenting er kjent", async () => {
    state.sets = null;
    expect(await listDemoSites()).toBeNull();
  });

  test("det spørres én gang så lenge appen er åpen", async () => {
    state.settings = { "sogne-cms_settings": "there" };
    vi.resetModules();
    const service = await import("../src/services/demoSiteList");
    await service.listDemoSites();
    await service.listDemoSites();
    expect(state.asked.filter((place) => place.startsWith("sogne-"))).toHaveLength(1);
  });
});
