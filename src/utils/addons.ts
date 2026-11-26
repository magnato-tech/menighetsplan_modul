// An add-on is a part of the admin that a congregation turns on when it wants it. Until then it
// is not in the menu and does nothing. What each add-on is called and what it adds to the menu
// is listed in pages/admin/addons.ts. This file holds only what the public website also has to
// know: which add-ons exist, and whether one is on.
//
// The choices are stored as one marked document in cms_settings (see services/addons.ts). They
// say how the admin is set up, not what the website contains, so a dataset neither holds them
// nor resets them.

export const ADDON_IDS = ["analysebord", "nettsidebesok", "givertjeneste"] as const;

export type AddonId = (typeof ADDON_IDS)[number];

/** Which add-ons are on. One that is not named is off: an add-on is never on without having been chosen. */
export type AddonChoices = Partial<Record<AddonId, boolean>>;

export const ADDONS_RECORD = "addons";
export const ADDONS_DOC_ID = "addons";

export const isAddonOn = (choices: AddonChoices | undefined, id: AddonId): boolean => choices?.[id] === true;

export const countAddonsOn = (choices: AddonChoices | undefined): number =>
  ADDON_IDS.filter((id) => isAddonOn(choices, id)).length;

/**
 * The add-ons the demo shows as on, though nothing is stored for them: the demo lets every visitor see them.
 * Only these; the other add-ons stay out of the demo (see pages/admin/demoTabs.ts).
 */
export const DEMO_ADDON_IDS: readonly AddonId[] = ["givertjeneste"];

/** The choices as the admin shows them: in the demo, the demo's add-ons are on. Anywhere else, the choices as stored. */
export function addonsAsShown(stored: AddonChoices, inDemo: boolean): AddonChoices {
  if (!inDemo) return stored;
  const shown: AddonChoices = { ...stored };
  for (const id of DEMO_ADDON_IDS) shown[id] = true;
  return shown;
}

/** The stored document as choices. Only a known add-on that is set to on is taken from it. */
export function parseAddonChoices(data: Record<string, unknown> | undefined): AddonChoices {
  const choices: AddonChoices = {};
  const stored = data?.recordType === ADDONS_RECORD ? data.on : undefined;
  if (!stored || typeof stored !== "object") return choices;
  for (const id of ADDON_IDS) {
    if ((stored as Record<string, unknown>)[id] === true) choices[id] = true;
  }
  return choices;
}
