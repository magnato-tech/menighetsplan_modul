import type { Person } from "../types";
import { leadsGroup, type GroupRoles } from "./groups";

// Who is using the app.
//
// An account is what someone signs in with (a Google account, or a link sent to an e-mail
// address). A person is a row in the congregation's register. The two are tied together by the
// e-mail address: the account's confirmed address must be the address of exactly one person in
// the register. What someone may do follows from the person, never from the account:
//
//   administrator   the person has the role in the register
//   gruppeleder     the person leads at least one group, as leader or deputy
//   medlem          everyone else who is in the register
//
// Someone who signs in without being in the register is signed in, but is nobody here.

export interface Account {
  uid: string;
  email: string | null;
  /** Whether the provider has confirmed that the address belongs to the one signing in. */
  emailVerified: boolean;
  displayName?: string | null;
}

export type AccountState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; account: Account };

/** Why an account that is signed in is not a person in the register. */
export type NotInRegisterReason =
  /** The provider has not confirmed the address, so it proves nothing about who this is. */
  | "unverified"
  /** Nobody in the register has the address. */
  | "noMatch"
  /** Several persons share the address, so it does not say which of them this is. */
  | "severalMatches";

export type Session =
  /** Not known yet: the sign-in state or the register has not arrived. Nothing is decided on a guess. */
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notInRegister"; account: Account; reason: NotInRegisterReason }
  /** `account` is null only for a stand-in: on a developer's own machine, or a visitor of the demo (see mayStandIn). */
  | { status: "member"; person: Person; account: Account | null };

export type SessionRole = "administrator" | "gruppeleder" | "medlem";

const normalized = (email: string | null | undefined): string => (email ?? "").trim().toLowerCase();

/** The persons in the register who have the address. Capital letters and blanks around it do not matter. */
export function personsWithEmail(email: string | null | undefined, persons: Person[]): Person[] {
  const wanted = normalized(email);
  return wanted === "" ? [] : persons.filter((person) => normalized(person.email) === wanted);
}

/**
 * Who the account is in the register. `registerReady` is whether the register has been received:
 * until then, nobody can be said to be missing from it.
 */
export function sessionOf(state: AccountState, persons: Person[], registerReady: boolean): Session {
  if (state.status !== "signedIn") return state;
  const { account } = state;
  if (!account.emailVerified || normalized(account.email) === "") return { status: "notInRegister", account, reason: "unverified" };
  if (!registerReady) return { status: "loading" };

  const matches = personsWithEmail(account.email, persons);
  if (matches.length === 1) return { status: "member", person: matches[0], account };
  return { status: "notInRegister", account, reason: matches.length === 0 ? "noMatch" : "severalMatches" };
}

/** The person standing in for a signed-in member on a developer's own machine, or loading/signed out. */
export function standInSession(personId: string, persons: Person[], registerReady: boolean): Session {
  if (!registerReady) return { status: "loading" };
  const person = persons.find((candidate) => candidate.id === personId);
  return person ? { status: "member", person, account: null } : { status: "signedOut" };
}

/**
 * Whether someone can go in as a person from the register without signing in: on a developer's
 * own machine, and in the demo, where every visitor is let in (see utils/demoDoor.ts). Never in
 * a congregation's published installation.
 */
export const mayStandIn = (where: { developerMachine: boolean; demo: boolean }): boolean => where.developerMachine || where.demo;

export const isAdministrator = (person: Pick<Person, "globalRole">): boolean => person.globalRole === "admin";

export const leadsAGroup = (person: Pick<Person, "id">, groups: GroupRoles[]): boolean =>
  groups.some((group) => leadsGroup(group, person.id));

/** The highest role the person has. An administrator who also leads a group is an administrator. */
export function roleOf(person: Pick<Person, "id" | "globalRole">, groups: GroupRoles[]): SessionRole {
  if (isAdministrator(person)) return "administrator";
  return leadsAGroup(person, groups) ? "gruppeleder" : "medlem";
}

export const ROLE_LABELS: Record<SessionRole, string> = {
  administrator: "Administrator",
  gruppeleder: "Gruppeleder",
  medlem: "Medlem",
};

/**
 * Where to go after signing in: the address that was asked for, when it is one of the app's own.
 * Anything else, such as an address on another website, is answered with Min side.
 */
export function destinationAfterSignIn(wanted: string | null | undefined): string {
  const fallback = "/minside";
  if (!wanted || !wanted.startsWith("/") || wanted.startsWith("//") || wanted.includes("\\")) return fallback;
  return wanted.startsWith("/logg-inn") ? fallback : wanted;
}

/** The address of the sign-in page that leads back to `path` afterwards. */
export const signInUrl = (path: string): string => `/logg-inn?neste=${encodeURIComponent(path)}`;
