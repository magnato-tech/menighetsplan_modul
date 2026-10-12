import { describe, expect, test } from "vitest";
import { SERIES_FREQUENCIES, SERIES_LIMIT, seriesDays } from "../src/utils/series";

// The days of a series: an event repeated from a first day through a last one.

const weekdayOf = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay();

describe("Dagene i en serie", () => {
  test("hver uke gir samme ukedag, med første og siste dag", () => {
    expect(seriesDays("2026-10-18", "2026-11-15", "weekly")).toEqual(["2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08", "2026-11-15"]);
  });

  test("siste dato er til og med, og en dag som ikke treffer, er ikke med", () => {
    expect(seriesDays("2026-10-18", "2026-11-14", "weekly")).toHaveLength(4);
    expect(seriesDays("2026-10-18", "2026-10-18", "weekly")).toEqual(["2026-10-18"]);
  });

  test("hver 2., 3. og 4. uke hopper over ukene imellom", () => {
    expect(seriesDays("2026-10-18", "2026-12-13", "every2")).toEqual(["2026-10-18", "2026-11-01", "2026-11-15", "2026-11-29", "2026-12-13"]);
    expect(seriesDays("2026-10-18", "2026-12-13", "every3")).toEqual(["2026-10-18", "2026-11-08", "2026-11-29"]);
    expect(seriesDays("2026-10-18", "2026-12-13", "every4")).toEqual(["2026-10-18", "2026-11-15", "2026-12-13"]);
  });

  test("serien holder ukedagen over skiftet mellom sommertid og vintertid, og over nyttår", () => {
    const days = seriesDays("2026-10-18", "2027-01-17", "weekly");
    expect(days).toContain("2026-10-25");
    expect(days).toContain("2027-01-03");
    expect(new Set(days.map(weekdayOf))).toEqual(new Set([0]));
  });

  test("én gang i måneden gir samme ukedag i samme uke i måneden", () => {
    // The 18th of October 2026 is the third Sunday
    expect(seriesDays("2026-10-18", "2027-02-28", "monthly")).toEqual(["2026-10-18", "2026-11-15", "2026-12-20", "2027-01-17", "2027-02-21"]);
  });

  test("en måned som ikke har den femte ukedagen, står over", () => {
    // The 29th of November 2026 is the fifth Sunday. December and February have only four
    expect(seriesDays("2026-11-29", "2027-03-31", "monthly")).toEqual(["2026-11-29", "2027-01-31"]);
  });

  test("ingen dager når første dag ikke er en dag, eller siste er før første", () => {
    expect(seriesDays("", "2026-11-15", "weekly")).toEqual([]);
    expect(seriesDays("2026-10-18", "", "weekly")).toEqual([]);
    expect(seriesDays("2026-10-18", "2026-10-17", "weekly")).toEqual([]);
    expect(seriesDays("18.10.2026", "2026-11-15", "weekly")).toEqual([]);
  });

  test("en serie blir aldri lengre enn grensen", () => {
    expect(seriesDays("2026-10-18", "2036-10-18", "weekly")).toHaveLength(SERIES_LIMIT);
    expect(seriesDays("2026-10-18", "2036-10-18", "monthly")).toHaveLength(SERIES_LIMIT);
    expect(seriesDays("2026-10-18", "2036-10-18", "weekly", 3)).toHaveLength(3);
  });

  test("valgene er dem skjemaet tilbyr, med norske navn", () => {
    expect(SERIES_FREQUENCIES.map((choice) => choice.label)).toEqual(["Hver uke", "Hver 2. uke", "Hver 3. uke", "Hver 4. uke", "Én gang i måneden"]);
  });
});
