import { useEffect } from "react";
import { useFirebase } from "../context/FirebaseDataContext";
import { recordLoginCount } from "../services/siteTraffic";
import { isLoginCounted } from "../utils/countedVisit";
import { countMinSideOpening, type MinimalStorage } from "../utils/loginCounts";
import { MIN_SIDE_OPENED, osloDayAndHour } from "../utils/siteTraffic";

// Counts an opening of Min side by someone in the register: at most once per browser per day
// (see utils/loginCounts.ts). Called once from the Min side routes in App.tsx.

/** The browser's storage, or null when the browser does not give it out. */
function browserStorage(): MinimalStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useMinSideOpenCount(): void {
  const { session } = useFirebase();
  const signedInAsMember = session.status === "member";

  useEffect(() => {
    if (!signedInAsMember) return;
    try {
      if (!isLoginCounted()) return;
      const today = osloDayAndHour(new Date()).date;
      if (countMinSideOpening(browserStorage(), today)) recordLoginCount(MIN_SIDE_OPENED);
    } catch {
      // Counting must never be what breaks Min side for the person using it
    }
  }, [signedInAsMember]);
}
