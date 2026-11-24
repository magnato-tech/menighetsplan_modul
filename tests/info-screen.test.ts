import { describe } from "vitest";
import { assert } from "./assert";
import {
  infoScreenBoard,
  osloClock,
  osloDayMonth,
  osloDayOfMonth,
  osloLongDate,
  osloTime,
  osloWeekdayShort,
  startTimeOf,
  todayHeadline,
} from "../src/utils/infoScreen";
import { INFO_SCREEN_PATH, isInfoScreenPath, isPublicPath } from "../src/utils/routes";
import type { Gathering } from "../src/types";

// The info screen in the church foyer: which events it shows today, this week and later.
// Sunday 29 November 2026, 10:42 in Norway (winter time, UTC+1).

const now = Date.parse("2026-11-29T09:42:00Z");
const oslo = (local: string) => `${local}:00+01:00`;
const gathering = (id: string, startsAt: string, extra: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "group-1",
  title: id,
  startsAt,
  visibility: "offentlig",
  ...extra,
});
const ids = (list: Gathering[]) => list.map((g) => g.id).join(",");

describe("Infoskjermen: hva som vises", () => {
  const sunday = [
    gathering("kveld", oslo("2026-11-29T22:00")),
    gathering("tidlig-uten-slutt", oslo("2026-11-29T08:00")),
    gathering("ferdig", oslo("2026-11-29T07:00"), { endsAt: oslo("2026-11-29T09:00") }),
    gathering("helg-pagar", oslo("2026-11-28T18:00"), { endsAt: oslo("2026-11-29T14:00") }),
    gathering("helg-ferdig", oslo("2026-11-28T10:00"), { endsAt: oslo("2026-11-28T20:00") }),
  ];
  const board = infoScreenBoard(sunday, now);

  assert(
    ids(board.today) === "helg-pagar,tidlig-uten-slutt,kveld",
    "I dag: det som ikke er over, sortert etter start; en uten sluttid varer fire timer; en flerdagers som pågår fra før er med"
  );
  assert(!board.today.some((g) => g.id === "ferdig"), "I dag: noe som er over før nå, står ikke der");
  assert(!board.today.some((g) => g.id === "helg-ferdig"), "I dag: en flerdagers som er over fra før, står ikke der");

  const boundaries = [
    gathering("i-dag", oslo("2026-11-29T23:30")),
    gathering("midnatt-i-morgen", oslo("2026-11-30T00:30")),
    gathering("dag-6", oslo("2026-12-05T12:00")),
    gathering("dag-7", oslo("2026-12-06T12:00")),
    gathering("i-gaar-sen", oslo("2026-11-28T23:30")),
  ];
  const edges = infoScreenBoard(boundaries, now);
  assert(ids(edges.today) === "i-dag", "Klokka 23.30 søndag er i dag, og klokka 00.30 mandag er neste dag (norsk dato, ikke millisekunder)");
  assert(ids(edges.week) === "midnatt-i-morgen,dag-6", "Uke: dag 1 til 6 fram i tid, dag 6 er med");
  assert(ids(edges.upcoming) === "dag-7", "Kommende: fra dag 7 og fram");
  assert(!edges.today.some((g) => g.id === "i-gaar-sen"), "En hendelse fra i går uten sluttid er ikke i dag");

  const hidden = infoScreenBoard(
    [
      gathering("intern", oslo("2026-11-29T18:00"), { visibility: "intern" }),
      gathering("gruppemote", oslo("2026-11-30T18:00"), { type: "gruppesamling" }),
      gathering("gruppemote-kommende", oslo("2026-12-10T18:00"), { type: "gruppesamling" }),
      gathering("intern-kommende", oslo("2026-12-10T18:00"), { visibility: "intern" }),
    ],
    now
  );
  assert(
    hidden.today.length === 0 && hidden.week.length === 0 && hidden.upcoming.length === 0,
    "Interne samlinger og gruppesamlinger er ikke med på skjermen"
  );

  const cancelled = infoScreenBoard(
    [gathering("avlyst-i-dag", oslo("2026-11-29T18:00"), { cancelled: true }), gathering("avlyst-uke", oslo("2026-12-01T18:00"), { cancelled: true })],
    now
  );
  assert(ids(cancelled.today) === "avlyst-i-dag" && ids(cancelled.week) === "avlyst-uke", "Avlyste samlinger blir stående, så siden kan streke dem over");

  const busyWeek = infoScreenBoard(
    ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"].map((day, index) =>
      gathering(`uke-${index + 1}`, oslo(`${day}T18:00`))
    ),
    now
  );
  assert(busyWeek.week.length === 5 && busyWeek.week[0].id === "uke-1" && busyWeek.week[4].id === "uke-5", "Uke: høyst fem, de nærmeste først");

  const featuredLater = infoScreenBoard(
    [
      gathering("kommende-1", oslo("2026-12-07T18:00")),
      gathering("kommende-2", oslo("2026-12-08T18:00")),
      gathering("kommende-3", oslo("2026-12-09T18:00")),
      gathering("kommende-4", oslo("2026-12-10T18:00")),
      gathering("kommende-5", oslo("2026-12-11T18:00")),
      gathering("fremhevet-senere", oslo("2026-12-20T18:00"), { visibility: "fremhevet" }),
    ],
    now
  );
  assert(
    ids(featuredLater.upcoming) === "kommende-1,kommende-2,kommende-3,fremhevet-senere",
    "Kommende: fremhevede tas først selv om de er lenger fram, og resten fyller opp til fire, sortert etter start"
  );
});

describe("Infoskjermen: hovedsaken i dag", () => {
  const konsert = gathering("konsert", oslo("2026-11-29T13:00"));
  const gudstjeneste = gathering("Gudstjeneste", oslo("2026-11-29T11:00"));
  const avlystGudstjeneste = gathering("Gudstjeneste avlyst", oslo("2026-11-29T09:00"), { cancelled: true });

  assert(
    todayHeadline([konsert, gudstjeneste]).headline?.id === "Gudstjeneste",
    "Hovedsaken i dag er gudstjenesten, også når den ikke er først"
  );
  assert(
    ids(todayHeadline([konsert, gudstjeneste]).rest) === "konsert",
    "Resten av dagen står i rekkefølge etter hovedsaken"
  );
  const skipped = todayHeadline([avlystGudstjeneste, konsert, gudstjeneste]);
  assert(skipped.headline?.id === "Gudstjeneste" && ids(skipped.rest) === "Gudstjeneste avlyst,konsert", "En avlyst gudstjeneste blir ikke hovedsaken");
  assert(todayHeadline([avlystGudstjeneste, konsert]).headline?.id === "konsert", "Uten gudstjeneste er den første ikke-avlyste hovedsaken");
  assert(todayHeadline([avlystGudstjeneste]).headline === null, "Bare avlyste i dag gir ingen hovedsak");
  assert(todayHeadline([]).headline === null && todayHeadline([]).rest.length === 0, "Ingenting i dag gir ingen hovedsak og ingen rest");
});

describe("Infoskjermen: tekst og klokkeslett i Norge", () => {
  const sunday = Date.parse("2026-11-29T09:42:00Z");
  assert(osloClock(sunday) === "10:42", "Klokka vises som norsk tid om vinteren");
  assert(osloClock(Date.parse("2026-07-01T20:05:00Z")) === "22:05", "Klokka vises som norsk tid om sommeren");
  assert(osloLongDate(sunday) === "søndag 29. november", "Datoen vises med ukedag og måned på norsk");

  assert(osloTime(oslo("2026-12-24T14:00")) === "14.00", "Klokkeslett med punktum, vintertid");
  assert(osloTime("2026-07-05T09:00:00Z") === "11.00", "Klokkeslett i sommertid: 09.00 UTC er 11.00 i Norge");
  assert(osloTime(oslo("2026-11-29T19:00")) === "19.00", "Klokkeslett med to siffer før punktum");

  const weekdays = ["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"].map((day) =>
    osloWeekdayShort(`${day}T12:00:00+01:00`)
  );
  assert(weekdays.join(",") === "SØN,MAN,TIR,ONS,TOR,FRE,LØR", "Ukedag i store bokstaver, fra søndag til lørdag");
  assert(osloWeekdayShort(oslo("2026-11-30T00:30")) === "MAN", "Ukedagen følger den norske datoen, også like etter midnatt");
  assert(osloDayOfMonth(oslo("2026-12-02T10:00")) === "2", "Dagen i måneden uten null foran");
  assert(osloDayOfMonth(oslo("2026-12-30T10:00")) === "30", "Dagen i måneden med to siffer");
  assert(osloDayMonth(oslo("2026-12-13T18:00")) === "13. desember", "Dag og måned på norsk");
});

describe("Infoskjermen: adressen", () => {
  assert(isInfoScreenPath("/skjerm") && isInfoScreenPath("/skjerm/"), "/skjerm er infoskjermen");
  assert(INFO_SCREEN_PATH === "/skjerm", "Adressen til infoskjermen er /skjerm");
  assert(!isInfoScreenPath("/skjermer-og-lys"), "En adresse som bare begynner likt, er ikke infoskjermen");
  assert(!isPublicPath("/skjerm"), "Infoskjermen er ikke en side på nettstedet, og besøk telles ikke");
  assert(isPublicPath("/skjermer-og-lys"), "En vanlig side som begynner likt, er fortsatt en side på nettstedet");
});

describe("Klokkeslett på skjermen", () => {
  assert(startTimeOf("2026-12-09T23:00:00.000Z") === null, "et arrangement fra midnatt om vinteren har ikke noe klokkeslett");
  assert(startTimeOf("2026-07-09T22:00:00.000Z") === null, "et arrangement fra midnatt om sommeren har ikke noe klokkeslett");
  assert(startTimeOf("2026-12-10T18:00:00.000Z") === "19.00", "ellers vises klokkeslettet");
});
