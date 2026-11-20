import { useEffect, useState } from "react";
import { collection, onSnapshot, type QuerySnapshot } from "firebase/firestore";
import { COLLECTIONS } from "../data/collections";
import { db, handleFirestoreError, OperationType } from "../firebase";
import type { MembershipApplication } from "../types";
import { compareApplications } from "../utils/membershipClerkWorkflow";

const read = (snapshot: QuerySnapshot): MembershipApplication[] =>
  snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MembershipApplication);

/** All membership applications. Only administrators and protokollansvarlig may list them. */
export function useMembershipApplications(enabled: boolean): MembershipApplication[] {
  const [applications, setApplications] = useState<MembershipApplication[]>([]);

  useEffect(() => {
    if (!enabled) {
      setApplications([]);
      return;
    }
    return onSnapshot(
      collection(db, COLLECTIONS.MEMBERSHIP_APPLICATIONS),
      (snapshot) => setApplications(read(snapshot).sort(compareApplications)),
      (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.MEMBERSHIP_APPLICATIONS)
    );
  }, [enabled]);

  return applications;
}