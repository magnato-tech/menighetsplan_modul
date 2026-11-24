import { describe, expect, test } from "vitest";
import type { Group, Person } from "../src/types";
import { isInGroup } from "../src/utils/groups";
import { isInServiceGroup, type PersonDirectoryRow } from "../src/utils/personDirectory";
import { cleanFilter, describeFilter, isEmptyFilter, personsMatching, type PersonFilter } from "../src/utils/personFilter";

// The filter on the Personer tab. Everyone here is made up.

const person = (id: string, name: string, more: Partial<Person> = {}): Person => ({ id, name, globalRole: "member", ...more });
const group = (id: string, name: string, category: Group["category"], leaderIds: string[], memberIds: string[], deputyLeaderIds: string[] = []): Group => ({
  id,
  name,
  category,
  leaderIds,
  memberIds,
  deputyLeaderIds,
});

const persons: Person[] = [
  person("hanne", "Hanne Husleder", { congregationMember: true }),
  person("hans", "Hans Husmedlem", { congregationMember: true }),
  person("lars", "Lars Lydleder", { congregationMember: true, denominationMember: true }),
  person("nora", "Nora Nestleder"),
  person("mia", "Mia Lydmedlem"),
  person("kjell", "Kjell Krysset", { congregationMember: true }),
  person("sofie", "Sofie Stab"),
  person("leif", "Leif Ledig"),
];
const groups: Group[] = [
  group("hus", "Husgruppe øst", "husgruppe", ["hanne"], ["hanne", "hans", "kjell"]),
  // A group stored without a type is a service group
  group("lyd", "Lyd og bilde", undefined, ["lars", "kjell"], ["lars", "nora", "mia"], ["nora"]),
  group("stab", "Menighetsråd", "ledergruppe", ["sofie"], ["sofie"]),
];

const names = (list: Person[]): string[] => list.map((one) => one.id);

describe("Filteret på personer", () => {
  test("husgruppelederne er lederne i husgrupper, og ingen andre", () => {
    expect(names(personsMatching(persons, groups, { roles: ["leader"], categories: ["husgruppe"] }))).toEqual(["hanne"]);
  });

  test("tjenestegruppelederne er ledere og nestledere i tjenestegrupper, men ikke i andre grupper", () => {
    expect(names(personsMatching(persons, groups, { roles: ["leader"], categories: ["tjenestegruppe"] }))).toEqual(["lars", "kjell"]);
    expect(names(personsMatching(persons, groups, { roles: ["deputy"], categories: ["tjenestegruppe"] }))).toEqual(["nora"]);
  });

  test("alle ledere er ledere i alle grupper, også i ledergruppen, og nestlederne er ikke med", () => {
    expect(names(personsMatching(persons, groups, { roles: ["leader"] }))).toEqual(["hanne", "lars", "kjell", "sofie"]);
  });

  test("én gruppe er alle som er i den, og med en rolle bare de med den rollen", () => {
    expect(names(personsMatching(persons, groups, { groupId: "stab" }))).toEqual(["sofie"]);
    expect(names(personsMatching(persons, groups, { groupId: "lyd", roles: ["leader"] }))).toEqual(["lars", "kjell"]);
    expect(names(personsMatching(persons, groups, { groupId: "lyd", roles: ["deputy", "member"] }))).toEqual(["nora", "mia"]);
  });

  test("deltakere er medlemmer som ikke leder eller nestleder gruppen, og ledere er ikke med der", () => {
    const members = names(personsMatching(persons, groups, { roles: ["member"] }));
    expect(members).toEqual(["hans", "mia", "kjell"]);
    expect(members).not.toContain("hanne");
    expect(members).not.toContain("lars");
  });

  test("rolle og gruppetype gjelder i samme gruppe: den som leder en tjenestegruppe og er med i en husgruppe, er ikke husgruppeleder", () => {
    const houseLeaders = names(personsMatching(persons, groups, { roles: ["leader"], categories: ["husgruppe"] }));
    expect(houseLeaders).not.toContain("kjell");
    // Kjell leads a service group and is only a member of the house group
    expect(names(personsMatching(persons, groups, { roles: ["member"], categories: ["husgruppe"] }))).toEqual(["hans", "kjell"]);
  });

  test("uten rolle gjelder gruppetypen alle som er med i en gruppe av den typen", () => {
    expect(names(personsMatching(persons, groups, { categories: ["husgruppe"] }))).toEqual(["hanne", "hans", "kjell"]);
    expect(names(personsMatching(persons, groups, { categories: ["ledergruppe", "husgruppe"] }))).toEqual(["hanne", "hans", "kjell", "sofie"]);
  });

  test("avkrysningsboksene gjelder sammen med gruppevalget", () => {
    expect(names(personsMatching(persons, groups, { roles: ["leader"], congregationMember: true }))).toEqual(["hanne", "lars", "kjell"]);
    expect(names(personsMatching(persons, groups, { congregationMember: true, denominationMember: true }))).toEqual(["lars"]);
  });

  test("«Ikke i noen tjenestegruppe» er den som ikke er i en tjenestegruppe, som leder eller nestleder", () => {
    expect(names(personsMatching(persons, groups, { withoutService: true }))).toEqual(["hanne", "hans", "sofie", "leif"]);
  });

  test("den som er i en tjenestegruppe på en av rollene, er ikke «ikke i noen tjenestegruppe»", () => {
    const outside = names(personsMatching(persons, groups, { withoutService: true }));
    expect(outside).not.toContain("nora");
    expect(outside).not.toContain("kjell");
  });

  test("uten noe valgt, er alle med", () => {
    expect(personsMatching(persons, groups, {})).toHaveLength(persons.length);
    expect(isEmptyFilter({})).toBe(true);
    expect(isEmptyFilter({ roles: [], categories: [], groupId: undefined })).toBe(true);
    expect(isEmptyFilter({ roles: ["leader"] })).toBe(false);
    expect(isEmptyFilter({ withoutService: true })).toBe(false);
  });

  test("«Ikke i noen tjenestegruppe» er det samme som tjenestegruppe-regelen i personlisten", () => {
    // The rows the table is built from: the same groups a person is in, as the administration reads them
    const rows: PersonDirectoryRow[] = persons.map((one) => ({
      person: one,
      groups: groups.filter((g) => isInGroup(g, one.id)),
      leaderInGroups: groups.filter((g) => g.leaderIds.includes(one.id)),
      deputyInGroups: groups.filter((g) => g.deputyLeaderIds?.includes(one.id)),
    }));
    expect(names(personsMatching(persons, groups, { withoutService: true }))).toEqual(rows.filter((row) => !isInServiceGroup(row)).map((row) => row.person.id));
  });
});

describe("Hva filteret sier", () => {
  test("roller og gruppetyper med ord, som i listen", () => {
    expect(describeFilter({ roles: ["leader"], categories: ["husgruppe"] }, groups)).toBe("Leder · Husgruppe");
    expect(describeFilter({ roles: ["deputy", "leader"], categories: ["tjenestegruppe"] }, groups)).toBe("Leder, nestleder · Tjenestegruppe");
    expect(describeFilter({ roles: ["member"] }, groups)).toBe("Deltaker");
    expect(describeFilter({ categories: ["husgruppe", "tjenestegruppe"] }, groups)).toBe("Tjenestegruppe, Husgruppe");
  });

  test("en gruppe, medlemskap og ikke i tjenestegruppe", () => {
    expect(describeFilter({ groupId: "stab" }, groups)).toBe("Gruppe: Menighetsråd");
    expect(describeFilter({ roles: ["leader"], groupId: "stab" }, groups)).toBe("Leder · Gruppe: Menighetsråd");
    expect(describeFilter({ congregationMember: true }, groups)).toBe("Medlem i menigheten");
    expect(describeFilter({ roles: ["leader"], denominationMember: true, withoutService: true }, groups)).toBe("Leder · Medlem i kirkesamfunnet · Ikke i noen tjenestegruppe");
  });

  test("ingen tekst når ingenting er valgt, og en ukjent gruppe sies som det", () => {
    expect(describeFilter({}, groups)).toBe("");
    expect(describeFilter({ groupId: "finnes-ikke" }, groups)).toBe("Gruppe: ukjent gruppe");
  });

  test("filteret lagres bare med det som er valgt, i fast rekkefølge", () => {
    const messy: PersonFilter = { roles: ["member", "leader"], categories: [], groupId: "", congregationMember: undefined, denominationMember: undefined, withoutService: undefined };
    expect(cleanFilter(messy)).toEqual({ roles: ["leader", "member"] });
    expect(cleanFilter({ categories: ["husgruppe", "tjenestegruppe"], denominationMember: true })).toEqual({ categories: ["tjenestegruppe", "husgruppe"], denominationMember: true });
    expect(cleanFilter({})).toEqual({});
  });
});
