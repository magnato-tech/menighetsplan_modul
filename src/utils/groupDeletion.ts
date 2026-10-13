import type { Gathering, Group, Task, VolunteerRole } from "../types";
import { allGroupPersonIds } from "./groups";

// What deleting a group means, worked out before anything is deleted.
//
// A group that owns events or tasks cannot be deleted: they would be left pointing at a group
// that is not there, and a whole programme must not disappear in one press. They are moved to
// another group first. What goes with the group, is what only exists because of it: its
// messages and the proposals for new participants. The persons in it are not touched.

export interface GroupDeletion {
  /** Why the group cannot be deleted yet, in words for the administrator. Empty when it can. */
  blockedBy: string[];
  /** How many persons are in the group, leaders and deputies counted once. They stay in the register. */
  participants: number;
  /** The roles that have the group as their team. They lose it and stand without a team. */
  roles: Pick<VolunteerRole, "id" | "name">[];
  /** The templates that name the group as responsible. They lose it. */
  templates: { id: string; name: string }[];
}

const counted = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

export function groupDeletion(
  group: Group,
  data: {
    gatherings: readonly Pick<Gathering, "groupId">[];
    tasks: readonly Pick<Task, "groupId">[];
    roles: readonly Pick<VolunteerRole, "id" | "name" | "groupId">[];
    templates: readonly { id: string; name: string; groupId?: string }[];
  }
): GroupDeletion {
  const gatherings = data.gatherings.filter((gathering) => gathering.groupId === group.id).length;
  const tasks = data.tasks.filter((task) => task.groupId === group.id).length;
  const blockedBy: string[] = [];
  if (gatherings > 0) blockedBy.push(`${counted(gatherings, "arrangement", "arrangementer")} ligger på denne gruppen. Flytt ${gatherings === 1 ? "det" : "dem"} til en annen gruppe, eller slett ${gatherings === 1 ? "det" : "dem"}, først.`);
  if (tasks > 0) blockedBy.push(`${counted(tasks, "oppgave", "oppgaver")} i kjøreplanene hører til denne gruppen. Gi ${tasks === 1 ? "den" : "dem"} et annet tjenesteteam, eller slett ${tasks === 1 ? "den" : "dem"}, først.`);
  return {
    blockedBy,
    participants: allGroupPersonIds(group).length,
    roles: data.roles.filter((role) => role.groupId === group.id).map(({ id, name }) => ({ id, name })),
    templates: data.templates.filter((template) => template.groupId === group.id).map(({ id, name }) => ({ id, name })),
  };
}
