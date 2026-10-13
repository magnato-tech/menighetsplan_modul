import { describe, expect, test } from "vitest";
import {
  MEETING_PLAN_LIMIT,
  asksForAnswerNow,
  daysTaken,
  hostsInTurn,
  lastDayOfSeason,
  meetingDays,
  nextGatheringOf,
  repeatOfSchedule,
  suggestedFirstDay,
} from "../src/utils/meetingPlan";

// A group leader's plan for the gatherings of a group through a season.

describe("Hvor ofte gruppen møtes", () => {
  test("den faste møtetiden til gruppen gir forslaget", () => {
    expect(repeatOfSchedule({ frequency: "hver uke" })).toBe("weekly");
    expect(repeatOfSchedule({ frequency: "annenhver uke" })).toBe("every2");
    expect(repeatOfSchedule({ frequency: "hver måned" })).toBe("monthly");
  });

  test("uten fast møtetid planlegges én samling", () => {
    expect(repeatOfSchedule(undefined)).toBe("once");
  });
});

describe("Første og siste dag i en plan", () => {
  test("første dag er neste gang ukedagen til gruppen kommer, og aldri i dag", () => {
    // The 13th of October 2026 is a Tuesday
    expect(suggestedFirstDay("2026-10-13", { weekday: "Torsdag" })).toBe("2026-10-15");
    expect(suggestedFirstDay("2026-10-13", { weekday: "mandag" })).toBe("2026-10-19");
    expect(suggestedFirstDay("2026-10-13", { weekday: "Tirsdag" })).toBe("2026-10-20");
  });

  test("uten fast ukedag er første dag om en uke", () => {
    expect(suggestedFirstDay("2026-10-13")).toBe("2026-10-20");
    expect(suggestedFirstDay("2026-10-13", { weekday: "en dag" })).toBe("2026-10-20");
  });

  test("siste dag er slutten av semesteret planen begynner i", () => {
    expect(lastDayOfSeason("2026-10-15")).toBe("2026-12-20");
    expect(lastDayOfSeason("2027-01-14")).toBe("2027-06-30");
    expect(lastDayOfSeason("2026-06-30")).toBe("2026-06-30");
    expect(lastDayOfSeason("2026-07-01")).toBe("2026-12-20");
    // In the days between the autumn and the new year, the plan is for the spring
    expect(lastDayOfSeason("2026-12-28")).toBe("2027-06-30");
  });
});

describe("Dagene i en plan", () => {
  test("én samling har den ene dagen", () => {
    expect(meetingDays("2026-10-15", "2026-12-20", "once")).toEqual(["2026-10-15"]);
  });

  test("annenhver uke gir samme ukedag fram til og med siste dag", () => {
    expect(meetingDays("2026-10-15", "2026-12-20", "every2")).toEqual(["2026-10-15", "2026-10-29", "2026-11-12", "2026-11-26", "2026-12-10"]);
  });

  test("hver uke og én gang i måneden", () => {
    expect(meetingDays("2026-10-15", "2026-11-05", "weekly")).toEqual(["2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05"]);
    // The third Thursday of the month
    expect(meetingDays("2026-10-15", "2026-12-20", "monthly")).toEqual(["2026-10-15", "2026-11-19", "2026-12-17"]);
  });

  test("en plan blir aldri lengre enn grensen", () => {
    expect(meetingDays("2026-10-15", "2028-10-15", "weekly")).toHaveLength(MEETING_PLAN_LIMIT);
  });

  test("uten en gyldig første dag er det ingen dager", () => {
    expect(meetingDays("", "2026-12-20", "weekly")).toEqual([]);
    expect(meetingDays("2026-12-21", "2026-12-20", "weekly")).toEqual([]);
  });
});

describe("Verter på omgang", () => {
  test("deltakerne tar hver sin gang, og begynner på nytt når alle har hatt det", () => {
    expect(hostsInTurn(5, ["anne", "bjørn", "cecilie"])).toEqual(["anne", "bjørn", "cecilie", "anne", "bjørn"]);
  });

  test("den som er valgt som vert, har den første", () => {
    expect(hostsInTurn(4, ["anne", "bjørn", "cecilie"], "bjørn")).toEqual(["bjørn", "cecilie", "anne", "bjørn"]);
    expect(hostsInTurn(2, ["anne", "bjørn"], "ukjent")).toEqual(["anne", "bjørn"]);
  });

  test("uten deltakere er det ingen verter", () => {
    expect(hostsInTurn(3, [])).toEqual([]);
    expect(hostsInTurn(0, ["anne"])).toEqual([]);
  });
});

describe("Dager der gruppen alt har en samling", () => {
  test("dagen regnes slik kalenderen i Norge viser den", () => {
    const held = [
      // Thursday the 29th of October at 19:30 in Norway
      { startsAt: "2026-10-29T18:30:00.000Z" },
      // Half past midnight on the 13th of November in Norway: the 12th by the clock in London
      { startsAt: "2026-11-12T23:30:00.000Z" },
    ];
    expect(daysTaken(["2026-10-15", "2026-10-29", "2026-11-12", "2026-11-13"], held)).toEqual(["2026-10-29", "2026-11-13"]);
  });
});

describe("Når deltakerne spørres om de kommer", () => {
  const now = Date.parse("2026-10-13T12:00:00.000Z");
  const inDays = (days: number) => new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

  const plan = [
    { id: "forrige", startsAt: inDays(-12), seriesId: "serie-1" },
    { id: "avlyst", startsAt: inDays(2), seriesId: "serie-1", cancelled: true },
    { id: "neste", startsAt: inDays(16), seriesId: "serie-1" },
    { id: "senere", startsAt: inDays(30), seriesId: "serie-1" },
  ];

  test("den neste samlingen er den første som ligger fram i tid og ikke er avlyst", () => {
    expect(nextGatheringOf(plan, now)?.id).toBe("neste");
    expect(nextGatheringOf([plan[0]], now)).toBeUndefined();
    expect(nextGatheringOf([], now)).toBeUndefined();
  });

  test("en samling planlagt for seg selv spør med en gang, hvor langt fram den enn ligger", () => {
    expect(asksForAnswerNow({ id: "enkelt" }, nextGatheringOf(plan, now))).toBe(true);
  });

  test("en samling i en plan spør bare når den er gruppens neste", () => {
    const next = nextGatheringOf(plan, now);
    expect(asksForAnswerNow(plan[2], next)).toBe(true);
    expect(asksForAnswerNow(plan[3], next)).toBe(false);
    expect(asksForAnswerNow(plan[3], undefined)).toBe(false);
  });
});
