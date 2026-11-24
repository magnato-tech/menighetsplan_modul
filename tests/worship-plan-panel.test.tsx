// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { WorshipPlanPanel } from "../src/pages/myPage/WorshipPlanPanel";

// The Gudstjenester tab on Min side. Today is fixed to 10 January 2027; the nearest service opens.

const ctx = vi.hoisted(() => ({
  gatherings: [] as unknown[],
  tasks: [] as unknown[],
  assignments: [] as unknown[],
  groups: [] as unknown[],
  currentUser: { id: "kari", globalRole: "member" },
  names: { kari: "Kari Nordmann", ola: "Ola Hansen" } as Record<string, string>,
  watchGatheringAssignments: () => () => undefined,
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    ...ctx,
    volunteerRoles: [],
    getPersonById: (id: string) => (ctx.names[id] ? { name: ctx.names[id] } : undefined),
  }),
}));

const service = (id: string, startsAt: string) => ({
  id,
  groupId: "menigheten",
  title: "Gudstjeneste",
  startsAt,
  visibility: "offentlig",
  isGudstjeneste: true,
});

const Probe = () => {
  const location = useLocation();
  return <div data-testid="adresse">{location.pathname + location.search}</div>;
};

const renderPanel = () =>
  render(
    <MemoryRouter initialEntries={["/minside"]}>
      <Routes>
        <Route path="/minside" element={<WorshipPlanPanel />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );

// The two folding headers, nearest first
const folds = () => screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2027, 0, 10, 12, 0, 0));
  ctx.gatherings = [service("g1", "2027-01-17T11:00:00Z"), service("g2", "2027-01-24T11:00:00Z")];
  ctx.tasks = [
    { id: "t1", gatheringId: "g1", title: "Lyd", status: "assigned", neededCount: 1 },
    { id: "t2", gatheringId: "g2", title: "Kaffe", status: "assigned", neededCount: 1 },
  ];
  ctx.assignments = [
    { id: "a1", taskId: "t1", personId: "kari", response: "confirmed" },
    { id: "a2", taskId: "t2", personId: "kari", response: "confirmed" },
  ];
  ctx.currentUser = { id: "kari", globalRole: "member" };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Gudstjenester på Min side", () => {
  test("den nærmeste gudstjenesten er åpen, de andre er brettet sammen", () => {
    renderPanel();
    expect(folds().map((button) => button.getAttribute("aria-expanded"))).toEqual(["true", "false"]);
    expect(screen.getByText("Kari Nordmann")).toBeTruthy();
    expect(screen.queryByText("Kaffe")).toBeNull();
  });

  test("en brettet gudstjeneste viser en «Du»-merkelapp i toppen når man står på en oppgave", () => {
    renderPanel();
    const [, second] = folds();
    expect(second.textContent).toContain("Du");
    expect(second.textContent).not.toContain("Kaffe");
  });

  test("et trykk på toppen av et kort åpner og lukker det, uavhengig av de andre", () => {
    renderPanel();
    const [first, second] = folds();
    fireEvent.click(second);
    expect(second.getAttribute("aria-expanded")).toBe("true");
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Kaffe")).toBeTruthy();
    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Lyd")).toBeNull();
    expect(screen.getByText("Kaffe")).toBeTruthy();
  });

  test("en som står på oppgaven ser kjøreplanen, som åpner med fra=gudstjenester", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Kjøreplan" }));
    expect(screen.getByTestId("adresse").textContent).toBe("/samling/g1?fra=gudstjenester");
  });

  test("en vanlig deltaker uten ansvar ser ikke Planlegg", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: "Planlegg" })).toBeNull();
  });
});
