import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { COLLECTIONS } from "../data/collections";
import type { MembershipClerkTask } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";

/** All protokollansvarlig tasks, newest documents first in Firestore; sorted for the board in the UI. */
export function useMembershipClerkTasks(enabled: boolean): MembershipClerkTask[] {
  const [tasks, setTasks] = useState<MembershipClerkTask[]>([]);

  useEffect(() => {
    if (!enabled) {
      setTasks([]);
      return;
    }
    return onSnapshot(
      query(collection(db, COLLECTIONS.MEMBERSHIP_CLERK_TASKS), orderBy("createdAt", "asc")),
      (snap) => {
        setTasks(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as MembershipClerkTask));
      },
      (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.MEMBERSHIP_CLERK_TASKS)
    );
  }, [enabled]);

  return useMemo(() => tasks, [tasks]);
}