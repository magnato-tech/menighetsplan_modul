import type { Group, Person } from "../types";
import { isInGroup, type GroupRoles } from "./groups";
import { roleOf } from "./session";

// The ways into the demo. A visitor does not sign in there: they choose what to look at, and
// go in as a person from the demo's register. Which person follows from the register, so the
// demo's content can be replaced without anything here being changed.

export type DemoWayIn =
  | "administrator"
  | "tjenestegruppeleder"
  | "husgruppeleder"
  | "tjenestegruppemedlem"
  | "medlemUtenTjeneste";

export type DemoGroup = GroupRoles & Pick<Group, "id" | "name" | "category">;

export interface DemoDoor {
  way: DemoWayIn;
  /** What the way in is called, and what the one going in gets to do. */
  name: string;
  does: string;
  /** The person from the register the visitor goes in as. */
  person: Person;
  /** Groups the person belongs to, for the choice on the door. */
  groupNames: string[];
  /** The address the visitor starts on. */
  start: string;
}

const WAYS_IN: { way: DemoWayIn; name: string; does: string; start: string }[] = [
  {
    way: "administrator",
    name: "Administrator",
    does: "Redigerer nettsiden (CMS), planlegger arrangementer og holder personregisteret",
    start: "/admin",
  },
  {
    way: "tjenestegruppeleder",
    name: "Tjenestegruppeleder",
    does: "Bemanner oppgavene i tjenestegruppene sine og holder listen over deltakere",
    start: "/leder",
  },
  {
    way: "husgruppeleder",
    name: "Husfellesskapsleder",
    does: "Leder husfellesskapet og inviterer til gruppesamlinger",
    start: "/leder",
  },
  {
    way: "tjenestegruppemedlem",
    name: "Frivillig i tjenestegruppe",
    does: "Ser ledige oppgaver i gruppene sine og melder seg på gudstjenester",
    start: "/minside",
  },
  {
    way: "medlemUtenTjeneste",
    name: "Frivillig uten tjenestegruppe",
    does: "Ser Min side uten ledige tjenesteoppgaver (kun husfellesskap eller råd)",
    start: "/minside",
  },
];

const pathOf = (address: string): string => address.split(/[?#]/)[0];

const isTjenestegruppe = (group: DemoGroup): boolean => (group.category ?? "tjenestegruppe") === "tjenestegruppe";
const isHusgruppe = (group: DemoGroup): boolean => group.category === "husgruppe";

const groupNamesOf = (person: Person, groups: DemoGroup[]): string[] =>
  groups
    .filter((group) => isInGroup(group, person.id))
    .map((group) => group.name)
    .sort((a, b) => a.localeCompare(b, "nb"));

const byNameThenId = (a: Person, b: Person): number => a.name.localeCompare(b.name, "nb") || a.id.localeCompare(b.id);

const pickFirst = (candidates: Person[], used: Set<string>): Person | undefined =>
  candidates.find((person) => !used.has(person.id));

/**
 * Where a way in leads. The choice decides which part of the app the visitor comes to. The
 * address the visitor was on the way to is kept when it lies in that part.
 */
export function whereDoorLeads(door: Pick<DemoDoor, "start">, wanted: string): string {
  const part = pathOf(door.start);
  const asked = pathOf(wanted);
  return asked === part || asked.startsWith(`${part}/`) ? wanted : door.start;
}

function personForWay(way: DemoWayIn, persons: Person[], groups: DemoGroup[], used: Set<string>): Person | undefined {
  const inTjeneste = (personId: string) => groups.some((group) => isTjenestegruppe(group) && isInGroup(group, personId));
  const leadsTjeneste = (person: Person) =>
    groups.some((group) => isTjenestegruppe(group) && group.leaderIds.includes(person.id));
  const leadsHus = (person: Person) => groups.some((group) => isHusgruppe(group) && group.leaderIds.includes(person.id));
  const countLed = (person: Person, filter: (group: DemoGroup) => boolean) =>
    groups.filter((group) => filter(group) && group.leaderIds.includes(person.id)).length;

  const sortByLedCount = (filter: (group: DemoGroup) => boolean) => (a: Person, b: Person) =>
    countLed(b, filter) - countLed(a, filter) || byNameThenId(a, b);

  const sortByMembership = (filter: (group: DemoGroup) => boolean) => (a: Person, b: Person) => {
    const inFiltered = (person: Person) => groups.filter((group) => filter(group) && isInGroup(group, person.id)).length;
    const inAny = (person: Person) => groups.filter((group) => isInGroup(group, person.id)).length;
    return inFiltered(b) - inFiltered(a) || inAny(b) - inAny(a) || byNameThenId(a, b);
  };

  switch (way) {
    case "administrator":
      return pickFirst(
        persons.filter((person) => roleOf(person, groups) === "administrator").sort(byNameThenId),
        used
      );
    case "tjenestegruppeleder":
      return pickFirst(persons.filter(leadsTjeneste).sort(sortByLedCount(isTjenestegruppe)), used);
    case "husgruppeleder":
      return pickFirst(persons.filter(leadsHus).sort(sortByLedCount(isHusgruppe)), used);
    case "tjenestegruppemedlem":
      return pickFirst(
        persons
          .filter((person) => roleOf(person, groups) === "medlem" && inTjeneste(person.id))
          .sort(sortByMembership(isTjenestegruppe)),
        used
      );
    case "medlemUtenTjeneste":
      return pickFirst(
        persons
          .filter((person) => roleOf(person, groups) === "medlem" && !inTjeneste(person.id))
          .sort((a, b) => groupNamesOf(b, groups).length - groupNamesOf(a, groups).length || byNameThenId(a, b)),
        used
      );
    default:
      return undefined;
  }
}

/**
 * The ways in that the register has someone for. Each way picks a distinct person so visitors
 * can compare what admin, leaders and volunteers see. The same register always gives the same persons.
 */
export function demoDoors(persons: Person[], groups: DemoGroup[]): DemoDoor[] {
  const used = new Set<string>();
  const doors: DemoDoor[] = [];

  for (const door of WAYS_IN) {
    const person = personForWay(door.way, persons, groups, used);
    if (!person) continue;
    used.add(person.id);
    doors.push({ ...door, person, groupNames: groupNamesOf(person, groups) });
  }

  return doors;
}
