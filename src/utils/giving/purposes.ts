// Gift purposes (gaveformål): what a gift can be given to, kept as a list by an administrator.
// «Ordinær drift» goes to the congregation's running costs; «Øremerket» is kept for the purpose it is named after.
// A purpose is never deleted. It can be deactivated, and what it is used for stands as it was made.
// The list is kept in the database, one document each (services/giving/purposes.ts). Not personal data.

export type GivingPurposeUsage = "drift" | "oremerket";

export interface GivingPurpose {
  id: string;
  name: string;
  usage: GivingPurposeUsage;
  /** A deactivated purpose stays in the list and in the figures made with it. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** The id of the administrator who last changed it. */
  updatedBy: string;
}

export const GIVING_PURPOSE_NAME_MAX = 80;

export const GIVING_USAGE_LABELS: Record<GivingPurposeUsage, string> = {
  drift: "Ordinær drift",
  oremerket: "Øremerket",
};

/** The name as it is stored: the ends trimmed, and every run of whitespace as one space. */
export const cleanPurposeName = (name: string): string => name.trim().replace(/\s+/g, " ");

/** What is wrong with a purpose's form, in the order it is checked. Null when it can be saved. */
export function purposeFormError(
  name: string,
  usage: GivingPurposeUsage | "",
  existing: readonly GivingPurpose[],
  editingId?: string
): string | null {
  const cleaned = cleanPurposeName(name);
  if (cleaned === "") return "Skriv et navn.";
  if (cleaned.length > GIVING_PURPOSE_NAME_MAX) return "Navnet kan ha høyst 80 tegn.";
  if (usage === "") return "Velg om formålet er ordinær drift eller øremerket.";
  const wanted = cleaned.toLocaleLowerCase("nb");
  // Whether it is in use or not: a deactivated purpose keeps its name.
  const taken = existing.some(
    (purpose) => purpose.id !== editingId && cleanPurposeName(purpose.name).toLocaleLowerCase("nb") === wanted
  );
  if (taken) return "Det finnes allerede et gaveformål med dette navnet.";
  return null;
}

/** In use first, then by name. Returns a new list; the one given is not changed. */
export function sortPurposes(list: readonly GivingPurpose[]): GivingPurpose[] {
  return [...list].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name, "nb");
  });
}
