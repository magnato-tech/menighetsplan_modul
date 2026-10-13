// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DeletePersonDialog } from "../src/pages/admin/DeletePersonDialog";
import type { Assignment, Gathering, Group, Person, Task } from "../src/types";
import { personDeletion } from "../src/utils/personDeletion";

// Deleting a person from the register: what it means is said first. Everyone here is made up.

const now = new Date("2026-10-13T12:00:00.000Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const person = (id: string, more: Partial<Person> = {}): Person => ({ id, name: `Person ${id}`, globalRole: "member", ...more });
const persons = [person("admin", { globalRole: "admin" }), person("anne"), person("leder"), person("nest")];
const groups: Group[] = [
  { id: "lyd", name: "Lyd", memberIds: ["anne", "leder"], leaderIds: ["leder"], deputyLeaderIds: ["nest"] },
  { id: "hus", name: "Husgruppe 1", memberIds: ["anne"], leaderIds: [] },
  { id: "annen", name: "Kjøkken", memberIds: [], leaderIds: [] },
];
const event = (id: string, days: number): Gathering => ({ id, groupId: "kalender", title: id, startsAt: new Date(now + days * DAY).toISOString(), visibility: "offentlig" });
const gatherings = [event("holdt", -7), event("kommer", 5), event("senere", 12)];
const task = (id: string, gatheringId: string, more: Partial<Task> = {}): Task => ({ id, gatheringId, groupId: "lyd", title: id, status: "confirmed", neededCount: 1, ...more });
const tasks = [task("t-holdt", "holdt"), task("t-kommer", "kommer"), task("t-to", "kommer", { neededCount: 2 }), task("t-spurt", "senere", { status: "assigned" })];
const on = (taskId: string, personId: string, response: Assignment["response"] = "confirmed"): Assignment => ({ id: `${taskId}-${personId}`, taskId, personId, response });
const assignments = [on("t-holdt", "anne"), on("t-kommer", "anne"), on("t-to", "anne"), on("t-to", "leder"), on("t-spurt", "anne", "pending"), on("borte", "anne")];
const of = (id: string, administratorId = "admin") => personDeletion(persons.find((p) => p.id === id)!, { persons, groups, gatherings, tasks, assignments, administratorId }, now);

afterEach(cleanup);

describe("Hva det betyr å slette en person", () => {
  test("personen tas ut av gruppene og av oppgavene som kommer, som får statusen som følger", () => {
    const deletion = of("anne");
    expect(deletion.blockedBy).toEqual([]);
    expect(deletion.groups).toEqual([{ id: "lyd", name: "Lyd" }, { id: "hus", name: "Husgruppe 1" }]);
    // Also the one whose task is gone: a loose end goes with the person
    expect(deletion.comingAssignmentIds.sort()).toEqual(["borte-anne", "t-kommer-anne", "t-spurt-anne", "t-to-anne"]);
    expect(deletion.taskStatuses.sort((a, b) => a.taskId.localeCompare(b.taskId))).toEqual([
      { taskId: "t-kommer", status: "open" },
      { taskId: "t-spurt", status: "open" },
      { taskId: "t-to", status: "open" },
    ]);
  });

  test("det som er holdt, blir stående, og bare svar på det som kommer, slettes", () => {
    const deletion = of("anne");
    expect(deletion.heldTasks).toBe(1);
    expect(deletion.comingAssignmentIds).not.toContain("t-holdt-anne");
    expect(deletion.upcomingGatheringIds).toEqual(["kommer", "senere"]);
  });

  test("leder og nestleder kan ikke slettes før gruppen har en annen", () => {
    expect(of("leder").blockedBy).toEqual(["Personen er leder eller nestleder i «Lyd». Velg en annen på gruppens side først."]);
    expect(of("nest").blockedBy).toHaveLength(1);
  });

  test("ingen sletter seg selv, og den eneste administratoren kan ikke slettes", () => {
    expect(of("admin").blockedBy).toEqual(["Du kan ikke slette deg selv. En annen administrator må gjøre det."]);
    expect(of("admin", "anne").blockedBy).toEqual(["Dette er den eneste administratoren. Gi en annen person administratortilgang først."]);
    const two = [...persons, person("admin2", { globalRole: "admin" })];
    expect(personDeletion(two[0], { persons: two, groups, gatherings, tasks, assignments, administratorId: "admin2" }, now).blockedBy).toEqual([]);
  });
});

describe("Advarselen før en person slettes", () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  test("sier hva som skjer med tall for personen, og hva som blir stående", () => {
    render(<DeletePersonDialog personName="Anne Aktiv" hasEmail deletion={of("anne")} onConfirm={onConfirm} onClose={onClose} />);
    const warning = screen.getByRole("alertdialog", { name: "Slette Anne Aktiv fra registeret?" });
    expect(within(within(warning).getByRole("list", { name: "Dette skjer" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Navn, telefon, e-post, fødselsdato og resten av personkortet slettes.",
      "Personen tas ut av 2 grupper: Lyd, Husgruppe 1.",
      "Personen tas av 4 oppgaver som kommer. De blir ledige igjen.",
      "Personen kan ikke lenger logge inn.",
    ]);
    expect(warning.textContent).toContain("Det som er holdt, blir stående med navnet: 1 oppgave som er holdt, og meldinger personen har skrevet");
    expect(within(warning).getByText("Det kan ikke angres.")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(within(warning).getByRole("button", { name: "Avbryt" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(within(warning).getByRole("button", { name: "Slett kontakten" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("en leder får vite hva som må gjøres først, og har ingen sletteknapp", () => {
    render(<DeletePersonDialog personName="Lars Leder" hasEmail deletion={of("leder")} onConfirm={onConfirm} onClose={onClose} />);
    const warning = screen.getByRole("alertdialog", { name: "Lars Leder kan ikke slettes ennå" });
    expect(within(warning).getByText(/leder eller nestleder i «Lyd»/)).toBeTruthy();
    expect(within(warning).queryByRole("button", { name: "Slett kontakten" })).toBeNull();
  });
});
