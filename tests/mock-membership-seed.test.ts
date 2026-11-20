import { describe, expect, test } from "vitest";
import { getMockDocuments } from "../src/data/mockDocuments";
import { COLLECTIONS } from "../src/data/collections";
import type { Person } from "../src/types";
import {
  DEMO_LEGACY_PROTOCOL_PERSON_IDS,
  DEMO_MEMBERSHIP_JOINED,
  personIdsWithMockMembership,
} from "../src/utils/mockMembershipSeed";

const persons = () =>
  getMockDocuments().filter((d) => d.collection === COLLECTIONS.PERSONS).map((d) => d.data as Person);

describe("Demomedlemskap i registeret", () => {
  test("ledere og tjenestefrivillige er medlem i menighet og trossamfunn", () => {
    const docs = getMockDocuments();
    const people = docs.filter((d) => d.collection === COLLECTIONS.PERSONS).map((d) => d.data as Person);
    const groups = docs.filter((d) => d.collection === COLLECTIONS.GROUPS).map((d) => d.data as (typeof import("../src/types").Group));
    const assignments = docs.filter((d) => d.collection === COLLECTIONS.ASSIGNMENTS).map((d) => d.data as (typeof import("../src/types").Assignment));
    const should = personIdsWithMockMembership(groups, assignments);

    const enrolled = people.filter(
      (p) =>
        p.congregationMember === true &&
        p.denominationMember === true &&
        !DEMO_LEGACY_PROTOCOL_PERSON_IDS.has(p.id)
    );
    expect(enrolled.length).toBe(should.size);
    for (const person of enrolled) {
      expect(person.congregationJoinedAt).toBe(DEMO_MEMBERSHIP_JOINED);
      expect(person.denominationEnrollmentType === "A" || person.denominationEnrollmentType === "G").toBe(true);
    }
  });

  test("barn under 15 i tjeneste får type G", () => {
    const ola = persons().find((p) => p.id === "person-41");
    const hanne = persons().find((p) => p.id === "person-43");
    expect(ola?.denominationEnrollmentType).toBe("G");
    expect(hanne?.denominationEnrollmentType).toBe("G");
  });

  test("voksen frivillig får type A", () => {
    const ola = persons().find((p) => p.id === "person-2");
    expect(ola?.congregationMember).toBe(true);
    expect(ola?.denominationEnrollmentType).toBe("A");
  });

  test("demo-person med G som voksen", () => {
    const liv = persons().find((p) => p.id === "person-76");
    expect(liv?.denominationEnrollmentType).toBe("G");
    expect(liv?.denominationMember).toBe(true);
  });

  test("tolv demo-personer har legacy innmeldingsdato", () => {
    const legacy = persons().filter((p) => DEMO_LEGACY_PROTOCOL_PERSON_IDS.has(p.id));
    expect(legacy).toHaveLength(12);
    for (const person of legacy) {
      const fix =
        person.congregationJoinedAt === "2010-12-31" || person.denominationJoinedAt === "2010-12-31";
      expect(fix).toBe(true);
    }
  });

  test("demo-søkere har forventet medlemskap før godkjenning", () => {
    const kirke = persons().find((p) => p.id === "person-91");
    const menighet = persons().find((p) => p.id === "person-93");
    const begge = persons().find((p) => p.id === "person-95");
    expect(kirke?.congregationMember).toBeUndefined();
    expect(kirke?.denominationMember).toBeUndefined();
    expect(menighet?.denominationMember).toBe(true);
    expect(menighet?.congregationMember).toBeUndefined();
    expect(begge?.congregationMember).toBeUndefined();
    expect(begge?.denominationMember).toBeUndefined();
  });

  test("delvise medlemskap beholdes", () => {
    const ada = persons().find((p) => p.id === "person-65");
    const frida = persons().find((p) => p.id === "person-70");
    expect(ada?.denominationMember).toBe(true);
    expect(ada?.congregationMember).toBeUndefined();
    expect(frida?.congregationMember).toBe(true);
    expect(frida?.denominationMember).toBeUndefined();
  });
});

describe("Hvem som telles med", () => {
  test("husgruppeleder uten tjeneste telles med som leder", () => {
    const docs = getMockDocuments();
    const groups = docs.filter((d) => d.collection === COLLECTIONS.GROUPS).map((d) => d.data as (typeof import("../src/types").Group));
    const hus = groups.find((g) => g.category === "husgruppe" && g.leaderIds.length > 0);
    expect(hus).toBeTruthy();
    const leaderId = hus!.leaderIds[0];
    const ids = personIdsWithMockMembership(groups, []);
    expect(ids.has(leaderId)).toBe(true);
    const person = persons().find((p) => p.id === leaderId);
    expect(person?.congregationMember).toBe(true);
  });
});