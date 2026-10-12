import { describe, vi } from "vitest";
import { assert } from "./assert";
import { toIcalendarFromGatherings } from "../src/utils/calendarFeed";
import type { ActionResult } from "../src/context/FirebaseDataContext";
import { ensurePersonalCalendarFeedToken } from "../src/services/personalCalendarFeed";
import {
  googleCalendarSubscribeUrl,
  personalCalendarFeedSearchParams,
  personalCalendarFeedUrl,
  personalCalendarGatheringsForFeed,
  PERSONAL_CALENDAR_FEED_PATH,
} from "../src/utils/personalCalendar";
import type { Gathering, Group, Person } from "../src/types";

describe("Personlig kalenderabonnement", () => {
  assert(
    personalCalendarFeedSearchParams("abc-token", null, false) === "token=abc-token",
    "Produksjon: bare token i spørringen"
  );

  assert(
    personalCalendarFeedSearchParams("abc-token", "sogne", true) === "token=abc-token&menighet=sogne",
    "Demo: menighet legges til i spørringen"
  );

  assert(
    personalCalendarFeedSearchParams("abc-token", null, true) === "token=abc-token&menighet=eksempel",
    "Demo uten valgt menighet: standard eksempel"
  );

  const feedUrl = personalCalendarFeedUrl("https://menighet.no///", "tok-1", "sogne", true);
  assert(
    feedUrl === `https://menighet.no${PERSONAL_CALENDAR_FEED_PATH}?token=tok-1&menighet=sogne`,
    "Feed-URL fjerner trailing slash og bygger riktig sti"
  );

  const google = googleCalendarSubscribeUrl(feedUrl);
  assert(google.startsWith("https://calendar.google.com/calendar/render?cid="), "Google-abonnement peker på Google Calendar");
  assert(google.includes(encodeURIComponent(feedUrl)), "Google-lenken koder hele iCal-adressen");

  const now = new Date("2026-10-02T12:00:00.000Z");
  const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const tjenesteGroup: Group = {
    id: "tjeneste-1",
    name: "Lyd og bilde",
    category: "tjenestegruppe",
    memberIds: ["p1"],
    leaderIds: [],
  };

  const internGathering: Gathering = {
    id: "gruppe-mote",
    groupId: "tjeneste-1",
    title: "Tjenestemøte",
    startsAt: inDays(3),
    visibility: "intern",
    type: "gruppesamling",
  };

  const avlyst: Gathering = {
    ...internGathering,
    id: "avlyst-mote",
    title: "Avlyst møte",
    cancelled: true,
  };

  const selected = personalCalendarGatheringsForFeed([internGathering, avlyst], [tjenesteGroup], now, () => undefined);
  assert(selected.map((g) => g.id).join() === "gruppe-mote,avlyst-mote", "Personlig utvalg tar med interne gruppesamlinger");

  const ics = toIcalendarFromGatherings(selected, { calendarName: "Min kalender", now });
  assert(ics.includes("BEGIN:VCALENDAR"), "Personlig iCal er gyldig VCALENDAR");
  assert(ics.includes("SUMMARY:Tjenestemøte"), "Intern samling kommer med i personlig feed");
  assert(ics.includes("STATUS:CANCELLED"), "Avlyst samling merkes CANCELLED");
  assert(ics.includes("X-WR-CALNAME:Min kalender"), "Kalendernavn for abonnementet");
  assert(!ics.includes("email") && !ics.includes("phone"), "Ingen personkontakt i personlig iCal");

  const person: Person = { id: "p1", name: "Ola", globalRole: "member" };
  const updatePerson = vi.fn((_personId: string, _updates: Partial<Person>): ActionResult => ({ success: true }));

  const created = ensurePersonalCalendarFeedToken(person, updatePerson);
  assert(created.success === true && created.token.startsWith("kal-"), "Ny token opprettes med kal-prefiks");
  const savedToken = created.success ? created.token : "";
  const saveCall = updatePerson.mock.calls[0];
  assert(
    updatePerson.mock.calls.length === 1 &&
      saveCall?.[0] === "p1" &&
      saveCall[1].calendarFeedToken === savedToken,
    "Token lagres på personen"
  );

  const existing = ensurePersonalCalendarFeedToken(
    { ...person, calendarFeedToken: "kal-eksisterende" },
    updatePerson
  );
  assert(existing.success === true && existing.token === "kal-eksisterende", "Eksisterende token gjenbrukes");
  assert(updatePerson.mock.calls.length === 1, "Ingen ny lagring når token finnes");

  const failUpdate = vi.fn(() => ({ success: false, error: "Nettverksfeil" }));
  const failed = ensurePersonalCalendarFeedToken({ id: "p2", name: "Kari", globalRole: "member" }, failUpdate);
  assert(failed.success === false && failed.error === "Nettverksfeil", "Skrivefeil returneres til brukeren");
});
