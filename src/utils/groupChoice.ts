import { GROUP_CATEGORIES } from "../data/groupOptions";
import type { Group } from "../types";
import { allGroupPersonIds, isInGroup } from "./groups";

// The groups a person can be put into from the person's own card.

const ORDER: string[] = ["tjenestegruppe", "husgruppe", "ledergruppe", "strategigruppe", "interessegruppe"];

export interface GroupChoices {
  /** The name of the kind of group, "Tjenestegruppe". */
  label: string;
  groups: Pick<Group, "id" | "name">[];
}

/**
 * The groups the person is not in, kind by kind, each kind by name. The group that only holds the
 * calendar is left out: it has nobody in it, and stops being the calendar's the day it has.
 */
export function groupsToJoin(groups: readonly Group[], gatherings: readonly { groupId: string }[], personId: string): GroupChoices[] {
  const holdsOnlyTheCalendar = (group: Group) => allGroupPersonIds(group).length === 0 && gatherings.some((gathering) => gathering.groupId === group.id);
  const open = groups.filter((group) => !isInGroup(group, personId) && !holdsOnlyTheCalendar(group));
  // Service groups first: they are what a person is most often put into from here
  const kinds = [...GROUP_CATEGORIES].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  return kinds.map((category) => ({
    label: category.label.split(" (")[0],
    groups: open
      .filter((group) => (group.category ?? "tjenestegruppe") === category.id)
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "nb")),
  })).filter((choice) => choice.groups.length > 0);
}
