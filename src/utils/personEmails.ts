import type { ExtraEmail, Person } from "../types";
import { usableEmail } from "./emailRecipients";
import { loginIdOf, usableLoginId } from "./logins";

// The e-mail addresses a person has. `email` is the main address. `extraEmails` are more addresses,
// each with two choices: `copy` (gets the e-mail from the administration, as the main address does)
// and `login` (can be used to sign in). Whatever asks which addresses a person has for a purpose
// reads them through these helpers, and not from `email` directly.

type PersonEmails = Pick<Person, "email" | "extraEmails">;

/** The extra addresses as they are stored. Anything that is not one is dropped, so a damaged record cannot break a list. */
export function extraEmailsOf(value: unknown): ExtraEmail[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ExtraEmail[] => {
    if (!item || typeof item !== "object") return [];
    const { address, copy, login } = item as Record<string, unknown>;
    if (typeof address !== "string" || typeof copy !== "boolean" || typeof login !== "boolean") return [];
    return [{ address, copy, login }];
  });
}

/** The addresses the person can sign in with: the main address, and the extra ones with login, each once. */
export function loginAddressesOf(person: PersonEmails): string[] {
  const extra = extraEmailsOf(person.extraEmails).filter((item) => item.login).map((item) => item.address);
  const addresses = [person.email, ...extra].map((address) => loginIdOf(address)).filter((id) => usableLoginId(id));
  return [...new Set(addresses)];
}

/** The extra addresses that get a copy of the administration's e-mail, each once, and not the main address. */
export function copyAddressesOf(person: PersonEmails): string[] {
  const main = usableEmail(person.email);
  const copies = extraEmailsOf(person.extraEmails)
    .filter((item) => item.copy)
    .map((item) => usableEmail(item.address))
    .filter((address): address is string => address !== null && address !== main);
  return [...new Set(copies)];
}
