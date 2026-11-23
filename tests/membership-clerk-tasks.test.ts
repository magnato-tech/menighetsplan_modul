import { describe, expect, test } from "vitest";
import {
  DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE,
  enrollmentDateCorrectionNeeded,
  openClerkTasks,
  canCompleteDateCorrectionTask,
  canCompleteWithdrawalTask,
  buildDateCorrectionTask,
  clerkTaskHeadline,
  dateCorrectionTaskId,
} from "../src/utils/membershipClerkTasks";
import type { MembershipClerkTask } from "../src/types";

describe("Protokolloppgaver", () => {
  test("legacy innmeldingsdato gir felt å rette", () => {
    expect(
      enrollmentDateCorrectionNeeded({
        congregationJoinedAt: DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE,
        denominationJoinedAt: "2019-04-12",
      })
    ).toEqual(["congregationJoinedAt"]);
  });

  test("stabil id for datokorrigering", () => {
    expect(dateCorrectionTaskId("p1", "congregationJoinedAt")).toBe("enroll-fix-p1-cong");
  });

  test("åpne oppgaver sorteres med legacy dato først", () => {
    const tasks: MembershipClerkTask[] = [
      {
        id: "b",
        kind: "application",
        status: "open",
        createdAt: "2026-06-01T10:00:00.000Z",
        personId: "p2",
        personName: "B",
        instruction: "x",
        applicationId: "a1",
      },
      buildDateCorrectionTask(
        { id: "p1", name: "A", congregationJoinedAt: DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE },
        "congregationJoinedAt",
        "2026-01-01T10:00:00.000Z"
      ),
    ];
    const open = openClerkTasks(tasks);
    expect(open[0].kind).toBe("correctEnrollmentDate");
    expect(open.length).toBe(2);
  });

  test("utført teller ned", () => {
    const tasks: MembershipClerkTask[] = [
      buildDateCorrectionTask(
        { id: "p1", name: "A", congregationJoinedAt: DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE },
        "congregationJoinedAt",
        "2026-01-01T10:00:00.000Z"
      ),
      { ...buildDateCorrectionTask(
        { id: "p2", name: "B", denominationJoinedAt: DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE },
        "denominationJoinedAt",
        "2026-01-02T10:00:00.000Z"
      ), status: "done" },
    ];
    expect(openClerkTasks(tasks).length).toBe(1);
  });

  test("validering av ny dato", () => {
    expect(canCompleteDateCorrectionTask("2015-06-01", true).ok).toBe(true);
    expect(canCompleteDateCorrectionTask("2015-06-01", false).ok).toBe(false);
    expect(canCompleteDateCorrectionTask(DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE, true).ok).toBe(false);
  });

  test("utmeldingsoppgave krever Cornerstone og attest", () => {
    expect(canCompleteWithdrawalTask({ cornerstoneUpdated: true, attestationEmailedAt: "2026-01-01" }).ok).toBe(true);
    expect(canCompleteWithdrawalTask({ cornerstoneUpdated: true, attestationPosted: true }).ok).toBe(true);
    expect(canCompleteWithdrawalTask({ cornerstoneUpdated: false, attestationPosted: true }).ok).toBe(false);
    expect(canCompleteWithdrawalTask({ cornerstoneUpdated: true }).ok).toBe(false);
  });

  test("tydelige overskrifter per oppgavetype", () => {
    expect(
      clerkTaskHeadline(
        buildDateCorrectionTask(
          { id: "p", name: "N", congregationJoinedAt: DIGITAL_PROTOCOL_LEGACY_ENROLLMENT_DATE },
          "congregationJoinedAt",
          "2026-01-01"
        )
      )
    ).toBe("Feil innmeldingsdato (menighet)");
    expect(
      clerkTaskHeadline({
        kind: "withdrawal",
        withdrawCongregation: true,
        withdrawDenomination: true,
      })
    ).toBe("Utmelding (menighet og kirkesamfunn)");
    expect(
      clerkTaskHeadline({ kind: "application" }, { kind: "denominationAdultEnroll", alsoDenomination: true })
    ).toBe("Selvstendig innmelding i kirkesamfunn");
    expect(
      clerkTaskHeadline({ kind: "application" }, { kind: "congregationApply", alsoDenomination: false })
    ).toBe("Innmelding (menighet)");
    expect(
      clerkTaskHeadline({ kind: "application" }, { kind: "congregationApply", alsoDenomination: true })
    ).toBe("Innmelding (menighet og kirkesamfunn)");
    expect(
      clerkTaskHeadline({ kind: "application" }, { kind: "denominationChildEnroll", alsoDenomination: true })
    ).toBe("Barn innmeldt i kirkesamfunn");
  });
});