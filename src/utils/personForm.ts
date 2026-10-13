import type { Person } from "../types";
import { birthDateError } from "./birthDate";
import { loginIdOf, sharedAddresses } from "./logins";

/** Why an e-mail address cannot be stored. Empty is allowed. */
export function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? null : "E-postadressen ser ikke riktig ut.";
}

/** Why a new person cannot be stored. Empty birth date is allowed. */
export function personEntryError(input: { name: string; email: string; birthDate: string }): string | null {
  if (input.name.trim() === "") return "Personen må ha et navn";
  return emailError(input.email) ?? birthDateError(input.birthDate);
}

/** A checked box is stored. An unchecked box is left out, so an update clears the field. */
export function membershipValue(checked: boolean): true | undefined {
  return checked ? true : undefined;
}

/** People who share an address, and therefore cannot sign in. Empty when every address is unique. */
export function sharedEmailWarnings(persons: readonly Pick<Person, "name" | "email">[]): { address: string; names: string[] }[] {
  return sharedAddresses(persons).map((address) => ({
    address,
    names: persons.filter((person) => loginIdOf(person.email) === address).map((person) => person.name),
  }));
}
