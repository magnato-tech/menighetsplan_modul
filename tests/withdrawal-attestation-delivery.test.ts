import { describe, expect, test } from "vitest";
import { canCompleteWithdrawalTask } from "../src/utils/membershipClerkTasks";
import { canSendWithdrawalAttestationEmail, withdrawalAttestationDelivered } from "../src/utils/withdrawalAttestationDelivery";
import type { MembershipClerkTask } from "../src/types";

const withdrawal = (patch: Partial<MembershipClerkTask> = {}): MembershipClerkTask => ({
  id: "w1",
  kind: "withdrawal",
  status: "open",
  createdAt: "2026-01-01T10:00:00.000Z",
  personId: "p1",
  personName: "Ola",
  instruction: "x",
  cornerstoneUpdated: true,
  ...patch,
});

describe("Utmeldingsattest", () => {
  test("levert via e-post eller brevpost", () => {
    expect(withdrawalAttestationDelivered({ attestationEmailedAt: "2026-01-02" })).toBe(true);
    expect(withdrawalAttestationDelivered({ attestationPosted: true })).toBe(true);
    expect(withdrawalAttestationDelivered({ attestationSent: true })).toBe(true);
    expect(withdrawalAttestationDelivered({})).toBe(false);
  });

  test("e-post krever Cornerstone og adresse", () => {
    const task = withdrawal();
    expect(canSendWithdrawalAttestationEmail(task, "ola@example.org").ok).toBe(true);
    expect(canSendWithdrawalAttestationEmail(withdrawal({ cornerstoneUpdated: false }), "ola@example.org").ok).toBe(false);
    expect(canSendWithdrawalAttestationEmail(withdrawal({ attestationEmailedAt: "2026" }), "ola@example.org").ok).toBe(false);
    expect(canSendWithdrawalAttestationEmail(task, undefined).ok).toBe(false);
  });

  test("fullføring følger attest", () => {
    expect(canCompleteWithdrawalTask(withdrawal({ attestationPosted: true })).ok).toBe(true);
  });
});