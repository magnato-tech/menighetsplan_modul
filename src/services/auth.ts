import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../firebase";
import type { AccountState } from "../utils/session";

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

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // Always ask which account, so a shared machine does not sign the next person in as the last
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}

/** Sends a sign-in link to the address. `returnTo` is the address in the app the link leads back to. */
export async function sendSignInLink(email: string, returnTo: string): Promise<void> {
  const address = email.trim();
  await sendSignInLinkToEmail(auth, address, { url: returnTo, handleCodeInApp: true });
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
  forgetEmailForLink();
  return "signedIn";
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/** What went wrong at sign-in, said so that the one signing in knows what to do. */
export function describeSignInError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
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
    default:
      return "Innloggingen gikk ikke. Prøv igjen.";
  }
}
