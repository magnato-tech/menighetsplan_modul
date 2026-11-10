import { ADDONS_RECORD } from "./addons";

// The modules of Min side: the parts of it an admin can switch off, when a congregation does not
// use them. They are stored in the same marked document as the add-ons (see services/addons.ts),
// and a module that is not named there is on. So nothing changes for a congregation until someone
// switches one off.
//
// Off means hidden and not read, never deleted: what is stored stays where it is.

export const MIN_SIDE_MODULE_IDS = ["grupper", "gruppechat", "husfellesskap", "tjeneste", "gudstjenesteplan", "semesterplan", "kalender"] as const;

export type MinSideModuleId = (typeof MIN_SIDE_MODULE_IDS)[number];

/** Which modules are switched off. One not named is on: these were part of Min side before they could be switched. */
export type MinSideModuleChoices = Partial<Record<MinSideModuleId, boolean>>;

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

/** The stored document as choices. Only a known module that is stored as off is taken from it. */
export function parseMinSideModules(data: Record<string, unknown> | undefined): MinSideModuleChoices {
  const choices: MinSideModuleChoices = {};
  const stored = data?.recordType === ADDONS_RECORD ? data.minSide : undefined;
  if (!stored || typeof stored !== "object") return choices;
  for (const id of MIN_SIDE_MODULE_IDS) {
    if ((stored as Record<string, unknown>)[id] === false) choices[id] = false;
  }
  return choices;
}

/** Every module on: what Min side shows before the database has answered, and in the demo. */
export const ALL_MIN_SIDE_MODULES_ON: MinSideModuleChoices = {};
