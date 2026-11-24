import type { Group, Person } from "../types";
import { loginIdOf, loginsOf, sharedAddresses } from "./logins";
import { loginAddressesOf } from "./personEmails";

// The Innlogging tab: who in the register has signed in to Min side, who never has, who signed in
// with an address that is not in the register, and who cannot sign in at all. The accounts are
// read live from Firebase Authentication where the installation is hosted (server/accountList.ts),
// and matched here against the register. Nothing is stored.
//
// A person can sign in exactly when loginsOf(persons) has a login with their id (utils/logins.ts),
// and nothing else decides it. All persons in the register are counted: the register keeps no
// archived persons, and a deleted person is taken out of it (see utils/personDeletion.ts).

/** Why the account list cannot be given. The server gives most of them; the page gives the last two. */
export type AccountRefusal = "demo" | "not-configured" | "not-signed-in" | "no-service-account" | "not-admin" | "database" | "google" | "network" | "unavailable";

/** How an account signs in: with Google, with a link sent to its address, or in some other way. */
export type AccountProvider = "google" | "e-postlenke" | "annet";

/** One account as the server gives it. Nothing that identifies it beyond its address is ever sent. */
export interface AccountRow {
  /** The address, in lower case with nothing around it. Null when the account has none. */
  email: string | null;
  emailVerified: boolean;
  disabled: boolean;
  provider: AccountProvider;
  /** ISO time, or null when Firebase does not say. */
  createdAt: string | null;
  /** ISO time of the last sign-in, or null when there has been none. */
  lastLoginAt: string | null;
}

export type AccountListAnswer = { ok: true; accounts: AccountRow[]; fetchedAt: string } | { ok: false; reason: AccountRefusal; message: string };

/** A person who can sign in, and has an account with their address. */
export interface SignedInRow {
  person: Person;
  account: AccountRow;
}

/** A person who can sign in, but has no account with their address yet. */
export interface NeverSignedInRow {
  person: Person;
  /** Leads a group or deputises for one. Listed first. */
  isLeader: boolean;
}

/** A person who cannot sign in: no address, or an address shared with someone else in the register. */
export type CannotSignInRow = { person: Person; reason: "no-email" } | { person: Person; reason: "shared"; address: string };

/** An account whose address is not a login: it is not in the register, or several persons share it. */
export interface NotInRegisterRow {
  address: string;
  account: AccountRow;
  shared: boolean;
}

export interface AccountOverview {
  /** Newest sign-in first. */
  notInRegister: NotInRegisterRow[];
  /** Leaders first, then by name. */
  neverSignedIn: NeverSignedInRow[];
  /** By name. */
  cannotSignIn: CannotSignInRow[];
  /** Newest sign-in first. */
  signedIn: SignedInRow[];
}

// ISO times compare as text. An account that has never signed in comes last.
const newestFirst = (a: AccountRow, b: AccountRow): number => (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? "");

const byName = (a: Person, b: Person): number => a.name.localeCompare(b.name, "nb");

/** Matches the accounts against the register, with the login rule of utils/logins.ts. */
export function overviewOf(persons: readonly Person[], groups: readonly Group[], accounts: readonly AccountRow[]): AccountOverview {
  const logins = loginsOf(persons);
  // The addresses each person signs in with, by person id: the main one and the extra ones that may sign in
  const addressesOfPerson = new Map<string, string[]>();
  for (const login of logins) addressesOfPerson.set(login.personId, [...(addressesOfPerson.get(login.personId) ?? []), login.id]);
  const loginAddresses = new Set(logins.map((login) => login.id));
  const shared = new Set(sharedAddresses(persons));
  const leaderIds = new Set(groups.flatMap((group) => [...group.leaderIds, ...(group.deputyLeaderIds ?? [])]));

  // The newest account of each address, when an address has more than one
  const accountOf = new Map<string, AccountRow>();
  for (const account of [...accounts].sort(newestFirst)) {
    const address = loginIdOf(account.email);
    if (address !== "" && !accountOf.has(address)) accountOf.set(address, account);
  }

  const signedIn: SignedInRow[] = [];
  const neverSignedIn: NeverSignedInRow[] = [];
  const cannotSignIn: CannotSignInRow[] = [];
  for (const person of persons) {
    const addresses = addressesOfPerson.get(person.id) ?? [];
    if (addresses.length === 0) {
      // Nothing to sign in with: the address that is shared, or no usable address at all
      const blocked = loginAddressesOf(person).find((address) => shared.has(address));
      cannotSignIn.push(blocked !== undefined ? { person, reason: "shared", address: blocked } : { person, reason: "no-email" });
      continue;
    }
    // Signed in when any of the addresses has an account. The newest of them is the one shown.
    const account = addresses
      .map((address) => accountOf.get(address))
      .filter((found): found is AccountRow => found !== undefined)
      .sort(newestFirst)[0];
    if (account) signedIn.push({ person, account });
    else neverSignedIn.push({ person, isLeader: leaderIds.has(person.id) });
  }

  // An account with no address cannot be matched to anyone, and is left out
  const notInRegister: NotInRegisterRow[] = [];
  for (const account of accounts) {
    const address = loginIdOf(account.email);
    if (address === "" || loginAddresses.has(address)) continue;
    notInRegister.push({ address, account, shared: shared.has(address) });
  }

  signedIn.sort((a, b) => newestFirst(a.account, b.account) || byName(a.person, b.person));
  neverSignedIn.sort((a, b) => Number(b.isLeader) - Number(a.isLeader) || byName(a.person, b.person));
  cannotSignIn.sort((a, b) => byName(a.person, b.person));
  notInRegister.sort((a, b) => newestFirst(a.account, b.account));

  return { notInRegister, neverSignedIn, cannotSignIn, signedIn };
}

/** How far back the tab looks: the last 7 or 30 days, or everything (null). */
export type AccountPeriod = 7 | 30 | null;

/** Whether the time lies within the last `days` days before `now`. With no period, every time does; with no time, none does. */
export function inPeriod(iso: string | null, days: AccountPeriod, now: number): boolean {
  if (days === null) return true;
  if (iso === null) return false;
  const time = Date.parse(iso);
  return !Number.isNaN(time) && time >= now - days * 24 * 60 * 60 * 1000 && time <= now + 60 * 1000;
}
