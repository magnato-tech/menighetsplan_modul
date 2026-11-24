import { auth } from "../firebase";
import { isLoginCounted } from "../utils/countedVisit";

// A signed-in account that the register does not know tells the board once a day, so the
// protokollansvarlig can find out who it is (see server/loginProblemReport.ts). Here is only the
// asking: it never throws, and an answer that is not JSON (a developer's machine, the demo) is nothing.

/** Where the report is sent. Only an installation at the hosting has it. */
export const LOGIN_PROBLEM_PATH = "/api/innloggingsproblem";
const STORAGE_PREFIX = "menighetsplan.innloggingsproblem.";

const todayOf = (): string => new Date().toISOString().slice(0, 10);

/**
 * The key that says this browser has told about the address today. The address itself is not kept in
 * the browser: only a short fingerprint of the day and the address.
 */
export function reportKeyOf(address: string, day: string): string {
  let hash = 5381;
  for (const char of `${day}:${address}`) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return `${STORAGE_PREFIX}${day}.${hash.toString(36)}`;
}

/**
 * Tells the board that the signed-in address is not in the register: at most once per browser per
 * address per day, not for an address that is not confirmed, and not where sign-ins are not counted.
 */
export async function reportLoginProblem(): Promise<void> {
  try {
    if (!isLoginCounted()) return;
    const user = auth.currentUser;
    if (!user || !user.email || user.emailVerified !== true) return;

    // The record is made before the report, so a report that fails is not repeated again and again the same day
    const key = reportKeyOf(user.email.trim().toLowerCase(), todayOf());
    try {
      if (window.localStorage.getItem(key) !== null) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // Without browser storage the report is made, and may be repeated
    }

    const idToken = await user.getIdToken();
    // A response that is not an answer (no function here) is nothing to act on
    await fetch(LOGIN_PROBLEM_PATH, { method: "POST", headers: { Authorization: `Bearer ${idToken}` } }).catch(() => undefined);
  } catch {
    // Nothing a visitor can act on: the sign-in page works without it
  }
}
