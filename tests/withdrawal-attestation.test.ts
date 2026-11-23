import { describe, expect, test } from "vitest";
import { buildWithdrawalAttestationDocx } from "../src/utils/withdrawalAttestation";

describe("Utmeldingsattest", () => {
  test("lager docx-blob", () => {
    const blob = buildWithdrawalAttestationDocx({
      churchName: "Eksempelmenigheten",
      person: { name: "Ola Eksempel", birthDate: "1990-05-15" },
      withdrawCongregation: true,
      withdrawDenomination: false,
      withdrawalDate: "2026-11-01",
    });
    expect(blob.type).toContain("wordprocessingml");
    expect(blob.size).toBeGreaterThan(100);
  });
});