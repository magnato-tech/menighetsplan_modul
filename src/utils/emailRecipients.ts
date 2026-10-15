import type { Group, Person } from "../types";
import { isServiceGroup } from "./personDirectory";

// Who an e-mail from the administration goes to. The same reckoning is done twice: in the
// administrator's browser, to say how many it will be, and where the e-mail is sent
// (server/emailSending.ts), which reads the register itself and trusts no list it is handed.

/**
 * The groups of people an e-mail can be sent to. The members of the congregation and everyone in
 * the register are the newsletter's audiences: those are the e-mails one can unsubscribe from.
 */
export type EmailAudience =
  | { kind: "leaders" }
  | { kind: "serviceGroups" }
  | { kind: "group"; groupId: string }
  | { kind: "members" }
  | { kind: "everyone" };

type PersonOfRegister = Pick<Person, "id" | "name" | "email" | "congregationMember">;
type GroupOfRegister = Pick<Group, "id" | "name" | "category" | "memberIds" | "leaderIds" | "deputyLeaderIds">;

export interface EmailRecipient {
  email: string;
  /** The persons the address stands on. More than one when a family shares an address. */
  personIds: string[];
  /** The first name to greet with. Null when the address is shared, so nobody is greeted by another's name. */
  firstName: string | null;
}

export interface EmailRecipients {
  recipients: EmailRecipient[];
  /** The persons in the audience who have no usable address, and so get nothing. */
  withoutEmail: PersonOfRegister[];
  /** The persons in the audience who get nothing because the newsletter has been unsubscribed from on their address. */
  optedOut: PersonOfRegister[];
}

const ADDRESS = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

/** The address as it is sent to, or null when it is not one. */
export function usableEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return address.length <= 254 && ADDRESS.test(address) ? address : null;
}

/** Whether an e-mail to this audience is a newsletter: it has the banner and the link to unsubscribe. */
export const isNewsletter = (audience: EmailAudience): boolean => audience.kind === "members" || audience.kind === "everyone";

const leadersOf = (group: GroupOfRegister): string[] => [...(group.leaderIds ?? []), ...(group.deputyLeaderIds ?? [])];
const everyoneIn = (group: GroupOfRegister): string[] => [...(group.memberIds ?? []), ...leadersOf(group)];

/** The ids of the persons an audience is, in no particular order and each once. */
export function audiencePersonIds(audience: EmailAudience, groups: readonly GroupOfRegister[], persons: readonly PersonOfRegister[]): string[] {
  if (audience.kind === "members") return persons.filter((person) => person.congregationMember === true).map((person) => person.id);
  if (audience.kind === "everyone") return persons.map((person) => person.id);
  const serviceGroups = groups.filter(isServiceGroup);
  const ids =
    audience.kind === "leaders"
      ? serviceGroups.flatMap(leadersOf)
      : audience.kind === "serviceGroups"
        ? serviceGroups.flatMap(everyoneIn)
        : groups.filter((group) => group.id === audience.groupId).flatMap(everyoneIn);
  return [...new Set(ids)];
}

/**
 * The addresses an audience is reached on, each once, sorted so the same question gives the same
 * order. With `onlyPersonIds`, only those of the audience who are among them: what is left after
 * a sending that stopped halfway.
 *
 * A newsletter is not sent to an address where anyone has unsubscribed (`optedOutPersonIds`): a
 * family that shares an address shares the inbox, and the one who unsubscribed would get it anyway.
 * Other e-mail, to leaders and groups, goes out as before.
 */
export function emailRecipients(
  audience: EmailAudience,
  persons: readonly PersonOfRegister[],
  groups: readonly GroupOfRegister[],
  onlyPersonIds?: readonly string[],
  optedOutPersonIds: ReadonlySet<string> = new Set()
): EmailRecipients {
  const only = onlyPersonIds ? new Set(onlyPersonIds) : null;
  const wanted = new Set(audiencePersonIds(audience, groups, persons).filter((id) => !only || only.has(id)));
  const byAddress = new Map<string, PersonOfRegister[]>();
  const withoutEmail: PersonOfRegister[] = [];

  for (const person of persons) {
    if (!wanted.has(person.id)) continue;
    const address = usableEmail(person.email);
    if (!address) withoutEmail.push(person);
    else byAddress.set(address, [...(byAddress.get(address) ?? []), person]);
  }

  const optedOut: PersonOfRegister[] = [];
  if (isNewsletter(audience)) {
    // Who has unsubscribed on an address is asked of everyone on it, also those outside the audience
    const unsubscribed = new Set(persons.filter((person) => optedOutPersonIds.has(person.id)).map((person) => usableEmail(person.email)));
    for (const [address, people] of byAddress) {
      if (!unsubscribed.has(address)) continue;
      optedOut.push(...people);
      byAddress.delete(address);
    }
  }

  const recipients = [...byAddress.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([email, people]) => ({
      email,
      personIds: people.map((person) => person.id),
      firstName: people.length === 1 ? firstNameOf(people[0].name) : null,
    }));
  return { recipients, withoutEmail, optedOut };
}

export function firstNameOf(name: string | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

/** What the audience is called where the administrator chooses it and in the log. */
export function audienceLabel(audience: EmailAudience, groups: readonly Pick<Group, "id" | "name">[]): string {
  if (audience.kind === "leaders") return "Ledere og nestledere i tjenestegruppene";
  if (audience.kind === "serviceGroups") return "Alle i tjenestegruppene";
  if (audience.kind === "members") return "Nyhetsbrev: medlemmer av menigheten";
  if (audience.kind === "everyone") return "Nyhetsbrev: alle i registeret med e-post";
  return groups.find((group) => group.id === audience.groupId)?.name ?? "Én gruppe";
}

/** One text per audience: what tells two sendings to the same people apart from two to different ones. */
export const audienceKey = (audience: EmailAudience): string => (audience.kind === "group" ? `group:${audience.groupId}` : audience.kind);

/** The audience a request names, or null when it names none that exists. */
export function toEmailAudience(value: unknown): EmailAudience | null {
  if (!value || typeof value !== "object") return null;
  const { kind, groupId } = value as { kind?: unknown; groupId?: unknown };
  if (kind === "leaders" || kind === "serviceGroups" || kind === "members" || kind === "everyone") return { kind };
  if (kind === "group" && typeof groupId === "string" && groupId.trim() !== "") return { kind, groupId };
  return null;
}
