import { describe } from "vitest";
import { assert } from "./assert";
import {
  gatheringsForCalendarFeed,
  googleCalendarSubscribeUrl,
  publicCalendarFeedSearchParams,
  publicCalendarFeedUrl,
  PUBLIC_CALENDAR_FEED_PATH,
  toIcalendar,
} from "../src/utils/calendarFeed";
import type { Gathering } from "../src/types";

describe("Offentlig iCal-feed", () => {
  const now = new Date("2026-10-02T12:00:00.000Z");
  const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const base: Gathering = {
    id: "evt-1",
    groupId: "group-1",
    title: "Søndagsgudstjeneste",
    startsAt: inDays(7),
    visibility: "offentlig",
    type: "arrangement",
  };

  const docs: Gathering[] = [
    base,
    {
      ...base,
      id: "intern",
      visibility: "intern",
      title: "Intern planlegging",
    },
    {
      ...base,
      id: "husgruppe",
      type: "gruppesamling",
      visibility: "offentlig",
      title: "Husfellesskap Sentrum",
    },
    {
      ...base,
      id: "avlyst",
      cancelled: true,
      title: "Avlyst konsert",
    },
    {
      ...base,
      id: "for-gammel",
      startsAt: inDays(-60),
      title: "For gammel",
    },
    {
      ...base,
      id: "langt-fram",
      startsAt: inDays(400),
      title: "Langt fram",
    },
  ];

  const selected = gatheringsForCalendarFeed(docs, now);
  assert(
    selected.map((g) => g.id).join() === "evt-1,avlyst",
    "Feeden tar med åpne arrangementer i vinduet, ikke interne, gruppesamlinger eller for gamle/nye"
  );

  const ics = toIcalendar(docs, { calendarName: "Testkirken", now });
  assert(ics.includes("BEGIN:VCALENDAR"), "iCal starter med VCALENDAR");
  assert(ics.includes("UID:evt-1@menighetsplan"), "Stabil UID fra samlingens id");
  assert(ics.includes("SUMMARY:Søndagsgudstjeneste"), "Tittel i SUMMARY");
  assert(ics.includes("STATUS:CANCELLED"), "Avlyst samling merkes CANCELLED");
  assert(!ics.includes("husgruppe"), "Gruppesamling kommer ikke med i feeden");
  assert(!ics.includes("Intern planlegging"), "Intern samling kommer ikke med");
  assert(!ics.includes("phone") && !ics.includes("email"), "Ingen personkontakt i feeden");
  assert(ics.includes("X-WR-CALNAME:Testkirken"), "Kalendernavn fra innstillinger");

  assert(publicCalendarFeedSearchParams(null, false) === "", "Offentlig feed uten demo: ingen spørring");
  assert(
    publicCalendarFeedSearchParams("sogne", true) === "menighet=sogne",
    "Offentlig feed i demo: menighet i spørringen"
  );
  assert(
    publicCalendarFeedUrl("https://menighet.no/", "sogne", true) ===
      `https://menighet.no${PUBLIC_CALENDAR_FEED_PATH}?menighet=sogne`,
    "Offentlig abonnements-URL for nettsiden"
  );
  const publicUrl = publicCalendarFeedUrl("https://menighet.no", null, false);
  assert(googleCalendarSubscribeUrl(publicUrl).includes(encodeURIComponent(publicUrl)), "Google-abonnement for hovedkalenderen");
});
