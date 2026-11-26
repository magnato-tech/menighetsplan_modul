// Givertjeneste: who holds which right (givingAccess/<address>). Pure rules, with no Firebase and no React.
// The database rules (firestore.rules, «Givertjeneste») decide what is really allowed. This file says what the
// admin shows, what it writes, and what the stored document has to hold for the rules to accept it.
//
// A right is given to one person, for one e-mail address. The address is the document's id and is never stored
// inside it. A right is taken away by setting it to false: a document is never deleted.

export type GivingRight = "overview" | "budget" | "individual" | "manage";

export interface GivingAccess {
  /** The e-mail address the rights are for. It is the id of the document, and is never stored inside it. */
  address: string;
  personId: string;
  name: string;
  overview: boolean;
  budget: boolean;
  individual: boolean;
  manage: boolean;
  /** The Google account the rights were taken into use with. Absent until the person does so. */
  googleId?: string;
  version: number;
  updatedAt?: string;
  updatedBy?: string;
}

export type GivingRights = Record<GivingRight, boolean>;

/** The rights as the admin names them, in the order they are shown. */
export const GIVING_RIGHTS: readonly { id: GivingRight; label: string; description: string }[] = [
  { id: "overview", label: "Oversikt", description: "Se publiserte samlede tall og budsjett." },
  { id: "budget", label: "Budsjett", description: "Det samme, og lage og endre gavebudsjettet." },
  { id: "individual", label: "Givere", description: "Se og føre givere, avtaler og gaver. Kan lese personregisteret." },
  { id: "manage", label: "Tilganger", description: "Gi og fjerne tilgang for andre, ikke for seg selv." },
];

export const GIVING_NAME_MAX = 120;

/** What the account is signed in with: whether it is a Google account, and which one (the id the provider gives). */
export interface GoogleSignIn {
  withGoogle: boolean;
  googleId: string | null;
}

/** Where the person using the app stands with their own rights. */
export type OwnAccessState = "none" | "other-person" | "needs-google" | "needs-activation" | "wrong-google" | "active";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An address as it is compared and stored: lower case, with nothing around it. */
export const normalizeGivingAddress = (address: string | null | undefined): string => (address ?? "").trim().toLowerCase();

/** Whether any of the four rights is held. */
export function hasAnyRight(access: Partial<GivingRights> | null | undefined): boolean {
  if (!access) return false;
  return GIVING_RIGHTS.some((right) => access[right.id] === true);
}

/** The labels of the rights held, in the order they are shown. */
export const rightLabelsOf = (access: Partial<GivingRights> | null | undefined): string[] =>
  GIVING_RIGHTS.filter((right) => access?.[right.id] === true).map((right) => right.label);

/**
 * Where the person stands with the rights on their own address, in this order: no right, a right
 * for another person, not signed in with Google, the rights not yet taken into use, another Google
 * account than the one they were taken into use with, and active.
 */
export function ownAccessState({
  access,
  personId,
  googleSignIn,
}: {
  access: GivingAccess | null;
  personId: string;
  googleSignIn: GoogleSignIn;
}): OwnAccessState {
  if (!access || !hasAnyRight(access)) return "none";
  if (access.personId !== personId) return "other-person";
  if (!googleSignIn.withGoogle) return "needs-google";
  if (!access.googleId) return "needs-activation";
  if (googleSignIn.googleId !== access.googleId) return "wrong-google";
  return "active";
}

/** What a row in the list says about its Google account. */
export function accessStatusLabel(access: GivingAccess | null | undefined): string {
  if (!hasAnyRight(access)) return "Ingen tilgang";
  if (!access?.googleId) return "Venter på at personen tar den i bruk";
  return "I bruk";
}

export interface GrantFormInput {
  address: string;
  name: string;
  rights: Partial<GivingRights>;
  /** The address the administrator signs in with. Empty in the demo, where nobody is «own». */
  ownAddress: string | null | undefined;
  ownPersonId: string | null | undefined;
  /**
   * The person the address stands for in the register. Undefined while it is not looked up yet: the checks
   * before it are then all that is said, and the lookup can be made when they pass.
   */
  foundPersonId: string | null | undefined;
  /** The rights the address already has, if any. */
  existing: GivingAccess | null | undefined;
}

/** What is wrong with the form for a grant, in the order it is checked. Null when the grant can be made. */
export function grantFormError(input: GrantFormInput): string | null {
  const address = normalizeGivingAddress(input.address);
  if (address === "" || !EMAIL_SHAPE.test(address)) return "Skriv e-postadressen.";
  const name = input.name.trim();
  if (name === "") return "Skriv navnet.";
  if (name.length > GIVING_NAME_MAX) return "Navnet kan ha høyst 120 tegn.";
  if (!hasAnyRight(input.rights)) return "Velg minst én tilgang.";
  const ownAddress = normalizeGivingAddress(input.ownAddress);
  if (ownAddress !== "" && address === ownAddress) return "Du kan ikke gi tilgang til deg selv.";
  if (input.existing) return "Adressen står allerede i listen. Endre den der.";
  if (input.foundPersonId === null) return "Adressen står ikke som innlogging for noen i personregisteret.";
  if (input.foundPersonId !== undefined && input.ownPersonId && input.foundPersonId === input.ownPersonId) {
    return "Du kan ikke gi tilgang til deg selv.";
  }
  return null;
}

/** The fields that are stored in the document. The address is its id, so it is not one of them. */
export interface StoredGivingAccess {
  personId: string;
  name: string;
  overview: boolean;
  budget: boolean;
  individual: boolean;
  manage: boolean;
  googleId?: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

/**
 * The document as it is stored: exactly the allowed fields, and googleId left out when there is none.
 * Throws when the stamp is missing: every write sets it, so that is a bug, not a state to store.
 */
export function storedAccessFields(access: GivingAccess): StoredGivingAccess {
  if (!access.updatedAt || !access.updatedBy) throw new Error("Tilgangen mangler tidspunkt eller avsender.");
  const stored: StoredGivingAccess = {
    personId: access.personId,
    name: access.name,
    overview: access.overview === true,
    budget: access.budget === true,
    individual: access.individual === true,
    manage: access.manage === true,
    version: access.version,
    updatedAt: access.updatedAt,
    updatedBy: access.updatedBy,
  };
  if (access.googleId) stored.googleId = access.googleId;
  return stored;
}

/** The first right for a new address: version 1, and no Google account until the person takes it into use. */
export function newAccess(
  input: { address: string; personId: string; name: string; rights: Partial<GivingRights> },
  byPersonId: string,
  now: Date
): GivingAccess {
  return {
    address: normalizeGivingAddress(input.address),
    personId: input.personId,
    name: input.name.trim(),
    overview: input.rights.overview === true,
    budget: input.rights.budget === true,
    individual: input.rights.individual === true,
    manage: input.rights.manage === true,
    version: 1,
    updatedAt: now.toISOString(),
    updatedBy: byPersonId,
  };
}

/**
 * The rights of an address changed. The Google account stays unless it is reset, so the person keeps the
 * rights they took into use. The name and the person stay as they are.
 */
export function changedAccess(
  existing: GivingAccess,
  changes: { rights?: Partial<GivingRights>; resetGoogle?: boolean },
  byPersonId: string,
  now: Date
): GivingAccess {
  const right = (id: GivingRight): boolean => changes.rights?.[id] ?? existing[id] === true;
  const next: GivingAccess = {
    address: existing.address,
    personId: existing.personId,
    name: existing.name,
    overview: right("overview"),
    budget: right("budget"),
    individual: right("individual"),
    manage: right("manage"),
    version: existing.version + 1,
    updatedAt: now.toISOString(),
    updatedBy: byPersonId,
  };
  if (existing.googleId && !changes.resetGoogle) next.googleId = existing.googleId;
  return next;
}

/**
 * The person takes the rights into use with the Google account they are signed in with. Nothing else changes,
 * except that the name is the person's own name in the register.
 */
export function activatedAccess(
  existing: GivingAccess,
  googleId: string,
  ownName: string,
  now: Date,
  byPersonId: string
): GivingAccess {
  return {
    ...existing,
    googleId,
    name: ownName,
    version: existing.version + 1,
    updatedAt: now.toISOString(),
    updatedBy: byPersonId,
  };
}

/** A row can be changed by someone with «Tilganger», unless it is their own address or their own person. */
export function canEditRow(
  row: { address: string; personId: string },
  ownAddress: string | null | undefined,
  ownPersonId: string | null | undefined
): boolean {
  if (normalizeGivingAddress(ownAddress) !== "" && normalizeGivingAddress(row.address) === normalizeGivingAddress(ownAddress)) return false;
  if (ownPersonId && row.personId === ownPersonId) return false;
  return true;
}
