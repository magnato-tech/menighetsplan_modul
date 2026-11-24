import type { Group, Person } from "../types";
import { personsMatching, type PersonFilter } from "./personFilter";

// E-mail lists: groups of persons saved from the «Personer» tab, and used in «Send e-post». A «filter» list
// keeps the filter, so new persons who match come in by themselves. A «fixed» list keeps the persons as they
// were when it was saved. The lists are kept in the database, one document each (services/emailLists.ts).

export type EmailListKind = "filter" | "fixed";

export interface EmailList {
  id: string;
  name: string;
  kind: EmailListKind;
  /** Only for a «filter» list. */
  filter?: PersonFilter;
  /** Only for a «fixed» list. */
  personIds?: string[];
  createdAt: string;
  updatedAt: string;
  /** The id of the administrator who saved it. */
  createdBy: string;
}

/** Where the handover from «Personer» to «Send e-post» is kept for the moment it takes to get there. */
export const EPOST_HANDOVER_KEY = "menighetsplan_epost_til";

/** What the administrator is told when the database does not yet let the lists be written. */
export const LISTS_NOT_PUBLISHED = "Listene kan ikke lagres ennå. Databasereglene må publiseres på nytt i Firebase.";

/** Whether a failed write was refused by the database: the rules are not published yet. */
export const isPermissionDenied = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === "permission-denied";

/**
 * The ids of the persons on a list. A «filter» list is the persons who match its filter today. A «fixed» list
 * is the persons it was saved with, those who are still in the register. Each id once.
 */
export function listPersonIds(list: Pick<EmailList, "kind" | "filter" | "personIds">, persons: readonly Person[], groups: readonly Group[]): string[] {
  if (list.kind === "filter") return list.filter ? personsMatching(persons, groups, list.filter).map((person) => person.id) : [];
  const inRegister = new Set(persons.map((person) => person.id));
  return [...new Set(list.personIds ?? [])].filter((id) => inRegister.has(id));
}

/** The error for a name that cannot be saved, or null. A name is unique among the lists, whatever its capitals. */
export function listNameError(name: string, lists: readonly Pick<EmailList, "id" | "name">[], exceptId?: string): string | null {
  const typed = name.trim().toLocaleLowerCase("nb");
  if (typed === "") return "Listen må ha et navn.";
  if (lists.some((list) => list.id !== exceptId && list.name.trim().toLocaleLowerCase("nb") === typed)) return "Det finnes allerede en liste med dette navnet.";
  return null;
}

/** What the «Personer» tab hands to «Send e-post»: the persons, and the name the chip is given. */
export interface EmailHandover {
  personIds: string[];
  label: string;
}

/** Leaves the handover for «Send e-post» in this browser. A browser that does not keep it, sends nothing across. */
export function writeEmailHandover(handover: EmailHandover): boolean {
  try {
    window.sessionStorage.setItem(EPOST_HANDOVER_KEY, JSON.stringify(handover));
    return true;
  } catch {
    return false;
  }
}

/** Takes the handover away, and returns it when it is there and well formed. Read once: the next page starts without it. */
export function takeEmailHandover(): EmailHandover | null {
  try {
    const stored = window.sessionStorage.getItem(EPOST_HANDOVER_KEY);
    window.sessionStorage.removeItem(EPOST_HANDOVER_KEY);
    const saved = JSON.parse(stored ?? "null") as { personIds?: unknown; label?: unknown } | null;
    if (!saved || !Array.isArray(saved.personIds) || typeof saved.label !== "string") return null;
    const personIds = saved.personIds.filter((id): id is string => typeof id === "string");
    return saved.label.trim() === "" ? null : { personIds, label: saved.label };
  } catch {
    return null;
  }
}

/** What the administrator is told when a list cannot be saved, renamed, changed or deleted. */
export function listFailureText(error: unknown, action: string): string {
  return isPermissionDenied(error) ? LISTS_NOT_PUBLISHED : `Det gikk ikke å ${action}. Prøv igjen.`;
}
