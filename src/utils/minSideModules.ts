import { ADDONS_RECORD } from "./addons";
import { isInGroup, leadsGroup, type GroupRoles } from "./groups";

// The modules of Min side: the parts of it an admin can switch off, when a congregation does not
// use them. They are stored in the same marked document as the add-ons (see services/addons.ts),
// and a module that is not named there is on. So nothing changes for a congregation until someone
// switches one off.
//
// Off means hidden and not read, never deleted: what is stored stays where it is.

export const MIN_SIDE_MODULE_IDS = ["grupper", "gruppechat", "husfellesskap", "tjeneste", "gudstjenesteplan", "semesterplan", "kalender"] as const;

export type MinSideModuleId = (typeof MIN_SIDE_MODULE_IDS)[number];

/**
 * Who the groups are shown to on Min side: everyone in them, only those who lead one, or nobody.
 * Chosen by an administrator on the page «Moduler».
 */
export type GroupAudience = "alle" | "ledere" | "ingen";

export const GROUP_AUDIENCES: readonly GroupAudience[] = ["alle", "ledere", "ingen"];

/**
 * Which modules are switched off. One not named is on: these were part of Min side before they could be switched.
 * `groupsFor` is set only when the groups are shown to leaders alone; «ingen» is `grupper: false`, as it always was,
 * so a browser that still runs older code reads the same choice as before.
 */
export interface MinSideModuleChoices extends Partial<Record<MinSideModuleId, boolean>> {
  groupsFor?: "ledere";
}

/** The module another needs: chat and house groups are parts of groups. */
export const MIN_SIDE_MODULE_REQUIRES: Partial<Record<MinSideModuleId, MinSideModuleId>> = {
  gruppechat: "grupper",
  husfellesskap: "grupper",
  gudstjenesteplan: "tjeneste",
};

/** On unless it is switched off, and the module it needs is on. */
export function isMinSideModuleOn(choices: MinSideModuleChoices | undefined, id: MinSideModuleId): boolean {
  if (choices?.[id] === false) return false;
  const required = MIN_SIDE_MODULE_REQUIRES[id];
  return required ? isMinSideModuleOn(choices, required) : true;
}

/** Who the groups are shown to. Everyone until an administrator chooses otherwise. */
export function groupAudienceOf(choices: MinSideModuleChoices | undefined): GroupAudience {
  if (choices?.grupper === false) return "ingen";
  return choices?.groupsFor === "ledere" ? "ledere" : "alle";
}

/** Whether a module depends on the groups: the groups themselves, and what needs them (chat, house groups). */
function dependsOnGroups(id: MinSideModuleId): boolean {
  return id === "grupper" || MIN_SIDE_MODULE_REQUIRES[id] === "grupper";
}

/**
 * Whether a module is on for one person. Like `isMinSideModuleOn`, except that the groups, and what
 * needs them, are shown to a leader alone when the administrator has chosen that.
 */
export function isMinSideModuleOnFor(choices: MinSideModuleChoices | undefined, id: MinSideModuleId, leadsAGroup: boolean): boolean {
  if (!isMinSideModuleOn(choices, id)) return false;
  return dependsOnGroups(id) && groupAudienceOf(choices) === "ledere" ? leadsAGroup : true;
}

/**
 * Whether the person may open the page of a group. «Alle»: everyone who belongs to it. «Ledere»: the
 * leader and deputy of it, and an administrator. «Ingen»: nobody.
 */
export function mayOpenGroupPage(
  choices: MinSideModuleChoices | undefined,
  group: GroupRoles,
  person: { id: string; globalRole?: string }
): boolean {
  const audience = groupAudienceOf(choices);
  if (audience === "ingen") return false;
  if (audience === "ledere") return leadsGroup(group, person.id) || person.globalRole === "admin";
  return isInGroup(group, person.id) || person.globalRole === "admin";
}

/**
 * The groups Min side lists for the person under «Mine grupper». With «ledere», only the groups
 * the person leads: a group one is only a member of is not shown.
 */
export function groupsListedFor<T extends GroupRoles>(choices: MinSideModuleChoices | undefined, groups: readonly T[], personId: string): T[] {
  if (groupAudienceOf(choices) !== "ledere") return [...groups];
  return groups.filter((group) => leadsGroup(group, personId));
}

/** The stored document as choices. Only a known module that is stored as off is taken from it. */
export function parseMinSideModules(data: Record<string, unknown> | undefined): MinSideModuleChoices {
  const choices: MinSideModuleChoices = {};
  if (data?.recordType !== ADDONS_RECORD) return choices;
  const stored = data.minSide;
  if (stored && typeof stored === "object") {
    for (const id of MIN_SIDE_MODULE_IDS) {
      if ((stored as Record<string, unknown>)[id] === false) choices[id] = false;
    }
  }
  // Shown to leaders alone: only counts while the groups are on at all
  if (data.groupAudience === "ledere" && choices.grupper !== false) choices.groupsFor = "ledere";
  return choices;
}

/** Every module on: what Min side shows before the database has answered, and in the demo. */
export const ALL_MIN_SIDE_MODULES_ON: MinSideModuleChoices = {};
