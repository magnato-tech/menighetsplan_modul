// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useSharedRoleTeams } from "../src/hooks/useRoleTeam";
import { tasksOfTemplate } from "../src/utils/gatheringTemplates";
import type { Group, Task, VolunteerRole } from "../src/types";

const { patchVolunteerRole, moveRoleTasksToTeam, updateTaskTeams } = vi.hoisted(() => ({
  patchVolunteerRole: vi.fn(async () => undefined),
  moveRoleTasksToTeam: vi.fn(async () => undefined),
  updateTaskTeams: vi.fn(async () => undefined),
}));

vi.mock("../src/services/volunteerRoles", () => ({
  patchVolunteerRole,
  moveRoleTasksToTeam,
  updateTaskTeams,
}));

const groups = [
  { id: "lovsang-1", name: "Lovsangsteam 1", memberIds: [], leaderIds: [] },
  { id: "lovsang-2", name: "Lovsangsteam 2", memberIds: [], leaderIds: [] },
  { id: "lyd", name: "Lyd og bilde", memberIds: [], leaderIds: [] },
] as Group[];

const lovsang = (groupIds?: string[]): VolunteerRole =>
  ({ id: "role-lovsang", name: "Lovsang", sortOrder: 0, ...(groupIds ? { groupId: groupIds[0], groupIds: groupIds.length > 1 ? groupIds : undefined } : {}) }) as VolunteerRole;

const task = (id: string, extra: Partial<Task> = {}) =>
  ({ id, gatheringId: "g1", title: id, status: "open", volunteerRoleId: "role-lovsang", ...extra }) as Task;

afterEach(() => {
  cleanup();
  patchVolunteerRole.mockClear();
  moveRoleTasksToTeam.mockClear();
  updateTaskTeams.mockClear();
});

describe("useSharedRoleTeams: shareRole", () => {
  test("deler rollen: teamene lagres, og eksisterende oppgaver beholder sitt team", async () => {
    const tasks = [task("t1", { groupId: "lovsang-1" })];
    const { result } = renderHook(() => useSharedRoleTeams(tasks, groups));

    const outcome = await result.current.shareRole(lovsang(["lovsang-1"]), "lovsang-2");

    expect(patchVolunteerRole).toHaveBeenCalledWith("role-lovsang", { groupId: "lovsang-1", groupIds: ["lovsang-1", "lovsang-2"] });
    expect(updateTaskTeams).not.toHaveBeenCalled();
    expect(moveRoleTasksToTeam).not.toHaveBeenCalled();
    expect(outcome.text).toBe(
      "Lovsang deles nå av Lovsangsteam 1 og Lovsangsteam 2. Nye gudstjenester får oppgaven som «Ikke fordelt», og lederne fordeler den."
    );
  });

  test("ikke fordelte oppgaver får det nye teamet blant valgene", async () => {
    const tasks = [task("u1", { teamChoices: ["lovsang-1"] }), task("u2", { teamChoices: ["lyd"] }), task("t1", { groupId: "lovsang-1" })];
    const { result } = renderHook(() => useSharedRoleTeams(tasks, groups));

    await result.current.shareRole(lovsang(["lovsang-1"]), "lovsang-2");

    expect(updateTaskTeams).toHaveBeenCalledWith([
      { taskId: "u1", groupId: undefined, teamChoices: ["lovsang-1", "lovsang-2"] },
      { taskId: "u2", groupId: undefined, teamChoices: ["lyd", "lovsang-2"] },
    ]);
  });

  test("en rolle uten team oppfører seg som å sette team: oppgavene flyttes", async () => {
    const tasks = [task("t1")];
    const { result } = renderHook(() => useSharedRoleTeams(tasks, groups));

    await result.current.shareRole(lovsang(), "lovsang-1");

    expect(patchVolunteerRole).toHaveBeenCalledWith("role-lovsang", { groupId: "lovsang-1" });
    expect(moveRoleTasksToTeam).toHaveBeenCalledWith("lovsang-1", ["t1"]);
  });
});

describe("useSharedRoleTeams: removeTeamFromRole", () => {
  test("med to team blir det ene som står igjen eneste team, også for ikke fordelte oppgaver", async () => {
    const tasks = [
      task("t1", { groupId: "lovsang-1" }),
      task("t2", { groupId: "lovsang-2" }),
      task("t3", { teamChoices: ["lovsang-1", "lovsang-2"] }),
      task("t4", { groupId: "lovsang-1", status: "cancelled" }),
      task("t5", { groupId: "lyd" }),
    ];
    const { result } = renderHook(() => useSharedRoleTeams(tasks, groups));

    const outcome = await result.current.removeTeamFromRole(lovsang(["lovsang-1", "lovsang-2"]), "lovsang-1");

    expect(patchVolunteerRole).toHaveBeenCalledWith("role-lovsang", { groupId: "lovsang-2", groupIds: undefined });
    expect(updateTaskTeams).toHaveBeenCalledWith([
      { taskId: "t1", groupId: "lovsang-2", teamChoices: undefined },
      { taskId: "t3", groupId: "lovsang-2", teamChoices: undefined },
    ]);
    expect(outcome.moved).toBe(2);
    expect(outcome.text).toBe("Lovsang hører ikke lenger til Lovsangsteam 1. 2 oppgaver går nå til Lovsangsteam 2.");
  });

  test("med tre team blir de to som står igjen valg for oppgaven, ikke fordelt", async () => {
    const threeTeams = ["lovsang-1", "lovsang-2", "lyd"];
    const tasks = [task("t1", { groupId: "lovsang-1" }), task("t2", { groupId: "lyd" })];
    const { result } = renderHook(() => useSharedRoleTeams(tasks, groups));

    await result.current.removeTeamFromRole(lovsang(threeTeams), "lovsang-1");

    expect(patchVolunteerRole).toHaveBeenCalledWith("role-lovsang", { groupId: "lovsang-2", groupIds: ["lovsang-2", "lyd"] });
    expect(updateTaskTeams).toHaveBeenCalledWith([{ taskId: "t1", groupId: undefined, teamChoices: ["lovsang-2", "lyd"] }]);
  });

  test("uten team igjen blir oppgavene uten team", async () => {
    const tasks = [task("t1", { teamChoices: ["lovsang-1"] })];
    const { result } = renderHook(() => useSharedRoleTeams(tasks, groups));

    const outcome = await result.current.removeTeamFromRole(lovsang(["lovsang-1"]), "lovsang-1");

    expect(updateTaskTeams).toHaveBeenCalledWith([{ taskId: "t1", groupId: undefined, teamChoices: undefined }]);
    expect(outcome.text).toBe("Lovsang hører ikke lenger til Lovsangsteam 1. 1 oppgave er uten team nå.");
  });

  test("oppgaver som hører til et annet team røres ikke", async () => {
    const tasks = [task("t1", { groupId: "lyd" }), task("t2", { teamChoices: ["lyd"] })];
    const { result } = renderHook(() => useSharedRoleTeams(tasks, groups));

    const outcome = await result.current.removeTeamFromRole(lovsang(["lovsang-1", "lovsang-2"]), "lovsang-1");

    expect(updateTaskTeams).not.toHaveBeenCalled();
    expect(outcome.moved).toBe(0);
  });
});

describe("Mal med delt rolle", () => {
  const sharedRole = { id: "role-lovsang", name: "Lovsang", sortOrder: 0, groupId: "lovsang-1", groupIds: ["lovsang-1", "lovsang-2"] } as VolunteerRole;

  test("en oppgave fra malen for en delt rolle er ikke fordelt, med valgene", () => {
    const [lovsangTask] = tasksOfTemplate({ program: [{ id: "a", offsetMinutes: 0, durationMinutes: 5, title: "Lovsang", roleId: "role-lovsang", roleName: "Lovsang" }], extraStaffing: [] }, [sharedRole]);
    expect(lovsangTask).toMatchObject({ title: "Lovsang", volunteerRoleId: "role-lovsang", teamChoices: ["lovsang-1", "lovsang-2"] });
    expect(lovsangTask.groupId).toBeUndefined();
  });

  test("en rolle med ett team gir oppgaven teamet, uten valg", () => {
    const [single] = tasksOfTemplate({ program: [{ id: "a", offsetMinutes: 0, durationMinutes: 5, title: "Lyd", roleId: "role-lyd", roleName: "Lyd" }], extraStaffing: [] }, [
      { id: "role-lyd", name: "Lyd", sortOrder: 0, groupId: "lyd" },
    ]);
    expect(single.groupId).toBe("lyd");
    expect(single.teamChoices).toBeUndefined();
  });
});
