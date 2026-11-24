import type { Group, Person } from "../../../../types";
import { audienceKey, audienceLabel, audiencePersonIds, type EmailAudience, type EmailRecipients } from "../../../../utils/emailRecipients";
import { listPersonIds, type EmailHandover, type EmailList } from "../../../../utils/emailLists";
import { newId } from "../../../../utils/id";

// The recipients written in «Til» on the e-mail page. A chip is a fixed choice, a group, a person, a saved
// list, or a selection handed over from the «Personer» tab. The chips are turned into one audience to send
// with (resolveChips), so the server gets what it always got.

/** Asks the administrator a question in the page and resolves with the answer: true for the yes button, false for «Avbryt». */
export type Ask = (text: string, yes?: string) => Promise<boolean>;

/** The two newsletter audiences: the only ones a newsletter goes to. */
export type NewsletterKind = "members" | "everyone";

export type RecipientChip =
  | { key: string; kind: "audience"; label: string; audience: EmailAudience }
  | { key: string; kind: "person"; label: string; personId: string }
  | { key: string; kind: "list"; label: string; listId: string }
  | { key: string; kind: "selection"; label: string; personIds: string[] };

/** The fixed choices, in the order they are suggested. */
const FIXED_AUDIENCES: EmailAudience[] = [{ kind: "leaders" }, { kind: "serviceGroups" }];
/** How many suggestions are shown at most. */
const MAX_SUGGESTIONS = 8;
/** The longest name of several chips in the log; a longer one is cut. */
const LABEL_MAX = 80;

export const people = (count: number): string => (count === 1 ? "1 person" : `${count} personer`);

export const newsletterAudience = (kind: NewsletterKind): EmailAudience => (kind === "members" ? { kind: "members" } : { kind: "everyone" });

export const audienceChip = (audience: EmailAudience, groups: readonly Group[]): RecipientChip => ({
  key: audienceKey(audience),
  kind: "audience",
  label: audienceLabel(audience, groups),
  audience,
});

export const personChip = (person: Person): RecipientChip => ({ key: `person:${person.id}`, kind: "person", label: person.name, personId: person.id });

export const listChip = (list: Pick<EmailList, "id" | "name">): RecipientChip => ({ key: `list:${list.id}`, kind: "list", label: list.name, listId: list.id });

/** The selection handed over from the «Personer» tab: exactly those persons, under the label it was given. */
export const selectionChip = (handover: EmailHandover): RecipientChip => ({ key: newId("utvalg"), kind: "selection", label: handover.label, personIds: handover.personIds });

/** What is sent: the audience, the persons named when it is a mix (or one person), and the name in the log. */
export interface ResolvedRecipients {
  audience: EmailAudience;
  onlyPersonIds?: string[];
  label: string;
}

/** The persons one chip reaches, as ids. A list that is no longer there reaches nobody. */
function idsOf(chip: RecipientChip, persons: readonly Person[], groups: readonly Group[], lists: readonly EmailList[]): string[] {
  if (chip.kind === "person") return [chip.personId];
  if (chip.kind === "selection") return chip.personIds;
  if (chip.kind === "list") {
    const list = lists.find((one) => one.id === chip.listId);
    return list ? listPersonIds(list, persons, groups) : [];
  }
  return audiencePersonIds(chip.audience, groups, persons);
}

/**
 * The chips as one sending. One fixed choice or one group is sent as it is, as before. One person, one
 * saved list, one selection, or several chips together, is sent to exactly the persons they reach, each
 * once: the audience «persons». A single list is named by its own name in the log.
 */
export function resolveChips(chips: readonly RecipientChip[], persons: readonly Person[], groups: readonly Group[], lists: readonly EmailList[] = []): ResolvedRecipients | null {
  if (chips.length === 0) return null;
  if (chips.length === 1 && chips[0].kind === "audience") return { audience: chips[0].audience, label: chips[0].label };
  const ids = new Set<string>();
  for (const chip of chips) for (const id of idsOf(chip, persons, groups, lists)) ids.add(id);
  const label = chips.length === 1 ? chips[0].label : joinedLabel(chips.map((chip) => chip.label));
  return { audience: { kind: "persons" }, onlyPersonIds: [...ids], label };
}

/** The names joined with a comma, cut to a length the log can show. */
export function joinedLabel(labels: readonly string[]): string {
  const text = labels.join(", ");
  return text.length <= LABEL_MAX ? text : `${text.slice(0, LABEL_MAX - 1).trimEnd()}…`;
}

export interface RecipientSuggestion {
  chip: RecipientChip;
  /** Said after the name: how many a group or a list has, or the address of a person. */
  detail: string;
}

/**
 * What the typed text suggests: the fixed choices, the saved lists, the groups and the persons by name or
 * address, not those already chosen.
 */
export function recipientSuggestions(
  query: string,
  persons: readonly Person[],
  groups: readonly Group[],
  chips: readonly RecipientChip[],
  lists: readonly EmailList[] = []
): RecipientSuggestion[] {
  const typed = query.trim().toLocaleLowerCase("nb");
  if (typed === "") return [];
  const taken = new Set(chips.map((chip) => chip.key));
  const found: RecipientSuggestion[] = [];
  const addAudience = (audience: EmailAudience) => {
    const chip = audienceChip(audience, groups);
    if (taken.has(chip.key) || !chip.label.toLocaleLowerCase("nb").includes(typed)) return;
    found.push({ chip, detail: people(audiencePersonIds(audience, groups, persons).length) });
  };
  FIXED_AUDIENCES.forEach(addAudience);
  for (const list of [...lists].sort((a, b) => a.name.localeCompare(b.name, "nb"))) {
    const chip = listChip(list);
    if (taken.has(chip.key) || !list.name.toLocaleLowerCase("nb").includes(typed)) continue;
    found.push({ chip, detail: people(listPersonIds(list, persons, groups).length) });
  }
  [...groups].sort((a, b) => a.name.localeCompare(b.name, "nb")).forEach((group) => addAudience({ kind: "group", groupId: group.id }));
  for (const person of persons) {
    const chip = personChip(person);
    const address = person.email?.trim() ?? "";
    if (taken.has(chip.key)) continue;
    if (!person.name.toLocaleLowerCase("nb").includes(typed) && !address.toLocaleLowerCase("nb").includes(typed)) continue;
    found.push({ chip, detail: address || "ingen e-postadresse" });
  }
  return found.slice(0, MAX_SUGGESTIONS);
}

/** How many persons get the e-mail, and how many addresses it goes to when those are not the same. */
export function countOf(recipients: EmailRecipients): { personCount: number; addressNote: string } {
  const personCount = new Set(recipients.recipients.flatMap((recipient) => recipient.personIds)).size;
  const addresses = recipients.recipients.length;
  return { personCount, addressNote: addresses !== personCount ? ` (${addresses} e-postadresser)` : "" };
}
