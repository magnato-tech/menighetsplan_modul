import { describe, expect, test } from "vitest";
import { getMockDocuments } from "../src/data/mockDocuments";
import { COLLECTIONS } from "../src/data/collections";
import type { Person } from "../src/types";
import {
  buildDemoMembershipApplication,
  DEMO_APPLICATION_SPECS,
  DEMO_CLERK_BOARD_TASK_COUNT,
  DEMO_LEGACY_DATE_FIELDS,
  DEMO_MEMBERSHIP_APPLICATION_PERSON_IDS,
  demoApplicationClerkTask,
  demoApplicationLogEntry,
  demoClerkBoardNeedsReseed,
  expectedDemoClerkTaskIds,
} from "../src/utils/demoMembershipClerkSeed";
import { DEMO_LEGACY_PROTOCOL_PERSON_IDS } from "../src/utils/mockMembershipSeed";
import { applicationTaskId, dateCorrectionTaskId, enrollmentDateCorrectionNeeded } from "../src/utils/membershipClerkTasks";

const persons = () =>
  getMockDocuments()
    .filter((d) => d.collection === COLLECTIONS.PERSONS)
    .map((d) => d.data as Person);

describe("Demoseed for protokollansvarlig", () => {
  test("tolv personer med 31.12.2010 gir tolv datokorrigeringsoppgaver", () => {
    const legacy = persons().filter((p) => DEMO_LEGACY_PROTOCOL_PERSON_IDS.has(p.id));
    expect(legacy).toHaveLength(12);

    const fields = legacy.flatMap((p) => enrollmentDateCorrectionNeeded(p));
    expect(fields).toHaveLength(12);

    const taskIds = new Set(
      legacy.flatMap((p) =>
        (DEMO_LEGACY_DATE_FIELDS[p.id] ?? []).map((field) => dateCorrectionTaskId(p.id, field))
      )
    );
    expect(taskIds.size).toBe(12);
  });

  test("seks søknader fra bruker: kirke, menighet og begge", () => {
    const seekers = persons().filter((p) => DEMO_MEMBERSHIP_APPLICATION_PERSON_IDS.has(p.id));
    expect(seekers).toHaveLength(6);

    const churchName = "Eksempelmenigheten";
    for (const spec of DEMO_APPLICATION_SPECS) {
      const person = seekers.find((p) => p.id === spec.personId);
      expect(person).toBeTruthy();
      const app = buildDemoMembershipApplication(person!, churchName, spec);
      expect(app.status).toBe("submitted");
      expect(app.kind).toBe(spec.kind);
      if (spec.kind === "congregationApply") {
        expect(app.alsoDenomination).toBe(spec.alsoDenomination === true);
      }
      const task = demoApplicationClerkTask(app);
      expect(task.kind).toBe("application");
      expect(task.status).toBe("open");
      expect(task.id).toBe(applicationTaskId(app.id));
      const log = demoApplicationLogEntry(app);
      expect(log.applicationId).toBe(app.id);
      expect(log.status).toBe("submitted");
    }

    const kirke = seekers.filter((p) => p.id === "person-91" || p.id === "person-92");
    const menighet = seekers.filter((p) => p.id === "person-93" || p.id === "person-94");
    const begge = seekers.filter((p) => p.id === "person-95" || p.id === "person-96");
    expect(kirke.every((p) => !p.denominationMember && !p.congregationMember)).toBe(true);
    expect(menighet.every((p) => p.denominationMember && !p.congregationMember)).toBe(true);
    expect(begge.every((p) => !p.denominationMember && !p.congregationMember)).toBe(true);
  });

  test("demo-oppgavebordet har tjue faste oppgaver", () => {
    const all = persons();
    const ids = expectedDemoClerkTaskIds(all);
    expect(ids).toHaveLength(DEMO_CLERK_BOARD_TASK_COUNT);
    expect(new Set(ids).size).toBe(DEMO_CLERK_BOARD_TASK_COUNT);
  });

  test("reseed når bare utmeldingsoppgaver finnes", () => {
    const all = persons();
    const partial = all.filter((p) => p.id === "person-69" || p.id === "person-70");
    const expectedPartial = expectedDemoClerkTaskIds(partial);
    expect(expectedPartial).toHaveLength(2);
    const openWithdrawals = expectedPartial.map((id) => ({ id, kind: "withdrawal" as const, status: "open" as const }));
    expect(demoClerkBoardNeedsReseed(openWithdrawals as never, partial)).toBe(true);
    expect(demoClerkBoardNeedsReseed(openWithdrawals as never, all)).toBe(true);
  });
});