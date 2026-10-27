import { describe, expect, test } from "vitest";
import { DEFAULT_VOLUNTEER_ROLE_IDS, DEFAULT_VOLUNTEER_ROLE_NAMES, buildInitialVolunteerRoles } from "../src/data/defaultVolunteerRoles";
import { demoServiceSeries } from "../src/data/demoServices";
import { initialAssignments, initialGatherings, initialGroups, initialTasks } from "../src/data/mockData";
import { programEditorAssignment } from "../src/utils/programEditor";

describe("Standardrollene", () => {
  test("standarden har de 12 rollene, og hver rolle beholder id-en sin", () => {
    expect([...DEFAULT_VOLUNTEER_ROLE_NAMES].sort((a, b) => a.localeCompare(b, "nb"))).toEqual([
      "Baking", "Barnekirke", "Bilde", "Forbønn", "Kjøkken", "Lovsang", "Lyd", "Møteleder", "Møtevert", "Pynting", "Rigging", "Taler",
    ]);
    expect(DEFAULT_VOLUNTEER_ROLE_IDS).toEqual({
      Baking: "volrole-1",
      Barnekirke: "volrole-2",
      Bilde: "volrole-3",
      Forbønn: "volrole-4",
      Kjøkken: "volrole-5",
      Lovsang: "volrole-7",
      Lyd: "volrole-8",
      Møteleder: "volrole-10",
      Møtevert: "volrole-11",
      Pynting: "volrole-12",
      Rigging: "volrole-13",
      Taler: "volrole-14",
    });
    expect(buildInitialVolunteerRoles().map((role) => [role.name, role.id])).toEqual(
      Object.entries(DEFAULT_VOLUNTEER_ROLE_IDS).map(([name, id]) => [name, id])
    );
  });
});

describe("Møteledere og talere", () => {
  test("malens Møteleder- og Taler-oppgaver hører til gruppen Møteledere og talere", () => {
    const tasks = demoServiceSeries([]).tasks.filter((task) => task.title === "Møteleder" || task.title === "Taler");
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) expect(task.groupId).toBe("group-moteledere");
  });

  test("demoen har en bekreftet Møteleder på gudstjenesten 15. november, og Andreas Lind kan endre kjøreplanen der", () => {
    const assignment = initialAssignments.find((a) => a.id === "assign-gudstjeneste-2026-11-15-moteleder");
    expect(assignment).toMatchObject({ personId: "person-14", response: "confirmed" });

    const task = initialTasks.find((t) => t.id === assignment?.taskId);
    expect(task).toMatchObject({ gatheringId: "gathering-gudstjeneste-2026-11-15", title: "Møteleder", volunteerRoleId: "volrole-10", status: "confirmed" });

    const gathering = initialGatherings.find((g) => g.id === "gathering-gudstjeneste-2026-11-15");
    expect(gathering).toBeDefined();
    // Checked while the service is running, which is when the programme can be changed
    const now = Date.parse(gathering!.startsAt);
    const editing = programEditorAssignment(gathering!, initialTasks, initialAssignments, buildInitialVolunteerRoles(), "person-14", now);
    expect(editing?.id).toBe("assign-gudstjeneste-2026-11-15-moteleder");
  });

  test("gruppen Møteledere og talere har Per Kristian Moen som leder og Thomas Viken som nestleder", () => {
    const group = initialGroups.find((g) => g.id === "group-moteledere");
    expect(group).toMatchObject({ leaderIds: ["person-7"], deputyLeaderIds: ["person-5"] });
    expect(group?.memberIds).toEqual(expect.arrayContaining(["person-5", "person-7", "person-14", "person-12", "person-1"]));
  });
});
