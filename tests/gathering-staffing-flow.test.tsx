// @vitest-environment jsdom
/**
 * End-to-end staffing flow: admin creates data, group leader requests volunteers on
 * program posts, members respond (yes/no/forfall), leader re-requests on other posts.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { COLLECTIONS } from "../src/data/collections";
import { buildInitialVolunteerRoles } from "../src/data/defaultVolunteerRoles";
import type { Gathering, Person, ProgramItem, Task } from "../src/types";
import { buildRunSheet } from "../src/utils/runSheet";
import { clearCollections, offline, seed, stored, storedIds } from "./support/offlineFirestore";
import { resetSession } from "./support/session";

vi.mock("../src/firebase", async () => (await import("./support/offlineFirestore")).firebaseModuleMock);
// Who is signed in is what the test says (see support/session.ts)
vi.mock("../src/services/auth", async () => (await import("./support/session")).authModuleMock);

import { FirebaseDataProvider, useFirebase } from "../src/context/FirebaseDataContext";
import { useLeaderGatheringDetail } from "../src/hooks/leaderHooks";
import { useTaskDetail } from "../src/hooks/memberHooks";
import { useMyPage } from "../src/pages/myPage/useMyPage";

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <FirebaseDataProvider>{children}</FirebaseDataProvider>
  </MemoryRouter>
);

/** Mounts the provider against an empty offline database (volunteer roles only). */
async function mountProvider() {
  const hook = renderHook(() => useFirebase(), { wrapper });
  await waitFor(() => expect(hook.result.current.addPerson).toBeTypeOf("function"));
  return hook;
}

async function switchUser(hook: Awaited<ReturnType<typeof mountProvider>>, personId: string) {
  hook.result.current.standInAs!(personId);
  await waitFor(() => expect(hook.result.current.currentUser.id).toBe(personId));
}

interface Scenario {
  leader: Person;
  ola: Person;
  per: Person;
  groupId: string;
  gatheringFar: Gathering;
  gatheringSoon: Gathering;
  taskLyd: Task;
  taskBilde: Task;
  taskVert: Task;
  taskSoon: Task;
  programFar: ProgramItem[];
}

type ProviderHook = Awaited<ReturnType<typeof mountProvider>>;

/** Admin-style setup: persons, group with leader, two gatherings, tasks on program posts. */
async function buildScenario(hook: ProviderHook): Promise<Scenario> {
  const leader = hook.result.current.addPerson({ name: "Camilla Bakke" }).person!;
  const ola = hook.result.current.addPerson({ name: "Ola Hansen" }).person!;
  const per = hook.result.current.addPerson({ name: "Per Olsen" }).person!;
  await waitFor(() => expect(hook.result.current.allPersons).toHaveLength(3));
  hook.result.current.standInAs!(leader.id);
  await waitFor(() => expect(hook.result.current.currentUser.id).toBe(leader.id));

  const group = hook.result.current
    .createGroup({
      name: "Lyd og bilde",
      leaderIds: [leader.id],
      memberIds: [ola.id, per.id],
    })
    .group!;
  await waitFor(() => expect(hook.result.current.getGroupById(group.id)?.name).toBe("Lyd og bilde"));

  const gatheringFar = hook.result.current
    .createGathering({
      groupId: group.id,
      title: "Gudstjeneste om en måned",
      startsAt: inDays(30),
      visibility: "intern",
    })
    .gathering!;
  await waitFor(() =>
    expect(hook.result.current.getGatheringById(gatheringFar.id)?.title).toBe("Gudstjeneste om en måned")
  );

  const gatheringSoon = hook.result.current
    .createGathering({
      groupId: group.id,
      title: "Gudstjeneste i morgen",
      startsAt: inHours(24),
      visibility: "intern",
    })
    .gathering!;
  await waitFor(() => expect(hook.result.current.getGatheringById(gatheringSoon.id)).toBeTruthy());

  const taskLyd = hook.result.current
    .createTask({
      gatheringId: gatheringFar.id,
      groupId: group.id,
      title: "Lydtekniker",
      neededCount: 1,
    })
    .task!;
  const taskBilde = hook.result.current
    .createTask({
      gatheringId: gatheringFar.id,
      groupId: group.id,
      title: "Bilde",
      neededCount: 1,
    })
    .task!;
  const taskVert = hook.result.current
    .createTask({
      gatheringId: gatheringFar.id,
      groupId: group.id,
      title: "Møtevert",
      neededCount: 1,
    })
    .task!;
  const taskSoon = hook.result.current
    .createTask({
      gatheringId: gatheringSoon.id,
      groupId: group.id,
      title: "Lydtekniker akutt",
      neededCount: 1,
    })
    .task!;
  await waitFor(() =>
    expect(hook.result.current.tasks.filter((t) => t.gatheringId === gatheringFar.id)).toHaveLength(3)
  );

  const programFar: ProgramItem[] = [
    { time: "11:00", title: "Lovsang", taskId: taskLyd.id },
    { time: "11:30", title: "Preken", taskId: taskBilde.id },
    { time: "12:15", title: "Kirkekaffe", taskId: taskVert.id },
  ];

  hook.result.current.updateGathering(gatheringFar.id, { programSchedule: programFar });
  hook.result.current.updateGathering(gatheringSoon.id, {
    programSchedule: [{ time: "11:00", title: "Gudstjeneste", taskId: taskSoon.id }],
  });

  await waitFor(() =>
    expect(hook.result.current.getGatheringById(gatheringFar.id)?.programSchedule).toHaveLength(3)
  );

  return {
    leader,
    ola,
    per,
    groupId: group.id,
    gatheringFar,
    gatheringSoon,
    taskLyd,
    taskBilde,
    taskVert,
    taskSoon,
    programFar,
  };
}

beforeEach(async () => {
  await offline;
  await clearCollections(Object.values(COLLECTIONS));
  resetSession();
  // Omit undefined groupId — Firestore rejects undefined field values in seed writes.
  seed(
    COLLECTIONS.VOLUNTEER_ROLES,
    buildInitialVolunteerRoles().map((role) => {
      const { groupId, ...rest } = role;
      return groupId ? { ...rest, groupId } : rest;
    })
  );
});

afterEach(cleanup);

describe("Admin oppretter personer, grupper og arrangementer", () => {
  test("personer, gruppeleder, program og oppgaver lagres og henger sammen", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    await switchUser(admin, scenario.leader.id);

    expect(admin.result.current.getGroupById(scenario.groupId)).toMatchObject({
      name: "Lyd og bilde",
      leaderIds: [scenario.leader.id],
      memberIds: [scenario.ola.id, scenario.per.id],
    });

    const savedGathering = await stored(COLLECTIONS.GATHERINGS, scenario.gatheringFar.id);
    expect(savedGathering?.programSchedule).toHaveLength(3);
    expect(savedGathering?.programSchedule?.map((p: ProgramItem) => p.taskId)).toEqual([
      scenario.taskLyd.id,
      scenario.taskBilde.id,
      scenario.taskVert.id,
    ]);

    expect(await storedIds(COLLECTIONS.TASKS)).toHaveLength(4);
    expect(await storedIds(COLLECTIONS.PERSONS)).toHaveLength(3);
  });
});

describe("Gruppeleder bemanner programposter", () => {
  test("leder har tilgang og ser oppgaver knyttet til programmet", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    admin.unmount();

    const screen = renderHook(
      () => ({
        data: useFirebase(),
        leader: useLeaderGatheringDetail(scenario.gatheringFar.id),
      }),
      { wrapper }
    );
    await waitFor(() => expect(screen.result.current.data.gatherings.length).toBeGreaterThanOrEqual(2));
    screen.result.current.data.standInAs!(scenario.leader.id);
    await waitFor(() => {
      expect(screen.result.current.leader.hasAccess).toBe(true);
      expect(screen.result.current.leader.isLeader).toBe(true);
    });
    expect(screen.result.current.leader.programSchedule).toHaveLength(3);
    expect(screen.result.current.leader.tasksWithDetails.map((t) => t.task.id).sort()).toEqual(
      [scenario.taskLyd.id, scenario.taskBilde.id, scenario.taskVert.id].sort()
    );
    expect(screen.result.current.leader.tasksWithDetails.every((t) => t.task.status === "open")).toBe(true);
  });

  test("leder forespør medlem på hver programpost", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    await switchUser(admin, scenario.leader.id);

    admin.result.current.assignTaskToPerson(scenario.taskLyd.id, scenario.ola.id, "pending");
    admin.result.current.assignTaskToPerson(scenario.taskBilde.id, scenario.per.id, "pending");
    admin.result.current.assignTaskToPerson(scenario.taskVert.id, scenario.ola.id, "pending");

    await waitFor(() => expect(admin.result.current.getTaskById(scenario.taskLyd.id)?.status).toBe("assigned"));

    const lydAssignments = admin.result.current.getAllAssignmentsForTask(scenario.taskLyd.id);
    expect(lydAssignments).toHaveLength(1);
    expect(lydAssignments[0]).toMatchObject({ personId: scenario.ola.id, response: "pending" });
    expect(admin.result.current.getAllAssignmentsForTask(scenario.taskBilde.id)[0].personId).toBe(scenario.per.id);
    expect(admin.result.current.getAllAssignmentsForTask(scenario.taskVert.id)[0].personId).toBe(scenario.ola.id);
  });
});

describe("Medlem svarer på forespørsel", () => {
  test("ja på oppgavesiden bekrefter tildelingen", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    admin.result.current.assignTaskToPerson(scenario.taskLyd.id, scenario.ola.id, "pending");

    const ola = renderHook(
      () => ({ data: useFirebase(), task: useTaskDetail(scenario.taskLyd.id) }),
      { wrapper }
    );
    await waitFor(() => expect(ola.result.current.data.allPersons).toHaveLength(3));
    ola.result.current.data.standInAs!(scenario.ola.id);
    await waitFor(() => expect(ola.result.current.task.isAskedOfMe).toBe(true));

    expect(ola.result.current.task.answerRequest(true).success).toBe(true);
    await waitFor(() => expect(ola.result.current.task.isAssignedToMe).toBe(true));
    expect((await stored(COLLECTIONS.TASKS, scenario.taskLyd.id))?.status).toBe("confirmed");
  });

  test("Min side viser forespørsler per programpost og ja flytter oppgaven til «Dine oppgaver»", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    admin.result.current.assignTaskToPerson(scenario.taskLyd.id, scenario.ola.id, "pending");
    admin.result.current.assignTaskToPerson(scenario.taskVert.id, scenario.ola.id, "pending");

    const ola = renderHook(() => ({ data: useFirebase(), page: useMyPage() }), { wrapper });
    await waitFor(() => expect(ola.result.current.data.allPersons).toHaveLength(3));
    ola.result.current.data.standInAs!(scenario.ola.id);

    await waitFor(() => {
      const titles = ola.result.current.page.attentionItems
        .filter((i) => i.type === "task_request")
        .map((i) => i.title);
      expect(titles).toContain("Lydtekniker");
      expect(titles).toContain("Møtevert");
    });

    const lydRequest = ola.result.current.page.attentionItems.find(
      (i) => i.type === "task_request" && i.title === "Lydtekniker"
    )!;
    ola.result.current.page.handleAttentionAnswer(lydRequest, true);
    await waitFor(() => expect(ola.result.current.page.myTasks.map((t) => t.id)).toContain(scenario.taskLyd.id));
  });
});

describe("Avslag og ny forespørsel på programposter", () => {
  test("nei på én post gjør oppgaven ledig – leder kan forespørre annen person på samme post", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    admin.result.current.assignTaskToPerson(scenario.taskLyd.id, scenario.ola.id, "pending");

    const ola = renderHook(
      () => ({ data: useFirebase(), task: useTaskDetail(scenario.taskLyd.id) }),
      { wrapper }
    );
    await waitFor(() => expect(ola.result.current.data.allPersons).toHaveLength(3));
    ola.result.current.data.standInAs!(scenario.ola.id);
    await waitFor(() => expect(ola.result.current.task.isAskedOfMe).toBe(true));
    ola.result.current.task.answerRequest(false);
    await waitFor(() => expect(ola.result.current.task.task?.status).toBe("open"));

    await switchUser(admin, scenario.leader.id);
    admin.result.current.assignTaskToPerson(scenario.taskLyd.id, scenario.per.id, "pending");
    await waitFor(() =>
      expect(admin.result.current.getAllAssignmentsForTask(scenario.taskLyd.id).map((a) => a.personId)).toContain(
        scenario.per.id
      )
    );

    const per = renderHook(
      () => ({ data: useFirebase(), task: useTaskDetail(scenario.taskLyd.id) }),
      { wrapper }
    );
    await waitFor(() => expect(per.result.current.data.allPersons).toHaveLength(3));
    per.result.current.data.standInAs!(scenario.per.id);
    await waitFor(() => expect(per.result.current.task.isAskedOfMe).toBe(true));
    per.result.current.task.answerRequest(true);
    await waitFor(() => expect(per.result.current.task.isAssignedToMe).toBe(true));
    expect((await stored(COLLECTIONS.TASKS, scenario.taskLyd.id))?.status).toBe("confirmed");
  });

  test("person som sa nei på én post kan forespørres på en annen programpost", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    admin.result.current.assignTaskToPerson(scenario.taskLyd.id, scenario.ola.id, "pending");

    const ola = renderHook(() => ({ data: useFirebase(), page: useMyPage() }), { wrapper });
    await waitFor(() => expect(ola.result.current.data.allPersons).toHaveLength(3));
    ola.result.current.data.standInAs!(scenario.ola.id);
    await waitFor(() => expect(ola.result.current.page.attentionItems.some((i) => i.title === "Lydtekniker")).toBe(true));

    const request = ola.result.current.page.attentionItems.find((i) => i.title === "Lydtekniker")!;
    ola.result.current.page.handleAttentionAnswer(request, false);
    await waitFor(() =>
      expect(ola.result.current.page.attentionItems.some((i) => i.title === "Lydtekniker")).toBe(false)
    );

    admin.result.current.assignTaskToPerson(scenario.taskVert.id, scenario.ola.id, "pending");
    await waitFor(() =>
      expect(ola.result.current.page.attentionItems.some((i) => i.title === "Møtevert")).toBe(true)
    );
  });

  test("samme person får ikke ledig oppgave tilbake på Min side etter avslag", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    admin.result.current.assignTaskToPerson(scenario.taskLyd.id, scenario.ola.id, "pending");

    const ola = renderHook(() => ({ data: useFirebase(), page: useMyPage() }), { wrapper });
    await waitFor(() => expect(ola.result.current.data.allPersons).toHaveLength(3));
    ola.result.current.data.standInAs!(scenario.ola.id);
    await waitFor(() => expect(ola.result.current.page.attentionItems.some((i) => i.title === "Lydtekniker")).toBe(true));

    const request = ola.result.current.page.attentionItems.find((i) => i.title === "Lydtekniker")!;
    ola.result.current.page.handleAttentionAnswer(request, false);
    await waitFor(() =>
      expect(ola.result.current.page.attentionItems.some((i) => i.type === "open_task" && i.title === "Lydtekniker")).toBe(
        false
      )
    );
  });
});

describe("Forfall og vikarbehov", () => {
  test("forfall i god tid gjør oppgaven ledig igjen", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    admin.result.current.assignTaskToPerson(scenario.taskBilde.id, scenario.ola.id, "confirmed");
    await waitFor(() => expect(admin.result.current.getTaskById(scenario.taskBilde.id)?.status).toBe("confirmed"));

    const ola = renderHook(
      () => ({ data: useFirebase(), task: useTaskDetail(scenario.taskBilde.id) }),
      { wrapper }
    );
    await waitFor(() => expect(ola.result.current.data.allPersons).toHaveLength(3));
    ola.result.current.data.standInAs!(scenario.ola.id);
    await waitFor(() => expect(ola.result.current.task.canReportAbsence).toBe(true));

    ola.result.current.task.reportAbsence();
    await waitFor(() => expect(ola.result.current.task.task?.status).toBe("open"));
    expect(ola.result.current.task.needsSubstitute).toBe(false);
    const assignment = admin.result.current.getAllAssignmentsForTask(scenario.taskBilde.id)[0];
    expect((await stored(COLLECTIONS.ASSIGNMENTS, assignment.id))?.response).toBe("withdrawn");
  });

  test("forfall under 48 timer før samlingen er akutt – leder kan forespørre vikar", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    admin.result.current.assignTaskToPerson(scenario.taskSoon.id, scenario.ola.id, "confirmed");
    await waitFor(() => expect(admin.result.current.getTaskById(scenario.taskSoon.id)?.status).toBe("confirmed"));

    admin.result.current.reportAbsence(scenario.taskSoon.id, scenario.ola.id, "Syk");
    await waitFor(() => expect(admin.result.current.getTaskById(scenario.taskSoon.id)?.status).toBe("vacant"));

    const ola = renderHook(() => ({ data: useFirebase(), page: useMyPage() }), { wrapper });
    await waitFor(() => expect(ola.result.current.data.allPersons).toHaveLength(3));
    ola.result.current.data.standInAs!(scenario.per.id);
    await waitFor(() => {
      const item = ola.result.current.page.attentionItems.find((i) => i.title === "Lydtekniker akutt");
      expect(item).toMatchObject({ type: "open_task", needsSubstitute: true });
    });

    await switchUser(admin, scenario.leader.id);
    admin.result.current.assignTaskToPerson(scenario.taskSoon.id, scenario.per.id, "pending");
    await waitFor(() => {
      expect(admin.result.current.getTaskById(scenario.taskSoon.id)?.status).toBe("assigned");
      expect(
        admin.result.current
          .getAllAssignmentsForTask(scenario.taskSoon.id)
          .some((a) => a.personId === scenario.per.id && a.response === "pending")
      ).toBe(true);
    });

    const perTask = renderHook(
      () => ({ data: useFirebase(), task: useTaskDetail(scenario.taskSoon.id) }),
      { wrapper }
    );
    await waitFor(() => expect(perTask.result.current.data.allPersons).toHaveLength(3));
    perTask.result.current.data.standInAs!(scenario.per.id);
    await waitFor(() => expect(perTask.result.current.task.isAskedOfMe).toBe(true));
    perTask.result.current.task.answerRequest(true);
    await waitFor(() => expect(admin.result.current.getTaskById(scenario.taskSoon.id)?.status).toBe("confirmed"));
  });
});

describe("Kjøreplan og gruppeledervisning", () => {
  test("kjøreplanen viser bemanning per programpost etter at folk har svart", async () => {
    const admin = await mountProvider();
    const scenario = await buildScenario(admin);
    admin.result.current.assignTaskToPerson(scenario.taskLyd.id, scenario.ola.id, "confirmed");
    admin.result.current.assignTaskToPerson(scenario.taskBilde.id, scenario.per.id, "pending");
    await waitFor(() => expect(admin.result.current.getTaskById(scenario.taskLyd.id)?.status).toBe("confirmed"));

    await switchUser(admin, scenario.leader.id);
    const { result: leaderView } = renderHook(
      () => useLeaderGatheringDetail(scenario.gatheringFar.id),
      { wrapper }
    );
    await waitFor(() => expect(leaderView.current.tasksWithDetails).toHaveLength(3));

    const runSheet = buildRunSheet(
      leaderView.current.programSchedule,
      leaderView.current.tasksWithDetails,
      admin.result.current.volunteerRoles
    );

    expect(runSheet).toHaveLength(3);
    const lydRow = runSheet.find((r) => r.task?.id === scenario.taskLyd.id)!;
    const bildeRow = runSheet.find((r) => r.task?.id === scenario.taskBilde.id)!;
    const vertRow = runSheet.find((r) => r.task?.id === scenario.taskVert.id)!;

    expect(lydRow.isFullyCovered).toBe(true);
    expect(lydRow.confirmedCount).toBe(1);
    expect(bildeRow.isFullyCovered).toBe(false);
    expect(bildeRow.assignedPersons[0].response).toBe("pending");
    expect(vertRow.isFullyCovered).toBe(false);
    expect(vertRow.confirmedCount).toBe(0);
  });
});
