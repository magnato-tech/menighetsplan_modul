import { useCms } from "../context/CmsContext";
import { useFirebase } from "../context/FirebaseDataContext";
import { groupsListedFor, mayOpenGroupPage, type GroupAudience, groupAudienceOf } from "../utils/minSideModules";
import type { Group } from "../types";

/** Who the groups are shown to on Min side, and what that means for this person (see utils/minSideModules.ts). */
export function useGroupAccess(): {
  audience: GroupAudience;
  mayOpen: (group: Group) => boolean;
  listed: (groups: Group[]) => Group[];
} {
  const { minSideModules } = useCms();
  const { currentUser } = useFirebase();
  return {
    audience: groupAudienceOf(minSideModules),
    mayOpen: (group) => mayOpenGroupPage(minSideModules, group, currentUser),
    listed: (groups) => groupsListedFor(minSideModules, groups, currentUser.id),
  };
}
