// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MyCalendarPanel } from "../src/pages/myPage/MyCalendarPanel";
import type { Gathering, Group } from "../src/types";

// The calendar tab on Min side. Today is fixed to 15 January 2027. Filters: Alle, Gudstjenester, and
// Mine grupper, which is only offered to someone who is in a group.

const state = vi.hoisted(() => ({ groups: [] as unknown[], gatherings: [] as unknown[] }));

vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    currentUser: { id: "kari", name: "Kari Nordmann", globalRole: "member" },
    allPersons: [],
    getUserGroups: () => state.groups,
    gatherings: state.gatherings,
    getPersonAttendance: () => undefined,
    tasks: [],
    assignments: [],
    watchGatheringAssignments: () => () => undefined,
  }),
}));

// The staffing module is off here, so the calendar does not watch assignments.
vi.mock("../src/hooks/useMinSideModules", () => ({ useMinSideModules: () => ({ isOn: () => false }) }));

const lydGroup: Group = { id: "lyd", name: "Lyd og bilde", category: "tjenestegruppe", memberIds: ["kari"], leaderIds: [] };

const worship: Gathering = {
  id: "gudstjeneste",
  groupId: "menigheten",
  title: "Søndagsgudstjeneste",
  startsAt: new Date(2027, 0, 17, 11, 0).toISOString(),
  visibility: "offentlig",
  type: "arrangement",
};

const groupMeeting: Gathering = {
  id: "lyd-mote",
  groupId: "lyd",
  title: "Lyd-møte",
  startsAt: new Date(2027, 0, 20, 18, 0).toISOString(),
  visibility: "intern",
  type: "gruppesamling",
};

const renderPanel = () =>
  render(
    <MemoryRouter>
      <MyCalendarPanel />
    </MemoryRouter>
  );

const filterLabels = () =>
  Array.from(document.querySelectorAll("#section-min-kalender .inline-flex button")).map((button) => button.textContent);

describe("Kalenderen på Min side: filtrene", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
    state.gatherings = [worship, groupMeeting];
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("en som er med i en gruppe ser Alle, Gudstjenester og Mine grupper", () => {
    state.groups = [lydGroup];
    renderPanel();
    expect(filterLabels()).toEqual(["Alle", "Gudstjenester", "Mine grupper"]);
  });

  test("en som ikke er med i noen gruppe ser bare Alle og Gudstjenester", () => {
    state.groups = [];
    renderPanel();
    expect(filterLabels()).toEqual(["Alle", "Gudstjenester"]);
  });

  test("det finnes ingen knapp «Jeg leder» eller «Menigheten»", () => {
    state.groups = [lydGroup];
    renderPanel();
    expect(screen.queryByRole("button", { name: "Jeg leder" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Menigheten" })).toBeNull();
  });

  test("Gudstjenester viser bare gudstjenester", () => {
    state.groups = [lydGroup];
    renderPanel();
    expect(screen.queryAllByText("Lyd-møte").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Gudstjenester" }));
    expect(screen.queryAllByText("Søndagsgudstjeneste").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Lyd-møte").length).toBe(0);
  });

  test("Mine grupper viser bare gruppens samlinger", () => {
    state.groups = [lydGroup];
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Mine grupper" }));
    expect(screen.queryAllByText("Lyd-møte").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Søndagsgudstjeneste").length).toBe(0);
  });
});
