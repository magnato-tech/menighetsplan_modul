import { STUDIO_ADDONS } from "./addons";
import type { StudioTab } from "./studio";

// Which tabs of the admin the demo is without. The demo is one database shared by everyone who
// looks at it, so nothing in it empties or replaces that database, and it shows the two levels
// without the add-on modules. The menu and the gate in front of a tab (DemoGate.tsx) ask here.

export const NOT_IN_DEMO: readonly StudioTab[] = [
  "database-admin",
  "moduler",
  ...STUDIO_ADDONS.flatMap((addon) => addon.menu.map((entry) => entry.tab)),
];

export const isTabInDemo = (tab: StudioTab): boolean => !NOT_IN_DEMO.includes(tab);
