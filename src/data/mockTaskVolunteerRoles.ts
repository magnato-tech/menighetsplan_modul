import type { Task } from "../types";
import {
  DEFAULT_VOLUNTEER_ROLE_NAMES,
  volunteerRoleIdForName,
} from "./defaultVolunteerRoles";

/** Maps each mock task id to a library role name. Titles stay as in the original mock data. */
export const MOCK_TASK_VOLUNTEER_ROLE: Record<string, (typeof DEFAULT_VOLUNTEER_ROLE_NAMES)[number]> = {
  "task-aug-1": "Rigging",
  "task-aug-2": "Møtevert",
  "task-1": "Lyd",
  "task-2": "Bilde",
  "task-8": "Bilde",
  "task-9": "Lyd",
  "task-3": "Kjøkken",
  "task-4": "Møtevert",
  "task-5": "Baking",
  "task-6": "Lovsang",
  "task-7": "Kjøkken",
  "task-sep-6-lyd": "Lyd",
  "task-sep-6-kaffe": "Baking",
  "task-okt-1": "Kjøkken",
  "task-okt-2": "Lyd",
  "task-g1-lovsang": "Lovsang",
  "task-g1-barn": "Barnekirke",
  "task-g1-taler": "Taler",
};

export function enrichTasksWithVolunteerRoles(tasks: Task[]): Task[] {
  return tasks.map((task) => {
    const roleName = MOCK_TASK_VOLUNTEER_ROLE[task.id];
    if (!roleName) return task;
    return { ...task, volunteerRoleId: volunteerRoleIdForName(roleName) };
  });
}
