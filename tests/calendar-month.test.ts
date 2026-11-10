import { describe } from "vitest";
import { assert } from "./assert";
import { buildMonthGrid, dayBounds, isContinuationDay, monthLabel, occursOnDay } from "../src/utils/calendarMonth";
import type { Gathering } from "../src/types";

describe("Månedsrutenett for kalender", () => {
  const today = new Date("2026-10-04T12:00:00.000Z");
  const event = (day: number, title: string): Gathering => ({
    id: `evt-${day}`,
    groupId: "g1",
    title,
    startsAt: new Date(2026, 9, day, 11, 0, 0).toISOString(),
    visibility: "offentlig",
    type: "arrangement",
  });

  const grid = buildMonthGrid(2026, 9, [event(4, "Gudstjeneste"), event(7, "Møte")], today);

  assert(grid.length === 42, "Månedsrutenettet har seks uker");
  assert(grid.some((cell) => cell.isToday && cell.date.getDate() === 4), "I dag markeres");
  assert(
    grid.find((cell) => cell.date.getDate() === 4 && cell.inMonth)?.events[0]?.title === "Gudstjeneste",
    "Arrangementer plasseres på riktig dag"
  );
  assert(monthLabel(2026, 9).includes("2026"), "Månedstittel inkluderer år");
});

describe("Arrangementer som varer flere dager", () => {
  const multi = {
    startsAt: new Date(2026, 10, 26, 0, 0, 0).toISOString(),
    endsAt: new Date(2026, 10, 29, 18, 0, 0).toISOString(),
  };
  const allDay = {
    startsAt: new Date(2026, 2, 4, 0, 0, 0).toISOString(),
    endsAt: new Date(2026, 2, 5, 0, 0, 0).toISOString(),
  };
  const noEnd = { startsAt: new Date(2026, 10, 12, 19, 0, 0).toISOString() };
  const day = (year: number, month: number, date: number) => dayBounds(new Date(year, month, date));
  const occurs = (g: { startsAt: string; endsAt?: string }, d: { start: number; end: number }) =>
    occursOnDay(g, d.start, d.end);

  // Each day of November 2026 the event is on, as day numbers
  const daysOf = (event: Gathering) =>
    buildMonthGrid(2026, 10, [event], new Date(2026, 0, 1))
      .filter((cell) => cell.inMonth && cell.events.length > 0)
      .map((cell) => cell.date.getDate());

  const tur: Gathering = { id: "tur", groupId: "g1", title: "Tur til Romania", type: "arrangement", visibility: "offentlig", ...multi };

  assert(
    JSON.stringify(daysOf(tur)) === JSON.stringify([26, 27, 28, 29]),
    "En tur fra 26. til 29. november vises på hver av de fire dagene, og ikke 25. eller 30."
  );
  assert(occurs(multi, day(2026, 10, 30)) === false, "Dagen etter slutten vises ikke");
  assert(occurs(multi, day(2026, 10, 25)) === false, "Dagen før starten vises ikke");

  const heldag: Gathering = { id: "heldag", groupId: "g1", title: "Heldag", type: "arrangement", visibility: "offentlig", ...allDay };
  const allDayGrid = buildMonthGrid(2026, 2, [heldag], new Date(2026, 0, 1));
  assert(
    JSON.stringify(allDayGrid.filter((c) => c.inMonth && c.events.length > 0).map((c) => c.date.getDate())) === JSON.stringify([4]),
    "En heldagshendelse 4. mars 00:00 til 5. mars 00:00 vises bare 4. mars (iCal-regel)"
  );
  assert(occurs(allDay, day(2026, 2, 5)) === false, "Slutt midt på natten inkluderer ikke dagen den slutter på");

  assert(occurs(noEnd, day(2026, 10, 12)) && !occurs(noEnd, day(2026, 10, 13)) && !occurs(noEnd, day(2026, 10, 11)), "Uten sluttid vises arrangementet bare på startdagen");
  const endEqualsStart = { startsAt: noEnd.startsAt, endsAt: noEnd.startsAt };
  assert(!occurs(endEqualsStart, day(2026, 10, 13)) && occurs(endEqualsStart, day(2026, 10, 12)), "Sluttid lik starttid gir bare startdagen");

  assert(isContinuationDay(multi, day(2026, 10, 26).start) === false, "Startdagen er ikke en fortsettelsesdag");
  assert(isContinuationDay(multi, day(2026, 10, 27).start) === true, "27. november er en fortsettelsesdag");
  assert(isContinuationDay(multi, day(2026, 10, 29).start) === true, "Siste dag er en fortsettelsesdag");
  assert(isContinuationDay(multi, day(2026, 10, 30).start) === false, "Dagen etter slutten er ikke en fortsettelsesdag");
  assert(isContinuationDay(allDay, day(2026, 2, 5).start) === false, "Heldagshendelsen har ingen fortsettelsesdag");
  assert(isContinuationDay(noEnd, day(2026, 10, 13).start) === false, "Uten sluttid er det ingen fortsettelsesdag");
});
