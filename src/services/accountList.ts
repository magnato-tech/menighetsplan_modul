import { auth } from "../firebase";
import type { AccountListAnswer } from "../utils/accountOverview";

// The Innlogging tab asks for the accounts here. The server checks who asks and reads the accounts
// from Firebase Authentication (server/accountList.ts). Here is only the asking: it never throws,
// and what went wrong comes back as the answer.

/** Where the request is sent. Only an installation at the hosting has it. */
export const ACCOUNT_LIST_PATH = "/api/kontoer";

export async function requestAccountList(): Promise<AccountListAnswer> {
  const unreachable: AccountListAnswer = { ok: false, reason: "network", message: "Ingen forbindelse. Sjekk nettet, og prøv igjen." };
  try {
    const idToken = await auth.currentUser?.getIdToken();
    // Asked even without a token: the server says first whether this is the demo, then that one must sign in
    const response = await fetch(ACCOUNT_LIST_PATH, idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : {});
    // Without the function (a developer's machine), the page is not JSON
    const answer = (await response.json().catch(() => null)) as AccountListAnswer | null;
    if (answer && typeof answer === "object" && typeof answer.ok === "boolean") return answer;
    return { ok: false, reason: "unavailable", message: "Oversikten er bare tilgjengelig i menighetens installasjon hos Vercel." };
  } catch {
    return unreachable;
  }
}
