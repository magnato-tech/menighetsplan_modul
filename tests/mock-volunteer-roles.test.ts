import { describe } from "vitest";
import { assert } from "./assert";
import { buildInitialVolunteerRoles, volunteerRoleIdForName } from "../src/data/defaultVolunteerRoles";
import { enrichTasksWithVolunteerRoles, MOCK_TASK_VOLUNTEER_ROLE } from "../src/data/mockTaskVolunteerRoles";
import { getCustomMockDocuments } from "../src/data/mockDocuments";
import { COLLECTIONS } from "../src/data/collections";
import type { Task } from "../src/types";

describe("Mock tjenesteroller", () => {
  assert(buildInitialVolunteerRoles().length === 12, "Demo-settet har 12 tjenesteroller");
  assert(volunteerRoleIdForName("Lyd") === "volrole-8", "Lyd peker på volrole-8");

  const tasks = enrichTasksWithVolunteerRoles([
    {
      id: "task-1",
      gatheringId: "gathering-1",
      groupId: "group-lyd",
      title: "Lydtekniker søndag",
      status: "open",
    },
  ]);
  assert(tasks[0].volunteerRoleId === "volrole-8", "Mock-oppgave kobles til bibliotekrollen");

  const docs = getCustomMockDocuments({ personCount: 32, groupCount: 14, taskCount: 24 });
  const roles = docs.filter((d) => d.collection === COLLECTIONS.VOLUNTEER_ROLES);
  const mockTasks = docs
    .filter((d) => d.collection === COLLECTIONS.TASKS)
    .map((d) => d.data as Task);

  assert(roles.length === 12, "Populering skriver 12 roller til Firestore");
  assert(
    mockTasks.every((task) => !MOCK_TASK_VOLUNTEER_ROLE[task.id] || Boolean(task.volunteerRoleId)),
    "Alle mappede oppgaver har volunteerRoleId"
  );
  assert(
    mockTasks.some((task) => task.id === "task-g1-taler" && task.volunteerRoleId === volunteerRoleIdForName("Taler")),
    "Taler på gudstjenesten peker på bibliotekrollen"
  );
});
