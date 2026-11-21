import { describe, expect, test } from "vitest";
import type { MembershipClerkTask, Person } from "../src/types";
import {
  canCompleteClerkTask,
  cornerstoneDoneForTask,
  periodContains,
  protocolLogRows,
} from "../src/utils/membershipProtocolLog";
import { canCompleteDateCorrectionTask } from "../src/utils/membershipClerkTasks";

const today = new Date("2026-06-15T12:00:00.000Z");

describe("Protokoll-logg", () => {
  test("rullerende 12 måneder og kalenderår", () => {
    expect(periodContains("2025-07-01", { kind: "rolling12" }, today)).toBe(true);
    expect(periodContains("2024-01-01", { kind: "rolling12" }, today)).toBe(false);
    expect(periodContains("2026-03-10", { kind: "year", year: 2026 }, today)).toBe(true);
    expect(periodContains("2025-12-31", { kind: "year", year: 2026 }, today)).toBe(false);
  });

  test("utførte oppgaver blir rader", () => {
    const tasks: MembershipClerkTask[] = [
      {
        id: "t1",
        kind: "withdrawal",
        status: "done",
        createdAt: "2026-01-01T10:00:00.000Z",
        personId: "p1",
        personName: "Ola",
        instruction: "x",
        doneAt: "2026-02-01T10:00:00.000Z",
        withdrawalDate: "2026-01-15",
        attestationEmailedAt: "2026-02-01T11:00:00.000Z",
      },
    ];
    const persons: Person[] = [
      { id: "p1", name: "Ola", globalRole: "member", denominationEnrollmentType: "A" },
    ];
    const rows = protocolLogRows(tasks, persons, [], { kind: "rolling12" }, "A", today);
    expect(rows).toHaveLength(1);
    expect(rows[0].event).toBe("Utmelding");
    expect(rows[0].document).toBe("E-post");
    expect(rows[0].category).toBe("A");
  });

  test("utført krever cornerstone og steg 2", () => {
    const withdrawal: MembershipClerkTask = {
      id: "w",
      kind: "withdrawal",
      status: "open",
      createdAt: "2026-01-01",
      personId: "p",
      personName: "P",
      instruction: "x",
      cornerstoneUpdated: true,
      attestationPosted: true,
      withdrawalDate: "2026-01-10",
    };
    expect(canCompleteClerkTask(withdrawal, "", null).ok).toBe(true);
    expect(canCompleteClerkTask({ ...withdrawal, cornerstoneUpdated: false }, "", null).ok).toBe(false);

    expect(canCompleteDateCorrectionTask("2015-01-01", true).ok).toBe(true);
    expect(canCompleteDateCorrectionTask("2015-01-01", false).ok).toBe(false);
    expect(cornerstoneDoneForTask({ ...withdrawal, cornerstoneUpdated: true }, null)).toBe(true);
  });
});