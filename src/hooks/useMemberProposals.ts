import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type QuerySnapshot } from "firebase/firestore";
import { COLLECTIONS } from "../data/collections";
import { db, handleFirestoreError, OperationType } from "../firebase";
import type { MemberProposal } from "../types";
import { pendingProposals } from "../utils/memberProposals";

const read = (snapshot: QuerySnapshot): MemberProposal[] =>
  snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MemberProposal);

/**
 * The proposals still waiting for one group. Nothing is read unless the caller may see them:
 * a leader, a deputy, or an administrator.
 */
export function useGroupProposals(groupId: string, enabled: boolean): MemberProposal[] {
  const [proposals, setProposals] = useState<MemberProposal[]>([]);

  useEffect(() => {
    if (!enabled || groupId === "") {
      setProposals([]);
      return;
    }
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.MEMBER_PROPOSALS),
        where("groupId", "==", groupId),
        where("status", "==", "pending")
      ),
      (snapshot) => setProposals(pendingProposals(read(snapshot))),
      (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.MEMBER_PROPOSALS)
    );
  }, [groupId, enabled]);

  return proposals;
}

/** How many proposals are waiting, per group. For the administrator's list of groups. */
export function usePendingProposalCounts(enabled: boolean): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) {
      setCounts(new Map());
      return;
    }
    return onSnapshot(
      query(collection(db, COLLECTIONS.MEMBER_PROPOSALS), where("status", "==", "pending")),
      (snapshot) => {
        const next = new Map<string, number>();
        for (const proposal of read(snapshot)) next.set(proposal.groupId, (next.get(proposal.groupId) ?? 0) + 1);
        setCounts(next);
      },
      (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.MEMBER_PROPOSALS)
    );
  }, [enabled]);

  return counts;
}
