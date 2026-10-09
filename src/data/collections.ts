import { DEMO_SITE } from "../demoSite";
import { collectionPrefixOf } from "../utils/demoSite";

// Names of every Firestore collection the app reads or writes.
//
// The names are the plain ones below everywhere but one place: in the demo, a visitor who has
// chosen to look at another congregation than the example (see utils/demoSite.ts) gets that
// congregation's collections, which lie beside the example's in the demo's database with the
// congregation's id in front ("sogne-cms_pages"). The whole app follows, because nothing in it
// writes the name of a collection anywhere but here.

const PLANNER_NAMES = {
  PERSONS: "persons",
  GROUPS: "groups",
  GATHERINGS: "gatherings",
  TASKS: "tasks",
  ASSIGNMENTS: "assignments",
  GROUP_MESSAGES: "groupMessages",
  GATHERING_ATTENDANCES: "gatheringAttendances",
  GATHERING_HEADCOUNTS: "gatheringHeadcounts",
  VOLUNTEER_ROLES: "volunteer_roles",
} as const;

const CMS_NAMES = {
  PAGES: "cms_pages",
  NEWS: "cms_news",
  SERMONS: "cms_sermons",
  STAFF: "cms_staff",
  SETTINGS: "cms_settings",
  MEDIA: "cms_media",
} as const;

const PREFIX = collectionPrefixOf(DEMO_SITE);

/** The names as the congregation being looked at has them. They keep their plain types: no code tells the two apart. */
const forThisSite = <Names extends Record<string, string>>(names: Names): Names =>
  PREFIX ? (Object.fromEntries(Object.entries(names).map(([key, name]) => [key, PREFIX + name])) as Names) : names;

export const COLLECTIONS = forThisSite(PLANNER_NAMES);

export const CMS_COLLECTIONS = forThisSite(CMS_NAMES);

// cms_settings holds a single document
export const CMS_SETTINGS_DOC_ID = "global";

export const ALL_COLLECTIONS: readonly string[] = [
  ...Object.values(COLLECTIONS),
  ...Object.values(CMS_COLLECTIONS),
];

/**
 * The plain names, with no congregation in front: what a dataset file calls the collections,
 * and what the reset of the demo puts each congregation's id in front of.
 */
export const PLAIN_COLLECTIONS: readonly string[] = [...Object.values(PLANNER_NAMES), ...Object.values(CMS_NAMES)];

/** Where a congregation in the demo keeps its settings, asked before it is chosen. */
export const settingsCollectionOf = (site: string | null): string => collectionPrefixOf(site) + CMS_NAMES.SETTINGS;
