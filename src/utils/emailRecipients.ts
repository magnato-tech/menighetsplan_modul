import type { Group, Person } from "../types";
import { isServiceGroup } from "./personDirectory";

// Who an e-mail from the administration goes to. The same reckoning is done twice: in the
// administrator's browser, to say how many it will be, and where the e-mail is sent
// (server/emailSending.ts), which reads the register itself and trusts no list it is handed.

/** The groups of people an e-mail can be sent to. */
export type EmailAudience = { kind: "leaders" } | { kind: "serviceGroups" } | { kind: "group"; groupId: string };

type PersonOfRegister = Pick<Person, "id" | "name" | "email">;
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
}

const ADDRESS = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

/** The address as it is sent to, or null when it is not one. */
export function usableEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return address.length <= 254 && ADDRESS.test(address) ? address : null;
}

const leadersOf = (group: GroupOfRegister): string[] => [...(group.leaderIds ?? []), ...(group.deputyLeaderIds ?? [])];
const everyoneIn = (group: GroupOfRegister): string[] => [...(group.memberIds ?? []), ...leadersOf(group)];

/** The ids of the persons an audience is, in no particular order and each once. */
export function audiencePersonIds(audience: EmailAudience, groups: readonly GroupOfRegister[]): string[] {
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
 */
export function emailRecipients(
  audience: EmailAudience,
  persons: readonly PersonOfRegister[],
  groups: readonly GroupOfRegister[],
  onlyPersonIds?: readonly string[]
): EmailRecipients {
  const only = onlyPersonIds ? new Set(onlyPersonIds) : null;
  const wanted = new Set(audiencePersonIds(audience, groups).filter((id) => !only || only.has(id)));
  const byAddress = new Map<string, PersonOfRegister[]>();
  const withoutEmail: PersonOfRegister[] = [];

  for (const person of persons) {
    if (!wanted.has(person.id)) continue;
    const address = usableEmail(person.email);
    if (!address) withoutEmail.push(person);
    else byAddress.set(address, [...(byAddress.get(address) ?? []), person]);
  }

  const recipients = [...byAddress.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([email, people]) => ({
      email,
      personIds: people.map((person) => person.id),
      firstName: people.length === 1 ? firstNameOf(people[0].name) : null,
    }));
  return { recipients, withoutEmail };
}

export function firstNameOf(name: string | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

/** What the audience is called where the administrator chooses it and in the log. */
export function audienceLabel(audience: EmailAudience, groups: readonly Pick<Group, "id" | "name">[]): string {
  if (audience.kind === "leaders") return "Ledere og nestledere i tjenestegruppene";
  if (audience.kind === "serviceGroups") return "Alle i tjenestegruppene";
  return groups.find((group) => group.id === audience.groupId)?.name ?? "Én gruppe";
}

/** One text per audience: what tells two sendings to the same people apart from two to different ones. */
export const audienceKey = (audience: EmailAudience): string => (audience.kind === "group" ? `group:${audience.groupId}` : audience.kind);

/** The audience a request names, or null when it names none that exists. */
export function toEmailAudience(value: unknown): EmailAudience | null {
  if (!value || typeof value !== "object") return null;
  const { kind, groupId } = value as { kind?: unknown; groupId?: unknown };
  if (kind === "leaders" || kind === "serviceGroups") return { kind };
  if (kind === "group" && typeof groupId === "string" && groupId.trim() !== "") return { kind, groupId };
  return null;
}
