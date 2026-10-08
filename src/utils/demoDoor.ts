import type { Person } from "../types";
import { isInGroup, type GroupRoles } from "./groups";
import { roleOf, type SessionRole } from "./session";

// The way into the demo. A visitor does not sign in there: they choose to look at the product
// as a volunteer, a group leader or an administrator, and go in as a person from the demo's
// register who has that role. Which person it is follows from the register, so the demo's
// content can be replaced without anything here being changed.

export interface DemoDoor {
  role: SessionRole;
  person: Person;
}

/** In the order they are offered. The volunteer comes first: that is what most of a congregation sees. */
export const DEMO_DOOR_ROLES: readonly SessionRole[] = ["medlem", "gruppeleder", "administrator"];

/** What each way in is called, and what the one going in gets to do. */
export const DEMO_DOOR_LABELS: Record<SessionRole, { name: string; does: string }> = {
  medlem: { name: "Frivillig", does: "Ser oppgavene sine, svarer på forespørsler og melder forfall" },
  gruppeleder: { name: "Gruppeleder", does: "Bemanner oppgavene i gruppene sine og holder medlemslisten" },
  administrator: { name: "Administrator", does: "Styrer nettsiden, arrangementene og personregisteret" },
};

/** Where each role starts when no other address was asked for. */
export const DEMO_DOOR_START: Record<SessionRole, string> = {
  medlem: "/minside",
  gruppeleder: "/leder",
  administrator: "/admin",
};

/**
 * One person to go in as for each role that someone in the register has. Of those with the
 * role, it is the one who is in the most groups, so the screens behind have something to show.
 * The same register always gives the same persons.
 */
export function demoDoors(persons: Person[], groups: GroupRoles[]): DemoDoor[] {
  const groupCount = (person: Person): number => groups.filter((group) => isInGroup(group, person.id)).length;

  return DEMO_DOOR_ROLES.flatMap((role) => {
    const [first] = persons
      .filter((person) => roleOf(person, groups) === role)
      .sort((a, b) => groupCount(b) - groupCount(a) || a.name.localeCompare(b.name, "nb") || a.id.localeCompare(b.id));
    return first ? [{ role, person: first }] : [];
  });
}
