import { beforeEach, describe, expect, test, vi } from "vitest";

// The congregations of the demo: the sets that come with the app, which of them lie ready in
// the demo's database, and which every visitor is offered. The owner of the demo decides the
// last, and a set says for itself what holds until the owner has.

type Answer = "there" | "missing" | "refused" | "unreachable";

const { state } = vi.hoisted(() => ({
  state: {
    sets: [] as { id: string; name: string; file: string; source: string; fetchedAt: string; documents: number; listed?: boolean }[] | null,
    /** What the database answers when asked for a congregation's settings, by collection. */
    settings: {} as Record<string, Answer>,
    /** The owner's choices as they lie in the database, or "refused" when they cannot be read. */
    setup: undefined as Record<string, unknown> | undefined | "refused",
    asked: [] as string[],
    written: [] as { place: string; data: unknown; options: unknown }[],
    site: null as string | null,
  },
}));

vi.mock("../src/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ collection, id }),
  getDoc: async (reference: { collection: string; id: string }) => {
    const place = `${reference.collection}/${reference.id}`;
    state.asked.push(place);
    if (place === "cms_settings/demo-setup") {
      if (state.setup === "refused") throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
      return { exists: () => state.setup !== undefined, data: () => state.setup };
    }
    const answer = state.settings[reference.collection] ?? "missing";
    if (answer === "refused") throw Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
    if (answer === "unreachable") throw Object.assign(new Error("The client is offline."), { code: "unavailable" });
    return { exists: () => answer === "there", data: () => ({}) };
  },
  setDoc: async (reference: { collection: string; id: string }, data: { listed?: Record<string, boolean> }, options: unknown) => {
    state.written.push({ place: `${reference.collection}/${reference.id}`, data, options });
    // As the database does with a merge: the choices already there stand
    const before = state.setup && state.setup !== "refused" ? (state.setup.listed as Record<string, boolean> | undefined) : undefined;
    state.setup = { ...data, listed: { ...before, ...data.listed } };
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

const set = (id: string, name: string, source: string, listed?: boolean) => ({
  id,
  name,
  file: `${id}.json`,
  source,
  fetchedAt: "2026-10-06T16:00:00.000Z",
  documents: 100,
  ...(listed === undefined ? {} : { listed }),
});

/** The service as a visitor who has just opened the demo has it. */
const open = async () => {
  vi.resetModules();
  return import("../src/services/demoSiteList");
};
const listDemoSites = async () => (await open()).listDemoSites();

beforeEach(() => {
  state.sets = [set("sogne", "Søgne Misjonskirke", "sognemisjonskirke.no"), set("floy", "Flekkerøy misjonskirke", "fløymk.no")];
  state.settings = { "sogne-cms_settings": "there", "floy-cms_settings": "there" };
  state.setup = undefined;
  state.asked = [];
  state.written = [];
  state.site = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Menighetene som ligger klare i demoen", () => {
  test("bare de som ligger i demoens database, etter navn", async () => {
    expect((await listDemoSites())?.map(({ id, name, source }) => ({ id, name, source }))).toEqual([
      { id: "floy", name: "Flekkerøy misjonskirke", source: "fløymk.no" },
      { id: "sogne", name: "Søgne Misjonskirke", source: "sognemisjonskirke.no" },
    ]);
    expect(state.asked.sort()).toEqual(["cms_settings/demo-setup", "floy-cms_settings/global", "sogne-cms_settings/global"]);
  });

  test("et sett som ikke er lagt i databasen ennå, er ikke klart", async () => {
    state.settings = { "sogne-cms_settings": "there" };
    expect((await listDemoSites())?.map((site) => site.id)).toEqual(["sogne"]);
  });

  test("en database som nekter, har ingen menighet å vise, heller ikke den som var valgt", async () => {
    state.settings = { "sogne-cms_settings": "refused", "floy-cms_settings": "refused" };
    state.site = "sogne";
    expect(await listDemoSites()).toEqual([]);
  });

  test("kan databasen ikke nås, blir den besøkende hos menigheten sin, og ingen andre er klare", async () => {
    state.settings = { "sogne-cms_settings": "unreachable", "floy-cms_settings": "unreachable" };
    state.site = "sogne";
    expect((await listDemoSites())?.map((site) => site.id)).toEqual(["sogne"]);
  });

  test("et sett med et navn som ikke kan stå foran en samling, er ikke med og spørres ikke etter", async () => {
    state.sets = [set("../persons", "Ikke en menighet", "eksempel.no"), set("sogne", "Søgne Misjonskirke", "sognemisjonskirke.no")];
    expect((await listDemoSites())?.map((site) => site.id)).toEqual(["sogne"]);
    expect(state.asked).not.toContain("../persons-cms_settings/global");
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
    const service = await open();
    await service.listDemoSites();
    await service.listDemoSetStatuses();
    expect(state.asked.filter((place) => place.startsWith("sogne-"))).toHaveLength(1);
  });
});

describe("Hvilke menigheter alle besøkende tilbys", () => {
  const listed = async () => Object.fromEntries((await listDemoSites())!.map((site) => [site.id, site.listed]));

  test("en menighet står ikke i lista før noen har sagt at den skal", async () => {
    expect(await listed()).toEqual({ floy: false, sogne: false });
  });

  test("et sett kan si for seg selv at menigheten står i lista", async () => {
    state.sets = [set("sogne", "Søgne Misjonskirke", "sognemisjonskirke.no"), set("floy", "Flekkerøy misjonskirke", "fløymk.no", true)];
    expect(await listed()).toEqual({ floy: true, sogne: false });
  });

  test("eierens valg går foran det settet sier, begge veier", async () => {
    state.sets = [set("sogne", "Søgne Misjonskirke", "sognemisjonskirke.no"), set("floy", "Flekkerøy misjonskirke", "fløymk.no", true)];
    state.setup = { recordType: "demoSetup", listed: { sogne: true, floy: false } };
    expect(await listed()).toEqual({ floy: false, sogne: true });
  });

  test("et dokument som ikke er eierens oppsett, gir ingen valg", async () => {
    state.setup = { listed: { sogne: true } };
    expect(await listed()).toEqual({ floy: false, sogne: false });
  });

  test("kan eierens valg ikke leses, gjelder det settene sier", async () => {
    state.sets = [set("sogne", "Søgne Misjonskirke", "sognemisjonskirke.no", true), set("floy", "Flekkerøy misjonskirke", "fløymk.no")];
    state.setup = "refused";
    expect(await listed()).toEqual({ floy: false, sogne: true });
  });
});

describe("Slik eieren ser menighetene", () => {
  test("alle settene er med, også de som ikke ligger i databasen ennå", async () => {
    state.settings = { "sogne-cms_settings": "there" };
    const statuses = await (await open()).listDemoSetStatuses();
    expect(statuses?.map(({ id, ready }) => ({ id, ready }))).toEqual([
      { id: "floy", ready: false },
      { id: "sogne", ready: true },
    ]);
  });

  test("et valg lagres hos eksempelmenighetens innstillinger, uten å røre valgene for de andre", async () => {
    state.setup = { recordType: "demoSetup", listed: { floy: true } };
    const service = await open();
    await service.saveSiteListing("sogne", true);

    expect(state.written).toEqual([
      { place: "cms_settings/demo-setup", data: { recordType: "demoSetup", listed: { sogne: true } }, options: { merge: true } },
    ]);
    // The list is asked for anew, and has the choice
    const after = Object.fromEntries((await service.listDemoSites())!.map((site) => [site.id, site.listed]));
    expect(after).toEqual({ floy: true, sogne: true });
  });

  test("valget lagres på samme sted uansett hvilken menighet eieren ser på", async () => {
    state.site = "floy";
    await (await open()).saveSiteListing("sogne", false);
    expect(state.written.map((write) => write.place)).toEqual(["cms_settings/demo-setup"]);
  });

  test("noe som ikke er en menighet, lagres ikke", async () => {
    await expect((await open()).saveSiteListing("../persons", true)).rejects.toThrow(/ikke en menighet/);
    expect(state.written).toEqual([]);
  });
});
