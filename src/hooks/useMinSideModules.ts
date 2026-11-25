import { useCms } from "../context/CmsContext";
import { useFirebase } from "../context/FirebaseDataContext";
import { leadsAGroup } from "../utils/session";
import { isMinSideModuleOnFor, type MinSideModuleId } from "../utils/minSideModules";

/**
 * Whether a Min side module is on for the person who is signed in, including the module it needs
 * (see utils/minSideModules.ts). The groups, and chat and house groups with them, can be shown to
 * leaders alone, so the answer depends on whether the person leads a group.
 */
export function useMinSideModules(): { isOn: (id: MinSideModuleId) => boolean } {
  const { minSideModules } = useCms();
  const { currentUser, groups } = useFirebase();
  const leads = leadsAGroup(currentUser, groups);
  return { isOn: (id) => isMinSideModuleOnFor(minSideModules, id, leads) };
}
