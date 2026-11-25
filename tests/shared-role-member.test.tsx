// @vitest-environment jsdom
/**
 * A role shared by several teams (Lovsang for «Lovsangsteam 1» and «Lovsangsteam 2»): a task of the role
 * starts «Ikke fordelt», and one of the teams takes it by writing only { groupId }.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Assignment, Gathering, Group, Task } from "../src/types";

const fake = vi.hoisted(() => ({ current: {} as Record<string, any> }));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => fake.current }));

import { useLeaderGroupDetail } from "../src/hooks/leaderHooks";
import { useTaskDetail } from "../src/hooks/memberHooks";
import { GroupActivities } from "../src/pages/leaderGroup/GroupActivities";
import { ConfirmProvider } from "../src/components/ConfirmProvider";
import { cardsFor, planPersonIds, type SemesterPlan } from "../src/utils/semesterPlan";

const FUTURE = "2099-03-07T10:00:00.000Z";

const group = (id: string, name: string, memberIds: string[], leaderIds: string[] = []): Group => ({
  id,
  name,
  memberIds,
  leaderIds,
  category: "tjenestegruppe",
} as Group);

const groups: Group[] = [
  group("lovsang-1", "Lovsangsteam 1", ["anne"], ["leder1"]),
  group("lovsang-2", "Lovsangsteam 2", ["bjorn"], ["leder2"]),
  group("lyd", "Lyd", ["carl"]),
];

const gathering = (id: string, startsAt: string): Gathering =>
  ({ id, groupId: "lyd", title: `Samling ${id}`, startsAt, visibility: "offentlig" } as Gathering);

const gatherings: Gathering[] = [gathering("g1", FUTURE)];

/** Not yet given to a team: no groupId, and both teams of the role may take it. */
const undistributed: Task = {
  id: "t-undist",
  gatheringId: "g1",
  title: "Forsang",
  status: "open",
  neededCount: 1,
  volunteerRoleId: "role-lovsang",
  teamChoices: ["lovsang-1", "lovsang-2"],
} as Task;

const roles = [{ id: "role-lovsang", name: "Lovsang", groupIds: ["lovsang-1", "lovsang-2"] }];

const updateTask = vi.fn((_taskId: string, _updates: Record<string, unknown>) => ({ success: true }));
const assignTaskToPerson = vi.fn(() => ({ success: true }));

function setFirebase(overrides: Record<string, unknown> = {}, tasks: Task[] = [undistributed], assignments: Assignment[] = []) {
  fake.current = {
    currentUser: { id: "leder1", name: "Leder", globalRole: "member" },
    allPersons: [],
    hasFullRegister: false,
    getPersonById: () => undefined,
    gatherings,
    tasks,
    assignments,
    groups,
    getGroupById: (id: string) => groups.find((g) => g.id === id),
    getGroupMessages: () => [],
    getGatheringById: (id: string) => gatherings.find((g) => g.id === id),
    getTaskById: (id: string) => tasks.find((t) => t.id === id),
    getAllAssignmentsForTask: (taskId: string) => assignments.filter((a) => a.taskId === taskId),
    getPersonAttendance: () => undefined,
    isPersonInGroup: (personId: string, groupId: string) => groups.find((g) => g.id === groupId)?.memberIds.includes(personId) ?? false,
    watchGatheringAssignments: () => undefined,
    updateTask,
    assignTaskToPerson,
    volunteerRoles: roles,
    ...overrides,
  };
}

beforeEach(() => {
  updateTask.mockClear();
  assignTaskToPerson.mockClear();
});
afterEach(cleanup);

describe("Ikke fordelt i gruppen", () => {
  test("en leder ser oppgaven under «Ikke fordelt», med begge teamene, og «Vi tar denne» skriver bare { groupId }", () => {
    setFirebase();
    const { result } = renderHook(() => useLeaderGroupDetail("lovsang-1"));

    expect(result.current.undistributedTasks.map((item) => item.task.id)).toEqual(["t-undist"]);
    expect(result.current.undistributedTasks[0].teamNames).toEqual(["Lovsangsteam 1", "Lovsangsteam 2"]);

    result.current.takeTask("t-undist");
    expect(updateTask).toHaveBeenCalledWith("t-undist", { groupId: "lovsang-1" });
    expect(updateTask.mock.calls[0][1]).toStrictEqual({ groupId: "lovsang-1" });
  });

  test("oppgaver som er avlyst eller ligger i fortiden vises ikke", () => {
    const past: Task = { ...undistributed, id: "t-past", gatheringId: "g-past" } as Task;
    setFirebase({ gatherings: [...gatherings, gathering("g-past", "2001-01-01T10:00:00.000Z")] }, [undistributed, past]);
    const { result } = renderHook(() => useLeaderGroupDetail("lovsang-1"));
    expect(result.current.undistributedTasks.map((item) => item.task.id)).toEqual(["t-undist"]);
  });

  test("gruppen kan gi oppgaven tilbake når rollen deles, og skriver teamChoices", () => {
    const given: Task = { ...undistributed, id: "t-given", groupId: "lovsang-1", teamChoices: undefined } as Task;
    setFirebase({}, [given]);
    const { result } = renderHook(() => useLeaderGroupDetail("lovsang-1"));

    expect(result.current.canGiveBack(given)).toBe(true);
    result.current.giveTaskBack("t-given");
    expect(updateTask).toHaveBeenCalledWith("t-given", { groupId: undefined, teamChoices: ["lovsang-1", "lovsang-2"] });
  });

  test("en rolle med ett team kan ikke gis tilbake", () => {
    const solo: Task = { ...undistributed, id: "t-solo", groupId: "lyd", teamChoices: undefined, volunteerRoleId: "role-lyd" } as Task;
    setFirebase({ volunteerRoles: [{ id: "role-lyd", name: "Lyd", groupId: "lyd" }] }, [solo]);
    const { result } = renderHook(() => useLeaderGroupDetail("lyd"));
    expect(result.current.canGiveBack(solo)).toBe(false);
  });

  test("GroupActivities viser «Ikke fordelt» med antall, teamene og knappen", () => {
    setFirebase();
    const detail = renderHook(() => useLeaderGroupDetail("lovsang-1")).result.current;
    render(
      <MemoryRouter>
        <ConfirmProvider>
          <GroupActivities detail={detail as any} showToast={() => undefined} />
        </ConfirmProvider>
      </MemoryRouter>
    );

    const section = document.getElementById("group-undistributed")!;
    expect(section.textContent).toContain("Ikke fordelt (1)");
    expect(section.textContent).toContain("Disse oppgavene deles med et annet team. Ta dem gruppen deres skal ha.");
    expect(section.textContent).toContain("Lovsangsteam 2");

    fireEvent.click(document.getElementById("btn-take-task-t-undist")!);
    expect(updateTask).toHaveBeenCalledWith("t-undist", { groupId: "lovsang-1" });
    expect(screen.getByText("Vi tar denne")).toBeTruthy();
  });

  test("uten oppgaver som ingen har tatt, vises ikke seksjonen", () => {
    setFirebase({}, []);
    const detail = renderHook(() => useLeaderGroupDetail("lovsang-1")).result.current;
    render(
      <MemoryRouter>
        <ConfirmProvider>
          <GroupActivities detail={detail as any} showToast={() => undefined} />
        </ConfirmProvider>
      </MemoryRouter>
    );
    expect(document.getElementById("group-undistributed")).toBeNull();
  });
});

describe("Medlemmer av teamene", () => {
  test("planen og kortene viser oppgaven for medlemmer av begge teamene, én gang per person", () => {
    const plan: SemesterPlan = {
      id: "p",
      name: "Våren",
      firstDay: "2099-01-01",
      lastDay: "2099-12-31",
      answerBy: "2099-02-01",
      opensAt: "2099-01-01T00:00:00.000Z",
      createdAt: "2098-12-01T00:00:00.000Z",
    };
    const data = { gatherings, tasks: [undistributed], groups, assignments: [] };

    // Everyone in the two teams, leaders included (as allGroupPersonIds counts them), and no one in Lyd
    expect(planPersonIds(plan, gatherings, [undistributed], groups).sort()).toEqual(["anne", "bjorn", "leder1", "leder2"]);
    expect(cardsFor(plan, "anne", data)).toHaveLength(1);
    expect(cardsFor(plan, "anne", data)[0].tasks.map((item) => item.task.id)).toEqual(["t-undist"]);
    expect(cardsFor(plan, "bjorn", data)[0].tasks.map((item) => item.task.id)).toEqual(["t-undist"]);
    expect(cardsFor(plan, "carl", data)).toEqual([]);
  });

  test("et medlem tar oppgaven for sitt team først, og setter seg deretter på den", () => {
    setFirebase({ currentUser: { id: "bjorn", name: "Bjørn", globalRole: "member" } });
    const { result } = renderHook(() => useTaskDetail("t-undist"));

    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.group?.id).toBe("lovsang-2");
    expect(result.current.canClaim).toBe(true);

    result.current.claimTask();
    expect(updateTask).toHaveBeenCalledWith("t-undist", { groupId: "lovsang-2" });
    expect(updateTask.mock.calls[0][1]).toStrictEqual({ groupId: "lovsang-2" });
    expect(assignTaskToPerson).toHaveBeenCalledWith("t-undist", "bjorn", "confirmed");
  });

  test("feiler takingen, settes personen ikke på oppgaven", () => {
    setFirebase({ currentUser: { id: "bjorn", name: "Bjørn", globalRole: "member" }, updateTask: vi.fn(() => ({ success: false, error: "Nei" })) });
    const { result } = renderHook(() => useTaskDetail("t-undist"));

    const outcome = result.current.claimTask();
    expect(outcome.success).toBe(false);
    expect(assignTaskToPerson).not.toHaveBeenCalled();
  });

  test("en person i ingen av teamene har ingen tilgang", () => {
    setFirebase({ currentUser: { id: "carl", name: "Carl", globalRole: "member" } });
    const { result } = renderHook(() => useTaskDetail("t-undist"));
    expect(result.current.permissionDenied).toBe(true);
  });
});
