import { CMS_SETTINGS_DOC_ID, settingsCollectionOf } from "../data/collections";
import { DEMO_SITE } from "../demoSite";
import { DEMO_SETUP_DOC_ID, DEMO_SETUP_RECORD, isSiteListed, parseDemoSiteId, parseSiteListing } from "../utils/demoSite";
import { listDemoSets } from "./demoSets";

// The congregations of the demo (see utils/demoSite.ts): the sets that come with the app
// (public/demosett/), whether the reset has put each in the demo's database, and whether it is
// in the list every visitor is offered. A congregation that is not in the database is offered
// to nobody, so nobody is led to an empty website. One that is there but not in the list can
// still be opened with a link, which is how the owner shows a congregation its own.

export interface DemoSiteChoice {
  id: string;
  /** The congregation's name. */
  name: string;
  /** The website the content was taken from, e.g. «sognemisjonskirke.no». */
  source: string;
  /** Whether every visitor is offered it. The owner decides (see utils/demoOwner.ts). */
  listed: boolean;
}

/** A set as the owner sees it: also the ones that are not in the database yet. */
export interface DemoSetStatus extends DemoSiteChoice {
  /** Whether it lies in the demo's database, so it can be shown. */
  ready: boolean;
}

let asked: Promise<DemoSetStatus[] | null> | undefined;

async function firestore() {
  const [{ db }, { doc, getDoc, setDoc }] = await Promise.all([import("../firebase"), import("firebase/firestore")]);
  return { db, doc, getDoc, setDoc };
}

async function ask(): Promise<DemoSetStatus[]> {
  const sets = (await listDemoSets()).filter((set) => parseDemoSiteId(set.id) !== null);
  if (sets.length === 0) return [];

  // The database is only brought in when there is something to ask it about
  const { db, doc, getDoc } = await firestore();
  const [ready, chosen] = await Promise.all([
    Promise.all(
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
    ),
    // The owner's choices lie with the example congregation's settings, whichever congregation is looked at
    getDoc(doc(db, settingsCollectionOf(null), DEMO_SETUP_DOC_ID))
      .then((snapshot) => parseSiteListing(snapshot.data()))
      // Without them, what each set says for itself holds
      .catch(() => parseSiteListing(undefined)),
  ]);

  return sets
    .map((set, index) => ({
      id: set.id,
      name: set.name,
      source: set.source,
      ready: ready[index],
      listed: isSiteListed(set.id, chosen, set.listed === true),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

/**
 * Every set, with whether it lies in the demo's database and whether it is in the visitors'
 * list, by name. Null when the list of sets could not be fetched. Asked once, and again after
 * the owner has changed a choice.
 */
export function listDemoSetStatuses(): Promise<DemoSetStatus[] | null> {
  asked ??= ask().catch((error) => {
    console.error("Menighetene i demoen kunne ikke hentes:", error);
    return null;
  });
  return asked;
}

/** The congregations that lie ready in the demo's database, or null when the list of sets could not be fetched. */
export async function listDemoSites(): Promise<DemoSiteChoice[] | null> {
  const statuses = await listDemoSetStatuses();
  return statuses?.filter((set) => set.ready).map(({ ready: _ready, ...site }) => site) ?? null;
}

/** Stores the owner's choice of whether a congregation is in the list every visitor is offered. Throws when it is not stored. */
export async function saveSiteListing(site: string, listed: boolean): Promise<void> {
  if (parseDemoSiteId(site) === null) throw new Error(`«${site}» er ikke en menighet i demoen.`);
  const { db, doc, setDoc } = await firestore();
  // Written into what is there: the choices for the other congregations stand
  await setDoc(doc(db, settingsCollectionOf(null), DEMO_SETUP_DOC_ID), { recordType: DEMO_SETUP_RECORD, listed: { [site]: listed } }, { merge: true });
  asked = undefined;
}
