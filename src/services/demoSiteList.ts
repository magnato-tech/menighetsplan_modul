import { CMS_SETTINGS_DOC_ID, settingsCollectionOf } from "../data/collections";
import { DEMO_SITE } from "../demoSite";
import { parseDemoSiteId } from "../utils/demoSite";
import { listDemoSets } from "./demoSets";

// Which congregations a visitor of the demo can choose between (see utils/demoSite.ts): the
// sets that come with the app (public/demosett/) and that the reset has put in the demo's
// database. A set that is not there yet is not offered, so nobody is led to an empty website.

export interface DemoSiteChoice {
  id: string;
  /** The congregation's name. */
  name: string;
  /** The website the content was taken from, e.g. «sognemisjonskirke.no». */
  source: string;
}

let asked: Promise<DemoSiteChoice[] | null> | undefined;

async function ask(): Promise<DemoSiteChoice[]> {
  const sets = (await listDemoSets()).filter((set) => parseDemoSiteId(set.id) !== null);
  if (sets.length === 0) return [];

  // The database is only brought in when there is something to ask it about
  const [{ db }, { doc, getDoc }] = await Promise.all([import("../firebase"), import("firebase/firestore")]);
  const present = await Promise.all(
    sets.map(async (set) => {
      try {
        return (await getDoc(doc(db, settingsCollectionOf(set.id), CMS_SETTINGS_DOC_ID))).exists();
      } catch (error) {
        // A database that refuses does not have the congregation to show. One that could not be
        // reached says nothing either way, and the visitor stays with the congregation they have.
        const refused = (error as { code?: unknown } | null)?.code === "permission-denied";
        return !refused && set.id === DEMO_SITE;
      }
    })
  );
  return sets
    .filter((_, index) => present[index])
    .map(({ id, name, source }) => ({ id, name, source }))
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

/**
 * The congregations that lie ready in the demo's database, by name, or null when the list of
 * sets could not be fetched. Asked once for as long as the app is open.
 */
export function listDemoSites(): Promise<DemoSiteChoice[] | null> {
  asked ??= ask().catch((error) => {
    console.error("Menighetene i demoen kunne ikke hentes:", error);
    return null;
  });
  return asked;
}
