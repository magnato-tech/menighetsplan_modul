import { describe, expect, test } from "vitest";
import { canDeleteProgramItem, programEditorAssignment } from "../src/utils/programEditor";
import type { Assignment, Task, VolunteerRole } from "../src/types";

// Who may change a gathering's programme from Min side: the one who has said yes to leading it.
// The same rule as firestore.rules (leadsGatheringRole, editsProgramOf).

const roles: VolunteerRole[] = [
  { id: "role-moteleder", name: "Møteleder", sortOrder: 1 },
  { id: "role-lyd", name: "Lyd", sortOrder: 2 },
];

const NOW = new Date("2026-10-26T12:00:00.000Z").getTime();
const gathering = { id: "g1", startsAt: "2026-10-26T10:00:00.000Z" };

const tasks: Task[] = [
  { id: "t-moteleder", gatheringId: "g1", volunteerRoleId: "role-moteleder", title: "Møteleder", status: "confirmed" },
  { id: "t-gudstjeneste", gatheringId: "g1", title: "Gudstjenesteleder", status: "open" },
  { id: "t-lyd", gatheringId: "g1", volunteerRoleId: "role-lyd", title: "Lyd", status: "open" },
  { id: "t-annen-gudstjeneste", gatheringId: "g2", volunteerRoleId: "role-moteleder", title: "Møteleder", status: "open" },
  { id: "t-avlyst", gatheringId: "g1", volunteerRoleId: "role-moteleder", title: "Møteleder", status: "cancelled" },
];

const assignment = (id: string, taskId: string, personId: string, response: Assignment["response"]): Assignment =>
  ({ id, taskId, personId, response });

const mine = assignment("a-mine", "t-moteleder", "mette", "confirmed");

describe("Hvem som kan endre programmet", () => {
  test("bekreftet møteleder, med rolle-id, gir retten", () => {
    expect(programEditorAssignment(gathering, tasks, [mine], roles, "mette", NOW)).toBe(mine);
  });

  test("bekreftet gudstjenesteleder uten rolle-id, men med tittelen, gir retten", () => {
    const leader = assignment("a-gud", "t-gudstjeneste", "per", "confirmed");
    expect(programEditorAssignment(gathering, tasks, [leader], roles, "per", NOW)).toBe(leader);
  });

  test("bare å ha fått forespørselen (pending) gir ingen rett", () => {
    const asked = assignment("a-asked", "t-moteleder", "mette", "pending");
    expect(programEditorAssignment(gathering, tasks, [asked], roles, "mette", NOW)).toBeNull();
  });

  test("en annen persons bekreftede oppgave gir ingen rett", () => {
    expect(programEditorAssignment(gathering, tasks, [mine], roles, "ola", NOW)).toBeNull();
  });

  test("en oppgave på et annet arrangement gir ingen rett", () => {
    const other = assignment("a-other", "t-annen-gudstjeneste", "mette", "confirmed");
    expect(programEditorAssignment(gathering, tasks, [other], roles, "mette", NOW)).toBeNull();
  });

  test("en avlyst oppgave gir ingen rett", () => {
    const cancelled = assignment("a-cancelled", "t-avlyst", "mette", "confirmed");
    expect(programEditorAssignment(gathering, tasks, [cancelled], roles, "mette", NOW)).toBeNull();
  });

  test("rollen Lyd gir ingen rett, selv bekreftet", () => {
    const sound = assignment("a-lyd", "t-lyd", "mette", "confirmed");
    expect(programEditorAssignment(gathering, tasks, [sound], roles, "mette", NOW)).toBeNull();
  });

  test("et arrangement som er over, gir ingen rett, når det har sluttid", () => {
    const over = { id: "g1", startsAt: "2026-10-26T08:00:00.000Z", endsAt: "2026-10-26T11:00:00.000Z" };
    expect(programEditorAssignment(over, tasks, [mine], roles, "mette", NOW)).toBeNull();
  });

  test("et arrangement uten sluttid regnes som over tre timer etter start", () => {
    const started4hAgo = { id: "g1", startsAt: "2026-10-26T08:00:00.000Z" };
    expect(programEditorAssignment(started4hAgo, tasks, [mine], roles, "mette", NOW)).toBeNull();
    const started1hAgo = { id: "g1", startsAt: "2026-10-26T11:00:00.000Z" };
    expect(programEditorAssignment(started1hAgo, tasks, [mine], roles, "mette", NOW)).toBe(mine);
  });

  test("uten innlogget person gir ingen rett", () => {
    expect(programEditorAssignment(gathering, tasks, [mine], roles, undefined, NOW)).toBeNull();
  });
});

describe("Sletting av programposter", () => {
  test("en post knyttet til en oppgave kan ikke slettes", () => {
    expect(canDeleteProgramItem({ taskId: "t-moteleder" })).toBe(false);
  });

  test("en post uten oppgave kan slettes", () => {
    expect(canDeleteProgramItem({})).toBe(true);
  });
});
