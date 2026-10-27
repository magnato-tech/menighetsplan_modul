// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Gathering, Group, Task } from "../src/types";
import { answerInRound, cardsFor, waitsForAnswer, type SemesterAnswer, type SemesterPlan } from "../src/utils/semesterPlan";
import { SemesterPlanPage } from "../src/pages/SemesterPlanPage";

// The way through a semester plan on Min side: one card at a time, the tasks of all one's teams
// on it, and every choice saved at once.

const plan: SemesterPlan = {
  id: "plan-1",
  name: "Våren 2027",
  firstDay: "2027-01-01",
  lastDay: "2027-06-01",
  answerBy: "2026-12-01",
  opensAt: "2026-10-27T17:00:00.000Z",
  createdAt: "2026-10-20T10:00:00.000Z",
};

const groups: Group[] = [
  { id: "lyd", name: "Lyd", memberIds: ["kari"], leaderIds: [] },
  { id: "kjokken", name: "Kjøkken", memberIds: ["kari"], leaderIds: [] },
];
const gatherings: Gathering[] = [
  { id: "g-jan", groupId: "menighet", title: "Misjonsgudstjeneste", startsAt: "2027-01-10T10:00:00.000Z", location: "Hovedsalen", visibility: "offentlig" },
  { id: "g-feb", groupId: "menighet", title: "Familiegudstjeneste", startsAt: "2027-02-14T10:00:00.000Z", visibility: "offentlig" },
];
const tasks: Task[] = [
  { id: "t-lyd", gatheringId: "g-jan", groupId: "lyd", title: "Lyd", status: "open", neededCount: 1 },
  { id: "t-kjokken", gatheringId: "g-jan", groupId: "kjokken", title: "Kjøkken", status: "open", neededCount: 1 },
  { id: "t-feb", gatheringId: "g-feb", groupId: "lyd", title: "Lyd", status: "open", neededCount: 1 },
];

const state = vi.hoisted(() => ({ stored: null as unknown }));
const services = vi.hoisted(() => ({
  saveAnswerStep: vi.fn(async () => true),
  restartAnswer: vi.fn(async () => true),
}));
const planner = vi.hoisted(() => ({
  currentUser: { id: "kari", name: "Kari", globalRole: "member" },
  assignTaskToPerson: vi.fn(() => ({ success: true })),
  updateAssignmentStatus: vi.fn(() => ({ success: true })),
  watchGatheringAssignments: vi.fn(() => () => undefined),
}));

vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => planner }));
vi.mock("../src/services/semesterPlans", () => services);
vi.mock("../src/hooks/useSemesterPlans", () => ({
  useMySemesterPlans: () => {
    const stored = state.stored as SemesterAnswer | null;
    const cards = cardsFor(plan, "kari", { gatherings, tasks, groups, assignments: [] });
    const now = new Date("2026-11-01T10:00:00.000Z");
    return { mine: [{ plan, cards, answer: answerInRound(plan, stored), stored, waiting: waitsForAnswer(plan, cards, stored, now) }], ready: true };
  },
}));


const show = () =>
  render(
    <MemoryRouter initialEntries={["/minside/semesterplan/plan-1"]}>
      <Routes>
        <Route path="/minside/semesterplan/:planId" element={<SemesterPlanPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  state.stored = null;
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("Semesterplanen på Min side", () => {
  test("ett kort om gangen, med oppgavene fra begge teamene på samme kort", () => {
    show();
    expect(screen.getByRole("heading", { name: "Semesterplan Våren 2027" })).toBeTruthy();
    expect(screen.getByText("1 av 2")).toBeTruthy();
    const card = screen.getByRole("article");
    expect(within(card).getByText("Misjonsgudstjeneste")).toBeTruthy();
    expect(within(card).getAllByRole("button", { name: "Ta oppgave" })).toHaveLength(2);
    expect(within(card).getByText("Kjøkken")).toBeTruthy();
    expect(within(card).getByText("Lyd")).toBeTruthy();
  });

  test("Ta oppgave tar den med en gang, og med mer å ta blir kortet stående", async () => {
    show();
    fireEvent.click(screen.getAllByRole("button", { name: "Ta oppgave" })[0]);
    expect(planner.assignTaskToPerson).toHaveBeenCalledWith("t-kjokken", "kari", "confirmed");
    expect(await screen.findByText(/^Lagt inn: Kjøkken/)).toBeTruthy();
    expect(screen.getByText("1 av 2")).toBeTruthy();
    expect(services.saveAnswerStep).not.toHaveBeenCalled();
  });

  test("Kan ikke gjelder hele arrangementet, og neste kort kommer", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Kan ikke" }));
    await waitFor(() => expect(screen.getByText("2 av 2")).toBeTruthy());
    expect(services.saveAnswerStep).toHaveBeenCalledWith(plan, "kari", { passed: "g-jan", declined: { gatheringId: "g-jan", cannot: true } }, null);
    expect(screen.getByRole("button", { name: "Tilbake" })).toBeTruthy();
  });

  test("etter siste kort er man ferdig, og kan gå gjennom igjen", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Neste" }));
    await waitFor(() => expect(screen.getByText("2 av 2")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Neste" }));
    expect(await screen.findByText("Takk! Du er ferdig med semesterplanen.")).toBeTruthy();
    expect(services.saveAnswerStep).toHaveBeenLastCalledWith(plan, "kari", { passed: "g-feb", finished: true }, null);
    fireEvent.click(screen.getByRole("button", { name: "Gå gjennom igjen" }));
    await waitFor(() => expect(screen.getByText("1 av 2")).toBeTruthy());
    expect(services.restartAnswer).toHaveBeenCalledWith(plan, "kari");
  });

  test("man fortsetter der man slapp, og den som er ferdig, ser oppgavene sine", () => {
    state.stored = { id: "x", planId: plan.id, personId: "kari", passed: ["g-jan"], declined: [], round: plan.opensAt };
    show();
    expect(screen.getByText("2 av 2")).toBeTruthy();
    cleanup();
    state.stored = { id: "x", planId: plan.id, personId: "kari", passed: ["g-jan", "g-feb"], declined: [], finishedAt: "2026-11-01T10:00:00.000Z", round: plan.opensAt };
    show();
    expect(screen.getByText("Takk! Du er ferdig med semesterplanen.")).toBeTruthy();
  });
});
