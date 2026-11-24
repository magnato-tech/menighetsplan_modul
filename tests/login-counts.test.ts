import { describe, expect, test } from "vitest";
import {
  MIN_SIDE_COUNT_KEY,
  countMinSideOpening,
  formatLongDayLabel,
  summarizeLoginCounts,
  type MinimalStorage,
} from "../src/utils/loginCounts";
import {
  LOGIN_COUNTS,
  MIN_SIDE_OPENED,
  TRAFFIC_ACTIONS,
  emptyTrafficDay,
  summarizeTraffic,
  type TrafficDay,
  type TrafficSite,
} from "../src/utils/siteTraffic";

const day = (date: string, actions: Record<string, number> = {}, fill: Partial<TrafficDay> = {}): TrafficDay => ({
  ...emptyTrafficDay(date),
  actions,
  ...fill,
});

// A site with no pages, so only the counts decide what the board shows
const emptySite = { pages: [], news: [], media: [], settings: {}, gatherings: [], sermons: [] } as unknown as TrafficSite;
// Monday 23 November 2026 at noon in Norway
const now = new Date("2026-11-23T11:00:00.000Z");

/** A fake storage in the browser's style: a value per key, and throws when told to. */
function fakeStorage(options: { throwOnRead?: boolean; throwOnWrite?: boolean } = {}): MinimalStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key) {
      if (options.throwOnRead) throw new DOMException("blocked", "SecurityError");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.throwOnWrite) throw new DOMException("full", "QuotaExceededError");
      values.set(key, value);
    },
  };
}

describe("Innlogginger per dag: summene", () => {
  test("legger sammen de tre måtene å logge inn på, og Min side hver for seg", () => {
    const summary = summarizeLoginCounts(
      [
        day("2026-11-20", { "innlogging-google": 2, "innlogging-epostlenke": 1, [MIN_SIDE_OPENED]: 4 }),
        day("2026-11-22", { "innlogging-lenke": 3, "innlogging-google": 1 }),
      ],
      "2026-11-20",
      "2026-11-22"
    );

    expect(summary.signIns).toBe(7);
    expect(summary.byKind).toEqual({ "innlogging-google": 3, "innlogging-epostlenke": 1, "innlogging-lenke": 3 });
    expect(summary.minSide).toBe(4);
    expect(summary.days.map((item) => item.signIns)).toEqual([3, 0, 4]);
  });

  test("gir null for hver dag som ikke har noe dokument, og teller ikke dager utenfor perioden", () => {
    const summary = summarizeLoginCounts(
      [day("2026-11-10", { "innlogging-google": 9 }), day("2026-11-24", { "innlogging-google": 2 })],
      "2026-11-22",
      "2026-11-24"
    );

    expect(summary.days.map((item) => item.date)).toEqual(["2026-11-22", "2026-11-23", "2026-11-24"]);
    expect(summary.days.map((item) => item.minSide)).toEqual([0, 0, 0]);
    expect(summary.signIns).toBe(2);
  });

  test("første dag med noen av tellingene, og null når ingenting er telt", () => {
    const later = summarizeLoginCounts([day("2026-11-23", {}, { visits: 5 }), day("2026-11-24", { [MIN_SIDE_OPENED]: 1 })], "2026-11-22", "2026-11-24");
    expect(later.countingSince).toBe("2026-11-24");

    const none = summarizeLoginCounts([day("2026-11-23", {}, { visits: 5 })], "2026-11-22", "2026-11-24");
    expect(none.countingSince).toBeNull();
    expect(none.signIns + none.minSide).toBe(0);
  });

  test("dato for visning, med norsk måned", () => {
    expect(formatLongDayLabel("2026-11-24")).toBe("24. nov.");
    expect(formatLongDayLabel("2026-07-01")).toBe("1. juli");
  });
});

describe("Innloggingstellingene og Nettsidebesøk", () => {
  test("en dag med bare innloggingstellinger er ingen dag med besøk på nettsiden", () => {
    const board = summarizeTraffic([day("2026-11-23", { "innlogging-google": 3, [MIN_SIDE_OPENED]: 2 })], emptySite, "7d", now);

    expect(board.hasCounts).toBe(false);
    expect(board.daysWithCounts).toBe(0);
    expect(board.countingSince).toBeNull();
    expect(board.actions.every((action) => action.count === 0)).toBe(true);
  });

  test("innloggingsnøklene står ikke blant nettsidens handlinger", () => {
    const actionIds: string[] = TRAFFIC_ACTIONS.map((action) => action.id);
    const loginIds: string[] = [...LOGIN_COUNTS.map((kind) => kind.id), MIN_SIDE_OPENED];
    expect(actionIds.filter((id) => loginIds.includes(id))).toEqual([]);

    const board = summarizeTraffic([day("2026-11-23", { "kontakt-epost": 1, "innlogging-google": 5 })], emptySite, "7d", now);
    expect(board.actions.map((action) => action.id)).toEqual(TRAFFIC_ACTIONS.map((action) => action.id));
    expect(board.actions.find((action) => action.id === "kontakt-epost")?.count).toBe(1);
  });
});

describe("Min side telles høyst én gang per nettleser per dag", () => {
  test("første åpning i dag telles, og en til samme dag gjør det ikke", () => {
    const storage = fakeStorage();
    expect(countMinSideOpening(storage, "2026-11-24")).toBe(true);
    expect(storage.values.get(MIN_SIDE_COUNT_KEY)).toBe("2026-11-24");
    expect(countMinSideOpening(storage, "2026-11-24")).toBe(false);
  });

  test("en ny dag telles igjen", () => {
    const storage = fakeStorage();
    countMinSideOpening(storage, "2026-11-24");
    expect(countMinSideOpening(storage, "2026-11-25")).toBe(true);
    expect(storage.values.get(MIN_SIDE_COUNT_KEY)).toBe("2026-11-25");
  });

  test("lesing som kaster feil: ingenting telles, og ingen feil slipper ut", () => {
    expect(countMinSideOpening(fakeStorage({ throwOnRead: true }), "2026-11-24")).toBe(false);
  });

  test("skriving som kaster feil: ingenting telles, for ellers telles hver åpning", () => {
    expect(countMinSideOpening(fakeStorage({ throwOnWrite: true }), "2026-11-24")).toBe(false);
  });

  test("uten lagring i det hele tatt telles ingenting", () => {
    expect(countMinSideOpening(null, "2026-11-24")).toBe(false);
  });
});
