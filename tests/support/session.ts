import { vi } from "vitest";
import type { Account, AccountState } from "../../src/utils/session";

// Stands in for src/services/auth in a test: who is signed in is what the test says. Use as the
// factory result of `vi.mock`:
//
//   vi.mock("../src/services/auth", async () => (await import("./support/session")).authModuleMock);

let state: AccountState = { status: "signedOut" };
const followers = new Set<(state: AccountState) => void>();
const tell = () => followers.forEach((follower) => follower(state));

export const authModuleMock = {
  subscribeAccount(onChange: (state: AccountState) => void): () => void {
    followers.add(onChange);
    onChange(state);
    return () => {
      followers.delete(onChange);
    };
  },
  signOut: vi.fn(async () => {
    state = { status: "signedOut" };
    tell();
  }),
  signInWithGoogle: vi.fn(async () => {}),
  sendSignInLink: vi.fn(async (_email: string, _returnTo: string) => {}),
  isSignInLink: vi.fn((_url: string) => false),
  completeSignInLink: vi.fn(async (_url: string, _email?: string): Promise<"signedIn" | "needsEmail"> => "signedIn"),
  describeSignInError: (error: unknown) => (error instanceof Error ? error.message : "Innloggingen gikk ikke. Prøv igjen."),
};

/** Someone signs in with an account that has this address, confirmed unless said otherwise. */
export function signInWith(email: string | null, more: Partial<Account> = {}): void {
  state = { status: "signedIn", account: { uid: `uid:${email}`, email, emailVerified: true, ...more } };
  tell();
}

export function nobodySignedIn(): void {
  state = { status: "signedOut" };
  tell();
}

/** The sign-in state has not arrived yet. */
export function signInStatePending(): void {
  state = { status: "loading" };
  tell();
}

/**
 * Before the provider is mounted: start as this person without an account, the way a
 * developer's own machine can (see FirebaseDataContext). For tests of what a person sees and
 * does, where how they signed in does not matter.
 */
export function startAsPerson(personId: string): void {
  sessionStorage.setItem("menighetsplan_utvikler_som", personId);
}

/** Between tests: nobody is signed in, nobody follows, and no person is stood in for. */
export function resetSession(): void {
  state = { status: "signedOut" };
  followers.clear();
  sessionStorage.clear();
  for (const mock of [
    authModuleMock.signOut,
    authModuleMock.signInWithGoogle,
    authModuleMock.sendSignInLink,
    authModuleMock.isSignInLink,
    authModuleMock.completeSignInLink,
  ]) {
    mock.mockClear();
  }
}
