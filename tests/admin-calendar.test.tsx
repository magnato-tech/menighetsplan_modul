// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AdminGatheringItem } from "../src/hooks/useAppHooks";
import type { Gathering, Group } from "../src/types";
import { calendarKindOf, defaultMonthDay, filterByKinds, monthWeeks, weekDays, weekNumber } from "../src/utils/adminCalendar";
import { GatheringsCalendar } from "../src/pages/admin/tabs/gatherings/GatheringsCalendar";

// «Kalender» in the planner: the filter buttons, and the events as a month or a week that are opened,
// never moved, and where a free part of a day starts a new event that day.

const at = (day: string, time = "11:00") => new Date(`${day}T${time}:00`).toISOString();
const event = (id: string, day: string, fields: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "g",
  title: `Arrangement ${id}`,
  startsAt: at(day),
  type: "arrangement",
  visibility: "offentlig",
  isGudstjeneste: false,
  ...fields,
});
const group = (category: Group["category"]): Pick<Group, "category"> => ({ category });
const item = (gathering: Gathering, category?: Group["category"], missing = 0): AdminGatheringItem =>
  ({
    gathering,
    group: category ? ({ id: "g", name: "Gruppe", category, memberIds: [], leaderIds: [] } as Group) : undefined,
    tasks: [],
    tasksWithStaffing: [],
    totalTasks: missing > 0 ? 1 : 0,
    coveredTasksCount: 0,
    missingStaffingCount: missing,
    staffing: { color: missing > 0 ? "red" : "green" },
  }) as unknown as AdminGatheringItem;

afterEach(cleanup);

describe("Filterknappene i kalenderen", () => {
  test("en gudstjeneste er en gudstjeneste, uansett hvem som har ansvaret", () => {
    expect(calendarKindOf(event("a", "2026-11-01", { isGudstjeneste: true }), group("tjenestegruppe"))).toBe("gudstjenester");
  });

  test("husgruppenes samlinger står under Husgrupper", () => {
    expect(calendarKindOf(event("a", "2026-11-01", { type: "gruppesamling", visibility: "intern", isPublic: false }), group("husgruppe"))).toBe("husgrupper");
  });

  test("et teams egen samling står under Tjenestegrupper, men et åpent ungdomsmøte teamet har ansvaret for, står under Andre", () => {
    expect(calendarKindOf(event("kjokken", "2026-11-04", { visibility: "intern", isPublic: false }), group("tjenestegruppe"))).toBe("tjenestegrupper");
    expect(calendarKindOf(event("rigging", "2026-11-10", { type: "gruppesamling" }), group("tjenestegruppe"))).toBe("tjenestegrupper");
    expect(calendarKindOf(event("ungdom", "2026-10-30"), group("tjenestegruppe"))).toBe("andre");
  });

  test("lederskapets møter og arrangementer uten gruppe står under Andre", () => {
    expect(calendarKindOf(event("rad", "2026-11-04", { visibility: "intern", isPublic: false }), group("ledergruppe"))).toBe("andre");
    expect(calendarKindOf(event("bonn", "2026-11-04"))).toBe("andre");
  });

  test("ingen knapp på er Alle, og flere knapper viser det som passer minst én", () => {
    const items = [
      item(event("g", "2026-11-01", { isGudstjeneste: true })),
      item(event("h", "2026-11-02", { type: "gruppesamling" }), "husgruppe"),
      item(event("a", "2026-11-03")),
    ];
    expect(filterByKinds(items, [])).toHaveLength(3);
    expect(filterByKinds(items, ["gudstjenester", "andre"]).map((i) => i.gathering.id)).toEqual(["g", "a"]);
  });
});

describe("Dagene i en måned og en uke", () => {
  test("uken begynner mandag, og ukenummeret er det norske", () => {
    expect(weekNumber(new Date(2026, 9, 20))).toBe(43);
    expect(weekNumber(new Date(2026, 0, 1))).toBe(1);
    expect(weekNumber(new Date(2027, 0, 1))).toBe(53);
    expect(weekNumber(new Date(2026, 11, 28))).toBe(53);
  });

  test("uken klokkene stilles, har sju forskjellige dager, mandag til søndag", () => {
    const days = weekDays(new Date(2026, 9, 25), [event("a", "2026-10-25")]);
    expect(days.map((d) => d.date.getDate())).toEqual([19, 20, 21, 22, 23, 24, 25]);
    expect(days[6].events.map((g) => g.id)).toEqual(["a"]);
  });

  test("en måned har bare uker som har dager i måneden", () => {
    const weeks = monthWeeks(2026, 9, []);
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0].date.getDate()).toBe(28);
    expect(weeks[4][6].date.getDate()).toBe(1);
  });
});

describe("Kalenderen på skjermen", () => {
  const items = [
    ...["a", "b", "c", "d"].map((id) => item(event(id, "2026-11-01"))),
    item(event("mangler", "2026-11-04", { title: "Kjøkkenteam" }), "tjenestegruppe", 2),
  ];
  const vis = (mode: "month" | "week", narrow = false) => {
    const handlers = { onAnchorChange: vi.fn(), onShowWeek: vi.fn(), onNewOnDay: vi.fn() };
    const view = render(
      <MemoryRouter>
        <GatheringsCalendar items={items} mode={mode} anchor={new Date(2026, 10, 4)} narrow={narrow} {...handlers} />
      </MemoryRouter>
    );
    return { ...view, ...handlers };
  };

  test("et trykk på en ledig plass på en dag starter et nytt arrangement den dagen", () => {
    const view = vis("month");
    fireEvent.click(view.container.querySelector('[data-calendar-day="2026-11-11"]')!);
    expect(view.onNewOnDay).toHaveBeenCalledWith("2026-11-11");
  });

  test("et arrangement åpnes, og starter ikke et nytt", () => {
    const view = vis("month");
    const link = view.container.querySelector('[data-calendar-event="mangler"]') as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/admin/samling/mangler?vis=bemanning");
    fireEvent.click(link);
    expect(view.onNewOnDay).not.toHaveBeenCalled();
    expect(link.querySelector('[aria-label="Mangler frivillige"]')).not.toBeNull();
  });

  test("en dag med mange arrangementer viser tre og «+1 til», som åpner uken", () => {
    const view = vis("month");
    const day = view.container.querySelector('[data-calendar-day="2026-11-01"]')!;
    expect(day.querySelectorAll("[data-calendar-event]")).toHaveLength(3);
    fireEvent.click(screen.getByText("+1 til"));
    expect(view.onShowWeek).toHaveBeenCalled();
    expect(view.onNewOnDay).not.toHaveBeenCalled();
  });

  test("uken viser alle arrangementene i sju kolonner, med liten skrift", () => {
    const view = vis("week");
    expect(view.container.querySelector("h3")!.textContent).toBe("Uke 45 · 2. nov. – 8. nov.");
    expect(view.container.querySelector('[data-calendar-view="week"] > div:last-child')!.className).toContain("grid-cols-7");
    expect(view.container.querySelectorAll("[data-calendar-day]")).toHaveLength(7);
    expect(view.container.querySelector("[data-calendar-event]")!.className).toContain("text-[10px]");
  });
});

describe("Månedsvisningen på mobil", () => {
  // Today is the 4th of November, which has an event, so the month opens on it
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 4, 12));
  });
  afterEach(() => vi.useRealTimers());

  const items = [
    ...["a", "b", "c", "d"].map((id) => item(event(id, "2026-11-01"))),
    item(event("mangler", "2026-11-04", { title: "Kjøkkenteam" }), "tjenestegruppe", 2),
  ];
  const phoneMonth = () => {
    const handlers = { onAnchorChange: vi.fn(), onShowWeek: vi.fn(), onNewOnDay: vi.fn() };
    const view = render(
      <MemoryRouter>
        <GatheringsCalendar items={items} mode="month" anchor={new Date(2026, 10, 4)} narrow {...handlers} />
      </MemoryRouter>
    );
    return { ...view, ...handlers };
  };
  const dayCell = (container: HTMLElement, day: string) => container.querySelector(`[data-calendar-day="${day}"]`) as HTMLButtonElement;

  test("hver dag er et trykk på 44 piksler, og viser en prikk for hvert arrangement, opptil tre", () => {
    const view = phoneMonth();
    expect(dayCell(view.container, "2026-11-01").className).toContain("h-11 w-11");
    const dots = dayCell(view.container, "2026-11-01").querySelector('span[aria-hidden="true"]')!;
    expect(dots.children).toHaveLength(3);
    expect(dayCell(view.container, "2026-11-04").querySelector('span[aria-hidden="true"]')!.children).toHaveLength(1);
    expect(screen.getByText("4 arrangementer")).toBeTruthy();
    expect(screen.getByText("1 arrangement")).toBeTruthy();
  });

  test("ingen tekst om arrangementene står i rutene, ingen «+N til» og ingen knapp for nytt arrangement", () => {
    const view = phoneMonth();
    expect(screen.queryByText("+1 til")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^Nytt arrangement/ })).toHaveLength(0);
    expect(dayCell(view.container, "2026-11-01").textContent).not.toContain("Arrangement a");
  });

  test("dagen som er valgt, er merket, og lister arrangementene sine under kalenderen", () => {
    const view = phoneMonth();
    // Today has an event, so the list opens on it
    expect(dayCell(view.container, "2026-11-04").getAttribute("aria-pressed")).toBe("true");
    expect(view.container.querySelectorAll("[data-calendar-event]")).toHaveLength(1);

    fireEvent.click(dayCell(view.container, "2026-11-01"));
    expect(dayCell(view.container, "2026-11-01").getAttribute("aria-pressed")).toBe("true");
    expect(dayCell(view.container, "2026-11-04").getAttribute("aria-pressed")).toBe("false");
    expect(view.container.querySelectorAll("[data-calendar-event]")).toHaveLength(4);
  });

  test("en rad i listen åpner arrangementet, som kortet gjør, og starter ikke et nytt", () => {
    const view = phoneMonth();
    const row = view.container.querySelector('[data-calendar-event="mangler"]') as HTMLAnchorElement;
    expect(row.getAttribute("href")).toBe("/admin/samling/mangler?vis=bemanning");
    expect(row.textContent).toContain("Kjøkkenteam");
    fireEvent.click(row);
    expect(view.onNewOnDay).not.toHaveBeenCalled();
  });

  test("en dag uten arrangementer sier det, og viser ingen rader", () => {
    const view = phoneMonth();
    fireEvent.click(dayCell(view.container, "2026-11-02"));
    expect(screen.getByText("Ingen arrangementer denne dagen.")).toBeTruthy();
    expect(view.container.querySelectorAll("[data-calendar-event]")).toHaveLength(0);
  });

  test("«I dag» går tilbake til dagen i dag som valgt dag", () => {
    const view = phoneMonth();
    fireEvent.click(dayCell(view.container, "2026-11-02"));
    fireEvent.click(screen.getByRole("button", { name: "I dag" }));
    expect(view.onAnchorChange).toHaveBeenCalled();
    expect(dayCell(view.container, "2026-11-04").getAttribute("aria-pressed")).toBe("true");
    expect(dayCell(view.container, "2026-11-02").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("Hvilken dag månedsvisningen på mobil åpner på", () => {
  const cells = (events: Gathering[]) => monthWeeks(2026, 10, events, new Date(2026, 10, 1)).flat();

  test("i dag, når i dag har arrangementer", () => {
    expect(defaultMonthDay(cells([event("a", "2026-11-04")]), new Date(2026, 10, 4))).toBe("2026-11-04");
  });

  test("ellers den neste dagen med arrangementer i måneden", () => {
    const list = [event("a", "2026-11-02"), event("b", "2026-11-20")];
    expect(defaultMonthDay(cells(list), new Date(2026, 10, 4))).toBe("2026-11-20");
    expect(defaultMonthDay(cells(list), new Date(2026, 9, 28))).toBe("2026-11-02");
  });

  test("det som ligger foran, også en dag fra neste måned nederst i rutenettet, før en dag som er forbi", () => {
    const october = monthWeeks(2026, 9, [event("a", "2026-10-21"), event("b", "2026-11-01")], new Date(2026, 9, 1)).flat();
    expect(defaultMonthDay(october, new Date(2026, 9, 28))).toBe("2026-11-01");
  });

  test("uten arrangementer i måneden: i dag hvis den er i måneden, ellers første dag", () => {
    expect(defaultMonthDay(cells([]), new Date(2026, 10, 4))).toBe("2026-11-04");
    expect(defaultMonthDay(cells([]), new Date(2026, 9, 28))).toBe("2026-11-01");
  });
});
