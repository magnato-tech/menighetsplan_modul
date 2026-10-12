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

/**
 * Who may sign in: one document for each e-mail address that belongs to exactly one person in
 * the register (see utils/logins.ts). The database rules read it to know who is asking.
 *
 * It is not content. It follows from the register, so it is never part of a dataset, and the
 * demo, where nobody signs in, is without it.
 */
export const LOGINS_COLLECTION = "logins";

/**
 * What the website shows of the register: one document for each person who has consented to a
 * public profile, holding the public fields and nothing else (see publicCopyOf in
 * utils/publicProfile.ts). Anyone may read it, and nobody but those in the register may read
 * the register itself. Like the logins it follows from the register, and is not content.
 */
export const PUBLIC_PROFILES_COLLECTION = "publicProfiles";

/**
 * What a signed-in person may know about the people in their groups, written from the register
 * by an administrator's browser (see utils/groupAccess.ts). Not content: not part of a dataset,
 * and not used in the demo, where anyone can open the register.
 */
export const GROUP_DIRECTORY_COLLECTION = "groupDirectory";
export const GROUP_LEADER_EMAILS_COLLECTION = "groupLeaderEmails";
export const PUBLIC_GROUP_CARDS_COLLECTION = "publicGroupCards";
export const GATHERING_READERS_COLLECTION = "gatheringReaders";

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
