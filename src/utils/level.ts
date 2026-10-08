// The two levels the product is sold at.
//
//   plattform   Menighetsplattform: the website with its CMS, the calendar with the gatherings,
//               and a simple Min side
//   plan        Menighetsplan: all of that, and the planner. Groups, tasks, volunteer roles,
//               staffing and the full Min side
//
// The higher level holds the lower, so there is no third choice, and one question is enough:
// does the level have the planner? The add-on modules (utils/addons.ts) are something else:
// they are turned on one by one, on top of a level.

export const LEVELS = ["plattform", "plan"] as const;

export type Level = (typeof LEVELS)[number];

export const LEVEL_NAMES: Record<Level, string> = {
  plattform: "Menighetsplattform",
  plan: "Menighetsplan",
};

/** What a level holds, said to someone choosing between the two. */
export const LEVEL_SUMMARIES: Record<Level, string> = {
  plattform: "Nettside, kalender og en enkel Min side",
  plan: "Alt i Menighetsplattform, og grupper, oppgaver og bemanning",
};

/** Whether the level has the planner: groups, tasks, volunteer roles, staffing and the full Min side. */
export const hasPlanner = (level: Level): boolean => level === "plan";

/** The level a stored value names, or null when it names neither. */
export function parseLevel(value: unknown): Level | null {
  return LEVELS.find((level) => level === value) ?? null;
}

/**
 * The level an installation is shown at. In the demo it is the one the visitor has chosen, and
 * the whole product until a choice is made. A congregation's own installation never asks the
 * browser: everything is included there until the vendor's assignment is read (chapter 14 of
 * PRODUKTDOKUMENTASJON.md, step 4).
 */
export function installationLevel(isDemo: boolean, chosenInDemo: Level | null): Level {
  return isDemo ? chosenInDemo ?? "plan" : "plan";
}
