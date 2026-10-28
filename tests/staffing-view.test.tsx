// @vitest-environment jsdom
/**
 * «Bemanning» as the leader and the admin see it: one card per team, free slots filled from
 * «Fyll plassen», those who said no behind a small button, and the filter that shows what must be ordered.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Assignment, Group, Task } from "../src/types";
import type { GatheringDetail } from "../src/components/gathering/gatheringDetail";
import type { RunSheetTask } from "../src/utils/runSheet";
import { buildStaffingRoster, type RosterRow } from "../src/utils/staffingRoster";
import { RESPONSE_LABELS, calculateTaskStaffingStatus } from "../src/utils/staffing";
import { StaffingView } from "../src/components/gathering/StaffingView";

// The dialogs have their own tests; here they only show what they were asked for
vi.mock("../src/components/gathering/AssignPersonDialog", async () => {
  const { createElement } = await import("react");
  return {
    AssignPersonDialog: (props: { taskId: string; mode: string }) =>
      createElement("div", { "data-testid": "assign" }, `${props.taskId}:${props.mode}`),
  };
});
vi.mock("../src/components/gathering/InstructionDialog", () => ({ InstructionDialog: () => null }));
vi.mock("../src/components/gathering/EditTaskDialog", () => ({ EditTaskDialog: () => null }));

const teams: Record<string, Group> = {
  lovsang: { id: "lovsang", name: "Lovsang", memberIds: [], leaderIds: [] },
  vert: { id: "vert", name: "Møtevert", memberIds: [], leaderIds: [] },
};

/** A role with its people, given as [name, response]. Same rules as the gathering view. */
function role(
  id: string,
  groupId: string | undefined,
  people: [string, Assignment["response"]][],
  extra: Partial<Task> = {}
): RunSheetTask {
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
    taskGroup: groupId ? teams[groupId] : undefined,
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

const details = [
  role("Lovsang", "lovsang", [["Lars Lyd", "confirmed"]]),
  role("Barnekirke", "lovsang", [["Berit Barn", "confirmed"], ["Frode Forfall", "withdrawn"]], { neededCount: 2 }),
  role("Kirkekaffe", "vert", [["Kari Kjøkken", "declined"]]),
  role("Møtevert", "vert", []),
  role("Taler", undefined, [["Tone Tale", "pending"]]),
];

function rowsOf(list: RunSheetTask[]): RosterRow[] {
  return buildStaffingRoster([], list);
}

const detail = {
  updateAssignmentStatus: vi.fn(() => ({ success: true })),
  removeAssignment: vi.fn(() => ({ success: true })),
} as unknown as GatheringDetail;

function renderView(rows: RosterRow[], canAdminister = true) {
  return render(
    <StaffingView detail={detail} rows={rows} canAdminister={canAdminister} showToast={() => undefined} />
  );
}

/** The card of one team, and the block of one role. */
const teamCard = (name: string) => screen.getByRole("region", { name });
const roleBlock = (id: string) => document.getElementById(`roster-${id}`)!;

afterEach(cleanup);

describe("Bemanning som team-kort", () => {
  test("hvert team har ett kort, og headeren teller bekreftet, venter og ledig", () => {
    renderView(rowsOf(details));

    const lovsang = within(teamCard("Lovsang"));
    expect(lovsang.getByText("2 bekreftet")).toBeTruthy();
    expect(lovsang.getByText("0 venter")).toBeTruthy();
    expect(lovsang.getByText("1 ledig")).toBeTruthy();

    const vert = within(teamCard("Møtevert"));
    expect(vert.getByText("0 bekreftet")).toBeTruthy();
    expect(vert.getByText("2 ledige")).toBeTruthy();
  });

  test("et team er foldet på mobil til headeren, og åpnes med et trykk", () => {
    renderView(rowsOf(details));

    const header = within(teamCard("Lovsang")).getByRole("button", { name: /^Lovsang/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
  });

  test("ingen rød «Må ordnes»-seksjon, bare teamene", () => {
    renderView(rowsOf(details));
    expect(screen.queryByText(/Må ordnes \(/)).toBeNull();
  });
});

describe("Ledig plass", () => {
  test("«Fyll plassen» åpner Tildel og Forespør, og Tildel kaller onAssign med bekreftet", () => {
    renderView(rowsOf(details));

    const block = within(roleBlock("Kirkekaffe"));
    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    fireEvent.click(block.getByRole("button", { name: "Tildel" }));

    expect(screen.getByTestId("assign").textContent).toBe("Kirkekaffe:confirmed");
  });

  test("Forespør sender samme oppgave som forespurt", () => {
    renderView(rowsOf(details));

    const block = within(roleBlock("Møtevert"));
    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    fireEvent.click(block.getByRole("button", { name: "Forespør" }));

    expect(screen.getByTestId("assign").textContent).toBe("Møtevert:pending");
  });

  test("Escape og et nytt trykk på «Fyll plassen» lukker valget", () => {
    renderView(rowsOf(details));

    const block = within(roleBlock("Møtevert"));
    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    expect(block.queryByRole("button", { name: "Tildel" })).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(block.queryByRole("button", { name: "Tildel" })).toBeNull();

    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    fireEvent.click(block.getByRole("button", { name: "Fyll plassen" }));
    expect(block.queryByRole("button", { name: "Tildel" })).toBeNull();
  });

  test("en leder ser ikke «Fyll plassen» i en annen gruppe", () => {
    renderView(rowsOf(details), false);

    expect(within(roleBlock("Barnekirke")).getByRole("button", { name: "Fyll plassen" })).toBeTruthy();
    expect(within(roleBlock("Møtevert")).queryByRole("button", { name: "Fyll plassen" })).toBeNull();
  });
});

describe("Sa nei", () => {
  test("de som sa nei er skjult bak «1 sa nei», og vises når den trykkes", () => {
    renderView(rowsOf(details));

    const block = within(roleBlock("Kirkekaffe"));
    expect(screen.queryByText("Kari Kjøkken")).toBeNull();
    fireEvent.click(block.getByRole("button", { name: "1 sa nei" }));
    expect(block.getByText("Kari Kjøkken")).toBeTruthy();
  });
});

describe("Filteret «Vis bare det som må ordnes»", () => {
  test("viser bare forfall og ubesatt, og skjuler team uten dem", () => {
    renderView(rowsOf(details));

    const filter = screen.getByRole("button", { name: "Vis bare det som må ordnes" });
    expect(filter.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(filter);
    expect(filter.getAttribute("aria-pressed")).toBe("true");

    expect(roleBlock("Barnekirke")).toBeTruthy();
    expect(roleBlock("Møtevert")).toBeTruthy();
    expect(document.getElementById("roster-Lovsang")).toBeNull();
    expect(document.getElementById("roster-Taler")).toBeNull();
    expect(screen.queryByRole("region", { name: "Uten team" })).toBeNull();
  });

  test("når ingenting må ordnes, står knappen som «Alt er dekket» og er avslått", () => {
    renderView(rowsOf([role("Lovsang", "lovsang", [["Lars Lyd", "confirmed"]])]));

    const filter = screen.getByRole("button", { name: "Alt er dekket" }) as HTMLButtonElement;
    expect(filter.disabled).toBe(true);
  });
});
