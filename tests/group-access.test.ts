import { describe, expect, test } from "vitest";
import { DEMO } from "../src/demo";
import { buildAssignment } from "../src/data/newDocuments";
import { documentFields, sanitizeForFirestore } from "../src/utils/firestoreData";
import type { Assignment, Gathering, Group, Person, Task } from "../src/types";
import {
  assignmentAccessPatches,
  gatheringReadersOf,
  groupDirectoryOf,
  groupLeaderEmailsOf,
  personFromCard,
  publicGroupCardsOf,
  visibleGroupPeople,
} from "../src/utils/groupAccess";

const ola: Person = {
  id: "ola",
  name: "Ola",
  phone: "111",
  email: "ola@example.com",
  globalRole: "member",
  birthDate: "1980-01-02",
  congregationMember: true,
  denominationMember: true,
};
const kari: Person = { id: "kari", name: "Kari", email: "kari@example.com", globalRole: "admin", birthDate: "1975-05-05" };
const liv: Person = {
  id: "liv",
  name: "Liv",
  phone: "222",
  email: "liv.privat@example.com",
  globalRole: "member",
  isPublicProfile: true,
  consentToPublishGivenAt: "2026-01-01T00:00:00.000Z",
  publicPhone: "333",
};

const lyd: Group = { id: "lyd", name: "Lyd", isPublic: true, memberIds: ["ola"], leaderIds: ["kari"], deputyLeaderIds: ["liv"] };
const intern: Group = { id: "intern", name: "Sjelesorg", isPublic: false, memberIds: ["liv"], leaderIds: ["kari"] };
const umerket: Group = { id: "gammel", name: "Gammel", memberIds: ["ola"], leaderIds: [] };

describe("Testmiljøet", () => {
  test("leser ikke VITE_DEMO fra utviklerens .env.local", () => {
    expect(DEMO).toBeNull();
  });
});

describe("Tildelingen som lagres", () => {
  test("har ikke id inne i dokumentet, for regelen lister feltene som er tillatt", () => {
    const built = buildAssignment("t", "p", "pending", {
      personName: "Ola",
      gatheringId: "g",
      gatheringGroupId: "gr",
      gatheringPublic: false,
    });
    const stored = sanitizeForFirestore(documentFields(built));
    expect(stored).not.toHaveProperty("id");
    expect(Object.keys(stored).sort()).toEqual(
      ["assignedAt", "gatheringGroupId", "gatheringId", "gatheringPublic", "personId", "personName", "response", "taskId"]
    );
  });
});

describe("Gruppekatalog", () => {
  test("gir navn og telefon, og aldri e-post eller fødselsdato", () => {
    const cards = groupDirectoryOf([ola, kari, liv], [lyd]);
    expect(cards.map((card) => card.id)).toEqual(["lyd_kari", "lyd_liv", "lyd_ola"]);
    expect(cards.find((card) => card.personId === "ola")).toEqual({ id: "lyd_ola", groupId: "lyd", personId: "ola", name: "Ola", phone: "111" });
    expect(JSON.stringify(cards)).not.toContain("email");
    expect(JSON.stringify(cards)).not.toContain("birthDate");
    expect(JSON.stringify(cards)).not.toContain("1980");
    expect(JSON.stringify(cards)).not.toContain("congregationMember");
    expect(JSON.stringify(cards)).not.toContain("denominationMember");
  });

  test("e-postkortet er et eget dokument, og mangler når personen ikke har e-post", () => {
    const without = { ...ola, email: undefined, phone: undefined };
    expect(groupLeaderEmailsOf([without, kari, liv], [lyd]).map((card) => card.personId)).toEqual(["kari", "liv"]);
    expect(groupLeaderEmailsOf([kari], [lyd])[0]).toEqual({ id: "lyd_kari", groupId: "lyd", personId: "kari", email: "kari@example.com" });
    const fromOla = JSON.stringify(groupLeaderEmailsOf([ola], [lyd]));
    expect(fromOla).not.toContain("congregationMember");
    expect(fromOla).not.toContain("denominationMember");
  });

  test("et offentlig kort har bare personer med offentlig profil, og hopper over grupper som ikke er merket", () => {
    const cards = publicGroupCardsOf([lyd, intern, umerket], [ola, kari, liv]);
    expect(cards.map((card) => card.id)).toEqual(["lyd"]);
    expect(cards[0]).toMatchObject({
      isPublic: true,
      memberCount: 3,
      leaderIds: [],
      deputyLeaderIds: ["liv"],
      memberIds: [],
    });
    expect(JSON.stringify(cards[0])).not.toContain("ola");
    expect(JSON.stringify(cards[0])).not.toContain("kari");
    expect(JSON.stringify(cards)).not.toContain("congregationMember");
    expect(JSON.stringify(cards)).not.toContain("denominationMember");
  });

  test("uten hele registeret ser et medlem telefon, og en leder også e-post", () => {
    const cards = groupDirectoryOf([ola, kari, liv], [lyd]);
    const emails = groupLeaderEmailsOf([ola, kari, liv], [lyd]);
    const asMember = visibleGroupPeople(lyd, false, [], cards, emails, "ola");
    expect(asMember.find((person) => person.id === "kari")?.phone).toBeUndefined();
    expect(asMember.find((person) => person.id === "kari")?.email).toBeUndefined();
    expect(asMember.find((person) => person.id === "ola")).toMatchObject({ phone: "111" });
    expect(asMember.every((person) => person.birthDate === undefined)).toBe(true);
    expect(asMember.every((person) => person.congregationMember === undefined && person.denominationMember === undefined)).toBe(true);

    const asLeader = visibleGroupPeople(lyd, false, [], cards, emails, "kari");
    expect(asLeader.find((person) => person.id === "ola")?.email).toBe("ola@example.com");
    expect(personFromCard(cards[0]).globalRole).toBe("member");
  });
});

describe("Tildelinger", () => {
  const task: Task = { id: "t1", gatheringId: "g1", groupId: "lyd", title: "Lyd", status: "open" };
  const gathering: Gathering = { id: "g1", groupId: "lyd", title: "Messe", startsAt: "2026-11-01T10:00:00.000Z", visibility: "offentlig", isPublic: true };
  const assignment: Assignment = { id: "a1", taskId: "t1", personId: "ola", response: "pending" };

  test("mangler navn og samling, og får dem fra oppgaven og personen", () => {
    expect(assignmentAccessPatches([assignment], [task], [gathering], [ola])).toEqual([
      { id: "a1", personName: "Ola", gatheringId: "g1", gatheringGroupId: "lyd", gatheringPublic: true },
    ]);
  });

  test("rører ikke en tildeling som allerede sier det", () => {
    const stamped: Assignment = { ...assignment, personName: "Ola", gatheringId: "g1", gatheringGroupId: "lyd", gatheringPublic: true };
    expect(assignmentAccessPatches([stamped], [task], [gathering], [ola])).toEqual([]);
  });

  test("lesemerker for gruppen og for den som står på oppgaven", () => {
    const other: Gathering = { id: "g2", groupId: "intern", title: "Internt", startsAt: "2026-11-02T10:00:00.000Z", visibility: "intern", isPublic: false };
    const readers = gatheringReadersOf([gathering, other], [lyd, intern], [task], [{ taskId: "t1", personId: "ola" }]);
    expect(readers.map((reader) => reader.id)).toEqual(["g1_kari", "g1_liv", "g1_ola", "g2_kari", "g2_liv"]);
  });
});
