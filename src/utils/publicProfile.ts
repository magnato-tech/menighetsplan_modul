import { Person } from "../types";

/**
 * What the public website may show about a person.
 * The private phone number and e-mail address are never part of it.
 */
export interface PublicProfile {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  category?: string;
  isStaff?: boolean;
}

/**
 * A person is shown publicly only when an admin has registered their consent.
 * Returns null otherwise, so nobody is published by leaving out a check.
 */
export function toPublicProfile(person: Person): PublicProfile | null {
  if (!person.isPublicProfile || !person.consentToPublishGivenAt) return null;
  return {
    id: person.id,
    name: person.name,
    title: person.staffRole || person.publicTitle || undefined,
    phone: person.publicPhone || undefined,
    email: person.publicEmail || undefined,
    avatarUrl: person.avatarUrl || undefined,
    bio: person.staffBio || undefined,
    category: person.staffCategory || undefined,
    isStaff: Boolean(person.isStaff),
  };
}

// What a public copy holds of a person, beside the id, the name and the consent. The private
// phone number and e-mail address, the role and everything about the planning are left out.
const COPIED = ["publicTitle", "publicPhone", "publicEmail", "avatarUrl", "isStaff", "staffRole", "staffCategory", "staffBio", "staffOrder"] as const;

/**
 * The copy of a person that anyone may read: what toPublicProfile shows, in the form of a
 * person, so the website reads it the way it reads the register. Null for a person who has not
 * consented to a public profile. In a database that is closed to those who are not in the
 * register, these copies are what a visitor gets instead of the register.
 */
export function publicCopyOf(person: Person): Person | null {
  if (!toPublicProfile(person)) return null;
  const copy: Person = {
    id: person.id,
    name: person.name,
    globalRole: "member",
    isPublicProfile: true,
    consentToPublishGivenAt: person.consentToPublishGivenAt,
  };
  const fields: Partial<Record<(typeof COPIED)[number], unknown>> = {};
  for (const field of COPIED) {
    const value = person[field];
    if (value !== undefined && value !== "") fields[field] = value;
  }
  return { ...copy, ...(fields as Partial<Person>) };
}

/** The public copies a register gives, by id. */
export const publicCopiesOf = (persons: readonly Person[]): Person[] =>
  persons.flatMap((person) => publicCopyOf(person) ?? []).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** The public profiles among the given persons, in the order of the ids. */
export function publicProfilesOf(personIds: string[], persons: Person[]): PublicProfile[] {
  const profiles: PublicProfile[] = [];
  for (const id of personIds) {
    const person = persons.find((p) => p.id === id);
    const profile = person ? toPublicProfile(person) : null;
    if (profile) profiles.push(profile);
  }
  return profiles;
}

export interface PublicProfileInput {
  isPublic: boolean;
  title: string;
  phone: string;
  email: string;
}

/**
 * The fields to store when an admin saves a person's public profile.
 * Turning it on records when the consent was registered and by whom; a consent
 * already on record is kept as it is. Turning it off removes the record, so the
 * person is not shown again without a new consent.
 */
export function publicProfileFields(
  person: Person,
  input: PublicProfileInput,
  adminId: string,
  now: Date = new Date()
): Pick<
  Person,
  "isPublicProfile" | "publicTitle" | "publicPhone" | "publicEmail" | "consentToPublishGivenAt" | "consentGivenBy"
> {
  const alreadyConsented = toPublicProfile(person) !== null;
  return {
    isPublicProfile: input.isPublic,
    publicTitle: input.title.trim() || undefined,
    publicPhone: input.phone.trim() || undefined,
    publicEmail: input.email.trim() || undefined,
    consentToPublishGivenAt: !input.isPublic
      ? undefined
      : alreadyConsented
      ? person.consentToPublishGivenAt
      : now.toISOString(),
    consentGivenBy: !input.isPublic ? undefined : alreadyConsented ? person.consentGivenBy : adminId,
  };
}
