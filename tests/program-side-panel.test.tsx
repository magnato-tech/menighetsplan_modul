// @vitest-environment jsdom
/**
 * The programme beside «Bemanning» on a large screen: time, title and who is on each post, the
 * posts a reader may open pick their role, and the panel folds to a strip that is remembered.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Assignment, Group, ProgramItem, Task } from "../src/types";
import { buildRunSheet, type RunSheetRow, type RunSheetTask } from "../src/utils/runSheet";
import { buildStaffingRoster } from "../src/utils/staffingRoster";
import { RESPONSE_LABELS, calculateTaskStaffingStatus } from "../src/utils/staffing";
import { ProgramSidePanel } from "../src/components/gathering/ProgramSidePanel";

const STORAGE_KEY = "menighetsplan_bemanning_program";

const teams: Record<string, Group> = {
  lovsang: { id: "lovsang", name: "Lovsang", memberIds: [], leaderIds: [] },
  vert: { id: "vert", name: "Møtevert", memberIds: [], leaderIds: [] },
};

/** A role with its people, given as [name, response]. Same rules as the gathering view. */
function role(id: string, groupId: string, people: [string, Assignment["response"]][], extra: Partial<Task> = {}): RunSheetTask {
  const task: Task = { id, gatheringId: "g", groupId, title: id, status: "open", neededCount: 1, ...extra };
  const assignments: Assignment[] = people.map(([name, response], i) => ({
    id: `${id}-${i}`,
    taskId: id,
    personId: `${id}-p${i}`,
    response,
    personName: name,
  }));
  const staffing = calculateTaskStaffingStatus(task, assignments);
  return {
    task,
    taskGroup: teams[groupId],
    isMyGroup: groupId === "lovsang",
    neededCount: staffing.neededCount,
    assignedPersons: assignments.map((assignment, i) => ({
      assignment,
      person: { id: assignment.personId, name: people[i][0], globalRole: "member" },
      statusLabel: RESPONSE_LABELS[assignment.response],
      response: assignment.response,
    })),
    confirmedPersonsCount: staffing.confirmedCount,
    isFullyCovered: staffing.isFullyCovered,
    hasWithdrawn: staffing.hasForfall,
  };
}

const schedule: ProgramItem[] = [
  { time: "09:30", title: "Lovsang", taskId: "Lovsang" },
  { time: "10:00", title: "Velkomst" },
  { time: "11:00", title: "Preken", taskId: "Taler" },
  { time: "11:30", title: "Kaffe", taskId: "Kirkekaffe" },
];

const details: RunSheetTask[] = [
  role("Lovsang", "lovsang", [["Lars Lyd", "confirmed"]]),
  role("Taler", "lovsang", [], { neededCount: 2 }),
  role("Kirkekaffe", "vert", [["Kari Kjøkken", "confirmed"]]),
];

const programRows = buildRunSheet(schedule, details, []).filter((row) => row.id.startsWith("program-"));

const onPickTask = vi.fn();
const onShowProgram = vi.fn();

function renderPanel(
  roster = buildStaffingRoster(schedule, details),
  highlightTaskId: string | null = null,
  rows: RunSheetRow[] = programRows
) {
  return render(
    <ProgramSidePanel
      rows={rows}
      roster={roster}
      highlightTaskId={highlightTaskId}
      onPickTask={onPickTask}
      onShowProgram={onShowProgram}
    />
  );
}

beforeEach(() => {
  window.localStorage.clear();
  onPickTask.mockClear();
  onShowProgram.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Programmet ved siden av bemanningen", () => {
  test("viser tid, tittel, «rolle · navn» der noen har sagt ja, og «2 ledige» med ikon", () => {
    renderPanel();

    expect(screen.getByText("09:30")).toBeTruthy();
    expect(screen.getByText("Velkomst")).toBeTruthy();
    expect(screen.getByText("Lovsang · Lars Lyd")).toBeTruthy();

    const open = screen.getByText("2 ledige");
    expect(open.closest("span")?.querySelector("svg")).not.toBeNull();
    expect(open.className).toContain("text-red-700");
  });

  test("viser navnene og det som er ledig på samme linje, der ledig er i rødt med ikon", () => {
    const withFree = [role("Lovsang", "lovsang", [["Thomas Viken", "confirmed"]], { neededCount: 3 }), ...details.slice(1)];
    renderPanel(
      buildStaffingRoster(schedule, withFree),
      null,
      buildRunSheet(schedule, withFree, []).filter((row) => row.id.startsWith("program-"))
    );

    const line = screen.getByText(/Lovsang · Thomas Viken/);
    expect(line.textContent).toBe("Lovsang · Thomas Viken · 2 ledige");
    const free = line.querySelector(".text-red-700") as HTMLElement;
    expect(free.textContent).toBe("2 ledige");
    expect(free.querySelector("svg")).not.toBeNull();
    expect(line.className).not.toContain("text-red-700");
  });

  test("en post uten oppgave viser bare tid og tittel", () => {
    renderPanel();

    const velkomst = screen.getByText("Velkomst").closest("li") as HTMLElement;
    expect(velkomst.querySelector("button")).toBeNull();
    expect(within(velkomst).queryByText(/ledig|·/)).toBeNull();
  });

  test("et trykk på en post gir rollen til onPickTask, og den valgte er merket", () => {
    renderPanel(buildStaffingRoster(schedule, details), "Taler");

    fireEvent.click(screen.getByRole("button", { name: /Preken/ }));
    expect(onPickTask).toHaveBeenCalledWith("Taler");

    const picked = screen.getByRole("button", { name: /Preken/ });
    expect(picked.getAttribute("aria-current")).toBe("true");
    expect(picked.className).toContain("bg-indigo-50");
    expect(screen.getByRole("button", { name: /Lovsang/ }).getAttribute("aria-current")).toBeNull();
  });

  test("en leder kan ikke trykke på en post i en annen gruppe, og ser ingen ledige plasser der", () => {
    const ownGroups = buildStaffingRoster(schedule, details).filter((row) => row.isMyGroup);
    renderPanel(ownGroups);

    // The other group's post shows its confirmed names only: no button, and nothing about who is missing
    const kaffe = screen.getByText("Kaffe").closest("li") as HTMLElement;
    expect(kaffe.querySelector("button")).toBeNull();
    expect(within(kaffe).getByText("Kirkekaffe · Kari Kjøkken")).toBeTruthy();
    expect(within(kaffe).queryByText(/ledig|forfall/)).toBeNull();
    expect(screen.getByRole("button", { name: /Preken/ })).toBeTruthy();
  });

  test("går til Program med lenken i bunnteksten", () => {
    renderPanel();

    expect(screen.getByText(/Programmet endres under Program\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gå til Program" }));
    expect(onShowProgram).toHaveBeenCalledTimes(1);
  });
});

describe("Å folde programmet", () => {
  test("er åpent når ingenting er lagret", () => {
    renderPanel();
    expect(screen.getByRole("complementary", { name: "Programmet" })).toBeTruthy();
  });

  test("foldes til en smal stripe, huskes, og åpnes igjen", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Fold sammen programmet" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("folded");
    expect(screen.queryByText("Velkomst")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Vis programmet" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("open");
    expect(screen.getByText("Velkomst")).toBeTruthy();
  });

  test("står åpent når lagringen er stengt, og kan likevel foldes", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blokkert");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blokkert");
    });

    renderPanel();
    expect(screen.getByText("Velkomst")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fold sammen programmet" }));
    expect(screen.getByRole("button", { name: "Vis programmet" })).toBeTruthy();
  });

  test("en stripe som er lagret, står foldet", () => {
    window.localStorage.setItem(STORAGE_KEY, "folded");
    renderPanel();

    expect(screen.getByRole("button", { name: "Vis programmet" })).toBeTruthy();
    expect(screen.queryByText("Velkomst")).toBeNull();
  });
});
