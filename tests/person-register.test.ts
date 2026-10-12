import { describe, expect, test } from "vitest";
import { deleteField } from "firebase/firestore";
import { buildPerson } from "../src/data/newDocuments";
import { forUpdate } from "../src/utils/firestoreData";
import { documentFields, sanitizeForFirestore } from "../src/utils/firestoreData";
import { buildAssignment } from "../src/data/newDocuments";
import { membershipValue, personEntryError, sharedEmailWarnings } from "../src/utils/personForm";
import { personListFile } from "../src/utils/personListFile";
import { publicCopyOf } from "../src/utils/publicProfile";
import type { Person } from "../src/types";

const withConsent = (person: Person): Person => ({
  ...person,
  isPublicProfile: true,
  consentToPublishGivenAt: "2026-01-01T00:00:00.000Z",
});

describe("Ny person", () => {
  test("tomt navn, ugyldig e-post og ugyldig eller framtidig fødselsdato avvises", () => {
    expect(personEntryError({ name: "  ", email: "", birthDate: "" })).toMatch(/navn/);
    expect(personEntryError({ name: "Kari", email: "kari", birthDate: "" })).toMatch(/E-post/);
    expect(personEntryError({ name: "Kari", email: "", birthDate: "1981-02-31" })).toMatch(/gyldig dato/);
    expect(personEntryError({ name: "Kari", email: "", birthDate: "2099-01-01" })).toMatch(/fram i tid/);
  });

  test("tom fødselsdato er lov", () => {
    expect(personEntryError({ name: "Kari", email: "", birthDate: "" })).toBeNull();
    expect(personEntryError({ name: "Kari", email: "kari@example.com", birthDate: "   " })).toBeNull();
    expect(buildPerson({ name: "Kari" }).birthDate).toBeUndefined();
  });
});

describe("Delt e-post", () => {
  test("advarselen kommer bare når to deler adresse", () => {
    const alone = [{ name: "Kari", email: "kari@example.com" }];
    expect(sharedEmailWarnings(alone)).toEqual([]);
    const pair = [
      { name: "Kari", email: "felles@example.com" },
      { name: "Ola", email: "Felles@example.com" },
    ];
    expect(sharedEmailWarnings(pair)).toEqual([{ address: "felles@example.com", names: ["Kari", "Ola"] }]);
    expect(sharedEmailWarnings([...pair, { name: "Liv", email: "liv@example.com" }])).toEqual([
      { address: "felles@example.com", names: ["Kari", "Ola"] },
    ]);
  });
});

describe("Medlemskap i registeret", () => {
  test("et kryss som fjernes, tar feltet bort fra dokumentet", () => {
    expect(membershipValue(true)).toBe(true);
    expect(membershipValue(false)).toBeUndefined();
    const cleared = forUpdate({
      congregationMember: membershipValue(false),
      denominationMember: membershipValue(false),
    });
    expect(cleared.congregationMember).toEqual(deleteField());
    expect(cleared.denominationMember).toEqual(deleteField());
  });

  test("feltene følger ikke med ut av registeret", () => {
    const person = buildPerson({
      name: "Kari",
      email: "kari@example.com",
      congregationMember: true,
      denominationMember: true,
    });
    const copy = publicCopyOf(withConsent(person));
    expect(JSON.stringify(copy)).not.toContain("congregationMember");
    expect(JSON.stringify(copy)).not.toContain("denominationMember");
    const stored = sanitizeForFirestore(documentFields(buildAssignment("t", person.id, "pending", {
      personName: person.name,
      gatheringId: "g",
      gatheringGroupId: "gr",
      gatheringPublic: false,
    })));
    expect(JSON.stringify(stored)).not.toContain("congregationMember");
    expect(JSON.stringify(stored)).not.toContain("denominationMember");
  });
});

describe("Uttrekk til Excel", () => {
  test("æ ø og å blir stående, og hver opplysning i sin kolonne", () => {
    const file = personListFile([{ name: "Åse Ødegård", phone: "900 00 000", email: "ase@example.com" }]);
    expect(file.startsWith("\uFEFF")).toBe(true);
    const lines = file.slice(1).split("\r\n");
    expect(lines[0].split(";")).toEqual(["Navn", "Telefon", "E-post"]);
    expect(lines[1].split(";")).toEqual(["Åse Ødegård", "900 00 000", "ase@example.com"]);
  });
});
