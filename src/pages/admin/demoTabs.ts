import { DEMO_ADDON_IDS } from "../../utils/addons";
import { STUDIO_ADDONS } from "./addons";
import type { StudioTab } from "./studio";

// Which tabs of the admin the demo is without. The demo is one database shared by everyone who
// looks at it, so nothing in it empties or replaces that database, and it shows the two levels
// without the add-on modules. The one exception is the add-ons named in DEMO_ADDON_IDS (utils/addons.ts),
// which are on in the demo. The menu and the gate in front of a tab (DemoGate.tsx) ask here.

export const NOT_IN_DEMO: readonly StudioTab[] = [
  "database-admin",
  "moduler",
  ...STUDIO_ADDONS.filter((addon) => !DEMO_ADDON_IDS.includes(addon.id)).flatMap((addon) =>
    addon.menu.map((entry) => entry.tab)
  ),
];

export const isTabInDemo = (tab: StudioTab): boolean => !NOT_IN_DEMO.includes(tab);
