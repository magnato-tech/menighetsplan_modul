import { buildPerson } from "../data/newDocuments";
import type { Person } from "../types";
import { personsWithEmail } from "./session";

// The first administrator of an installation.
//
// Who may use the admin is decided by the register (see session.ts), and the register is edited
// in the admin. Someone therefore has to be put in from the outside once: the one who sets the
// installation up names the address of the congregation's first administrator, and
// scripts/first-admin.ts writes what this file says has to be written. After that, the
// administrator adds the others in the admin.

export type FirstAdminPlan =
  /** Nobody in the register has the address: a person is added as administrator. */
  | { action: "create"; person: Person }
  /** The person is there as a member, and is made an administrator. */
  | { action: "promote"; person: Person }
  /** The person is an administrator already. Nothing is written. */
  | { action: "none"; person: Person }
  | { action: "refuse"; reason: string };

const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** What has to be written for the address to belong to an administrator in the register. */
export function planFirstAdmin(email: string, name: string, persons: Person[]): FirstAdminPlan {
  const address = email.trim();
  if (!looksLikeEmail(address)) return { action: "refuse", reason: "E-postadressen ser ikke riktig ut." };

  const matches = personsWithEmail(address, persons);
  if (matches.length > 1) {
    return {
      action: "refuse",
      reason: `Flere personer i registeret har adressen (${matches.map((person) => person.name).join(", ")}). Den må stå på én person for at den skal kunne brukes til å logge inn.`,
    };
  }
  if (matches.length === 1) {
    const [person] = matches;
    return person.globalRole === "admin" ? { action: "none", person } : { action: "promote", person };
  }
  if (name.trim() === "") return { action: "refuse", reason: "Ingen i registeret har adressen, så navnet på personen må oppgis." };
  return { action: "create", person: buildPerson({ name, email: address.toLowerCase(), globalRole: "admin" }) };
}
