import { describe, expect, test } from "vitest";
import type { MembershipApplication } from "../src/types";
import {
  isMembershipApplicationOpen,
  membershipApplicationStatusLabel,
  membershipWorkflowSteps,
  openMembershipApplications,
} from "../src/utils/membershipClerkWorkflow";

const app = (status: MembershipApplication["status"]): MembershipApplication => ({
  id: "m1",
  kind: "congregationApply",
  personId: "p1",
  submittedAt: "2026-01-01T12:00:00.000Z",
  status,
  applicantName: "Ola Nord",
  lastName: "Nord",
  firstNames: "Ola",
  address: "Gate 1",
  phone: "1",
  email: "a@b.no",
  nationalId: "12345678901",
  baptized: true,
  notOtherDenomination: true,
  signaturePlace: "X",
  signatureDate: "2026-01-01",
});

describe("Protokollansvarlig", () => {
  test("åpne oppgaver", () => {
    expect(isMembershipApplicationOpen(app("submitted"))).toBe(true);
    expect(isMembershipApplicationOpen(app("completed"))).toBe(false);
    const open = openMembershipApplications([app("completed"), app("submitted"), app("received")]);
    expect(open.map((a) => a.status)).toEqual(["submitted", "received"]);
  });

  test("trinn i arbeidsflyt", () => {
    const steps = membershipWorkflowSteps(app("received"));
    expect(steps[0].done).toBe(true);
    expect(steps[1].done).toBe(false);
    expect(membershipApplicationStatusLabel.cornerstoneDone).toContain("Cornerstone");
  });
});