import { useEffect, useRef } from "react";
import { addGroupMember } from "../services/firestore";
import type { Group } from "../types";
import { leadersMissingAsMembers } from "../utils/groups";

/**
 * Keeps the rule that whoever leads a group is a member of it, in the database itself: a leader
 * or deputy who is missing from the group's list of members is written into it. A group can
 * come without them there from a dataset, and the screens then count them all the same (see
 * utils/groups.ts), but the list is what is stored, and it should be whole.
 *
 * It runs in the browser of an administrator who has the app open, like the logins do (see
 * useRegisterMirror). `active` is whether the one at the screen is an administrator and every
 * group has arrived.
 */
export function useLeadersAsMembers(groups: Group[], active: boolean): void {
  // A write that was turned away is not tried again and again
  const stopped = useRef(false);

  useEffect(() => {
    if (!active || stopped.current) return;
    const missing = leadersMissingAsMembers(groups);
    if (missing.length === 0) return;
    Promise.all(missing.map(({ groupId, personId }) => addGroupMember(groupId, personId))).catch((error) => {
      stopped.current = true;
      console.warn("Lederne kunne ikke skrives inn i listene over deltakere:", error);
    });
  }, [active, groups]);
}
