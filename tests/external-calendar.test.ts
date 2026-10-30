import { describe, expect, test } from "vitest";
import type { Gathering } from "../src/types";
import {
  diffCalendar,
  fixEredaktorDateStart,
  parseExternalCalendarFeed,
  proposeImport,
} from "../src/utils/externalCalendar";
import type { GatheringTemplate } from "../src/utils/gatheringTemplates";

const icsSample = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:uid-gud@example.org
DTSTART;VALUE=DATE:20260906T110000
SUMMARY:Gudstjeneste
LOCATION:Bedehuset
END:VEVENT
BEGIN:VEVENT
UID:uid-bonn@example.org
DTSTART:20260908T190000
SUMMARY:Bønnemøte
LOCATION:Bedehuset
END:VEVENT
END:VCALENDAR`;

const icsUtc = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:uid-gud-utc@example.org
DTSTART;VALUE=DATE:20260913T090000Z
SUMMARY:Gudstjeneste
END:VEVENT
BEGIN:VEVENT
UID:uid-gud-vinter@example.org
DTSTART;VALUE=DATE:20261108T100000Z
SUMMARY:Gudstjeneste
END:VEVENT
END:VCALENDAR`;

describe("externalCalendar", () => {
  test("fixEredaktorDateStart retter VALUE=DATE med klokkeslett", () => {
    const fixed = fixEredaktorDateStart(icsSample);
    expect(fixed).toMatch(/DTSTART:20260906T110000/);
    expect(fixed).not.toMatch(/DTSTART;VALUE=DATE:20260906T110000/);
  });

  test("parseExternalCalendarFeed leser hendelser", () => {
    const events = parseExternalCalendarFeed(icsSample);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("Gudstjeneste");
    expect(events[0].uid).toBe("uid-gud@example.org");
    expect(events[1].title).toBe("Bønnemøte");
  });

  test("UTC-tid blir Europe/Oslo", () => {
    const events = parseExternalCalendarFeed(icsUtc);
    expect(events[0].startsAt).toContain("2026-09-13");
    const start = new Date(events[0].startsAt);
    expect(start.getHours()).toBe(11);
    expect(events[1].startsAt).toContain("2026-11-08");
    expect(new Date(events[1].startsAt).getHours()).toBe(11);
  });

  test("proposeImport foreslår gudstjeneste-mal", () => {
    const events = parseExternalCalendarFeed(icsSample);
    const templates: GatheringTemplate[] = [
      {
        id: "tpl-gud",
        name: "Gudstjeneste",
        title: "Gudstjeneste",
        time: "11:00",
        isGudstjeneste: true,
        visibility: "offentlig",
        program: [],
        extraStaffing: [],
        durationMinutes: 90,
      },
    ];
    expect(proposeImport(events[0], templates).templateId).toBe("tpl-gud");
    expect(proposeImport(events[1], templates).templateId).toBe(null);
  });

  test("diffCalendar finner ny, oppdatert og borte", () => {
    const feed = parseExternalCalendarFeed(icsSample);
    const linked: Gathering = {
      id: "g1",
      groupId: "grp",
      title: "Gudstjeneste",
      startsAt: feed[0].startsAt,
      visibility: "offentlig",
      externalCalendarUid: feed[0].uid,
    };
    const goneLinked: Gathering = {
      id: "g2",
      groupId: "grp",
      title: "Gammel",
      startsAt: feed[1].startsAt,
      visibility: "offentlig",
      externalCalendarUid: "uid-forsvunnet@example.org",
    };
    const intern: Gathering = {
      id: "g3",
      groupId: "grp",
      title: "Bønnemøte",
      startsAt: feed[1].startsAt,
      visibility: "intern",
    };

    const diff = diffCalendar(feed, [linked, goneLinked, intern], [], []);
    expect(diff.newEvents.map((e) => e.uid)).toEqual(["uid-bonn@example.org"]);
    expect(diff.gone.map((g) => g.id)).toEqual(["g2"]);

    const changed = { ...linked, title: "Annen tittel" };
    const diff2 = diffCalendar(feed, [changed, goneLinked], [], []);
    expect(diff2.updated).toHaveLength(1);
    expect(diff2.updated[0].event.title).toBe("Gudstjeneste");
  });

  test("dismissed og kept", () => {
    const feed = parseExternalCalendarFeed(icsSample);
    expect(diffCalendar(feed, [], [feed[1].uid!], []).newEvents).toHaveLength(1);
    const linked: Gathering = {
      id: "g2",
      groupId: "grp",
      title: "Gammel",
      startsAt: feed[0].startsAt,
      visibility: "offentlig",
      externalCalendarUid: "uid-forsvunnet@example.org",
    };
    expect(diffCalendar([], [linked], [], [linked.externalCalendarUid!]).gone).toHaveLength(0);
  });
});
