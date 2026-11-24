import type { ExtraEmail, Person } from "../types";
import { birthDateError } from "./birthDate";
import { usableEmail } from "./emailRecipients";
import { loginAddressesOf, extraEmailsOf } from "./personEmails";
import { sharedAddresses } from "./logins";

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
export function sharedEmailWarnings(persons: readonly Pick<Person, "name" | "email" | "extraEmails">[]): { address: string; names: string[] }[] {
  return sharedAddresses(persons).map((address) => ({
    address,
    names: persons.filter((person) => loginAddressesOf(person).includes(address)).map((person) => person.name),
  }));
}

/**
 * Why the extra addresses of a person cannot be stored, or null when they can. An empty row is
 * left out when saved, so it is not an error. The main address is `main`.
 */
export function extraEmailsError(rows: readonly ExtraEmail[], main: string | null | undefined): string | null {
  const mainAddress = usableEmail(main);
  const seen = new Set<string>(mainAddress ? [mainAddress] : []);
  for (const row of rows) {
    if (row.address.trim() === "") continue;
    const address = usableEmail(row.address);
    if (!address) return `${row.address.trim()} er ikke en gyldig e-postadresse.`;
    if (seen.has(address)) return `${address} står allerede på personen.`;
    seen.add(address);
  }
  return null;
}

/** The extra addresses as they are stored: lower case, empty rows left out, and nothing repeated. */
export function extraEmailsToStore(rows: readonly ExtraEmail[], main: string | null | undefined): ExtraEmail[] {
  const mainAddress = usableEmail(main);
  const seen = new Set<string>(mainAddress ? [mainAddress] : []);
  const stored: ExtraEmail[] = [];
  for (const row of rows) {
    const address = usableEmail(row.address);
    if (!address || seen.has(address)) continue;
    seen.add(address);
    stored.push({ address, copy: row.copy === true, login: row.login === true });
  }
  return stored;
}

/**
 * The person's extra addresses with one more added, for signing in: the «Legg til på person»
 * action in the Innlogging tab. Refused when the address is already on the person.
 */
export function withExtraEmail(person: Pick<Person, "email" | "extraEmails">, address: string): { ok: true; extraEmails: ExtraEmail[] } | { ok: false; message: string } {
  const wanted = usableEmail(address);
  if (!wanted) return { ok: false, message: `${address.trim()} er ikke en gyldig e-postadresse.` };
  const onPerson = usableEmail(person.email) === wanted || extraEmailsOf(person.extraEmails).some((item) => usableEmail(item.address) === wanted);
  if (onPerson) return { ok: false, message: `${wanted} står allerede på personen.` };
  return { ok: true, extraEmails: [...extraEmailsOf(person.extraEmails), { address: wanted, copy: false, login: true }] };
}
