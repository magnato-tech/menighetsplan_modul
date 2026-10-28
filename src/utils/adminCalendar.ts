import type { Gathering, Group } from "../types";
import { isGroupGathering, isWorshipService } from "./gatherings";
import { visibilityOf } from "./visibility";
import { buildMonthGrid, type CalendarMonthCell } from "./calendarMonth";

// The calendar in the planner («Kalender»): which filter button an event falls under, and the days of
// a month or a week to draw. Only for the admin; the website has its own calendar module.

/** The filter buttons. Every event falls under exactly one of them. */
export type CalendarKind = "gudstjenester" | "husgrupper" | "tjenestegrupper" | "andre";

export const CALENDAR_KINDS: { value: CalendarKind; label: string }[] = [
  { value: "gudstjenester", label: "Gudstjenester" },
  { value: "husgrupper", label: "Husgrupper" },
  { value: "tjenestegrupper", label: "Tjenestegrupper" },
  { value: "andre", label: "Andre" },
];

/**
 * Which button an event falls under. A worship service is that, whoever is responsible. A meeting in a
 * house group is the house groups'. A service team's own meeting (a group meeting, or an internal event)
 * is the teams'. Everything else is «Andre»: prayer meetings, youth meetings and other open events a
 * team may be responsible for, and the leadership's meetings.
 */
export function calendarKindOf(gathering: Gathering, group?: Pick<Group, "category">): CalendarKind {
  if (isWorshipService(gathering)) return "gudstjenester";
  if (group?.category === "husgruppe") return "husgrupper";
  if (group?.category === "tjenestegruppe" && (isGroupGathering(gathering) || visibilityOf(gathering) === "intern")) return "tjenestegrupper";
  return "andre";
}

/** The events under the buttons that are on. With none on («Alle»), every event. */
export function filterByKinds<T extends { gathering: Gathering; group?: Pick<Group, "category"> }>(items: T[], kinds: CalendarKind[]): T[] {
  if (kinds.length === 0) return items;
  return items.filter((item) => kinds.includes(calendarKindOf(item.gathering, item.group)));
}

/** The weeks of a month, Monday first. A last row that lies wholly in the next month is left out. */
export function monthWeeks(year: number, month: number, events: Gathering[], today: Date = new Date()): CalendarMonthCell[][] {
  const cells = buildMonthGrid(year, month, events, today);
  const weeks: CalendarMonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks.filter((week) => week.some((cell) => cell.inMonth));
}

/** The Monday of the week a day lies in. */
export function mondayOf(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
}

/** The seven days of the week a day lies in, Monday to Sunday, each with its events. */
export function weekDays(day: Date, events: Gathering[], today: Date = new Date()): CalendarMonthCell[] {
  const monday = mondayOf(day);
  const todayKey = dayKey(today);
  return Array.from({ length: 7 }, (_, i) => {
    // Counted in calendar days, so the week is right when the clocks change
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = dayKey(date);
    return {
      date,
      inMonth: true,
      isToday: key === todayKey,
      events: events.filter((g) => dayKey(new Date(g.startsAt)) === key).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    };
  });
}

/** A day as the forms write it: "2026-10-25". */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The week number as Norwegian calendars count it (ISO 8601): the week with the year's first Thursday is week 1. */
export function weekNumber(day: Date): number {
  const thursday = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 3 - ((day.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  return 1 + Math.round((thursday.getTime() - mondayOf(firstThursday).getTime() - 3 * 86400000) / (7 * 86400000));
}

/**
 * The day a phone's month opens on: today or the next day with events in the grid, also one of the
 * next month's days at its end, for what is ahead is what matters. Without that, the first day with
 * events in the month. A month without events opens on today, or on its first day.
 */
export function defaultMonthDay(cells: CalendarMonthCell[], today: Date = new Date()): string {
  const todayKey = dayKey(today);
  const shown = cells.filter((cell) => cell.inMonth);
  const ahead = cells.find((cell) => cell.events.length > 0 && dayKey(cell.date) >= todayKey);
  const day = ahead ?? shown.find((cell) => cell.events.length > 0);
  if (day) return dayKey(day.date);
  return shown.some((cell) => dayKey(cell.date) === todayKey) || shown.length === 0 ? todayKey : dayKey(shown[0].date);
}
