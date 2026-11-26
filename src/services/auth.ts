import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithCustomToken,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../firebase";
import { isLoginCounted } from "../utils/countedVisit";
import type { GoogleSignIn } from "../utils/giving/access";
import type { LoginCountId } from "../utils/siteTraffic";
import type { AccountState } from "../utils/session";
import { recordLoginCount } from "./siteTraffic";

/**
 * Signing in, with the two ways the congregations use: a Google account, or a link sent to an
 * e-mail address. Both confirm that the address belongs to the one signing in, which is what
 * ties an account to a person in the register (see utils/session.ts). There are no passwords.
 *
 * Both ways have to be turned on for the installation's Firebase project, and the address the
 * installation is published on has to be among the project's authorized domains.
 */

// The e-mail the link was sent to, kept on the device it was asked from. Firebase asks for it
// again when the link is opened, so a link that has leaked is of no use on its own.
const EMAIL_FOR_LINK = "menighetsplan_epost_for_lenke";

// E-mails from Firebase, and the Google window, in Norwegian
auth.languageCode = "no";

/** Follows who is signed in. Told once at the start, and at every sign-in and sign-out. */
export function subscribeAccount(onChange: (state: AccountState) => void): () => void {
  return onAuthStateChanged(
    auth,
    (user) =>
      onChange(
        user
          ? { status: "signedIn", account: { uid: user.uid, email: user.email, emailVerified: user.emailVerified, displayName: user.displayName } }
          : { status: "signedOut" }
      ),
    (error) => {
      // Without a sign-in state nobody is signed in: the pages behind sign-in stay closed
      console.error("Innloggingen kunne ikke leses:", error);
      onChange({ status: "signedOut" });
    }
  );
}

/**
 * Counts a sign-in that has succeeded, as a sum for the day (see utils/loginCounts.ts). Nothing
 * waits for it, and nothing in it can make the sign-in fail.
 */
function countSignIn(id: LoginCountId): void {
  try {
    if (isLoginCounted()) recordLoginCount(id);
  } catch {
    // A count that cannot be made is left out; the sign-in itself is already done
  }
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // Always ask which account, so a shared machine does not sign the next person in as the last
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
  countSignIn("innlogging-google");
}

/** Where the installation sends the sign-in link itself, with its own e-mail service (see server/signInEmail.ts). */
export const SIGN_IN_EMAIL_PATH = "/api/innloggingsepost";

// What a refusal from the server is given, so that describeSignInError says the server's own words
const REFUSED_CODE = "innlogging/epost-avvist";

/**
 * Asks the installation to send the link. True when it is sent. False when this installation does
 * not send it that way, or the function cannot be reached (a developer's machine): then Firebase
 * sends it. Throws with the server's words when the server refuses, such as for a bad address.
 */
async function askForOwnSignInEmail(address: string, returnTo: string): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(SIGN_IN_EMAIL_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: address, returnTo }),
    });
  } catch {
    return false;
  }
  // Without the function, the page is not JSON
  const answer = (await response.json().catch(() => null)) as { ok?: unknown; reason?: unknown; message?: unknown } | null;
  if (answer && answer.ok === true) return true;
  if (answer && (answer.reason === "bad-email" || answer.reason === "failed") && typeof answer.message === "string") {
    throw Object.assign(new Error(answer.message), { code: REFUSED_CODE });
  }
  return false;
}

/** Sends a sign-in link to the address. `returnTo` is the address in the app the link leads back to. */
export async function sendSignInLink(email: string, returnTo: string): Promise<void> {
  const address = email.trim();
  if (!(await askForOwnSignInEmail(address, returnTo))) {
    await sendSignInLinkToEmail(auth, address, { url: returnTo, handleCodeInApp: true });
  }
  rememberEmailForLink(address);
}

function rememberEmailForLink(email: string): void {
  try {
    window.localStorage.setItem(EMAIL_FOR_LINK, email);
  } catch {
    // Without storage the address is asked for again when the link is opened; nothing else is lost
  }
}

function emailForLink(): string | null {
  try {
    return window.localStorage.getItem(EMAIL_FOR_LINK);
  } catch {
    // Blocked storage is the same as the link being opened on another device
    return null;
  }
}

function forgetEmailForLink(): void {
  try {
    window.localStorage.removeItem(EMAIL_FOR_LINK);
  } catch {
    // Nothing was stored that could be removed
  }
}

/** Whether the address is a sign-in link from an e-mail. */
export const isSignInLink = (url: string): boolean => isSignInWithEmailLink(auth, url);

/**
 * Signs in with a link from an e-mail. The address it was sent to is remembered on the device
 * it was asked from. Opened anywhere else, `email` has to be given, and "needsEmail" is the
 * answer until it is.
 */
export async function completeSignInLink(url: string, email?: string): Promise<"signedIn" | "needsEmail"> {
  const address = email?.trim() || emailForLink();
  if (!address) return "needsEmail";
  await signInWithEmailLink(auth, address, url);
  countSignIn("innlogging-epostlenke");
  forgetEmailForLink();
  return "signedIn";
}

/** Signs in with the token the server gave for a personal login link (see utils/loginLink.ts). */
export async function signInWithLoginLink(customToken: string): Promise<void> {
  await signInWithCustomToken(auth, customToken);
  countSignIn("innlogging-lenke");
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * How the account signed in right now is signed in: with Google or not, and with which Google account (the
 * id Google gives it). Read from the sign-in token, so it is the sign-in of this session. Nothing is signed in
 * when there is no account, and then it is not Google either.
 */
export async function readGoogleSignIn(): Promise<GoogleSignIn> {
  const user = auth.currentUser;
  if (!user) return { withGoogle: false, googleId: null };
  const token = await user.getIdTokenResult();
  const identities = (token.claims.firebase as { identities?: Record<string, unknown> } | undefined)?.identities;
  const googleIds = identities?.["google.com"];
  const googleId = Array.isArray(googleIds) && typeof googleIds[0] === "string" ? googleIds[0] : null;
  return { withGoogle: token.signInProvider === "google.com", googleId };
}

/** What went wrong at sign-in, said so that the one signing in knows what to do. */
export function describeSignInError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === REFUSED_CODE && error instanceof Error) return error.message;
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Innloggingen ble avbrutt. Prøv igjen.";
    case "auth/popup-blocked":
      return "Nettleseren stoppet innloggingsvinduet. Tillat sprettoppvinduer for denne siden, og prøv igjen.";
    case "auth/network-request-failed":
      return "Ingen forbindelse. Sjekk nettet, og prøv igjen.";
    case "auth/invalid-email":
    case "auth/missing-email":
      return "E-postadressen ser ikke riktig ut.";
    case "auth/invalid-action-code":
    case "auth/expired-action-code":
      return "Lenken er brukt eller utløpt. Be om en ny.";
    case "auth/user-disabled":
      return "Denne kontoen er sperret. Ta kontakt med menigheten.";
    case "auth/operation-not-allowed":
    case "auth/unauthorized-domain":
    case "auth/unauthorized-continue-uri":
      return "Denne innloggingsmåten er ikke slått på for denne installasjonen ennå. Ta kontakt med den som har satt opp løsningen.";
    case "auth/too-many-requests":
      return "For mange forsøk. Vent litt, og prøv igjen.";
    case "auth/quota-exceeded":
      return "Innloggingen er midlertidig sperret fordi for mange har bedt om lenke i dag. Prøv igjen senere, eller logg inn med Google.";
    default:
      return "Innloggingen gikk ikke. Prøv igjen.";
  }
}
