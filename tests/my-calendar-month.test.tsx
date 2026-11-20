// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MyCalendarMonth } from "../src/pages/myPage/MyCalendarMonth";
import type { PersonalCalendarEvent } from "../src/utils/personalCalendar";
import type { Gathering } from "../src/types";

// The calendar as a month on a tablet and a PC. Today is fixed to 15 January 2027 (a Friday).

const gathering = (id: string, title: string, startsAt: string, endsAt?: string): Gathering => ({
  id,
  groupId: "menigheten",
  title,
  startsAt,
  endsAt,
  visibility: "offentlig",
  type: "arrangement",
});

const events: PersonalCalendarEvent[] = [
  { gathering: gathering("g1", "Gudstjeneste", new Date(2027, 0, 17, 11, 0).toISOString()), source: "menigheten" },
  { gathering: gathering("g2", "Leirhelg", new Date(2027, 0, 20, 10, 0).toISOString(), new Date(2027, 0, 22, 15, 0).toISOString()), source: "menigheten" },
];

const dayCell = (key: string) => document.querySelector(`[data-calendar-day="${key}"]`) as HTMLElement;

describe("Månedsvisningen i kalenderen på Min side", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("viser måneden med år, og en hendelse på sin dag", () => {
    render(<MyCalendarMonth events={events} dots={new Map()} onOpen={() => undefined} />);
    expect(screen.getByRole("heading", { name: /januar 2027/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Forrige måned" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Neste måned" })).toBeTruthy();
    expect(dayCell("2027-01-17").querySelector('[data-calendar-event="g1"]')).not.toBeNull();
    expect(dayCell("2027-01-16").querySelector("[data-calendar-event]")).toBeNull();
  });

  test("et trykk på en hendelse åpner den", () => {
    const onOpen = vi.fn();
    render(<MyCalendarMonth events={events} dots={new Map()} onOpen={onOpen} />);
    const pill = dayCell("2027-01-17").querySelector('[data-calendar-event="g1"]') as HTMLElement;
    fireEvent.click(pill);
    expect(onOpen).toHaveBeenCalledWith("g1");
  });

  test("et trykk på en tom dag viser at den er tom", () => {
    render(<MyCalendarMonth events={events} dots={new Map()} onOpen={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Mandag 11. januar" }));
    expect(screen.getByText("Ingen hendelser denne dagen.")).toBeTruthy();
  });

  test("en flerdagshendelse står «forts.» på andre dag", () => {
    render(<MyCalendarMonth events={events} dots={new Map()} onOpen={() => undefined} />);
    const secondDay = dayCell("2027-01-21").querySelector('[data-calendar-event="g2"]') as HTMLElement;
    expect(secondDay).not.toBeNull();
    expect(secondDay.textContent).toContain("forts.");
    expect(dayCell("2027-01-20").querySelector('[data-calendar-event="g2"]')!.textContent).toContain("10:00");
  });

  test("med hendelsen valgt i listen ved siden av måneden, står den der også", () => {
    const onOpen = vi.fn();
    render(<MyCalendarMonth events={events} dots={new Map()} onOpen={onOpen} />);
    // Today has no events, so the first coming day with events is picked: Sunday the 17th
    const aside = screen.getByRole("complementary", { name: "Valgt dag" });
    expect(aside.textContent).toContain("Søndag 17. januar");
    fireEvent.click(screen.getByRole("button", { name: /Søndag 17. januar/ }));
    fireEvent.click(aside.querySelector("button")!);
    expect(onOpen).toHaveBeenCalledWith("g1");
  });
});
