import { describe, expect, test } from "vitest";
import { shiftDate, weeksBetween, withLiveDates } from "../src/utils/liveDates";

// Dates in the demo content are moved whole weeks, and the clock is read as in Norway.

describe("Hvor mange uker som har gått", () => {
  test("uka skifter ved midnatt mellom søndag og mandag, norsk tid", () => {
    // Monday 31 August 2026 at 00:00 in Norway is 22:00 the evening before in UTC (summer time)
    expect(weeksBetween("2026-08-31", Date.parse("2026-08-30T22:00:00Z"))).toBe(0);
    expect(weeksBetween("2026-08-31", Date.parse("2026-09-06T21:59:59Z"))).toBe(0);
    expect(weeksBetween("2026-08-31", Date.parse("2026-09-06T22:00:00Z"))).toBe(1);
    expect(weeksBetween("2026-08-31", Date.parse("2026-08-30T21:59:59Z"))).toBe(-1);
  });

  test("også om vinteren, når Norge ligger én time foran UTC", () => {
    // Monday 2 November 2026 at 00:00 in Norway is 23:00 the evening before in UTC
    expect(weeksBetween("2026-08-31", Date.parse("2026-11-01T22:59:59Z"))).toBe(8);
    expect(weeksBetween("2026-08-31", Date.parse("2026-11-01T23:00:00Z"))).toBe(9);
  });

  test("hvilken dag i uka innholdet er skrevet for, spiller ingen rolle", () => {
    const now = Date.parse("2026-10-09T10:00:00Z");
    expect(weeksBetween("2026-09-03", now)).toBe(weeksBetween("2026-08-31", now));
    expect(weeksBetween("2026-08-31", now)).toBe(5);
  });
});

describe("En dato flyttet et antall uker", () => {
  test("et tidspunkt beholder ukedag og klokkeslett", () => {
    expect(shiftDate("2026-09-06T11:00:00+02:00", 0)).toBe("2026-09-06T09:00:00.000Z");
    expect(shiftDate("2026-09-06T11:00:00+02:00", 1)).toBe("2026-09-13T09:00:00.000Z");
    expect(shiftDate("2026-09-06T11:00:00+02:00", -2)).toBe("2026-08-23T09:00:00.000Z");
  });

  test("klokka er den samme i Norge på begge sider av skiftet mellom sommertid og vintertid", () => {
    // 11:00 in summer time moved into winter time is still 11:00, one hour later in UTC
    expect(shiftDate("2026-09-06T11:00:00+02:00", 8)).toBe("2026-11-01T10:00:00.000Z");
    // And from winter time into summer time
    expect(shiftDate("2026-12-06T11:00:00+01:00", 20)).toBe("2027-04-25T09:00:00.000Z");
    // The Sundays the clocks are changed on
    expect(shiftDate("2026-10-18T18:00:00+02:00", 1)).toBe("2026-10-25T17:00:00.000Z");
    expect(shiftDate("2027-03-21T11:00:00+01:00", 1)).toBe("2027-03-28T09:00:00.000Z");
  });

  test("et tidspunkt skrevet i UTC leses også som norsk klokke", () => {
    // 10:00 UTC is 12:00 in Norway in August, and 12:00 in Norway in December is 11:00 UTC
    expect(shiftDate("2026-08-25T10:00:00.000Z", 16)).toBe("2026-12-15T11:00:00.000Z");
  });

  test("brøkdeler av et sekund følger med", () => {
    expect(shiftDate("2026-08-25T10:00:00.123Z", 1)).toBe("2026-09-01T10:00:00.123Z");
  });

  test("en dag uten klokkeslett er fortsatt en dag", () => {
    expect(shiftDate("2027-10-01", 2)).toBe("2027-10-15");
    expect(shiftDate("2027-01-03", -1)).toBe("2026-12-27");
  });

  test("det som ikke er en dato, blir stående", () => {
    for (const text of ["19:30", "2026-10", "person-1", "", "Søndag 6. september", "2026-10-18T11:00:00", "2026-13-45", "1503.45.67890"]) {
      expect(shiftDate(text, 3)).toBe(text);
    }
  });
});

describe("Et dokument med datoene flyttet", () => {
  const gathering = {
    id: "gathering-1",
    title: "Gudstjeneste",
    startsAt: "2026-09-06T11:00:00+02:00",
    cancelled: false,
    neededCount: 2,
    hostPersonId: null,
    programSchedule: [{ time: "11:00", title: "Velkommen" }],
    joinedAt: { "person-1": "2026-08-01T00:00:00.000Z" },
    validUntil: "2027-10-01",
  };

  test("alle datoer flyttes, også inne i lister og kart, og resten er urørt", () => {
    expect(withLiveDates(gathering, 1)).toEqual({
      id: "gathering-1",
      title: "Gudstjeneste",
      startsAt: "2026-09-13T09:00:00.000Z",
      cancelled: false,
      neededCount: 2,
      hostPersonId: null,
      programSchedule: [{ time: "11:00", title: "Velkommen" }],
      joinedAt: { "person-1": "2026-08-08T00:00:00.000Z" },
      validUntil: "2027-10-08",
    });
  });

  test("dokumentet som ble gitt inn, er ikke endret", () => {
    const before = JSON.stringify(gathering);
    withLiveDates(gathering, 12);
    expect(JSON.stringify(gathering)).toBe(before);
  });
});
