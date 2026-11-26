import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { ALL_COLLECTIONS, GIVING_PURPOSES_COLLECTION, PLAIN_COLLECTIONS } from "../src/data/collections";
import { buildGivingPurpose } from "../src/data/newDocuments";
import {
  GIVING_PURPOSE_NAME_MAX,
  cleanPurposeName,
  purposeFormError,
  sortPurposes,
  type GivingPurpose,
} from "../src/utils/giving/purposes";

// Gift purposes (gaveformål): the form rules, the sorting and the new documents, tested on the real code. Everyone here is made up.

const NOW = "2026-11-26T10:00:00.000Z";

const purpose = (id: string, name: string, active = true, usage: GivingPurpose["usage"] = "drift"): GivingPurpose => ({
  id,
  name,
  usage,
  active,
  createdAt: NOW,
  updatedAt: NOW,
  updatedBy: "anna",
});

const existing = [purpose("p-kirke", "Kirkens arbeid"), purpose("p-misjon", "Misjon", false, "oremerket"), purpose("p-ost", "Østlandet", true, "oremerket")];

describe("Skjemaet for et gaveformål", () => {
  test("et tomt navn, eller bare mellomrom, får beskjed om å skrive et navn", () => {
    expect(purposeFormError("", "drift", existing)).toBe("Skriv et navn.");
    expect(purposeFormError("   \t ", "drift", existing)).toBe("Skriv et navn.");
  });

  test("et navn på mer enn 80 tegn er for langt, og 80 tegn går bra", () => {
    expect(GIVING_PURPOSE_NAME_MAX).toBe(80);
    expect(purposeFormError("a".repeat(81), "drift", [])).toBe("Navnet kan ha høyst 80 tegn.");
    expect(purposeFormError("a".repeat(80), "drift", [])).toBeNull();
  });

  test("lengden regnes etter at ender er trimmet og mellomrom er slått sammen", () => {
    expect(purposeFormError(`  ${"a".repeat(80)}  `, "drift", [])).toBeNull();
    expect(purposeFormError(`${"a".repeat(40)}    ${"b".repeat(40)}`, "drift", [])).toBe("Navnet kan ha høyst 80 tegn.");
    expect(purposeFormError(`${"a".repeat(40)}   ${"b".repeat(39)}`, "drift", [])).toBeNull();
  });

  test("uten bruk får man beskjed om å velge ordinær drift eller øremerket", () => {
    expect(purposeFormError("Misjon i Afrika", "", [])).toBe("Velg om formålet er ordinær drift eller øremerket.");
  });

  test("navnet sjekkes før bruken, og bruken før dubletter", () => {
    expect(purposeFormError("", "", existing)).toBe("Skriv et navn.");
    expect(purposeFormError("Kirkens arbeid", "", existing)).toBe("Velg om formålet er ordinær drift eller øremerket.");
  });

  test("et navn som finnes fra før får beskjed, uansett store og små bokstaver, mellomrom og om formålet er i bruk", () => {
    const duplicate = "Det finnes allerede et gaveformål med dette navnet.";
    expect(purposeFormError("  kirkens   ARBEID ", "drift", existing)).toBe(duplicate);
    expect(purposeFormError("misjon", "oremerket", existing)).toBe(duplicate);
    expect(purposeFormError("østlandet", "drift", existing)).toBe(duplicate);
  });

  test("et navn som ikke finnes fra før er greit", () => {
    expect(purposeFormError("Kirkens arbeid i byen", "drift", existing)).toBeNull();
    expect(purposeFormError("Misjon i Afrika", "oremerket", existing)).toBeNull();
  });

  test("et formål kan beholde sitt eget navn når det endres", () => {
    expect(purposeFormError("Kirkens arbeid", "drift", existing, "p-kirke")).toBeNull();
    expect(purposeFormError("  KIRKENS arbeid ", "drift", existing, "p-kirke")).toBeNull();
  });

  test("et formål kan ikke ta navnet til et annet, selv om det endres", () => {
    expect(purposeFormError("Misjon", "drift", existing, "p-kirke")).toBe("Det finnes allerede et gaveformål med dette navnet.");
  });
});

describe("Navnet på et gaveformål", () => {
  test("mellomrom i ender fjernes, og alle mellomrom inni blir ett", () => {
    expect(cleanPurposeName("  Lys   og\tvarme \n")).toBe("Lys og varme");
    expect(cleanPurposeName("Kirkens arbeid")).toBe("Kirkens arbeid");
  });
});

describe("Rekkefølgen på gaveformålene", () => {
  test("formål i bruk kommer først, deretter etter navn", () => {
    const sorted = sortPurposes([purpose("a", "Zebra", false), purpose("b", "Bjørn"), purpose("c", "Aron", false), purpose("d", "Åse")]);
    expect(sorted.map((one) => one.name)).toEqual(["Bjørn", "Åse", "Aron", "Zebra"]);
  });

  test("listen som gis, endres ikke", () => {
    const list = [purpose("a", "Zebra"), purpose("b", "Aron")];
    const before = list.map((one) => one.id).join();
    sortPurposes(list);
    expect(list.map((one) => one.id).join()).toBe(before);
  });
});

describe("Et nytt gaveformål", () => {
  test("får en ny id med prefikset purpose, og er i bruk fra starten", () => {
    const created = buildGivingPurpose({ name: "  Misjon  i Afrika ", usage: "oremerket" }, "anna", new Date(NOW));
    expect(created.id.startsWith("purpose-")).toBe(true);
    expect(created.name).toBe("Misjon i Afrika");
    expect(created.usage).toBe("oremerket");
    expect(created.active).toBe(true);
    expect(created.createdAt).toBe(NOW);
    expect(created.updatedAt).toBe(NOW);
    expect(created.updatedBy).toBe("anna");
  });

  test("har nøyaktig de feltene som lagres, pluss id", () => {
    const created = buildGivingPurpose({ name: "Kirkens arbeid", usage: "drift" }, "anna", new Date(NOW));
    expect(Object.keys(created).sort()).toEqual(["active", "createdAt", "id", "name", "updatedAt", "updatedBy", "usage"]);
  });

  test("hvert nytt formål får sin egen id, også når det lages i en løkke", () => {
    const ids = Array.from({ length: 200 }, () => buildGivingPurpose({ name: "Diakoni", usage: "drift" }, "anna", new Date(NOW)).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Gaveformål i kodebasen", () => {
  const root = path.resolve(__dirname, "..");
  const rules = readFileSync(path.join(root, "firestore.rules"), "utf8");

  function filesUnder(folder: string): string[] {
    return readdirSync(path.join(root, folder)).flatMap((name) => {
      const relative = `${folder}/${name}`;
      return statSync(path.join(root, relative)).isDirectory() ? filesUnder(relative) : [relative];
    });
  }

  test("samlingen for gaveformål er ikke med i de samlingene som fylles, testes eller nullstilles", () => {
    expect(GIVING_PURPOSES_COLLECTION).toBe("givingPurposes");
    expect(ALL_COLLECTIONS).not.toContain(GIVING_PURPOSES_COLLECTION);
    expect(PLAIN_COLLECTIONS).not.toContain(GIVING_PURPOSES_COLLECTION);
  });

  test("firestore.rules har en regel for gaveformål", () => {
    expect(rules).toContain("match /givingPurposes/{");
  });

  test("ingen fil i server/ eller api/ nevner gaveformål", () => {
    const files = [...filesUnder("server"), ...filesUnder("api")];
    expect(files.length).toBeGreaterThan(0);
    const found = files.filter((file) => {
      const text = readFileSync(path.join(root, file), "utf8");
      return text.includes("givingPurposes") || text.includes("GIVING_");
    });
    expect(found).toEqual([]);
  });
});
