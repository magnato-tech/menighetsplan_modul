import { describe, expect, test } from "vitest";
import {
  MEMBERSHIP_ARCHIVE_NOTICE,
  membershipFormPath,
  nationalIdValid,
  splitRegisteredName,
  validateCongregationApply,
  validateDenominationChild,
} from "../src/utils/membershipApplication";

describe("Medlemskapsskjema", () => {
  test("arkivtekst", () => {
    expect(MEMBERSHIP_ARCHIVE_NOTICE).toContain("konfidensielt");
    expect(MEMBERSHIP_ARCHIVE_NOTICE).toContain("fysisk eller digitalt");
  });

  test("splitter registrert navn", () => {
    expect(splitRegisteredName("Ola Nordmann")).toEqual({ firstNames: "Ola", lastName: "Nordmann" });
    expect(splitRegisteredName("Kari")).toEqual({ firstNames: "", lastName: "Kari" });
  });

  test("fødselsnummer", () => {
    expect(nationalIdValid("12345678901")).toBe(true);
    expect(nationalIdValid("123")).toBe(false);
  });

  test("stier fra handling", () => {
    expect(membershipFormPath("combinedApply", {})).toBe("/minside/medlemskap/soknad-menighet");
    expect(membershipFormPath("congregationApply", {})).toBe("/minside/medlemskap/soknad-menighet");
    expect(membershipFormPath("denominationEnroll", { birthDate: "2015-01-01" })).toBe(
      "/minside/medlemskap/innmelding-kirkesamfunn/barn"
    );
    expect(membershipFormPath("denominationEnroll", { birthDate: "1990-01-01" })).toBe(
      "/minside/medlemskap/innmelding-kirkesamfunn"
    );
  });

  test("søknad krever bekreftelser", () => {
    const base = {
      lastName: "Nord",
      firstNames: "Ola",
      address: "Gate 1",
      phone: "999",
      email: "a@b.no",
      nationalId: "12345678901",
      baptized: true as const,
      baptizedDate: "2000-01-01",
      alsoDenomination: false,
      notOtherDenomination: false,
      childrenToEnroll: false,
      signaturePlace: "X",
      signatureDate: "2026-01-01",
    };
    expect(
      validateCongregationApply({ ...base, alsoDenomination: true }, { requireBaptizedDate: true })
    ).toContain("trossamfunn");
    expect(
      validateCongregationApply(
        { ...base, alsoDenomination: true, notOtherDenomination: true },
        { requireBaptizedDate: true }
      )
    ).toBeNull();
    expect(
      validateCongregationApply(
        { ...base, alsoDenomination: false, notOtherDenomination: false },
        { requireBaptizedDate: true }
      )
    ).toBeNull();
    expect(
      validateCongregationApply(
        { ...base, notOtherDenomination: false },
        { requireBaptizedDate: true, alreadyDenominationMember: true }
      )
    ).toBeNull();
  });

  test("barneskjema", () => {
    expect(
      validateDenominationChild({
        childLastName: "N",
        childFirstNames: "B",
        childNationalId: "12345678901",
        childBirthPlace: "Bergen",
        childBaptized: false,
        childBaptizedDate: "",
        parent1Name: "Mor Mor",
        parent2Name: "",
        childFromOtherDenomination: false,
        childAttestationAttached: false,
        signaturePlace: "X",
        signatureDate: "2026-01-01",
        parent2ConfirmNoOther: false,
        parent2SignaturePlace: "",
        parent2SignatureDate: "",
      })
    ).toBeNull();
  });
});