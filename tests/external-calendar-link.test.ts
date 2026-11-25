import { describe, expect, test } from "vitest";
import type { Gathering } from "../src/types";
import {
  bestLink,
  diffCalendar,
  dismissedFeedRows,
  linkCandidates,
  linkedFeedRows,
  parseExternalCalendarFeed,
  type ExternalCalendarEvent,
} from "../src/utils/externalCalendar";
import { calendarNoteKey, parseSurfaces, calendarNoteFor } from "../src/utils/surfaces";
import { SURFACES_RECORD } from "../src/data/settingsRecords";

// A Sunday in November, and the same day the week after.
const sunday = new Date(2026, 10, 8, 11, 0).toISOString();
const nextSunday = new Date(2026, 10, 15, 11, 0).toISOString();

function feedEvent(overrides: Partial<ExternalCalendarEvent> = {}): ExternalCalendarEvent {
  return {
    uid: "uid-gud@example.org",
    title: "Gudstjeneste",
    startsAt: sunday,
    location: "",
    description: "",
    cancelled: false,
    ...overrides,
  };
}

function planned(overrides: Partial<Gathering> & { id: string }): Gathering {
  return {
    groupId: "grp",
    title: "Gudstjeneste",
    startsAt: sunday,
    visibility: "offentlig",
    ...overrides,
  } as Gathering;
}

describe("Forslag til kobling", () => {
  test("bare arrangementer samme dag kommer med", () => {
    const sameDay = planned({ id: "same", startsAt: new Date(2026, 10, 8, 18, 0).toISOString() });
    const otherDay = planned({ id: "other", startsAt: nextSunday });
    expect(linkCandidates(feedEvent(), [sameDay, otherDay]).map((g) => g.id)).toEqual(["same"]);
  });

  test("allerede koblede, gruppemøter og avlyste arrangementer kommer ikke med", () => {
    const linked = planned({ id: "linked", externalCalendarUid: "annen-uid" });
    const group = planned({ id: "group", type: "gruppesamling" });
    const cancelled = planned({ id: "cancelled", cancelled: true });
    const ok = planned({ id: "ok" });
    expect(linkCandidates(feedEvent(), [linked, group, cancelled, ok]).map((g) => g.id)).toEqual(["ok"]);
  });

  test("samme tittel (uten forskjell på store og små bokstaver) kommer først", () => {
    const other = planned({ id: "other", title: "Bønnemøte", startsAt: new Date(2026, 10, 8, 9, 0).toISOString() });
    const exact = planned({ id: "exact", title: "gudstjeneste", startsAt: new Date(2026, 10, 8, 16, 0).toISOString() });
    expect(linkCandidates(feedEvent(), [other, exact]).map((g) => g.id)).toEqual(["exact", "other"]);
  });

  test("ett kandidat er det som velges", () => {
    const only = planned({ id: "only", title: "Kaffe" });
    expect(bestLink(feedEvent(), [only])?.id).toBe("only");
  });

  test("to like gode kandidater gir ingen automatisk kobling", () => {
    const first = planned({ id: "first", startsAt: new Date(2026, 10, 8, 11, 0).toISOString() });
    const second = planned({ id: "second", startsAt: new Date(2026, 10, 8, 12, 0).toISOString() });
    expect(bestLink(feedEvent(), [first, second])).toBeNull();
  });

  test("eksakt tittel vinner når en annen kandidat bare har hovedordet", () => {
    const exact = planned({ id: "exact", title: "Gudstjeneste" });
    const withBaptism = planned({ id: "baptism", title: "Gudstjeneste med dåp", startsAt: new Date(2026, 10, 8, 14, 0).toISOString() });
    expect(bestLink(feedEvent(), [withBaptism, exact])?.id).toBe("exact");
  });

  test("ingen kandidat som ligner, gir ingen kobling", () => {
    const first = planned({ id: "a", title: "Kaffe" });
    const second = planned({ id: "b", title: "Bønnemøte" });
    expect(bestLink(feedEvent(), [first, second])).toBeNull();
  });
});

describe("Kobling og diff", () => {
  test("etter kobling er hendelsen ikke ny, og en tidsendring fra Google kommer i oppdatert", () => {
    const feed = [feedEvent()];
    const before = planned({ id: "g1" });
    expect(diffCalendar(feed, [before], [], []).newEvents).toHaveLength(1);

    const linked = { ...before, externalCalendarUid: "uid-gud@example.org" };
    expect(diffCalendar(feed, [linked], [], []).newEvents).toHaveLength(0);

    const moved = [feedEvent({ startsAt: new Date(2026, 10, 8, 12, 0).toISOString() })];
    const diff = diffCalendar(moved, [linked], [], []);
    expect(diff.newEvents).toHaveLength(0);
    expect(diff.updated.map((row) => row.gathering.id)).toEqual(["g1"]);
  });

  test("linkedFeedRows finner de koblede hendelsene", () => {
    const feed = [feedEvent(), feedEvent({ uid: "uid-annen@example.org", title: "Bønnemøte" })];
    const gatherings = [planned({ id: "g1", externalCalendarUid: "uid-gud@example.org" })];
    const rows = linkedFeedRows(feed, gatherings);
    expect(rows.map((row) => [row.event.uid, row.gathering.id])).toEqual([["uid-gud@example.org", "g1"]]);
  });
});

describe("Avviste og slettede hendelser", () => {
  test("en avvist hendelse i feeden og en slettet som er borte fra feeden vises", () => {
    const feed = [feedEvent()];
    const notes = { "uid-slettet@example.org": { reason: "slettet" as const, at: sunday, title: "Kaffe", startsAt: sunday } };
    const rows = dismissedFeedRows(feed, ["uid-gud@example.org", "uid-slettet@example.org", "uid-gammel@example.org"], (uid) =>
      notes[uid as keyof typeof notes]
    );
    expect(rows.map((row) => row.uid)).toEqual(["uid-gud@example.org", "uid-slettet@example.org"]);
    expect(rows[1].note?.reason).toBe("slettet");
  });

  test("nøkkelen for en notat har ingen punktum eller «@»", () => {
    const key = calendarNoteKey("uid-1.2@example.org");
    expect(key).not.toMatch(/[.@]/);
    expect(key).toBe("uid-1%2E2%40example%2Eorg");
  });

  test("parseSurfaces leser notatene, og hopper over ugyldige", () => {
    const key = calendarNoteKey("uid-1@example.org");
    const parsed = parseSurfaces({
      recordType: SURFACES_RECORD,
      dismissedUids: ["uid-1@example.org"],
      calendarNotes: {
        [key]: { reason: "slettet", at: sunday, title: "Gudstjeneste", startsAt: sunday },
        ugyldig: { reason: "ukjent", at: sunday },
      },
    });
    expect(Object.keys(parsed.calendarNotes ?? {})).toEqual([key]);
    expect(calendarNoteFor(parsed, "uid-1@example.org")?.title).toBe("Gudstjeneste");
  });
});

describe("Feeden", () => {
  test("parseExternalCalendarFeed gir uid for hver hendelse", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20261108T110000
SUMMARY:Gudstjeneste
END:VEVENT
END:VCALENDAR`;
    expect(parseExternalCalendarFeed(ics)[0].uid).toBe("");
  });
});
