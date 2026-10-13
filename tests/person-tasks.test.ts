import { describe, expect, test } from "vitest";
import type { Assignment, Gathering, Task } from "../src/types";
import { personTaskOverview } from "../src/utils/personTasks";

// What one person has taken on, by role. Only a yes counts.

const now = new Date("2026-10-13T12:00:00.000Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const event = (id: string, days: number, more: Partial<Gathering> = {}): Gathering => ({ id, groupId: "kalender", title: `Gudstjeneste ${id}`, startsAt: new Date(now + days * DAY).toISOString(), visibility: "offentlig", ...more });
const gatherings = [event("gammel", -120), event("holdt", -10), event("a", 12), event("b", 26), event("avlyst", 5, { cancelled: true })];
const roles = [{ id: "r-leder", name: "Møteleder" }, { id: "r-taler", name: "Taler" }];
const task = (id: string, gatheringId: string, more: Partial<Task> = {}): Task => ({ id, gatheringId, groupId: "g", title: "Egen tittel", status: "open", ...more });
const tasks = [
  task("t-gammel", "gammel", { volunteerRoleId: "r-leder" }),
  task("t-holdt", "holdt", { volunteerRoleId: "r-leder" }),
  task("t-holdt-spurt", "holdt", { volunteerRoleId: "r-taler" }),
  task("t-a-leder", "a", { volunteerRoleId: "r-leder" }),
  task("t-a-taler", "a", { volunteerRoleId: "r-taler" }),
  task("t-b-leder", "b", { volunteerRoleId: "r-leder" }),
  task("t-b-kaffe", "b", { title: "Kirkekaffe" }),
  task("t-b-nei", "b", { volunteerRoleId: "r-taler" }),
  task("t-b-strøket", "b", { volunteerRoleId: "r-taler", status: "cancelled" }),
  task("t-avlyst", "avlyst", { volunteerRoleId: "r-leder" }),
];
const on = (taskId: string, response: Assignment["response"] = "confirmed", personId = "p1"): Assignment => ({ id: `${taskId}-${personId}`, taskId, personId, response });
const assignments = [
  on("t-gammel"), on("t-holdt"), on("t-holdt-spurt", "pending"),
  on("t-a-leder"), on("t-a-taler"), on("t-b-leder"), on("t-b-kaffe", "pending"),
  on("t-b-nei", "declined"), on("t-b-strøket"), on("t-avlyst"), on("t-a-leder", "confirmed", "p2"),
];
const overview = (personId = "p1") => personTaskOverview(personId, { assignments, tasks, gatherings, roles }, now);

describe("Oppgavene til én person", () => {
  test("telles per rolle: det som kommer, og det som er holdt de siste tre månedene", () => {
    expect(overview().byRole).toEqual([
      { role: "Møteleder", coming: 2, held: 1 },
      { role: "Taler", coming: 1, held: 0 },
    ]);
    expect(overview()).toMatchObject({ comingCount: 3, heldCount: 1, askedCount: 1 });
  });

  test("bare et ja teller: den som er spurt, står i listen og ikke i tallene, og et nei er ingenting", () => {
    const { coming, byRole } = overview();
    expect(coming.map((row) => [row.role, row.gatheringId, row.response])).toEqual([
      ["Møteleder", "a", "confirmed"],
      ["Taler", "a", "confirmed"],
      ["Kirkekaffe", "b", "pending"],
      ["Møteleder", "b", "confirmed"],
    ]);
    expect(byRole.some((line) => line.role === "Kirkekaffe")).toBe(false);
  });

  test("avlyste arrangementer, strøkne oppgaver og det som er eldre enn tre måneder, er ikke med", () => {
    const { held, coming } = overview();
    expect(held.map((row) => row.taskId)).toEqual(["t-holdt"]);
    expect([...held, ...coming].map((row) => row.taskId)).not.toEqual(expect.arrayContaining(["t-gammel", "t-avlyst", "t-b-strøket", "t-holdt-spurt"]));
  });

  test("en oppgave uten rolle står med sin egen tittel, og en annen persons oppgaver er ikke med", () => {
    expect(overview().coming.find((row) => row.taskId === "t-b-kaffe")?.role).toBe("Kirkekaffe");
    expect(overview("p2")).toMatchObject({ comingCount: 1, heldCount: 0, askedCount: 0 });
    expect(overview("ingen")).toMatchObject({ coming: [], held: [], byRole: [] });
  });
});
