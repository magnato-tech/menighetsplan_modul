import { describe, expect, test } from "vitest";
import { countdownText } from "../src/utils/worshipCountdown";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("countdownText", () => {
  const start = new Date("2026-10-25T11:00:00+01:00");

  test("shows days, hours and minutes when more than a day away", () => {
    const now = new Date(start.getTime() - (3 * DAY + 11 * HOUR + 50 * MINUTE));
    expect(countdownText(start, now)).toBe("Om 3 dager · 11 timer · 50 minutter");
  });

  test("leaves out days when less than a day away", () => {
    const now = new Date(start.getTime() - (5 * HOUR + 3 * MINUTE));
    expect(countdownText(start, now)).toBe("Om 5 timer · 3 minutter");
  });

  test("shows only minutes under an hour", () => {
    const now = new Date(start.getTime() - 25 * MINUTE);
    expect(countdownText(start, now)).toBe("Om 25 minutter");
  });

  test("uses the singular for one minute", () => {
    const now = new Date(start.getTime() - 1 * MINUTE);
    expect(countdownText(start, now)).toBe("Om 1 minutt");
  });

  test("says Pågår nå from the start until two hours after", () => {
    expect(countdownText(start, start)).toBe("Pågår nå");
    expect(countdownText(start, new Date(start.getTime() + 30 * MINUTE))).toBe("Pågår nå");
  });

  test("returns nothing once the service is over", () => {
    expect(countdownText(start, new Date(start.getTime() + 2 * HOUR))).toBe("");
  });

  test("returns nothing for an invalid start time", () => {
    expect(countdownText(new Date("ikke-en-dato"), start)).toBe("");
  });
});
