import { describe, expect, test } from "vitest";
import type { ProgramItem } from "../src/types";
import { DEFAULT_DURATION_MINUTES, clockToMinutes, durationsOf, minutesToClock, moveProgramItem, withComputedTimes } from "../src/utils/programTiming";

// Local time, so the clock reads the same wherever the tests run
const at = (hours: number, minutes: number) => new Date(2026, 10, 1, hours, minutes).toISOString();
const start = at(11, 0);

describe("klokkeslett og minutter", () => {
  test("klokkeslett med kolon eller punktum blir minutter etter midnatt", () => {
    expect(clockToMinutes("11:05")).toBe(665);
    expect(clockToMinutes("11.05")).toBe(665);
    expect(clockToMinutes(" 9:30 ")).toBe(570);
  });

  test("ugyldige klokkeslett gir null", () => {
    expect(clockToMinutes("abc")).toBeNull();
    expect(clockToMinutes("25:00")).toBeNull();
    expect(clockToMinutes("11:60")).toBeNull();
    expect(clockToMinutes(undefined)).toBeNull();
  });

  test("minutter blir til klokkeslett, og starter på nytt etter midnatt", () => {
    expect(minutesToClock(665)).toBe("11:05");
    expect(minutesToClock(24 * 60 + 5)).toBe("00:05");
    expect(minutesToClock(-5)).toBe("23:55");
  });
});

describe("varighet", () => {
  test("uten varighet leses den av avstanden til neste klokkeslett, og den siste til slutten", () => {
    const items: ProgramItem[] = [{ time: "11:00", title: "A" }, { time: "11:10", title: "B" }, { time: "11:25", title: "C" }];
    expect(durationsOf(items, at(11, 40))).toEqual([10, 15, 15]);
  });

  test("en egen varighet går foran det klokkeslettene sier", () => {
    const items: ProgramItem[] = [{ time: "11:00", durationMinutes: 20, title: "A" }, { time: "11:10", title: "B" }];
    expect(durationsOf(items, at(11, 40))).toEqual([20, 30]);
  });

  test("uten noe å lese av får punktet standardvarigheten", () => {
    expect(durationsOf([{ time: "", title: "A" }])).toEqual([DEFAULT_DURATION_MINUTES]);
  });

  test("negativ avstand gir standardvarigheten", () => {
    const items: ProgramItem[] = [{ time: "11:30", title: "A" }, { time: "11:10", title: "B" }];
    expect(durationsOf(items)).toEqual([DEFAULT_DURATION_MINUTES, DEFAULT_DURATION_MINUTES]);
  });
});

describe("klokkeslett fra starten", () => {
  test("første punkt starter ved arrangementets start, og hvert neste når det forrige er slutt", () => {
    const items: ProgramItem[] = [
      { time: "", durationMinutes: 5, title: "A" },
      { time: "", durationMinutes: 15, title: "B" },
      { time: "", durationMinutes: 10, title: "C" },
    ];
    const timed = withComputedTimes(items, start);
    expect(timed.map((item) => item.time)).toEqual(["11:00", "11:05", "11:20"]);
    expect(timed.map((item) => item.durationMinutes)).toEqual([5, 15, 10]);
  });

  test("et punkt uten varighet får en fra klokkeslettene som var der før", () => {
    const items: ProgramItem[] = [
      { time: "11:00", title: "A" },
      { time: "11:10", title: "B" },
    ];
    const timed = withComputedTimes(items, start, at(11, 30));
    expect(timed).toEqual([
      { time: "11:00", durationMinutes: 10, title: "A" },
      { time: "11:10", durationMinutes: 20, title: "B" },
    ]);
  });
});

describe("flytting av et punkt", () => {
  test("hvert punkt beholder varigheten sin, og klokkeslettene regnes ut på nytt", () => {
    const items: ProgramItem[] = [
      { time: "11:00", durationMinutes: 5, title: "A" },
      { time: "11:05", durationMinutes: 15, title: "B" },
      { time: "11:20", durationMinutes: 10, title: "C" },
    ];
    const moved = moveProgramItem(items, 0, 2, start);
    expect(moved.map((item) => `${item.time} ${item.title} ${item.durationMinutes}`)).toEqual(["11:00 B 15", "11:15 C 10", "11:25 A 5"]);
  });

  test("et punkt flyttet til samme sted endrer ingenting", () => {
    const items: ProgramItem[] = [{ time: "11:00", durationMinutes: 5, title: "A" }];
    expect(moveProgramItem(items, 0, 0, start)).toEqual(items);
  });
});

describe("Programmet beholder starten sin", () => {
  const start = new Date(2026, 10, 1, 11, 0).toISOString();
  const items = [
    { time: "10:45", title: "Velkommen ved inngang", durationMinutes: 15 },
    { time: "11:00", title: "Klokkeringing", durationMinutes: 5 },
    { time: "11:05", title: "Lovsang", durationMinutes: 15 },
  ];

  test("en post før gudstjenesten blir stående når noe annet flyttes", () => {
    expect(withComputedTimes(items, start).map((i) => i.time)).toEqual(["10:45", "11:00", "11:05"]);
    expect(moveProgramItem(items, 2, 1, start).map((i) => `${i.time} ${i.title}`)).toEqual(["10:45 Velkommen ved inngang", "11:00 Lovsang", "11:15 Klokkeringing"]);
  });

  test("flyttes den første posten, starter programmet likevel på samme klokkeslett", () => {
    expect(moveProgramItem(items, 0, 2, start).map((i) => i.time)).toEqual(["10:45", "10:50", "11:05"]);
  });
});
