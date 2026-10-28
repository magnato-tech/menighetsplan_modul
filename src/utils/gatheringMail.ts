import type { Assignment, Gathering, Person, Task } from "../types";
import { usableEmail } from "./emailRecipients";

// The e-mail to everyone on a gathering, and the message to its teams: who is asked and what they are
// called. The people are those with an assignment on the gathering's tasks that is still open (pending or
// confirmed), each once. Nobody who has declined or withdrawn is written to.

/** The assignments that count for an e-mail to everyone on the gathering. */
export const MAIL_RESPONSES: readonly Assignment["response"][] = ["confirmed", "pending"];

export interface MailPerson {
  id: string;
  name: string;
  /** The address it is sent to, or null when there is none that can be used. */
  address: string | null;
}

/**
 * The people with an open assignment on the gathering, each once and by name. A name is the register's, or the
 * one kept on the assignment when the person is no longer there.
 */
export function mailPeopleOf(
  taskIds: ReadonlySet<string>,
  assignments: readonly Pick<Assignment, "taskId" | "personId" | "response" | "personName">[],
  persons: readonly Pick<Person, "id" | "name" | "email">[]
): MailPerson[] {
  const byId = new Map<string, MailPerson>();
  for (const assignment of assignments) {
    if (!taskIds.has(assignment.taskId) || !MAIL_RESPONSES.includes(assignment.response) || byId.has(assignment.personId)) continue;
    const person = persons.find((candidate) => candidate.id === assignment.personId);
    byId.set(assignment.personId, {
      id: assignment.personId,
      name: person?.name ?? assignment.personName ?? "",
      address: usableEmail(person?.email),
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

/** The subject that is written in before anything is changed: «Gudstjeneste søndag 8. november». */
export function mailSubjectOf(gathering: Pick<Gathering, "title" | "startsAt">): string {
  const day = new Date(gathering.startsAt).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Oslo" });
  return `${gathering.title.trim()} ${day}`;
}

/** The teams of a gathering: the groups its tasks belong to, each once and in the order of the tasks. A task without a team is no team. */
export function teamsOfTasks(
  tasks: readonly Pick<Task, "groupId">[],
  groups: readonly { id: string; name: string }[]
): { groupId: string; name: string }[] {
  const names = new Map(groups.map((group) => [group.id, group.name]));
  const seen = new Set<string>();
  const teams: { groupId: string; name: string }[] = [];
  for (const task of tasks) {
    const groupId = task.groupId;
    if (!groupId || seen.has(groupId) || !names.has(groupId)) continue;
    seen.add(groupId);
    teams.push({ groupId, name: names.get(groupId) ?? "" });
  }
  return teams;
}
