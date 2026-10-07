// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { CMS_COLLECTIONS, COLLECTIONS } from "../src/data/collections";
import { clearWriteError, getWriteError } from "../src/services/writeErrors";
import type { Assignment, Gathering, Group, GroupMessage, Person, Task } from "../src/types";
import { clearCollections, offline, seed, stored, storedIds } from "./support/offlineFirestore";
import { nobodySignedIn, resetSession, signInStatePending, signInWith, startAsPerson } from "./support/session";

// The provider runs against the real Firestore client, kept offline. What a test sees in
// the provider's state is therefore what the client holds after the write, not a guess at it.
vi.mock("../src/firebase", async () => (await import("./support/offlineFirestore")).firebaseModuleMock);
// Who is signed in is what the test says (see support/session.ts)
vi.mock("../src/services/auth", async () => (await import("./support/session")).authModuleMock);

import { FirebaseDataProvider, useFirebase } from "../src/context/FirebaseDataContext";

const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
// A withdrawal is acute less than 48 hours before the gathering
const farAhead = inHours(30 * 24);
const tomorrow = inHours(24);

const persons: Person[] = [
  { id: "person-1", name: "Kari Nordmann", globalRole: "admin" },
  { id: "person-2", name: "Ola Hansen", globalRole: "member" },
  { id: "person-3", name: "Per Olsen", globalRole: "member" },
];
const groups: Group[] = [
  {
    id: "group-lyd",
    name: "Lyd og bilde",
    memberIds: ["person-2"],
    leaderIds: ["person-1"],
    memberJoinedAt: { "person-2": "2026-01-10T12:00:00.000Z" },
    notificationPreferences: { "person-2": false },
  },
];
const gatherings: Gathering[] = [
  {
    id: "gathering-1",
    groupId: "group-lyd",
    title: "Gudstjeneste",
    startsAt: farAhead,
    theme: "Nåde",
    visibility: "offentlig",
    isPublic: true,
  },
  { id: "gathering-soon", groupId: "group-lyd", title: "Bønnemøte", startsAt: tomorrow, visibility: "intern", isPublic: false },
];
const tasks: Task[] = [
  { id: "task-1", gatheringId: "gathering-1", groupId: "group-lyd", title: "Lydtekniker", status: "open", neededCount: 1 },
  { id: "task-2", gatheringId: "gathering-1", groupId: "group-lyd", title: "Bilde", status: "open", neededCount: 2 },
  { id: "task-soon", gatheringId: "gathering-soon", groupId: "group-lyd", title: "Vert", status: "confirmed", neededCount: 1 },
];
const assignments: Assignment[] = [
  { id: "assign-1", taskId: "task-2", personId: "person-2", response: "confirmed" },
  { id: "assign-soon", taskId: "task-soon", personId: "person-3", response: "confirmed" },
];
const messages: GroupMessage[] = [
  {
    id: "msg-1",
    groupId: "group-lyd",
    senderPersonId: "person-2",
    senderName: "Ola Hansen",
    content: "Hei!",
    createdAt: "2026-10-01T08:00:00.000Z",
  },
];

beforeEach(async () => {
  await offline;
  await clearCollections(Object.values(COLLECTIONS));
  // Unless a test says otherwise, the one using the app is the first person in the register
  resetSession();
  startAsPerson("person-1");
  seed(COLLECTIONS.PERSONS, persons);
  seed(COLLECTIONS.GROUPS, groups);
  seed(COLLECTIONS.GATHERINGS, gatherings);
  seed(COLLECTIONS.TASKS, tasks);
  seed(COLLECTIONS.ASSIGNMENTS, assignments);
  seed(COLLECTIONS.GROUP_MESSAGES, messages);
  clearWriteError();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Mounts the provider and waits for the first snapshots. */
async function mountProvider(internal = true) {
  const { result } = renderHook(() => useFirebase(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <FirebaseDataProvider internal={internal}>{children}</FirebaseDataProvider>
    ),
  });
  await waitFor(() => expect(result.current.allPersons).toHaveLength(persons.length));
  await waitFor(() => expect(result.current.gatherings).toHaveLength(gatherings.length));
  if (internal) {
    await waitFor(() => expect(result.current.tasks).toHaveLength(tasks.length));
    await waitFor(() => expect(result.current.assignments).toHaveLength(assignments.length));
  }
  return result;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isTimestamp = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

describe("Lesing", () => {
  test("Dataene i databasen vises", async () => {
    const data = await mountProvider();
    await waitFor(() => {
      expect(data.current.groups.map((g) => g.id)).toEqual(["group-lyd"]);
      expect(data.current.groupMessages.map((m) => m.id)).toEqual(["msg-1"]);
    });
    expect(data.current.getTaskById("task-1")?.title).toBe("Lydtekniker");
    expect(data.current.getTasksForPerson("person-2").map((t) => t.id)).toEqual(["task-2"]);
  });

  test("Den offentlige nettsiden får ikke oppgaver, tildelinger, meldinger eller oppmøte", async () => {
    seed(CMS_COLLECTIONS.SETTINGS, [
      {
        id: "headcount-gathering-1",
        recordType: "gatheringHeadcount",
        gatheringId: "gathering-1",
        adults: 40,
        children: 9,
        registeredAt: "2026-10-01T12:00:00.000Z",
      },
    ]);
    const data = await mountProvider(false);
    await waitFor(() => expect(data.current.groups).toHaveLength(1));
    await pause(60);
    expect(data.current.tasks).toEqual([]);
    expect(data.current.assignments).toEqual([]);
    expect(data.current.groupMessages).toEqual([]);
    expect(data.current.attendances).toEqual([]);
    expect(data.current.headcounts).toEqual([]);
  });

  test("På egen maskin kan en utvikler gå inn som en person, og bytte til en annen", async () => {
    const data = await mountProvider();
    expect(data.current.currentUser.id).toBe("person-1");
    expect(data.current.session).toMatchObject({ status: "member", account: null });

    data.current.standInAs!("person-2");
    await waitFor(() => expect(data.current.currentUser.name).toBe("Ola Hansen"));
  });
});

describe("Nye dokumenter", () => {
  test("En ny samling vises og lagres slik den ble returnert", async () => {
    const data = await mountProvider();
    const result = data.current.createGathering({
      groupId: "group-lyd",
      title: " Høsttakkefest ",
      startsAt: "2026-10-18T09:00:00.000Z",
    });
    expect(result.success).toBe(true);
    const created = result.gathering!;

    await waitFor(() => expect(data.current.getGatheringById(created.id)?.title).toBe("Høsttakkefest"));
    const saved = await stored(COLLECTIONS.GATHERINGS, created.id);
    expect(saved).toMatchObject({
      id: created.id,
      groupId: "group-lyd",
      title: "Høsttakkefest",
      visibility: "offentlig",
      isPublic: true,
    });
    // Fields that were never filled in are left out, not stored as empty values
    expect(saved).not.toHaveProperty("theme");
  });

  test("En ny oppgave, gruppe og person vises og lagres", async () => {
    const data = await mountProvider();
    const task = data.current.createTask({ gatheringId: "gathering-1", groupId: "group-lyd", title: "Kirkekaffe", neededCount: 2 }).task!;
    const group = data.current.createGroup({ name: "Kirkekaffe", leaderIds: ["person-1"] }).group!;
    const person = data.current.addPerson({ name: "Anne Berg", phone: "900 00 000" }).person!;

    await waitFor(() => {
      expect(data.current.getTaskById(task.id)).toMatchObject({ title: "Kirkekaffe", status: "open", neededCount: 2 });
      expect(data.current.getGroupById(group.id)).toMatchObject({ name: "Kirkekaffe", leaderIds: ["person-1"], memberIds: [] });
      expect(data.current.getPersonById(person.id)).toMatchObject({ name: "Anne Berg", globalRole: "member" });
    });
    expect(await stored(COLLECTIONS.TASKS, task.id)).toMatchObject({ id: task.id, gatheringId: "gathering-1" });
    expect(await stored(COLLECTIONS.GROUPS, group.id)).toMatchObject({ id: group.id, category: "tjenestegruppe" });
    expect(await stored(COLLECTIONS.PERSONS, person.id)).toMatchObject({ id: person.id, phone: "900 00 000" });
  });

  test("En melding sendes fra den aktive brukeren", async () => {
    const data = await mountProvider();
    const message = data.current.sendGroupMessage("group-lyd", "  Husk øvelse i kveld  ").message!;

    await waitFor(() => expect(data.current.getGroupMessages("group-lyd").map((m) => m.id)).toEqual(["msg-1", message.id]));
    expect(await stored(COLLECTIONS.GROUP_MESSAGES, message.id)).toMatchObject({
      senderPersonId: "person-1",
      senderName: "Kari Nordmann",
      content: "Husk øvelse i kveld",
    });
  });
});

describe("Endringer", () => {
  test("Et felt som tømmes forsvinner, og resten av samlingen står urørt", async () => {
    const data = await mountProvider();
    data.current.updateGathering("gathering-1", { title: "Familiegudstjeneste", theme: undefined });

    await waitFor(() => expect(data.current.getGatheringById("gathering-1")?.title).toBe("Familiegudstjeneste"));
    expect(data.current.getGatheringById("gathering-1")).not.toHaveProperty("theme");
    const saved = await stored(COLLECTIONS.GATHERINGS, "gathering-1");
    expect(saved).toMatchObject({ title: "Familiegudstjeneste", startsAt: farAhead });
    expect(saved).not.toHaveProperty("theme");
  });

  test("Invitasjonen registreres som sendt med tidspunkt", async () => {
    const data = await mountProvider();
    data.current.sendGatheringInvitation("gathering-1");

    await waitFor(() => expect(data.current.getGatheringById("gathering-1")?.invitationSent).toBe(true));
    expect(isTimestamp((await stored(COLLECTIONS.GATHERINGS, "gathering-1"))?.invitationSentAt)).toBe(true);
  });

  test("Oppgaven kan endres felt for felt", async () => {
    const data = await mountProvider();
    data.current.updateTaskInstruction("task-1", "Møt 09:30");
    data.current.updateTask("task-1", { title: "Lyd og lys" });

    await waitFor(() => expect(data.current.getTaskById("task-1")).toMatchObject({ instruction: "Møt 09:30", title: "Lyd og lys" }));
    expect(data.current.getTaskById("task-1")?.status).toBe("open");
  });

  test("Gruppe og person kan endres", async () => {
    const data = await mountProvider();
    data.current.updateGroupName("group-lyd", "  Teknikk  ");
    data.current.updateGroup("group-lyd", { description: "Lyd, lys og bilde" });
    data.current.updatePerson("person-2", { phone: "911 11 111" });

    await waitFor(() => {
      expect(data.current.getGroupById("group-lyd")).toMatchObject({ name: "Teknikk", description: "Lyd, lys og bilde" });
      expect(data.current.getPersonById("person-2")?.phone).toBe("911 11 111");
    });
    expect(await stored(COLLECTIONS.GROUPS, "group-lyd")).toMatchObject({ name: "Teknikk", memberIds: ["person-2"] });
  });
});

describe("Sletting", () => {
  test("Samling, oppgave og melding forsvinner", async () => {
    const data = await mountProvider();
    data.current.deleteGathering("gathering-1");
    data.current.deleteTask("task-1");
    data.current.deleteGroupMessage("msg-1");

    await waitFor(() => {
      expect(data.current.gatherings.map((g) => g.id)).toEqual(["gathering-soon"]);
      expect(data.current.tasks.map((t) => t.id).sort()).toEqual(["task-2", "task-soon"]);
      expect(data.current.groupMessages).toEqual([]);
    });
    expect(await storedIds(COLLECTIONS.GATHERINGS)).toEqual(["gathering-soon"]);
    expect(await storedIds(COLLECTIONS.TASKS)).toEqual(["task-2", "task-soon"]);
  });
});

describe("Medlemskap", () => {
  test("Et nytt medlem legges til én gang og får innmeldingsdato", async () => {
    const data = await mountProvider();
    data.current.addGroupMember("group-lyd", "person-3");
    data.current.addGroupMember("group-lyd", "person-3");

    await waitFor(() => expect(data.current.getGroupById("group-lyd")?.memberIds).toEqual(["person-2", "person-3"]));
    const saved = await stored(COLLECTIONS.GROUPS, "group-lyd");
    expect(saved?.memberIds).toEqual(["person-2", "person-3"]);
    expect(isTimestamp(saved?.memberJoinedAt["person-3"])).toBe(true);
    expect(saved?.memberJoinedAt["person-2"]).toBe("2026-01-10T12:00:00.000Z");
    expect(data.current.isPersonInGroup("person-3", "group-lyd")).toBe(true);
  });

  test("Et medlem som fjernes er heller ikke leder lenger", async () => {
    const data = await mountProvider();
    data.current.removeGroupMember("group-lyd", "person-1");
    data.current.removeGroupMember("group-lyd", "person-2");

    await waitFor(() => expect(data.current.getGroupById("group-lyd")).toMatchObject({ memberIds: [], leaderIds: [] }));
    expect(await stored(COLLECTIONS.GROUPS, "group-lyd")).toMatchObject({ memberIds: [], leaderIds: [], deputyLeaderIds: [] });
    expect(data.current.isPersonInGroup("person-2", "group-lyd")).toBe(false);
  });

  test("Varslingsvalget gjelder bare personen som endrer det", async () => {
    const data = await mountProvider();
    expect(data.current.getGroupNotificationsEnabled("group-lyd", "person-1")).toBe(true);
    expect(data.current.toggleGroupNotifications("group-lyd", "person-1")).toEqual({ success: true, enabled: false });

    await waitFor(() => expect(data.current.getGroupNotificationsEnabled("group-lyd", "person-1")).toBe(false));
    expect((await stored(COLLECTIONS.GROUPS, "group-lyd"))?.notificationPreferences).toEqual({
      "person-1": false,
      "person-2": false,
    });

    expect(data.current.toggleGroupNotifications("group-lyd", "person-1")).toEqual({ success: true, enabled: true });
    await waitFor(() => expect(data.current.getGroupNotificationsEnabled("group-lyd", "person-1")).toBe(true));
  });
});

// PRODUKTDOKUMENTASJON.md chapter 3: the task's status follows from its need and its assignments
describe("Bemanning", () => {
  test("Direkte tildeling bekrefter tildelingen, og oppgaven er dekket", async () => {
    const data = await mountProvider();
    data.current.assignTaskToPerson("task-1", "person-3", "confirmed");

    await waitFor(() => expect(data.current.getTaskById("task-1")?.status).toBe("confirmed"));
    const [assignment] = data.current.getAllAssignmentsForTask("task-1");
    expect(assignment).toMatchObject({ taskId: "task-1", personId: "person-3", response: "confirmed" });
    const saved = await stored(COLLECTIONS.ASSIGNMENTS, assignment.id);
    expect(saved).toMatchObject({ response: "confirmed" });
    expect(isTimestamp(saved?.assignedAt)).toBe(true);
    expect((await stored(COLLECTIONS.TASKS, "task-1"))?.status).toBe("confirmed");
  });

  test("En forespørsel venter på svar, og svaret avgjør oppgavens status", async () => {
    const data = await mountProvider();
    data.current.assignTaskToPerson("task-1", "person-3", "pending");
    await waitFor(() => expect(data.current.getTaskById("task-1")?.status).toBe("assigned"));
    const [request] = data.current.getAllAssignmentsForTask("task-1");
    expect(request.response).toBe("pending");
    expect(request).not.toHaveProperty("respondedAt");

    data.current.updateAssignmentStatus(request.id, "confirmed");
    await waitFor(() => expect(data.current.getTaskById("task-1")?.status).toBe("confirmed"));
    expect(isTimestamp((await stored(COLLECTIONS.ASSIGNMENTS, request.id))?.respondedAt)).toBe(true);

    // Setting it back to "pending" means the person has not answered after all
    data.current.updateAssignmentStatus(request.id, "pending");
    await waitFor(() => expect(data.current.getTaskById("task-1")?.status).toBe("assigned"));
    expect(await stored(COLLECTIONS.ASSIGNMENTS, request.id)).not.toHaveProperty("respondedAt");
  });

  test("Et nei i god tid gjør oppgaven ledig igjen", async () => {
    const data = await mountProvider();
    data.current.assignTaskToPerson("task-1", "person-3", "pending");
    await waitFor(() => expect(data.current.getAllAssignmentsForTask("task-1")).toHaveLength(1));

    data.current.updateAssignmentStatus(data.current.getAllAssignmentsForTask("task-1")[0].id, "declined");
    await waitFor(() => expect(data.current.getAllAssignmentsForTask("task-1")[0].response).toBe("declined"));
    expect((await stored(COLLECTIONS.TASKS, "task-1"))?.status).toBe("open");
  });

  test("En oppgave som trenger to er ledig til begge plassene er fylt", async () => {
    const data = await mountProvider();
    expect(data.current.getTaskById("task-2")?.status).toBe("open");

    data.current.assignTaskToPerson("task-2", "person-3", "confirmed");
    await waitFor(() => expect(data.current.getTaskById("task-2")?.status).toBe("confirmed"));
    expect(data.current.getAllAssignmentsForTask("task-2")).toHaveLength(2);
  });

  test("Forfall i god tid lagres med grunn, og oppgaven blir ledig", async () => {
    const data = await mountProvider();
    data.current.assignTaskToPerson("task-2", "person-3", "confirmed");
    await waitFor(() => expect(data.current.getTaskById("task-2")?.status).toBe("confirmed"));

    expect(data.current.reportAbsence("task-2", "person-2", " Syk ")).toEqual({ success: true });
    await waitFor(() => expect(data.current.getTaskById("task-2")?.status).toBe("open"));
    const saved = await stored(COLLECTIONS.ASSIGNMENTS, "assign-1");
    expect(saved).toMatchObject({ response: "withdrawn", withdrawalReason: "Syk" });
    expect(isTimestamp(saved?.respondedAt)).toBe(true);
    expect((await stored(COLLECTIONS.TASKS, "task-2"))?.status).toBe("open");
  });

  test("Forfall mindre enn 48 timer før samlingen er akutt, til noen tar oppgaven", async () => {
    const data = await mountProvider();
    data.current.reportAbsence("task-soon", "person-3");
    await waitFor(() => expect(data.current.getTaskById("task-soon")?.status).toBe("vacant"));
    expect((await stored(COLLECTIONS.ASSIGNMENTS, "assign-soon"))?.response).toBe("withdrawn");

    data.current.assignTaskToPerson("task-soon", "person-2", "confirmed");
    await waitFor(() => expect(data.current.getTaskById("task-soon")?.status).toBe("confirmed"));
    expect((await stored(COLLECTIONS.TASKS, "task-soon"))?.status).toBe("confirmed");
  });

  test("Den som bare er spurt og melder fra, har svart nei", async () => {
    const data = await mountProvider();
    data.current.assignTaskToPerson("task-1", "person-3", "pending");
    await waitFor(() => expect(data.current.getAllAssignmentsForTask("task-1")).toHaveLength(1));

    data.current.reportAbsence("task-1", "person-3");
    await waitFor(() => expect(data.current.getAllAssignmentsForTask("task-1")[0].response).toBe("declined"));
    expect(data.current.getTaskById("task-1")?.status).toBe("open");
  });

  test("Forfall fra en som ikke står på oppgaven gjør ingenting", async () => {
    const data = await mountProvider();
    expect(data.current.reportAbsence("task-1", "person-2").success).toBe(false);
    expect(data.current.reportAbsence("ukjent-oppgave", "person-2").success).toBe(false);
    await pause(60);
    expect(data.current.getTaskById("task-1")?.status).toBe("open");
    expect(getWriteError()).toBeNull();
  });

  test("Når en person fjernes fra oppgaven, er plassen ledig igjen", async () => {
    const data = await mountProvider();
    data.current.removeAssignment("assign-soon");

    await waitFor(() => expect(data.current.getAllAssignmentsForTask("task-soon")).toEqual([]));
    expect(data.current.getTaskById("task-soon")?.status).toBe("open");
    expect((await stored(COLLECTIONS.TASKS, "task-soon"))?.status).toBe("open");
    expect(await storedIds(COLLECTIONS.ASSIGNMENTS)).toEqual(["assign-1"]);
  });

  test("Endret behov endrer også om oppgaven er dekket", async () => {
    const data = await mountProvider();
    data.current.updateTaskNeededCount("task-2", 1);
    await waitFor(() => expect(data.current.getTaskById("task-2")).toMatchObject({ neededCount: 1, status: "confirmed" }));

    data.current.updateTask("task-2", { neededCount: 3 });
    await waitFor(() => expect(data.current.getTaskById("task-2")).toMatchObject({ neededCount: 3, status: "open" }));

    // Without a stated need the task counts as needing one person
    data.current.updateTaskNeededCount("task-2", undefined);
    await waitFor(() => expect(data.current.getTaskById("task-2")).not.toHaveProperty("neededCount"));
    expect((await stored(COLLECTIONS.TASKS, "task-2"))?.status).toBe("confirmed");
  });
});

describe("Tjenesteroller", () => {
  test("ny rolle med instruks kan opprettes og redigeres", async () => {
    const data = await mountProvider();
    const created = data.current.createVolunteerRole({
      name: "Teknikk",
      instruction: "Møt kl. 09:00",
      sortOrder: 0,
    }).role!;

    await waitFor(() => expect(data.current.volunteerRoles.some((r) => r.id === created.id)).toBe(true));
    expect((await stored(CMS_COLLECTIONS.SETTINGS, created.id))?.instruction).toBe("Møt kl. 09:00");

    data.current.updateVolunteerRole(created.id, { instruction: "Møt kl. 10:00" });
    await waitFor(() =>
      expect(data.current.volunteerRoles.find((r) => r.id === created.id)?.instruction).toBe("Møt kl. 10:00")
    );
    expect((await stored(CMS_COLLECTIONS.SETTINGS, created.id))?.instruction).toBe("Møt kl. 10:00");
  });
});

describe("Oppmøte", () => {
  test("Hver person har ett svar per samling, og et nytt svar erstatter det gamle", async () => {
    const data = await mountProvider();
    data.current.respondToGathering("gathering-1", "person-2", "attending");
    await waitFor(() => expect(data.current.getPersonAttendance("gathering-1", "person-2")?.status).toBe("attending"));

    data.current.respondToGathering("gathering-1", "person-2", "declined");
    await waitFor(() => expect(data.current.getPersonAttendance("gathering-1", "person-2")?.status).toBe("declined"));
    expect(data.current.getGatheringAttendances("gathering-1")).toHaveLength(1);
    expect(await storedIds(COLLECTIONS.GATHERING_ATTENDANCES)).toHaveLength(1);
  });
});

describe("Oppmøtetall", () => {
  // Stored in cms_settings, marked by recordType, until the live rules allow their own collection
  const storedCounts = async () =>
    (await storedIds(CMS_COLLECTIONS.SETTINGS)).filter((id) => id.startsWith("headcount-"));

  beforeEach(async () => {
    await clearCollections([CMS_COLLECTIONS.SETTINGS]);
  });

  test("Et oppmøtetall lagres med hvem som registrerte det, og en ny telling erstatter den gamle", async () => {
    const data = await mountProvider();
    data.current.registerHeadcount("gathering-1", { adults: 80, children: 20, note: "Dåp" });
    await waitFor(() => expect(data.current.headcounts).toHaveLength(1));
    const first = await stored(CMS_COLLECTIONS.SETTINGS, "headcount-gathering-1");
    expect(first).toMatchObject({
      recordType: "gatheringHeadcount",
      gatheringId: "gathering-1",
      adults: 80,
      children: 20,
      note: "Dåp",
      registeredBy: "person-1",
    });
    expect(isTimestamp(first?.registeredAt)).toBe(true);
    expect(data.current.headcounts[0]).not.toHaveProperty("recordType");

    data.current.registerHeadcount("gathering-1", { adults: 82, children: 20 });
    await waitFor(() => expect(data.current.headcounts[0]?.adults).toBe(82));
    expect(data.current.headcounts).toHaveLength(1);
    expect(await storedCounts()).toEqual(["headcount-gathering-1"]);
    // The corrected count has no note, so the old note is gone too
    expect(await stored(CMS_COLLECTIONS.SETTINGS, "headcount-gathering-1")).not.toHaveProperty("note");
  });

  test("Et oppmøtetall kan fjernes igjen", async () => {
    const data = await mountProvider();
    data.current.registerHeadcount("gathering-1", { adults: 10, children: 0 });
    await waitFor(() => expect(data.current.headcounts).toHaveLength(1));
    data.current.removeHeadcount("gathering-1");
    await waitFor(() => expect(data.current.headcounts).toEqual([]));
    expect(await storedCounts()).toEqual([]);
  });

  test("Tjenesteroller i samme samling blir ikke lest som oppmøtetall", async () => {
    const data = await mountProvider();
    data.current.createVolunteerRole({ name: "Lyd", sortOrder: 0 });
    data.current.registerHeadcount("gathering-1", { adults: 10, children: 0 });
    await waitFor(() => expect(data.current.headcounts).toHaveLength(1));
    await waitFor(() => expect(data.current.volunteerRoles.map((r) => r.name)).toContain("Lyd"));
    expect(data.current.volunteerRoles.some((r) => r.id === "headcount-gathering-1")).toBe(false);
  });
});

describe("Analysebordet", () => {
  test("En modul skjules og vises igjen for personen som bruker bordet", async () => {
    const data = await mountProvider();
    data.current.setAnalyticsModuleHidden("oppmote", true);
    data.current.setAnalyticsModuleHidden("grupper", true);
    await waitFor(() => expect(data.current.currentUser.analyticsHiddenModules).toEqual(["oppmote", "grupper"]));
    // Hiding twice keeps one entry
    data.current.setAnalyticsModuleHidden("oppmote", true);
    data.current.setAnalyticsModuleHidden("grupper", false);
    await waitFor(() => expect(data.current.currentUser.analyticsHiddenModules).toEqual(["oppmote"]));
    expect((await stored(COLLECTIONS.PERSONS, "person-1"))?.analyticsHiddenModules).toEqual(["oppmote"]);
    // Another person's board is not touched
    expect((await stored(COLLECTIONS.PERSONS, "person-2"))?.analyticsHiddenModules).toBeUndefined();

    data.current.showAllAnalyticsModules();
    await waitFor(() => expect(data.current.currentUser).not.toHaveProperty("analyticsHiddenModules"));
    expect(await stored(COLLECTIONS.PERSONS, "person-1")).not.toHaveProperty("analyticsHiddenModules");
  });
});

describe("Feil", () => {
  test("En skriving databasen avviser meldes til brukeren", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const data = await mountProvider();
    // Firestore cannot store a function
    data.current.updateGathering("gathering-1", { theme: (() => "x") as unknown as string });

    await waitFor(() => expect(getWriteError()?.action).toBe("lagre endringene i samlingen"));
    await waitFor(() => expect(data.current.getGatheringById("gathering-1")?.theme).toBe("Nåde"));
    expect((await stored(COLLECTIONS.GATHERINGS, "gathering-1"))?.theme).toBe("Nåde");
  });
});

describe("Hvem som bruker appen", () => {
  const eva: Person = { id: "person-eva", name: "Eva Epost", email: "Eva@Eksempel.no", globalRole: "member" };

  // Nobody is stood in for here: who is in, is decided by the account and the register
  beforeEach(() => {
    resetSession();
    seed(COLLECTIONS.PERSONS, [eva]);
  });

  async function mount() {
    const { result } = renderHook(() => useFirebase(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <FirebaseDataProvider>{children}</FirebaseDataProvider>,
    });
    await waitFor(() => expect(result.current.allPersons).toHaveLength(persons.length + 1));
    return result;
  }

  test("Den som logger inn med adressen sin fra registeret, er den personen, og får planleggingsdataene", async () => {
    signInWith("eva@eksempel.no");
    const data = await mount();

    await waitFor(() => expect(data.current.session).toMatchObject({ status: "member", person: { id: "person-eva" } }));
    expect(data.current.currentUser.name).toBe("Eva Epost");
    await waitFor(() => expect(data.current.tasks).toHaveLength(tasks.length));
    await waitFor(() => expect(data.current.assignments).toHaveLength(assignments.length));
  });

  test("Den som ikke er logget inn, er ingen, og planleggingsdataene hentes ikke", async () => {
    nobodySignedIn();
    const data = await mount();
    await pause(150);

    expect(data.current.session).toEqual({ status: "signedOut" });
    expect(data.current.currentUser).toMatchObject({ id: "", name: "", globalRole: "member" });
    expect(data.current.tasks).toEqual([]);
    expect(data.current.assignments).toEqual([]);
    expect(data.current.groupMessages).toEqual([]);
  });

  test("En konto som ikke står i registeret, er logget inn uten å være noen her", async () => {
    signInWith("fremmed@eksempel.no");
    const data = await mount();
    await pause(150);

    expect(data.current.session).toMatchObject({ status: "notInRegister", reason: "noMatch" });
    expect(data.current.currentUser.id).toBe("");
    expect(data.current.tasks).toEqual([]);
  });

  test("Før innloggingen er kjent, er ingenting avgjort", async () => {
    signInStatePending();
    const data = await mount();
    expect(data.current.session).toEqual({ status: "loading" });
    expect(data.current.tasks).toEqual([]);

    signInWith("eva@eksempel.no");
    await waitFor(() => expect(data.current.session.status).toBe("member"));
  });

  test("Den som logger ut, er ingen igjen, og planleggingsdataene blir ikke liggende i nettleseren", async () => {
    signInWith("eva@eksempel.no");
    const data = await mount();
    await waitFor(() => expect(data.current.tasks).toHaveLength(tasks.length));

    await data.current.signOut();

    await waitFor(() => expect(data.current.session).toEqual({ status: "signedOut" }));
    await waitFor(() => expect(data.current.tasks).toEqual([]));
    expect(data.current.assignments).toEqual([]);
    expect(data.current.groupMessages).toEqual([]);
    // What the public website also reads, is still there
    expect(data.current.gatherings).toHaveLength(gatherings.length);
  });
});
