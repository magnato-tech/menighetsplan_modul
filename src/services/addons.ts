import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { CMS_COLLECTIONS } from "../data/collections";
import { ADDONS_DOC_ID, ADDONS_RECORD, parseAddonChoices, type AddonChoices, type AddonId } from "../utils/addons";
import { parseMinSideModules, type MinSideModuleChoices, type MinSideModuleId } from "../utils/minSideModules";

/**
 * Where it is stored which add-ons are on (see utils/addons.ts): one marked document in
 * cms_settings, like the operating mode (see operatingMode.ts). The rules deployed on a project
 * accept that collection, and the public website may read it, which it has to: an add-on can
 * decide what the website does, as the visit counting shows.
 *
 * A database without the document has every add-on off.
 */
const addonsRef = () => doc(db, CMS_COLLECTIONS.SETTINGS, ADDONS_DOC_ID);

/**
 * Follows the choices as they change. Nothing is reported until it is known: without a
 * connection a missing document is merely not fetched yet, and only the server can say that no
 * add-on has ever been chosen. Returns the function that stops following.
 */
export function subscribeAddons(onChange: (choices: AddonChoices) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(
    addonsRef(),
    (snapshot) => {
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      onChange(parseAddonChoices(snapshot.data()));
    },
    onError
  );
}

/**
 * Turns one add-on on or off. Only that add-on is written, so two people who each choose at the
 * same time do not undo each other.
 */
export async function saveAddonChoice(id: AddonId, on: boolean): Promise<void> {
  await setDoc(addonsRef(), { recordType: ADDONS_RECORD, on: { [id]: on } }, { merge: true });
}

/**
 * Follows which Min side modules are switched off (see utils/minSideModules.ts). They are kept in
 * the add-ons' document, so this listens to the same document and reads only its own field.
 */
export function subscribeMinSideModules(
  onChange: (choices: MinSideModuleChoices) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(
    addonsRef(),
    (snapshot) => {
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      onChange(parseMinSideModules(snapshot.data()));
    },
    onError
  );
}

/** Turns one Min side module on or off. Only that module's field is written. */
export async function saveMinSideModule(id: MinSideModuleId, on: boolean): Promise<void> {
  await setDoc(addonsRef(), { recordType: ADDONS_RECORD, minSide: { [id]: on } }, { merge: true });
}
