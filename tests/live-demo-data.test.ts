import { describe, expect, test } from "vitest";
import { CMS_COLLECTIONS, COLLECTIONS } from "../src/data/collections";
import { initialGatherings } from "../src/data/mockData";
import { DEMO_CONTENT_WEEK, FULL_DEMO_COUNTS, getCustomMockDocuments, getMockDocuments, type MockDocument } from "../src/data/mockDocuments";
import type { Gathering } from "../src/types";
import { isWorshipService, upcomingPublicGatherings } from "../src/utils/gatherings";

// The demo content is shown all year, with its dates counted from today. These checks hold the
// content to that: it is written for one week (DEMO_CONTENT_WEEK), and names no season.

const DAY_MS = 24 * 60 * 60 * 1000;

// The start of a week in Norway (Monday at 00:00), at different times of the year
const WEEK_STARTS = [
  "2026-08-30T22:00:00Z", // the week the content is written for
  "2026-10-04T22:00:00Z",
  "2026-12-20T23:00:00Z", // winter time
  "2027-03-28T22:00:00Z", // the day after the clocks go forward
  "2027-07-04T22:00:00Z",
].map((moment) => Date.parse(moment));

const rowsOf = <T,>(documents: MockDocument[], collection: string): T[] =>
  documents.filter((d) => d.collection === collection).map((d) => d.data as T);

const weekdayAndClock = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", weekday: "long", hour: "2-digit", minute: "2-digit" });

const MOMENT = /^\d{4}-\d{2}-\d{2}T/;

/** Every moment in a document, with the name of the field it stands in. */
function momentsIn(value: unknown, field = ""): { field: string; moment: number }[] {
  if (typeof value === "string") return MOMENT.test(value) ? [{ field, moment: Date.parse(value) }] : [];
  if (Array.isArray(value)) return value.flatMap((item) => momentsIn(item, field));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => momentsIn(item, key));
  return [];
}

describe("Demoinnholdet følger kalenderen", () => {
  test("uka innholdet er skrevet for, begynner på en mandag", () => {
    expect(new Date(`${DEMO_CONTENT_WEEK}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  test("i uka det er skrevet for, står datoene som de er skrevet", () => {
    const gatherings = rowsOf<Gathering>(getMockDocuments(WEEK_STARTS[0]), COLLECTIONS.GATHERINGS);
    for (const gathering of gatherings) {
      const written = initialGatherings.find((g) => g.id === gathering.id)!;
      expect(Date.parse(gathering.startsAt)).toBe(Date.parse(written.startsAt));
    }
  });

  test.each(WEEK_STARTS)("hver samling beholder ukedag og klokkeslett (uka fra %i)", (weekStart) => {
    const gatherings = rowsOf<Gathering>(getMockDocuments(weekStart + 3 * DAY_MS), COLLECTIONS.GATHERINGS);
    expect(gatherings.length).toBe(initialGatherings.length);
    for (const gathering of gatherings) {
      const written = initialGatherings.find((g) => g.id === gathering.id)!;
      expect(weekdayAndClock.format(new Date(gathering.startsAt))).toBe(weekdayAndClock.format(new Date(written.startsAt)));
      expect(weekdayAndClock.format(new Date(gathering.endsAt!))).toBe(weekdayAndClock.format(new Date(written.endsAt!)));
    }
  });

  test.each(WEEK_STARTS)("det som er gjort, er datert før uka begynner (uka fra %i)", (weekStart) => {
    // Every day of the week gives the same content, so the first moment of the week is the strictest
    const documents = getCustomMockDocuments(FULL_DEMO_COUNTS, weekStart);
    const ahead = documents.flatMap((document) =>
      momentsIn(document.data)
        // When a gathering is held is the one moment that may lie ahead
        .filter(({ field }) => !(document.collection === COLLECTIONS.GATHERINGS && (field === "startsAt" || field === "endsAt")))
        .filter(({ moment }) => !(moment < weekStart))
        .map(({ field }) => `${document.collection}/${document.id}: ${field}`)
    );
    expect(ahead).toEqual([]);
  });

  test.each(WEEK_STARTS)("et oppmøtetall gjelder en samling som er holdt (uka fra %i)", (weekStart) => {
    const documents = getCustomMockDocuments(FULL_DEMO_COUNTS, weekStart);
    const gatherings = rowsOf<Gathering>(documents, COLLECTIONS.GATHERINGS);
    const counts = rowsOf<{ gatheringId: string }>(documents, COLLECTIONS.GATHERING_HEADCOUNTS);
    expect(counts.length).toBeGreaterThan(0);
    for (const count of counts) {
      const gathering = gatherings.find((g) => g.id === count.gatheringId)!;
      expect(Date.parse(gathering.endsAt ?? gathering.startsAt)).toBeLessThan(weekStart);
    }
  });

  test.each(WEEK_STARTS)("det er alltid en gudstjeneste åpen for alle innen en uke (uka fra %i)", (weekStart) => {
    const gatherings = rowsOf<Gathering>(getCustomMockDocuments(FULL_DEMO_COUNTS, weekStart), COLLECTIONS.GATHERINGS);
    // Asked on the first morning of the week and on its last evening
    for (const now of [weekStart + 8 * 60 * 60 * 1000, weekStart + 7 * DAY_MS - 60 * 60 * 1000]) {
      const next = upcomingPublicGatherings(gatherings, now).find(isWorshipService);
      expect(next).toBeDefined();
      expect(Date.parse(next!.startsAt) - now).toBeLessThan(7 * DAY_MS);
    }
  });

  test("samme uke gir samme innhold hver dag, og neste uke ligger alt sju dager senere", () => {
    const monday = getMockDocuments(WEEK_STARTS[1]);
    const sunday = getMockDocuments(WEEK_STARTS[1] + 7 * DAY_MS - 1);
    const nextWeek = getMockDocuments(WEEK_STARTS[1] + 7 * DAY_MS);
    expect(sunday).toEqual(monday);

    const start = (documents: MockDocument[]) => Date.parse(rowsOf<Gathering>(documents, COLLECTIONS.GATHERINGS)[0].startsAt);
    expect(start(nextWeek) - start(monday)).toBe(7 * DAY_MS);
  });

  test("innholdet nevner ingen årstid, høytid eller måned", () => {
    // It is shown in every week of the year
    const season =
      /høst|vinter|sommer|\bvår(en|semester|lig)|semester|advent|\bjul(en|aften|e[a-zæøå]*)?\b|nyttår|allehelgen|påske|pinse|\b(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\b/i;
    const named = getCustomMockDocuments(FULL_DEMO_COUNTS, WEEK_STARTS[0]).flatMap((document) => {
      // Web addresses are not text anyone reads
      const text = JSON.stringify(document.data).replace(/https?:\/\/[^"\s]+/g, "");
      const found = season.exec(text);
      return found ? [`${document.collection}/${document.id}: ${found[0]}`] : [];
    });
    expect(named).toEqual([]);
  });

  test("nettsiden har taler og nyheter som allerede er ute", () => {
    const documents = getCustomMockDocuments(FULL_DEMO_COUNTS, WEEK_STARTS[3]);
    const sermons = rowsOf<{ date: string }>(documents, CMS_COLLECTIONS.SERMONS);
    const news = rowsOf<{ publishedAt: string }>(documents, CMS_COLLECTIONS.NEWS);
    expect(sermons.length).toBeGreaterThan(0);
    expect(news.length).toBeGreaterThan(0);
    // The latest sermon is from the Sunday before the week begins
    const latest = Math.max(...sermons.map((s) => Date.parse(s.date)));
    expect(WEEK_STARTS[3] - latest).toBeLessThan(DAY_MS);
  });
});
