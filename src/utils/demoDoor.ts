import type { Person } from "../types";
import { isInGroup, type GroupRoles } from "./groups";
import { roleOf, type SessionRole } from "./session";

// The ways into the demo. A visitor does not sign in there: they choose what to look at, and
// go in as a person from the demo's register who has the role it takes. Which person it is
// follows from the register, so the demo's content can be replaced without anything here being
// changed.
//
// The website's editor comes first, and by its own name. It is an administrator's work, but a
// visitor who wants to see the CMS does not look for it under «Administrator».

export type DemoWayIn = "nettside" | "administrator" | "gruppeleder" | "medlem";

export interface DemoDoor {
  way: DemoWayIn;
  /** What the way in is called, and what the one going in gets to do. */
  name: string;
  does: string;
  /** The person from the register the visitor goes in as. */
  person: Person;
  /** The address the visitor starts on. */
  start: string;
}

/** In the order they are offered: what the one deciding for a congregation works in first, then what its people see. */
const WAYS_IN: { way: DemoWayIn; role: SessionRole; name: string; does: string; start: string }[] = [
  {
    way: "nettside",
    role: "administrator",
    name: "Rediger nettsiden (CMS)",
    does: "Bygger sider og meny, skriver nyheter, legger ut taler og velger design",
    start: "/admin?tab=cms-sider",
  },
  {
    way: "administrator",
    role: "administrator",
    name: "Administrator",
    does: "Planlegger arrangementer, bemanner oppgaver og holder personregisteret",
    start: "/admin",
  },
  {
    way: "gruppeleder",
    role: "gruppeleder",
    name: "Gruppeleder",
    does: "Bemanner oppgavene i gruppene sine og holder medlemslisten",
    start: "/leder",
  },
  {
    way: "medlem",
    role: "medlem",
    name: "Frivillig",
    does: "Ser oppgavene sine, svarer på forespørsler og melder forfall",
    start: "/minside",
  },
];

/**
 * The ways in that the register has someone for. Of those with the role a way takes, the
 * visitor goes in as the one who is in the most groups, so the screens behind have something
 * to show. The same register always gives the same persons.
 */
export function demoDoors(persons: Person[], groups: GroupRoles[]): DemoDoor[] {
  const groupCount = (person: Person): number => groups.filter((group) => isInGroup(group, person.id)).length;
  const personWith = (role: SessionRole): Person | undefined =>
    persons
      .filter((person) => roleOf(person, groups) === role)
      .sort((a, b) => groupCount(b) - groupCount(a) || a.name.localeCompare(b.name, "nb") || a.id.localeCompare(b.id))[0];

  return WAYS_IN.flatMap(({ role, ...door }) => {
    const person = personWith(role);
    return person ? [{ ...door, person }] : [];
  });
}
