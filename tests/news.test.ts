import { describe, expect, test } from "vitest";
import { isNewsExpired, isNewsShown, lastDayOf, norwegianDayOf, shownNews } from "../src/utils/news";

// How long a news article is shown on the website: until the date set on it, or, without one,
// through the day of the event it belongs to. The day is the day in Norway.

const at = (moment: string): number => Date.parse(moment);
const meeting = { id: "g1", startsAt: "2026-10-11T09:00:00.000Z" };
const article = (fields: { expiresAt?: string; gatheringRefId?: string; isPublished?: boolean } = {}) => ({ isPublished: true, ...fields });

describe("Dagen i Norge", () => {
  test("skifter ved midnatt norsk tid, sommer som vinter", () => {
    // Summer time: midnight in Norway is 22:00 in UTC
    expect(norwegianDayOf(at("2026-07-10T21:59:59Z"))).toBe("2026-07-10");
    expect(norwegianDayOf(at("2026-07-10T22:00:00Z"))).toBe("2026-07-11");
    // Winter time: 23:00 in UTC
    expect(norwegianDayOf(at("2026-12-10T22:59:59Z"))).toBe("2026-12-10");
    expect(norwegianDayOf(at("2026-12-10T23:00:00Z"))).toBe("2026-12-11");
  });
});

describe("Siste dag en nyhet vises", () => {
  test("uten dato og uten arrangement står den til den tas ut", () => {
    expect(lastDayOf(article(), [meeting])).toBeNull();
    expect(isNewsExpired(article(), [meeting], at("2030-01-01T12:00:00Z"))).toBe(false);
  });

  test("en dato på nyheten gjelder til og med den dagen", () => {
    const news = article({ expiresAt: "2026-10-11" });
    expect(lastDayOf(news, [])).toEqual({ day: "2026-10-11", from: "date" });
    expect(isNewsExpired(news, [], at("2026-10-11T21:59:59Z"))).toBe(false);
    expect(isNewsExpired(news, [], at("2026-10-11T22:00:00Z"))).toBe(true);
  });

  test("en nyhet som hører til et arrangement, vises til og med dagen arrangementet holdes", () => {
    const news = article({ gatheringRefId: "g1" });
    expect(lastDayOf(news, [meeting])).toEqual({ day: "2026-10-11", from: "event" });
    expect(isNewsExpired(news, [meeting], at("2026-10-11T20:00:00Z"))).toBe(false);
    expect(isNewsExpired(news, [meeting], at("2026-10-12T05:00:00Z"))).toBe(true);
  });

  test("dagen er den norske: et arrangement sent på kvelden hører til den kvelden", () => {
    // 23:30 in Norway on the 11th is 21:30 in UTC
    const late = { id: "g1", startsAt: "2026-10-11T21:30:00.000Z" };
    expect(lastDayOf(article({ gatheringRefId: "g1" }), [late])?.day).toBe("2026-10-11");
    // 00:30 in Norway on the 12th is still the 11th in UTC
    const afterMidnight = { id: "g1", startsAt: "2026-10-11T22:30:00.000Z" };
    expect(lastDayOf(article({ gatheringRefId: "g1" }), [afterMidnight])?.day).toBe("2026-10-12");
  });

  test("et arrangement over flere dager teller til det er slutt", () => {
    const camp = { id: "g1", startsAt: "2026-10-09T16:00:00.000Z", endsAt: "2026-10-11T12:00:00.000Z" };
    expect(lastDayOf(article({ gatheringRefId: "g1" }), [camp])?.day).toBe("2026-10-11");
  });

  test("nyheten følger arrangementet når det flyttes", () => {
    const news = article({ gatheringRefId: "g1" });
    const moved = { ...meeting, startsAt: "2026-10-18T09:00:00.000Z" };
    expect(isNewsExpired(news, [meeting], at("2026-10-13T10:00:00Z"))).toBe(true);
    expect(isNewsExpired(news, [moved], at("2026-10-13T10:00:00Z"))).toBe(false);
  });

  test("datoen på nyheten går foran arrangementet, begge veier", () => {
    expect(lastDayOf(article({ gatheringRefId: "g1", expiresAt: "2026-10-20" }), [meeting])).toEqual({ day: "2026-10-20", from: "date" });
    expect(lastDayOf(article({ gatheringRefId: "g1", expiresAt: "2026-10-05" }), [meeting])).toEqual({ day: "2026-10-05", from: "date" });
  });

  test("er arrangementet slettet, er det ingenting å gå etter, og nyheten står", () => {
    expect(lastDayOf(article({ gatheringRefId: "borte" }), [meeting])).toBeNull();
  });

  test("det som ikke er en dato, regnes ikke som en", () => {
    for (const expiresAt of ["", "  ", "snart", "11.10.2026", "2026-13-45"]) {
      expect(lastDayOf(article({ expiresAt }), [])).toBeNull();
    }
    expect(lastDayOf(article({ gatheringRefId: "g1" }), [{ id: "g1", startsAt: "ukjent" }])).toBeNull();
  });
});

describe("Nyhetene som står i listene på nettsiden", () => {
  const now = at("2026-10-12T10:00:00Z");

  test("en kladd vises aldri, og en nyhet uten merke for kladd regnes som publisert", () => {
    expect(isNewsShown(article({ isPublished: false }), [], now)).toBe(false);
    expect(isNewsShown({}, [], now)).toBe(true);
  });

  test("en nyhet som er utløpt, er ute, og resten står i rekkefølgen de kom", () => {
    const news = [
      { id: "ny", ...article() },
      { id: "utløpt", ...article({ expiresAt: "2026-10-11" }) },
      { id: "holdt", ...article({ gatheringRefId: "g1" }) },
      { id: "til-i-dag", ...article({ expiresAt: "2026-10-12" }) },
      { id: "kladd", ...article({ isPublished: false }) },
    ];
    expect(shownNews(news, [meeting], now).map((n) => n.id)).toEqual(["ny", "til-i-dag"]);
  });

  test("før arrangementene har kommet, holdes en nyhet som venter på arrangementet sitt, tilbake", () => {
    expect(isNewsShown(article({ gatheringRefId: "g1" }), null, now)).toBe(false);
    // What does not wait for an event, is settled at once
    expect(isNewsShown(article(), null, now)).toBe(true);
    expect(isNewsShown(article({ expiresAt: "2026-10-20", gatheringRefId: "g1" }), null, now)).toBe(true);
    expect(isNewsShown(article({ expiresAt: "2026-10-11" }), null, now)).toBe(false);
  });
});
