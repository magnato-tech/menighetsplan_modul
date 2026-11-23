import { describe, expect, test } from "vitest";
import type { Gathering } from "../src/types";
import { countByFilter, filterEvents, groupByMonth } from "../src/utils/eventsOnWebsite";

// «Arrangementer på nettsiden»: which events the list shows, their order and their months.
// The clock is fixed to 18. november 2026, midday, local time.
const NOW = new Date(2026, 10, 18, 12, 0, 0);
const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h, 0, 0).toISOString();

const event = (id: string, startsAt: string, fields: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "g",
  title: id,
  startsAt,
  type: "arrangement",
  visibility: "offentlig",
  isGudstjeneste: false,
  imageUrl: "https://menigheten.example/bilde.jpg",
  summary: "Mat og sang.",
  ...fields,
});

const ids = (gatherings: Gathering[]) => gatherings.map((g) => g.id);

const samples = [
  event("fjern", at(2026, 12, 3)),
  event("i-dag", at(2026, 11, 18, 8)), // earlier today: still upcoming
  event("i-gar", at(2026, 11, 17, 20)),
  event("eldst", at(2026, 9, 1)),
  event("nyest-tidligere", at(2026, 11, 10)),
  event("intern-uten-tekst", at(2026, 11, 25), { visibility: "intern", imageUrl: undefined, summary: undefined }),
  event("mangler", at(2026, 11, 26), { imageUrl: undefined }),
  event("fremhevet", at(2026, 11, 20), { visibility: "fremhevet" }),
  event("avlyst", at(2026, 11, 22), { title: "Avlyst", visibility: "offentlig" }),
];

describe("Hvilke arrangementer listen viser", () => {
  test("kommende er fra starten av i dag, og tidligere er alt før", () => {
    expect(ids(filterEvents(samples, "kommende", NOW))).toEqual(["i-dag", "fremhevet", "avlyst", "intern-uten-tekst", "mangler", "fjern"]);
    expect(ids(filterEvents(samples, "tidligere", NOW))).toEqual(["i-gar", "nyest-tidligere", "eldst"]);
  });

  test("kommende er sortert stigende på starttid, og tidligere synkende (nyest først)", () => {
    const kommende = filterEvents(samples, "kommende", NOW).map((g) => g.startsAt);
    expect(kommende).toEqual([...kommende].sort());
    expect(ids(filterEvents(samples, "tidligere", NOW))[0]).toBe("i-gar");
  });

  test("mangler tar ikke med interne arrangementer, selv om de mangler bilde og tekst", () => {
    expect(ids(filterEvents(samples, "mangler", NOW))).toEqual(["mangler"]);
  });

  test("offentlig, kun intern og fremhevet er kommende med den synligheten", () => {
    expect(ids(filterEvents(samples, "offentlig", NOW))).toEqual(["i-dag", "avlyst", "mangler", "fjern"]);
    expect(ids(filterEvents(samples, "intern", NOW))).toEqual(["intern-uten-tekst"]);
    expect(ids(filterEvents(samples, "fremhevet", NOW))).toEqual(["fremhevet"]);
  });

  test("et avlyst arrangement blir værende i listen, slik det var", () => {
    expect(filterEvents(samples, "offentlig", NOW).map((g) => g.title)).toContain("Avlyst");
  });

  test("tomme filtre gir en tom liste, ikke en feil", () => {
    expect(filterEvents([], "kommende", NOW)).toEqual([]);
    expect(filterEvents([], "tidligere", NOW)).toEqual([]);
  });
});

describe("Antall på filterknappene", () => {
  test("teller hvert filter", () => {
    expect(countByFilter(samples, NOW)).toEqual({
      kommende: 6,
      mangler: 1,
      offentlig: 4,
      intern: 1,
      fremhevet: 1,
      tidligere: 3,
    });
  });
});

describe("Arrangementene gruppert per måned", () => {
  test("hver måned får en nøkkel og en overskrift med stor forbokstav og år", () => {
    const groups = groupByMonth(filterEvents(samples, "kommende", NOW));
    expect(groups.map((g) => ({ key: g.key, label: g.label }))).toEqual([
      { key: "2026-11", label: "November 2026" },
      { key: "2026-12", label: "Desember 2026" },
    ]);
  });

  test("arrangementene beholder rekkefølgen og legges i riktig måned", () => {
    const groups = groupByMonth(filterEvents(samples, "tidligere", NOW));
    expect(groups.map((g) => [g.label, ids(g.items)])).toEqual([
      ["November 2026", ["i-gar", "nyest-tidligere"]],
      ["September 2026", ["eldst"]],
    ]);
  });

  test("ingen arrangementer gir ingen måneder", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
