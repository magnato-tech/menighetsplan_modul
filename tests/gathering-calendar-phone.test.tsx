// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The admin calendar on a phone (below 768 px) and on a PC. The phone shows the coming events only, the
// month (compact) and the cards, and the card puts the theme and the speaker on lines of their own.

const { planner, installation } = vi.hoisted(() => ({
  installation: { demo: null as null | Record<string, string> },
  planner: {
    assignments: [] as { id: string; taskId: string; personId: string; personName?: string; response: string }[],
    allPersons: [
      { id: "astri", name: "Astri Berg" },
      { id: "preben", name: "Preben Dahl" },
    ],
    deleteGatheringWithStaffing: () => ({ success: true }) as { success: boolean; error?: string },
    getPersonById: (id: string) => ({ astri: { name: "Astri Berg" }, preben: { name: "Preben Dahl" } })[id as "astri" | "preben"],
  },
}));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => planner }));
vi.mock("../src/hooks/useGatheringTemplates", () => ({ useGatheringTemplates: () => ({ templates: [], ready: true }) }));
vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    surfaces: { minSide: true, ownWebsite: true, externalSiteUrl: "", externalCalendarUrl: "", dismissedUids: [], keptUids: [] },
    surfacesState: "ready",
  }),
}));
vi.mock("../src/hooks/useExternalCalendarQueue", () => ({
  useExternalCalendarQueue: () => ({
    importOn: false,
    diff: null,
    pending: 0,
    syncing: false,
    sync: async () => {},
    createFromEvent: () => {},
    dismiss: async () => {},
    keep: async () => {},
    formInitialFor: () => ({}),
    templateIdFor: () => undefined,
    setTemplateFor: () => {},
    groupReady: true,
  }),
  useExternalCalendarPending: () => 0,
}));
global.fetch = vi.fn(async () => ({ ok: false, text: async () => "" })) as unknown as typeof fetch;

import { GatheringsTab } from "../src/pages/admin/tabs/GatheringsTab";
import type { StudioData } from "../src/pages/admin/studio";
import type { AdminGatheringItem } from "../src/hooks/useAppHooks";
import type { Gathering, Task, VolunteerRole } from "../src/types";
import { combineDateAndTimeToIso } from "../src/utils/dates";

const VIEW_KEY = "menighetsplan_kalender_visning";

const roles: VolunteerRole[] = [
  { id: "r-taler", name: "Taler", sortOrder: 0 },
  { id: "r-moteleder", name: "Møteleder", sortOrder: 1 },
];
const groups = [{ id: "kalender", name: "Kalender", memberIds: [], leaderIds: [] }];

const gathering = (id: string, title: string, day: string, time: string, fields: Partial<Gathering>): Gathering => ({
  id,
  groupId: "kalender",
  title,
  startsAt: combineDateAndTimeToIso(day, time),
  visibility: "offentlig",
  isGudstjeneste: false,
  type: "arrangement",
  ...fields,
});
const task = (id: string, gatheringId: string, volunteerRoleId: string, title: string): Task =>
  ({ id, gatheringId, volunteerRoleId, title, status: "open", neededCount: 1 }) as Task;
const item = (g: Gathering, tasks: Task[] = []): AdminGatheringItem =>
  ({
    gathering: g,
    tasks,
    tasksWithStaffing: [],
    totalTasks: tasks.length,
    coveredTasksCount: 0,
    missingStaffingCount: 0,
    staffing: { color: "green" },
  }) as unknown as AdminGatheringItem;

// Today is the 1st of October 2026. Three events lie ahead, one is held.
const worship = gathering("sondag", "Søndagsgudstjeneste", "2026-10-18", "11:00", { isGudstjeneste: true, theme: "Takk", location: "Storsalen" });
const meeting = gathering("mote", "Menighetsmøte", "2026-10-20", "19:00", { location: "Bjørkeveien" });
const youth = gathering("ungdom", "Ungdomskveld", "2026-10-25", "18:00", { location: "Ungdomshuset" });
const held = gathering("gammel", "Gammel gudstjeneste", "2026-09-06", "11:00", { isGudstjeneste: true });
const adminGatherings = [
  item(worship, [task("t-taler", "sondag", "r-taler", "Taler"), task("t-mote", "sondag", "r-moteleder", "Møteleder")]),
  item(meeting),
  item(youth, [task("t-ungdom", "ungdom", "r-taler", "Taler")]),
  item(held),
];
planner.assignments = [
  { id: "a1", taskId: "t-taler", personId: "astri", response: "confirmed" },
  { id: "a2", taskId: "t-mote", personId: "preben", response: "confirmed" },
  // Asked, but has not said yes: no speaker on the ungdomskveld
  { id: "a3", taskId: "t-ungdom", personId: "preben", response: "pending" },
];

const stubWidth = (wide: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: wide && query === "(min-width: 768px)", media: query, addEventListener() {}, removeEventListener() {} }));

const show = () => {
  const studio = {
    adminGatherings,
    adminGroups: groups.map((group) => ({ group })),
    adminVolunteerRoles: roles,
    createGathering: vi.fn(),
    createTask: vi.fn(),
    updateGathering: vi.fn(),
    deleteGathering: vi.fn(),
  } as unknown as StudioData;
  return render(
    <MemoryRouter>
      <GatheringsTab studio={studio} showFeedback={vi.fn()} />
    </MemoryRouter>
  );
};
const cardOf = (container: HTMLElement, id: string) => container.querySelector(`a[href="/admin/samling/${id}?vis=bemanning"]`) as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 1, 12));
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Kalenderen på en mobil", () => {
  test("Kommende og Tidligere er borte, og Uke og Tabell er borte; Måned og Kort står", () => {
    stubWidth(false);
    show();
    expect(screen.getByRole("button", { name: "Måned" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kort" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Uke" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tabell" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Periode" })).toBeNull();
    expect(screen.queryByText("Kommende")).toBeNull();
    expect(screen.queryByText("Tidligere")).toBeNull();
  });

  test("kortene viser bare det som kommer", () => {
    stubWidth(false);
    localStorage.setItem(VIEW_KEY, JSON.stringify("cards"));
    show();
    expect(screen.getByText("Menighetsmøte")).toBeTruthy();
    expect(screen.queryByText("Gammel gudstjeneste")).toBeNull();
  });

  test("en visning som er valgt som Uke, vises som Måned", () => {
    stubWidth(false);
    localStorage.setItem(VIEW_KEY, JSON.stringify("week"));
    const view = show();
    expect(view.container.querySelector('[data-calendar-view="month"]')).not.toBeNull();
    expect(view.container.querySelector('[data-calendar-view="week"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Måned" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("en tabell som er valgt, vises som kort", () => {
    stubWidth(false);
    localStorage.setItem(VIEW_KEY, JSON.stringify("table"));
    show();
    expect(screen.getByRole("button", { name: "Kort" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("måneden viser valgt dag og listen under den; en rad åpner arrangementet", () => {
    stubWidth(false);
    localStorage.setItem(VIEW_KEY, JSON.stringify("month"));
    const view = show();
    // Today has no events, so the month opens on the next day with one
    expect(view.container.querySelector('[data-calendar-day="2026-10-18"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("link", { name: /Søndagsgudstjeneste/ }).getAttribute("href")).toBe(`/admin/samling/sondag?vis=bemanning`);

    fireEvent.click(view.container.querySelector('[data-calendar-day="2026-10-20"]')!);
    expect(screen.getByRole("link", { name: /Menighetsmøte/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Søndagsgudstjeneste/ })).toBeNull();
  });
});

describe("Kalenderen på PC", () => {
  test("alle fire visningene, og Kommende og Tidligere, står", () => {
    stubWidth(true);
    show();
    for (const name of ["Måned", "Uke", "Kort", "Tabell"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Periode" })).toBeTruthy();
    expect(screen.getByText("Kommende")).toBeTruthy();
    expect(screen.getByText("Tidligere")).toBeTruthy();
  });

  test("Tidligere viser det som er holdt", () => {
    stubWidth(true);
    localStorage.setItem(VIEW_KEY, JSON.stringify("cards"));
    show();
    expect(screen.queryByText("Gammel gudstjeneste")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tidligere" }));
    expect(screen.getByText("Gammel gudstjeneste")).toBeTruthy();
  });

  test("en uke som er valgt, er en uke med sju dager", () => {
    stubWidth(true);
    localStorage.setItem(VIEW_KEY, JSON.stringify("week"));
    const view = show();
    expect(view.container.querySelector('[data-calendar-view="week"]')).not.toBeNull();
    expect(view.container.querySelectorAll("[data-calendar-day]")).toHaveLength(7);
  });
});

describe("Kortet for et arrangement", () => {
  test("tema og taler står på en linje for seg, og dato og sted på linjen over", () => {
    stubWidth(false);
    localStorage.setItem(VIEW_KEY, JSON.stringify("cards"));
    show();
    const themeLine = screen.getByText("Tema: Takk · Taler: Astri Berg");
    expect(themeLine.tagName).toBe("P");
    const whenLine = screen.getByText(/Storsalen$/);
    expect(whenLine.tagName).toBe("P");
    expect(whenLine.textContent).not.toContain("Tema");
    expect(whenLine.textContent).not.toContain("Taler");
  });

  test("uten noen som har sagt ja til Taler, står det ingen taler på kortet", () => {
    stubWidth(true);
    localStorage.setItem(VIEW_KEY, JSON.stringify("cards"));
    const view = show();
    // Ungdomskveld has a speaker task, but the person has only been asked
    expect(screen.getAllByText(/Taler:/)).toHaveLength(1);
    expect(cardOf(view.container, "ungdom").textContent).not.toContain("Taler");
  });

  test("et arrangement uten tema og taler har bare én linje under tittelen", () => {
    stubWidth(false);
    localStorage.setItem(VIEW_KEY, JSON.stringify("cards"));
    const view = show();
    expect(cardOf(view.container, "mote").querySelectorAll("p")).toHaveLength(1);
  });
});
