import { describe, expect, test } from "vitest";
import { ageOn, birthDateError, formatBirthDate, todayInNorway } from "../src/utils/birthDate";

const TODAY = "2026-10-12";

describe("Fødselsdatoen til en person", () => {
  test("en dato som finnes og ikke ligger fram i tid, godtas, og et tomt felt også", () => {
    expect(birthDateError("1980-03-12", TODAY)).toBeNull();
    expect(birthDateError(TODAY, TODAY)).toBeNull();
    expect(birthDateError("", TODAY)).toBeNull();
    expect(birthDateError("  ", TODAY)).toBeNull();
  });

  test("det som ikke er en dato, en dato fram i tid og et årstall som må være feil, sies fra om", () => {
    expect(birthDateError("12.03.1980", TODAY)).toBe("Fødselsdatoen er ikke en gyldig dato.");
    expect(birthDateError("1981-02-31", TODAY)).toBe("Fødselsdatoen er ikke en gyldig dato.");
    expect(birthDateError("2026-10-13", TODAY)).toBe("Fødselsdatoen kan ikke være fram i tid.");
    expect(birthDateError("0198-03-12", TODAY)).toMatch(/for langt tilbake/);
  });

  test("alderen er hele år, og skifter på fødselsdagen", () => {
    expect(ageOn("1980-10-12", TODAY)).toBe(46);
    expect(ageOn("1980-10-13", TODAY)).toBe(45);
    expect(ageOn("1980-03-12", TODAY)).toBe(46);
    expect(ageOn("2026-10-12", TODAY)).toBe(0);
    // Born on the 29th of February: a year older on the 1st of March in a year without one
    expect(ageOn("2004-02-29", "2026-02-28")).toBe(21);
    expect(ageOn("2004-02-29", "2026-03-01")).toBe(22);
  });

  test("uten en gyldig fødselsdato er det ingen alder og ingen tekst", () => {
    expect(ageOn(undefined, TODAY)).toBeNull();
    expect(ageOn("ikke en dato", TODAY)).toBeNull();
    expect(ageOn("2030-01-01", TODAY)).toBeNull();
    expect(formatBirthDate(undefined)).toBe("");
    expect(formatBirthDate("1981-02-31")).toBe("");
  });

  test("datoen leses som dag, måned og år", () => {
    expect(formatBirthDate("1980-03-12")).toBe("12. mars 1980");
    expect(formatBirthDate("2011-12-01")).toBe("1. desember 2011");
  });

  test("dagen i dag er dagen i Norge, også rundt midnatt", () => {
    expect(todayInNorway(new Date("2026-10-12T21:59:00Z"))).toBe("2026-10-12");
    expect(todayInNorway(new Date("2026-10-12T22:01:00Z"))).toBe("2026-10-13");
  });
});
