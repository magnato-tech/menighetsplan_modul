import { describe, expect, test } from "vitest";
import { datesMentioned, needsLastDay, suggestedLastDay } from "../src/utils/news";

// Backlog 17: an article saved with nothing that ends it is asked about, and the date it mentions is offered.

const october21 = Date.parse("2026-10-21T10:00:00Z");

describe("Datoer i teksten", () => {
  test("«16. oktober» og «11. okt.» blir dager i år", () => {
    expect(datesMentioned("Vi starter opp med Alpha Youth den 16. oktober kl 19.30 på Loftet", october21)).toEqual(["2026-10-16"]);
    expect(datesMentioned("Lørdag 11. okt. har vi bønnevakt", october21)).toEqual(["2026-10-11"]);
  });

  test("klokkeslett og tall uten år er ikke datoer", () => {
    expect(datesMentioned("kl 19.30, 16.10 og 24 timer", october21)).toEqual([]);
  });

  test("en dato med år, i ord eller tall", () => {
    expect(datesMentioned("3. mars 2027 og 05.04.2027", october21)).toEqual(["2027-03-03", "2027-04-05"]);
  });

  test("i oktober er «4. januar» neste år", () => {
    expect(datesMentioned("Juletrefest 4. januar", Date.parse("2026-12-10T10:00:00Z"))).toEqual(["2027-01-04"]);
  });

  test("31. februar finnes ikke", () => {
    expect(datesMentioned("31. februar", october21)).toEqual([]);
  });

  test("forslaget er den siste datoen i tittel, ingress og tekst", () => {
    expect(suggestedLastDay({ title: "Leir 6. november", summary: "Påmelding innen 30. oktober", content: "Hjem 8. november" }, october21)).toBe("2026-11-08");
    expect(suggestedLastDay({ title: "Høsten 2026", summary: "Få med deg det som skjer" }, october21)).toBeNull();
  });
});

describe("Når det spørres", () => {
  const event = { id: "g1", startsAt: "2026-10-16T17:30:00Z", endsAt: "2026-10-16T20:00:00Z" };

  test("en publisert nyhet uten siste dag og uten arrangement", () => {
    expect(needsLastDay({}, [event])).toBe(true);
    expect(needsLastDay({ isPublished: true, expiresAt: "" }, [event])).toBe(true);
  });

  test("ikke med siste dag, med arrangement, eller når den ikke er publisert", () => {
    expect(needsLastDay({ expiresAt: "2026-10-16" }, [event])).toBe(false);
    expect(needsLastDay({ gatheringRefId: "g1" }, [event])).toBe(false);
    expect(needsLastDay({ isPublished: false }, [event])).toBe(false);
  });

  test("et arrangement som er borte fra kalenderen, avslutter ingenting", () => {
    expect(needsLastDay({ gatheringRefId: "borte" }, [event])).toBe(true);
  });
});
