import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type QuerySnapshot } from "firebase/firestore";
import { COLLECTIONS } from "../data/collections";
import { db, handleFirestoreError, OperationType } from "../firebase";
import type { MembershipApplication } from "../types";

const read = (snapshot: QuerySnapshot): MembershipApplication[] =>
  snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MembershipApplication);

/** Applications the signed-in person has sent from Min side. */
export function useMyMembershipApplications(personId: string, enabled: boolean): MembershipApplication[] {
  const [applications, setApplications] = useState<MembershipApplication[]>([]);

  useEffect(() => {
    if (!enabled || personId === "") {
      setApplications([]);
      return;
    }
    return onSnapshot(
      query(collection(db, COLLECTIONS.MEMBERSHIP_APPLICATIONS), where("personId", "==", personId)),
      (snapshot) => setApplications(read(snapshot)),
      (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.MEMBERSHIP_APPLICATIONS)
    );
  }, [personId, enabled]);

  return applications;
}