// @vitest-environment jsdom
/**
 * The side panel of the run sheet on a large screen: who has said yes to each role, the reader's own
 * roles, and the panel is hidden on a phone and on paper.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Assignment, Gathering, Person, Task, VolunteerRole } from "../src/types";
import type { GatheringDetail } from "../src/components/gathering/gatheringDetail";
import { RunSheetSidePanel } from "../src/components/gathering/RunSheetSidePanel";
import { SharedRunSheetView } from "../src/components/gathering/SharedRunSheetView";

afterEach(() => cleanup());

const gathering: Gathering = {
  id: "gt",
  groupId: "g-gudstjeneste",
  title: "Gudstjeneste",
  startsAt: "2026-11-15T11:00:00Z",
  endsAt: "2026-11-15T12:00:00Z",
  visibility: "offentlig",
  isGudstjeneste: true,
  programSchedule: [
    { time: "11:00", title: "Lyd", taskId: "t-lyd" },
    { time: "11:30", title: "Kaffe", taskId: "t-kaffe" },
  ],
} as Gathering;

const roles: VolunteerRole[] = [{ id: "role-lyd", name: "Lyd", sortOrder: 1 }];

const people: Record<string, Person> = {
  kari: { id: "kari", name: "Kari Nordmann", globalRole: "member" } as Person,
  ola: { id: "ola", name: "Ola Hansen", globalRole: "member" } as Person,
};

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  gatheringId: "gt",
  title: `Tittel ${id}`,
  status: "assigned",
  neededCount: 1,
  ...extra,
});

const assignment = (id: string, taskId: string, personId: string, response: Assignment["response"]): Assignment => ({
  id,
  taskId,
  personId,
  response,
});

/** A detail with the same shape as useLeaderGatheringDetail gives, for the parts the panel reads. */
function detailWith(tasks: Task[], assignments: Assignment[]): GatheringDetail {
  const tasksWithDetails = tasks.map((t) => ({
    task: t,
    assignedPersons: assignments
      .filter((a) => a.taskId === t.id)
      .map((a) => ({ assignment: a, person: people[a.personId], statusLabel: a.response, response: a.response })),
    confirmedCount: 0,
    neededCount: t.neededCount,
  }));
  return {
    gathering,
    tasksWithDetails,
    programSchedule: gathering.programSchedule ?? [],
    volunteerRoles: roles,
  } as unknown as GatheringDetail;
}

const tasks = [
  task("t-lyd", { volunteerRoleId: "role-lyd", title: "Lyd og bilde" }),
  task("t-kaffe", { title: "Kaffe" }),
];

describe("Bemanning og dine oppgaver på Kjøreplanen", () => {
  test("viser navnene til dem som har sagt ja, «–» for en ledig rolle, og «Du» på egen rad", () => {
    const detail = detailWith(tasks, [
      assignment("a1", "t-lyd", "kari", "confirmed"),
      assignment("a2", "t-lyd", "ola", "confirmed"),
      assignment("a3", "t-kaffe", "kari", "pending"),
    ]);

    render(<RunSheetSidePanel detail={detail} personId="ola" />);

    const bemanning = screen.getByRole("heading", { name: "Bemanning" }).parentElement as HTMLElement;
    const rows = Array.from(bemanning.querySelectorAll(":scope > div > div")) as HTMLElement[];
    expect(rows).toHaveLength(2);

    // The sound task: both who have said yes are named, and it is Ola's row, so it has the badge
    expect(rows[0].textContent).toBe("Lyd — Kari Nordmann, Ola HansenDu");
    // Nobody has said yes to the kaffe, and Kari's pending answer is not shown
    expect(rows[1].textContent).toBe("Kaffe –");
    expect(within(rows[0]).getByText("Du")).toBeTruthy();
    expect(within(rows[1]).queryByText("Du")).toBeNull();
    expect(screen.getAllByText("Du")).toHaveLength(1);
  });

  test("«Dine oppgaver» listes bare når personen har oppgaver her", () => {
    const detail = detailWith(tasks, [assignment("a1", "t-lyd", "ola", "confirmed")]);
    const { unmount } = render(<RunSheetSidePanel detail={detail} personId="ola" />);
    expect(screen.getByText("Dine oppgaver")).toBeTruthy();
    const mine = screen.getByRole("heading", { name: "Dine oppgaver" }).parentElement as HTMLElement;
    expect(within(mine).getByRole("listitem").textContent).toBe("Lyd");
    unmount();

    render(<RunSheetSidePanel detail={detailWith(tasks, [])} personId="ola" />);
    expect(screen.queryByText("Dine oppgaver")).toBeNull();
  });

  test("Kjøreplanen legger panelet bare på PC, og ikke på papiret", () => {
    const detail = detailWith(tasks, [assignment("a1", "t-lyd", "kari", "confirmed")]);
    render(
      <MemoryRouter>
        <SharedRunSheetView detail={detail} personId="ola" planningLink={null} backLink="/minside" />
      </MemoryRouter>
    );

    const panel = screen.getByRole("complementary", { name: "Bemanning og dine oppgaver" });
    expect(panel.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "lg:block", "print:hidden"]));
    expect(within(panel).getByText("Kari Nordmann")).toBeTruthy();
  });
});
