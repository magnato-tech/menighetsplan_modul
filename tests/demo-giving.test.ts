import { describe, expect, test } from "vitest";
import { resetDemo, type DemoSet } from "../scripts/reset-demo";
import { demoGivingDocuments } from "../src/data/demoGiving";
import { getCustomMockDocuments, FULL_DEMO_COUNTS } from "../src/data/mockDocuments";
import { COLLECTIONS, GIVING_PLAIN_COLLECTIONS } from "../src/data/collections";
import { planReset, pathOf, siteDocuments, type SiteSet } from "../src/utils/demoReset";

// The givertjeneste documents of the demo: the gift purposes and the access given to two persons of
// the example congregation. Each congregation has its own copy, and the nightly reset removes the
// rest of what visitors add to these collections.

const NOW = Date.parse("2026-11-26T10:00:00Z");
const example = getCustomMockDocuments(FULL_DEMO_COUNTS, NOW);
const persons = example.filter((d) => d.collection === COLLECTIONS.PERSONS);
const personById = (id: string) => persons.find((p) => p.id === id)!.data as { name: string; email: string; globalRole: string };

const giving = demoGivingDocuments(example, NOW);
const purposes = giving.filter((d) => d.collection === GIVING_PLAIN_COLLECTIONS.PURPOSES);
const access = giving.filter((d) => d.collection === GIVING_PLAIN_COLLECTIONS.ACCESS);

/** A small set, shaped as the files in public/demosett/. Its website is the only thing it has. */
const sogne: SiteSet = {
  createdAt: "2026-11-23T16:00:00.000Z",
  collections: {
    cms_pages: [{ id: "sogne-forside", slug: "", title: "Forside", updatedAt: "2026-11-01T10:00:00.000Z" }],
  },
};

describe("Givertjeneste i demoen: dokumentene", () => {
  test("gavene har akkurat feltene som er satt, og tre formål", () => {
    expect(purposes.map((d) => d.id)).toEqual(["purpose-drift", "purpose-misjon", "purpose-barn"]);
    for (const purpose of purposes) {
      expect(Object.keys(purpose.data).sort()).toEqual(["active", "createdAt", "name", "updatedAt", "updatedBy", "usage"]);
    }
  });

  test("formålene har riktig navn og bruk, og er aktive", () => {
    expect(purposes.map((d) => [(d.data as { name: string }).name, (d.data as { usage: string }).usage])).toEqual([
      ["Menighetens arbeid", "drift"],
      ["Misjonsarbeid", "oremerket"],
      ["Barn og unge", "oremerket"],
    ]);
    for (const purpose of purposes) expect((purpose.data as { active: boolean }).active).toBe(true);
  });

  test("formålene er skrevet av den første administratoren, og tidspunktene er dette øyeblikket", () => {
    const admin = persons.find((p) => (p.data as { globalRole: string }).globalRole === "admin")!;
    for (const purpose of purposes) {
      expect((purpose.data as { updatedBy: string }).updatedBy).toBe(admin.id);
      expect((purpose.data as { createdAt: string }).createdAt).toBe(new Date(NOW).toISOString());
      expect((purpose.data as { updatedAt: string }).updatedAt).toBe(new Date(NOW).toISOString());
    }
  });

  test("det er to tilganger, og bare den første har googleId", () => {
    expect(access.length).toBe(2);
    expect(Object.keys(access[0].data).sort()).toEqual(
      ["budget", "googleId", "individual", "manage", "name", "overview", "personId", "updatedAt", "updatedBy", "version"]
    );
    expect(Object.keys(access[1].data).sort()).toEqual(["budget", "individual", "manage", "name", "overview", "personId", "updatedAt", "updatedBy", "version"]);
    expect(access[0].data).toMatchObject({ googleId: "demo", overview: true, budget: true, individual: true, manage: false, version: 1 });
    expect(access[1].data).toMatchObject({ overview: false, budget: false, individual: false, manage: true, version: 1 });
  });

  test("ingen logg, og ingen dokumenter i andre samlinger", () => {
    expect(giving.some((d) => d.collection === GIVING_PLAIN_COLLECTIONS.LOG)).toBe(false);
    expect(giving.every((d) => Object.values(GIVING_PLAIN_COLLECTIONS).includes(d.collection as never))).toBe(true);
  });
});

describe("Givertjeneste i demoen: hvem tilgangene gjelder", () => {
  test("tilgangene hører til personer i eksempelmenigheten, med samme e-post og navn", () => {
    for (const document of access) {
      const data = document.data as { personId: string; name: string };
      const person = personById(data.personId);
      expect(person.name).toBe(data.name);
      expect(person.email.trim().toLowerCase()).toBe(document.id);
    }
  });

  test("ingen tilgang gis til en administrator", () => {
    for (const document of access) {
      expect(personById((document.data as { personId: string }).personId).globalRole).not.toBe("admin");
    }
  });

  test("uten administrator lages ingenting", () => {
    const withoutAdmin = example.map((d) =>
      d.collection === COLLECTIONS.PERSONS ? { ...d, data: { ...(d.data as object), globalRole: "member" } } : d
    );
    expect(demoGivingDocuments(withoutAdmin, NOW)).toEqual([]);
  });

  test("med færre enn to aktuelle personer lages bare de som finnes, og ingen blir funnet på", () => {
    const onlyOne = example.filter((d) => {
      if (d.collection !== COLLECTIONS.PERSONS) return true;
      const p = d.data as { globalRole: string; email?: string };
      return p.globalRole === "admin" || d.id === "person-2";
    });
    const made = demoGivingDocuments(onlyOne, NOW).filter((d) => d.collection === GIVING_PLAIN_COLLECTIONS.ACCESS);
    expect(made.map((d) => (d.data as { personId: string }).personId)).toEqual(["person-2"]);
  });
});

describe("Givertjeneste i demoen: hver menighet og nullstillingen", () => {
  test("hver menighet får sine egne samlinger, med menighetens id foran", () => {
    const sites = [
      { site: null, documents: example.concat(giving) },
      { site: "sogne", documents: siteDocuments(example.concat(giving), sogne, NOW) },
    ];
    const written = planReset(sites, []).write.map(pathOf);

    expect(written).toContain(`${GIVING_PLAIN_COLLECTIONS.PURPOSES}/purpose-drift`);
    expect(written).toContain(`sogne-${GIVING_PLAIN_COLLECTIONS.PURPOSES}/purpose-drift`);
    for (const document of access) {
      expect(written).toContain(`${GIVING_PLAIN_COLLECTIONS.ACCESS}/${document.id}`);
      expect(written).toContain(`sogne-${GIVING_PLAIN_COLLECTIONS.ACCESS}/${document.id}`);
    }
  });

  test("et besøkendes dokument i sogne-givingAccess er med i det som fjernes", () => {
    const sites = [
      { site: null, documents: example.concat(giving) },
      { site: "sogne", documents: siteDocuments(example.concat(giving), sogne, NOW) },
    ];
    const plan = planReset(sites, [`sogne-${GIVING_PLAIN_COLLECTIONS.ACCESS}/besokende@eksempel.no`]);
    expect(plan.remove).toEqual([`sogne-${GIVING_PLAIN_COLLECTIONS.ACCESS}/besokende@eksempel.no`]);
  });

  test("nullstillingen leser de tre samlingene, og fjerner det besøkende har lagt inn der", async () => {
    const stored = new Map<string, Record<string, unknown>>([
      [`${GIVING_PLAIN_COLLECTIONS.ACCESS}/besokende@eksempel.no`, { name: { stringValue: "Besøkende" } }],
      [`${GIVING_PLAIN_COLLECTIONS.LOG}/logg-fra-besokende`, { action: { stringValue: "x" } }],
    ]);
    const ROOT = "https://firestore.googleapis.com/v1/projects/demo-prosjektet/databases/(default)/documents";
    const NAME = "projects/demo-prosjektet/databases/(default)/documents/";
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const answer = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as Response;
      if (url === `${ROOT}:commit`) {
        const { writes } = JSON.parse(String(init?.body)) as { writes: { update?: { name: string; fields: Record<string, unknown> }; delete?: string }[] };
        for (const write of writes) {
          if (write.update) stored.set(write.update.name.slice(NAME.length), write.update.fields);
          if (write.delete) stored.delete(write.delete.slice(NAME.length));
        }
        return answer({ writeResults: writes.map(() => ({})) });
      }
      const { pathname } = new URL(url);
      const collection = decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1));
      const found = [...stored.keys()].filter((path) => path.startsWith(`${collection}/`));
      return answer(found.length === 0 ? {} : { documents: found.map((path) => ({ name: NAME + path, fields: stored.get(path) })) });
    }) as typeof fetch;

    const sets: DemoSet[] = [{ id: "sogne", name: "Søgne", set: sogne }];
    const result = await resetDemo({ projectId: "demo-prosjektet", databaseId: "(default)" }, NOW, fetchFn, sets);

    expect(result.removed).toBe(2);
    expect(stored.has(`${GIVING_PLAIN_COLLECTIONS.ACCESS}/besokende@eksempel.no`)).toBe(false);
    expect(stored.has(`${GIVING_PLAIN_COLLECTIONS.LOG}/logg-fra-besokende`)).toBe(false);
    expect(stored.has(`sogne-${GIVING_PLAIN_COLLECTIONS.PURPOSES}/purpose-barn`)).toBe(true);
  });
});
