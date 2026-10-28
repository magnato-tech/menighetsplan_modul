// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { StaffingView } from "../src/components/gathering/StaffingView";
import type { GatheringDetail } from "../src/components/gathering/gatheringDetail";
import type { RosterRow } from "../src/utils/staffingRoster";

// The team cards of «Bemanning» in columns: as many as the width holds, every team once, in team order.

const row = (id: string, team: string, groupId: string, free: number): RosterRow =>
  ({
    task: { id, title: `Rolle ${id}`, gatheringId: "g", groupId, neededCount: free, status: "open" },
    roleTitle: `Rolle ${id}`,
    groupId,
    groupName: team,
    isMyGroup: false,
    programTimes: [],
    needed: free,
    confirmed: 0,
    pending: 0,
    free,
    state: "ubesatt",
    people: [],
  }) as unknown as RosterRow;

const rows = [
  row("1", "Lyd", "lyd", 1),
  row("2", "Bilde", "bilde", 2),
  row("3", "Kor", "kor", 1),
  row("4", "Ung", "ung", 3),
  row("5", "Vert", "vert", 1),
];

const detail = { updateAssignmentStatus: vi.fn(), removeAssignment: vi.fn() } as unknown as GatheringDetail;

function renderView(width?: number) {
  return render(
    <StaffingView detail={detail} rows={rows} canAdminister={true} width={width} showToast={() => undefined} />
  );
}

afterEach(() => cleanup());

describe("StaffingView: lag i kolonner", () => {
  test("med 680 px er det to kolonner, og hvert team står én gang", () => {
    const { container } = renderView(680);
    const columns = container.querySelectorAll("[data-staffing-column]");
    expect(columns).toHaveLength(2);
    const names = Array.from(container.querySelectorAll("section")).map((s) => s.getAttribute("aria-label"));
    expect(names.sort()).toEqual(["Bilde", "Kor", "Lyd", "Ung", "Vert"].sort());
  });

  test("første rad står fra venstre i team-rekkefølgen, og neste kort går i den korteste kolonnen", () => {
    const { container } = renderView(680);
    const [left, right] = Array.from(container.querySelectorAll("[data-staffing-column]"));
    // Teams without times are in name order here: Bilde, Kor, Lyd, Ung, Vert. All are folded in jsdom (no
    // matchMedia), so each card is as tall as its header, and the second card goes to the free right column.
    expect(within(left as HTMLElement).getAllByRole("region")[0].getAttribute("aria-label")).toBe("Bilde");
    expect(within(right as HTMLElement).getAllByRole("region")[0].getAttribute("aria-label")).toBe("Kor");
  });

  test("under 656 px er det én kolonne, og uten bredde måles den ikke (tester)", () => {
    const narrow = renderView(400);
    expect(narrow.container.querySelectorAll("[data-staffing-column]")).toHaveLength(1);
    cleanup();
    const unmeasured = renderView();
    expect(unmeasured.container.querySelectorAll("[data-staffing-column]")).toHaveLength(1);
    expect(screen.getAllByRole("region")).toHaveLength(5);
  });

  test("tre kolonner på 1000 px", () => {
    const { container } = renderView(1000);
    expect(container.querySelectorAll("[data-staffing-column]")).toHaveLength(3);
  });
});
