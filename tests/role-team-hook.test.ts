// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useRoleTeam } from "../src/hooks/useRoleTeam";
import type { Group, Task, VolunteerRole } from "../src/types";

const { patchVolunteerRole, moveRoleTasksToTeam } = vi.hoisted(() => ({
  patchVolunteerRole: vi.fn(async () => undefined),
  moveRoleTasksToTeam: vi.fn(async () => undefined),
}));

vi.mock("../src/services/volunteerRoles", () => ({
  patchVolunteerRole,
  moveRoleTasksToTeam,
}));

const groups = [
  { id: "group-rigging", name: "Rigging", memberIds: [], leaderIds: [] },
  { id: "group-lyd", name: "Lyd og bilde", memberIds: [], leaderIds: [] },
] as Group[];

const task = (id: string, volunteerRoleId?: string, groupId?: string) =>
  ({ id, gatheringId: "g1", title: id, status: "open", ...(volunteerRoleId ? { volunteerRoleId } : {}), ...(groupId ? { groupId } : {}) }) as Task;

afterEach(() => {
  cleanup();
  patchVolunteerRole.mockClear();
  moveRoleTasksToTeam.mockClear();
});

describe("useRoleTeam: setRoleTeam", () => {
  test("lagrer teamet på rollen og flytter bare rollens oppgaver som har et annet team", async () => {
    const tasks = [
      task("t1", "role-1"),
      task("t2", "role-1", "group-rigging"),
      task("t3", "role-2"),
      task("t4"),
    ];
    const role = { id: "role-1", name: "Lyd", sortOrder: 0 } as VolunteerRole;
    const { result } = renderHook(() => useRoleTeam(tasks, groups));

    const outcome = await result.current(role, "group-rigging");

    expect(patchVolunteerRole).toHaveBeenCalledWith("role-1", { groupId: "group-rigging" });
    expect(moveRoleTasksToTeam).toHaveBeenCalledTimes(1);
    expect(moveRoleTasksToTeam).toHaveBeenCalledWith("group-rigging", ["t1"]);
    expect(outcome).toEqual({ text: "Lyd er knyttet til Rigging. 1 oppgave ble flyttet til gruppen.", moved: 1 });
  });

  test("tar man bort teamet, fjernes det fra oppgavene, og det sies hvor mange som er uten team", async () => {
    const tasks = [task("t1", "role-1", "group-rigging"), task("t2", "role-1")];
    const role = { id: "role-1", name: "Lyd", groupId: "group-rigging", sortOrder: 0 } as VolunteerRole;
    const { result } = renderHook(() => useRoleTeam(tasks, groups));

    const outcome = await result.current(role, undefined);

    expect(patchVolunteerRole).toHaveBeenCalledWith("role-1", { groupId: undefined });
    expect(moveRoleTasksToTeam).toHaveBeenCalledWith(undefined, ["t1"]);
    expect(outcome.text).toBe("Lyd er ikke lenger knyttet til et team. 1 oppgave er uten team nå.");
    expect(outcome.moved).toBe(1);
  });

  test("et team som ikke endres, lagrer bare rollen og flytter ingenting", async () => {
    const tasks = [task("t1", "role-1")];
    const role = { id: "role-1", name: "Lyd", groupId: "group-rigging", sortOrder: 0 } as VolunteerRole;
    const { result } = renderHook(() => useRoleTeam(tasks, groups));

    const outcome = await result.current(role, "group-rigging", { instruction: "Møt kl. 09:30" });

    expect(patchVolunteerRole).toHaveBeenCalledWith("role-1", { instruction: "Møt kl. 09:30", groupId: "group-rigging" });
    expect(moveRoleTasksToTeam).not.toHaveBeenCalled();
    expect(outcome).toEqual({ text: "«Lyd» er oppdatert.", moved: 0 });
  });

  test("uten oppgaver som skal flyttes, sies det bare at rollen er oppdatert", async () => {
    const role = { id: "role-1", name: "Lyd", sortOrder: 0 } as VolunteerRole;
    const { result } = renderHook(() => useRoleTeam([task("t3", "role-2")], groups));

    const outcome = await result.current(role, "group-lyd");

    expect(moveRoleTasksToTeam).not.toHaveBeenCalled();
    expect(outcome).toEqual({ text: "«Lyd» er oppdatert.", moved: 0 });
  });

  test("en oppgave i flertall får «oppgaver» og flere oppgaver ny tekst", async () => {
    const tasks = [task("t1", "role-1"), task("t2", "role-1")];
    const role = { id: "role-1", name: "Lyd", sortOrder: 0 } as VolunteerRole;
    const { result } = renderHook(() => useRoleTeam(tasks, groups));

    const outcome = await result.current(role, "group-lyd");

    expect(outcome.text).toBe("Lyd er knyttet til Lyd og bilde. 2 oppgaver ble flyttet til gruppen.");
  });
});
