import type { Person } from "../types";
import type { MirrorChanges } from "./mirror";

// Who may sign in, as the database itself has to know it.
//
// Someone who signs in is known by the e-mail address of the account, and is a person in the
// register when exactly one person there has that address (see utils/session.ts). The database
// rules cannot search the register for an address. They can only look up a document they know
// the place of. So for every address that belongs to exactly one person, there is one document
// with the address as its place, saying which person it is and whether the person is an
// administrator: a login.
//
// The logins follow from the register and from nothing else. They are written again whenever
// the register changes (hooks/useRegisterMirror.ts), and are never edited by hand.

export interface Login {
  /** The e-mail address, in lower case with nothing around it. Also the place of the document. */
  id: string;
  personId: string;
  role: LoginRole;
}

/** What the database rules know of a person: administrator, web editor, or member. */
export type LoginRole = "admin" | "nettredaktor" | "member";

/** The role a login gets from the person, or from what is stored; anything unknown is a member. */
export const loginRoleOf = (role: unknown): LoginRole => (role === "admin" || role === "nettredaktor" ? role : "member");

/** An address as it is compared and stored: lower case, with nothing around it. Empty when there is none. */
export const loginIdOf = (email: string | null | undefined): string => (email ?? "").trim().toLowerCase();

// A place in the database cannot hold a slash, and an address that is not one, is nobody's
const usable = (id: string): boolean => /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(id);

/**
 * The logins a register gives: one for each address that stands on exactly one person. An
 * address two persons share says nothing about which of them is signing in, so neither can.
 */
export function loginsOf(persons: readonly Pick<Person, "id" | "email" | "globalRole">[]): Login[] {
  const byAddress = new Map<string, Pick<Person, "id" | "globalRole">[]>();
  for (const person of persons) {
    const id = loginIdOf(person.email);
    if (usable(id)) byAddress.set(id, [...(byAddress.get(id) ?? []), person]);
  }
  return [...byAddress.entries()]
    .filter(([, owners]) => owners.length === 1)
    .map(([id, [person]]): Login => ({ id, personId: person.id, role: loginRoleOf(person.globalRole) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The addresses in the register that cannot be used to sign in, because several persons have them. */
export function sharedAddresses(persons: readonly Pick<Person, "email">[]): string[] {
  const counts = new Map<string, number>();
  for (const person of persons) {
    const id = loginIdOf(person.email);
    if (usable(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id).sort();
}

/**
 * The changes without the one that would shut out the administrator who is making them: their
 * own login is never taken away. It happens when their address is put on a second person, and
 * the one who did it must still be able to get in and take it off again.
 */
export function keepingOwnLogin(changes: MirrorChanges<Login>, ownEmail: string | null): MirrorChanges<Login> {
  const own = loginIdOf(ownEmail);
  return own === "" ? changes : { set: changes.set, remove: changes.remove.filter((id) => id !== own) };
}
