// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { COLLECTIONS } from "../src/data/collections";
import type { Assignment, Gathering, Group, Person, Task } from "../src/types";
import { clearCollections, offline, seed, stored } from "./support/offlineFirestore";
import { resetSession, startAsPerson } from "./support/session";

// What a volunteer sees and can do, run through the real provider and the real Firestore client (offline)
vi.mock("../src/firebase", async () => (await import("./support/offlineFirestore")).firebaseModuleMock);
// Who is signed in is what the test says (see support/session.ts)
vi.mock("../src/services/auth", async () => (await import("./support/session")).authModuleMock);

import { FirebaseDataProvider, useFirebase } from "../src/context/FirebaseDataContext";
import { useTaskDetail } from "../src/hooks/memberHooks";
import { useMyPage } from "../src/pages/myPage/useMyPage";

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const persons: Person[] = [
  { id: "leder", name: "Kari Nordmann", globalRole: "admin" },
  { id: "ola", name: "Ola Hansen", globalRole: "member" },
  { id: "per", name: "Per Olsen", globalRole: "member" },
  { id: "utenfor", name: "Anne Berg", globalRole: "member" },
];
const groups: Group[] = [{ id: "group-lyd", name: "Lyd og bilde", memberIds: ["ola", "per"], leaderIds: ["leder"] }];
const gathering = (id: string, startsAt: string, extra: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "group-lyd",
  title: `Samling ${id}`,
  startsAt,
  visibility: "intern",
  ...extra,
});
const gatherings: Gathering[] = [
  gathering("neste-uke", inDays(7), { invitationSent: true }),
  gathering("om-en-maaned", inDays(30)),
  gathering("forrige-uke", inDays(-7), { invitationSent: true }),
];
const task = (id: string, gatheringId: string, neededCount: number, status: Task["status"] = "open"): Task => ({
  id,
  gatheringId,
  groupId: "group-lyd",
  title: id,
  status,
  neededCount,
});
const tasks: Task[] = [
  task("lyd", "neste-uke", 1),
  task("bilde", "neste-uke", 2),
  task("vert", "om-en-maaned", 1, "confirmed"),
  task("gammel", "forrige-uke", 1),
];
const assignments: Assignment[] = [
  { id: "per-paa-bilde", taskId: "bilde", personId: "per", response: "confirmed" },
  { id: "ola-paa-vert", taskId: "vert", personId: "ola", response: "confirmed" },
];

beforeEach(async () => {
  await offline;
  await clearCollections(Object.values(COLLECTIONS));
  resetSession();
  seed(COLLECTIONS.PERSONS, persons);
  seed(COLLECTIONS.GROUPS, groups);
  seed(COLLECTIONS.GATHERINGS, gatherings);
  seed(COLLECTIONS.TASKS, tasks);
  seed(COLLECTIONS.ASSIGNMENTS, assignments);
});

afterEach(cleanup);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <FirebaseDataProvider>{children}</FirebaseDataProvider>
  </MemoryRouter>
);

/** Mounts the hooks as the given person, once the data has arrived. */
async function mountAs<T>(personId: string, useView: () => T) {
  // The planning data is only followed for someone in the register, so the person is there from the start
  startAsPerson(personId);
  const { result } = renderHook(() => ({ data: useFirebase(), view: useView() }), { wrapper });
  await waitFor(() => {
    expect(result.current.data.currentUser.id).toBe(personId);
    expect(result.current.data.allPersons).toHaveLength(persons.length);
    expect(result.current.data.gatherings).toHaveLength(gatherings.length);
    expect(result.current.data.tasks).toHaveLength(tasks.length);
    expect(result.current.data.assignments).toHaveLength(assignments.length);
  });
  return result;
}

describe("Oppgavesiden for et medlem", () => {
  test("En ledig oppgave kan tas, og er da bekreftet med en gang", async () => {
    const page = await mountAs("ola", () => useTaskDetail("lyd"));
    expect(page.current.view).toMatchObject({ canClaim: true, isAssignedToMe: false, freeSlots: 1, needsSubstitute: false });

    expect(page.current.view.claimTask().success).toBe(true);
    await waitFor(() => expect(page.current.view.isAssignedToMe).toBe(true));
    expect(page.current.view).toMatchObject({ canClaim: false, canReportAbsence: true, freeSlots: 0 });
    expect((await stored(COLLECTIONS.TASKS, "lyd"))?.status).toBe("confirmed");
  });

  test("En oppgave for to er ledig selv om én alt står på den", async () => {
    const page = await mountAs("ola", () => useTaskDetail("bilde"));
    expect(page.current.view).toMatchObject({ canClaim: true, freeSlots: 1 });
    expect(page.current.view.othersOnTask.map((p) => p.name)).toEqual(["Per Olsen"]);

    page.current.view.claimTask();
    await waitFor(() => expect(page.current.view.task?.status).toBe("confirmed"));
    expect(page.current.view).toMatchObject({ isAssignedToMe: true, freeSlots: 0 });
  });

  test("En forespørsel kan besvares med ja", async () => {
    const page = await mountAs("ola", () => useTaskDetail("lyd"));
    page.current.data.assignTaskToPerson("lyd", "ola", "pending");
    await waitFor(() => expect(page.current.view.isAskedOfMe).toBe(true));
    // Asked, so there is nothing to claim and nothing to withdraw from yet
    expect(page.current.view).toMatchObject({ canClaim: false, canReportAbsence: false, isAssignedToMe: false });

    expect(page.current.view.answerRequest(true).success).toBe(true);
    await waitFor(() => expect(page.current.view.isAssignedToMe).toBe(true));
    expect(page.current.view.task?.status).toBe("confirmed");
    expect(page.current.data.getAllAssignmentsForTask("lyd")).toHaveLength(1);
  });

  test("En forespørsel kan besvares med nei, og oppgaven er ledig for andre", async () => {
    const page = await mountAs("ola", () => useTaskDetail("lyd"));
    page.current.data.assignTaskToPerson("lyd", "ola", "pending");
    await waitFor(() => expect(page.current.view.isAskedOfMe).toBe(true));

    page.current.view.answerRequest(false);
    await waitFor(() => expect(page.current.view.isAskedOfMe).toBe(false));
    expect(page.current.view.task?.status).toBe("open");
    expect(page.current.data.getAllAssignmentsForTask("lyd")[0].response).toBe("declined");
    expect(page.current.view.answerRequest(true).success).toBe(false);
  });

  test("Den som har oppgaven kan melde forfall", async () => {
    const page = await mountAs("ola", () => useTaskDetail("vert"));
    expect(page.current.view).toMatchObject({ isAssignedToMe: true, canReportAbsence: true, canClaim: false });

    page.current.view.reportAbsence();
    await waitFor(() => expect(page.current.view.isAssignedToMe).toBe(false));
    // A month ahead is not acute, so the task is simply free again
    expect(page.current.view).toMatchObject({ freeSlots: 1, needsSubstitute: false, canReportAbsence: false });
    expect((await stored(COLLECTIONS.ASSIGNMENTS, "ola-paa-vert"))?.response).toBe("withdrawn");
  });

  test("En oppgave i en annen gruppe vises ikke", async () => {
    const page = await mountAs("utenfor", () => useTaskDetail("lyd"));
    expect(page.current.view).toMatchObject({ permissionDenied: true, task: null, canClaim: false });
    expect(page.current.view.claimTask().success).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(page.current.data.getAllAssignmentsForTask("lyd")).toEqual([]);
  });
});

describe("Min side", () => {
  const attention = (page: { current: { view: ReturnType<typeof useMyPage> } }) =>
    page.current.view.attentionItems.map((item) => `${item.type}:${item.title}`);

  test("Viser forespørsler, ubesvarte innkallinger og ledige oppgaver som ligger foran", async () => {
    const page = await mountAs("ola", useMyPage);
    page.current.data.assignTaskToPerson("lyd", "ola", "pending");

    await waitFor(() =>
      expect(attention(page)).toEqual([
        "task_request:lyd",
        "unanswered_invitation:Samling neste-uke",
        "open_task:bilde",
      ])
    );
    // Nothing from last week, and not the task Ola already has
    expect(page.current.view.attentionItems.some((item) => item.title === "gammel" || item.title === "vert")).toBe(false);
  });

  test("Et ja på en forespørsel flytter oppgaven til «Dine oppgaver»", async () => {
    const page = await mountAs("ola", useMyPage);
    expect(page.current.view.myTasks.map((t) => t.id)).toEqual(["vert"]);
    page.current.data.assignTaskToPerson("lyd", "ola", "pending");
    await waitFor(() => expect(attention(page)).toContain("task_request:lyd"));

    const request = page.current.view.attentionItems.find((item) => item.type === "task_request")!;
    page.current.view.handleAttentionAnswer(request, true);
    await waitFor(() => expect(attention(page)).not.toContain("task_request:lyd"));
    // The nearest task first
    expect(page.current.view.myTasks.map((t) => t.id)).toEqual(["lyd", "vert"]);
    expect(page.current.view.feedbackMessage?.text).toBe("Takk! Oppgaven er din.");
  });

  test("Et nei fjerner saken uten at oppgaven dukker opp igjen som ledig for samme person", async () => {
    const page = await mountAs("ola", useMyPage);
    page.current.data.assignTaskToPerson("lyd", "ola", "pending");
    await waitFor(() => expect(attention(page)).toContain("task_request:lyd"));

    const request = page.current.view.attentionItems.find((item) => item.type === "task_request")!;
    page.current.view.handleAttentionAnswer(request, false);
    await waitFor(() => expect(attention(page)).toEqual(["unanswered_invitation:Samling neste-uke", "open_task:bilde"]));
    expect((await stored(COLLECTIONS.TASKS, "lyd"))?.status).toBe("open");
  });

  test("En ledig oppgave kan tas, og en innkalling besvares, rett fra Min side", async () => {
    const page = await mountAs("ola", useMyPage);
    await waitFor(() => expect(attention(page)).toHaveLength(3));

    const openTask = page.current.view.attentionItems.find((item) => item.title === "bilde")!;
    page.current.view.handleAttentionAnswer(openTask, true);
    await waitFor(() => expect(attention(page)).not.toContain("open_task:bilde"));
    expect((await stored(COLLECTIONS.TASKS, "bilde"))?.status).toBe("confirmed");

    const invitation = page.current.view.attentionItems.find((item) => item.type === "unanswered_invitation")!;
    page.current.view.handleAttentionAnswer(invitation, false);
    await waitFor(() => expect(attention(page)).not.toContain("unanswered_invitation:Samling neste-uke"));
    expect(page.current.data.getPersonAttendance("neste-uke", "ola")?.status).toBe("declined");
  });

  test("En oppgave som står akutt ledig merkes som «trenger vikar»", async () => {
    seed(COLLECTIONS.TASKS, [task("lyd", "neste-uke", 1, "vacant")]);
    const page = await mountAs("ola", useMyPage);

    await waitFor(() => {
      const lyd = page.current.view.attentionItems.find((item) => item.title === "lyd");
      expect(lyd).toMatchObject({ type: "open_task", needsSubstitute: true });
    });
    expect(page.current.view.attentionItems.find((item) => item.title === "bilde")).toMatchObject({ needsSubstitute: false });
  });
});
