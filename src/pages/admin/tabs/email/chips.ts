import type { Group, Person } from "../../../../types";
import { audienceKey, audienceLabel, audiencePersonIds, type EmailAudience, type EmailRecipients } from "../../../../utils/emailRecipients";

// The recipients written in «Til» on the e-mail page. A chip is a fixed choice, a group or a person.
// The chips are turned into one audience to send with (resolveChips), so the server gets what it always got.

/** The two newsletter audiences: the only ones a newsletter goes to. */
export type NewsletterKind = "members" | "everyone";

export type RecipientChip =
  | { key: string; kind: "audience"; label: string; audience: EmailAudience }
  | { key: string; kind: "person"; label: string; personId: string };

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

/** What is sent: the audience, the persons named when it is a mix (or one person), and the name in the log. */
export interface ResolvedRecipients {
  audience: EmailAudience;
  onlyPersonIds?: string[];
  label: string;
}

/**
 * The chips as one sending. One fixed choice or one group is sent as it is, as before. One person, or
 * several chips together, is sent to exactly the persons named: the audience «persons», once for each person.
 */
export function resolveChips(chips: readonly RecipientChip[], persons: readonly Person[], groups: readonly Group[]): ResolvedRecipients | null {
  if (chips.length === 0) return null;
  if (chips.length === 1) {
    const [chip] = chips;
    if (chip.kind === "audience") return { audience: chip.audience, label: chip.label };
    return { audience: { kind: "persons" }, onlyPersonIds: [chip.personId], label: chip.label };
  }
  // Each person once, however many chips reach them
  const ids = new Set<string>();
  for (const chip of chips) {
    if (chip.kind === "person") ids.add(chip.personId);
    else for (const id of audiencePersonIds(chip.audience, groups, persons)) ids.add(id);
  }
  return { audience: { kind: "persons" }, onlyPersonIds: [...ids], label: joinedLabel(chips.map((chip) => chip.label)) };
}

/** The names joined with a comma, cut to a length the log can show. */
export function joinedLabel(labels: readonly string[]): string {
  const text = labels.join(", ");
  return text.length <= LABEL_MAX ? text : `${text.slice(0, LABEL_MAX - 1).trimEnd()}…`;
}

export interface RecipientSuggestion {
  chip: RecipientChip;
  /** Said after the name: how many a group has, or the address of a person. */
  detail: string;
}

/** What the typed text suggests: the fixed choices, the groups and the persons by name or address, not those already chosen. */
export function recipientSuggestions(query: string, persons: readonly Person[], groups: readonly Group[], chips: readonly RecipientChip[]): RecipientSuggestion[] {
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
