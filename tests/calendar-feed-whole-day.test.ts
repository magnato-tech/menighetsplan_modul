import { describe, expect, test } from "vitest";
process.env.TZ = "America/New_York";
import type { Gathering } from "../src/types";
const { toIcalendar } = await import("../src/utils/calendarFeed");

// Heldagsarrangementer i kalenderabonnementet. Maskinen står i New York her, og svaret skal likevel
// være norsk dato og klokkeslett.

const now = new Date("2026-06-01T12:00:00.000Z");

const event = (startsAt: string, endsAt?: string): Gathering => ({
  id: "evt-1",
  groupId: "group-1",
  title: "Arrangement",
  startsAt,
  ...(endsAt ? { endsAt } : {}),
  visibility: "offentlig",
  type: "arrangement",
});

/** The DTSTART and DTEND lines of the one event in the calendar. */
const timeLinesOf = (gathering: Gathering) =>
  toIcalendar([gathering], { now, calendarName: "Test" })
    .split("\r\n")
    .filter((line) => /^DT(START|END)/.test(line));

describe("Heldagsarrangementer i kalenderabonnementet", () => {
  test("maskinens tidssone er New York i denne testen", () => {
    expect(new Date("2026-11-25T12:00:00Z").getTimezoneOffset()).toBe(300);
  });

  test("start kl. 00:00 norsk tid og slutt tre dager senere: heldager til dagen etter slutt", () => {
    // 2026-11-25 23:00 UTC er 26. november i Oslo
    expect(timeLinesOf(event("2026-11-25T23:00:00.000Z", "2026-11-28T23:00:00.000Z"))).toEqual([
      "DTSTART;VALUE=DATE:20261126",
      "DTEND;VALUE=DATE:20261129",
    ]);
  });

  test("start kl. 00:00 norsk tid uten slutt: én dag, med DTEND dagen etter", () => {
    expect(timeLinesOf(event("2027-03-03T23:00:00.000Z"))).toEqual(["DTSTART;VALUE=DATE:20270304", "DTEND;VALUE=DATE:20270305"]);
  });

  test("midnatt om sommeren (sommertid i Oslo) uten slutt blir heldag, ikke et klokkeslett", () => {
    expect(timeLinesOf(event("2026-06-13T22:00:00.000Z"))).toEqual(["DTSTART;VALUE=DATE:20260614", "DTEND;VALUE=DATE:20260615"]);
  });

  test("et arrangement som starter kl. 10 norsk tid skrives med klokkeslett i UTC, som før", () => {
    expect(timeLinesOf(event("2026-11-29T10:00:00.000Z"))).toEqual(["DTSTART:20261129T100000Z", "DTEND:20261129T113000Z"]);
  });

  test("et arrangement kl. 19:00 til 20:00 norsk tid skrives med klokkeslett i UTC", () => {
    expect(timeLinesOf(event("2026-11-25T18:00:00.000Z", "2026-11-25T19:00:00.000Z"))).toEqual([
      "DTSTART:20261125T180000Z",
      "DTEND:20261125T190000Z",
    ]);
  });
});
