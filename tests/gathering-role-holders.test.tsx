// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GatheringRoleHolders } from "../src/components/gathering/GatheringRoleHolders";
import { roleHolderNamesOf, speakerNamesOf } from "../src/utils/gatherings";
import type { Assignment, Person, Task, VolunteerRole } from "../src/types";

// Who leads and who speaks at a gathering: the people who have said yes to the tasks with those roles.

const roles: Pick<VolunteerRole, "id" | "name">[] = [
  { id: "r-leder", name: "Møteleder" },
  { id: "r-taler", name: "Taler" },
  { id: "r-lovsang", name: "Lovsang" },
];
const persons: Pick<Person, "id" | "name">[] = [
  { id: "astri", name: "Astri Berg" },
  { id: "preben", name: "Preben Dahl" },
];
const task = (id: string, gatheringId: string, fields: Partial<Task> = {}): Pick<Task, "id" | "gatheringId" | "volunteerRoleId" | "title"> => ({
  id,
  gatheringId,
  title: id,
  ...fields,
});
const answer = (taskId: string, personId: string, response: Assignment["response"] = "confirmed"): Pick<Assignment, "taskId" | "personId" | "response" | "personName"> => ({
  taskId,
  personId,
  response,
  personName: "",
});

const tasks = [
  task("leder", "g1", { volunteerRoleId: "r-leder", title: "Møteleder" }),
  task("taler", "g1", { volunteerRoleId: "r-taler", title: "Taler" }),
  task("lovsang", "g1", { volunteerRoleId: "r-lovsang", title: "Lovsang" }),
  task("gudstjenesteleder", "g2", { title: "Gudstjenesteleder" }),
  task("leder-annen", "g3", { volunteerRoleId: "r-leder" }),
];

afterEach(() => cleanup());

describe("Hvem som leder og taler på et arrangement", () => {
  test("Møteleder er den som har sagt ja til rollen Møteleder, også under navnet Gudstjenesteleder", () => {
    expect(roleHolderNamesOf("g1", ["Møteleder", "Gudstjenesteleder", "Leder"], tasks, [answer("leder", "astri")], roles, persons)).toEqual(["Astri Berg"]);
    expect(roleHolderNamesOf("g2", ["Møteleder", "Gudstjenesteleder", "Leder"], tasks, [answer("gudstjenesteleder", "preben")], roles, persons)).toEqual(["Preben Dahl"]);
  });

  test("bare den som har sagt ja, står; den som er spurt, er ikke med", () => {
    const assignments = [answer("leder", "astri"), answer("leder", "preben", "pending")];
    expect(roleHolderNamesOf("g1", ["Møteleder"], tasks, assignments, roles, persons)).toEqual(["Astri Berg"]);
  });

  test("ingen som har sagt ja gir en tom liste, og en oppgave uten rolle-navn på gjelder ikke", () => {
    expect(roleHolderNamesOf("g1", ["Møteleder"], tasks, [], roles, persons)).toEqual([]);
    expect(roleHolderNamesOf("g1", ["Møteleder"], tasks, [answer("lovsang", "astri")], roles, persons)).toEqual([]);
  });

  test("en oppgave hos et annet arrangement gir ingen i denne listen", () => {
    expect(roleHolderNamesOf("g2", ["Møteleder"], tasks, [answer("leder-annen", "astri")], roles, persons)).toEqual([]);
  });

  test("taler gir det samme som speakerNamesOf", () => {
    const assignments = [answer("taler", "astri")];
    expect(roleHolderNamesOf("g1", ["Taler", "Dagens taler"], tasks, assignments, roles, persons)).toEqual(speakerNamesOf("g1", tasks, assignments, roles, persons));
    expect(speakerNamesOf("g1", tasks, assignments, roles, persons)).toEqual(["Astri Berg"]);
  });

  test("ukjent person gir navnet som står på tildelingen", () => {
    const assignments = [{ ...answer("leder", "borte"), personName: "Ola Gammel" }];
    expect(roleHolderNamesOf("g1", ["Møteleder"], tasks, assignments, roles, persons)).toEqual(["Ola Gammel"]);
  });
});

describe("Linja med Møteleder og Taler i toppen", () => {
  test("viser navnene til dem som har sagt ja", () => {
    render(
      <GatheringRoleHolders
        gatheringId="g1"
        tasks={tasks}
        assignments={[answer("leder", "astri"), answer("taler", "preben")]}
        roles={roles}
        persons={persons}
      />
    );
    expect(screen.getByText("Møteleder:", { exact: false })).toBeTruthy();
    expect(screen.getByText("Astri Berg")).toBeTruthy();
    expect(screen.getByText("Preben Dahl")).toBeTruthy();
    expect(screen.queryByText("ledig")).toBeNull();
  });

  test("har arrangementet oppgaven, men ingen har sagt ja: «ledig» med varselikon", () => {
    const { container } = render(<GatheringRoleHolders gatheringId="g1" tasks={tasks} assignments={[answer("leder", "preben", "pending"), answer("taler", "preben")]} roles={roles} persons={persons} />);
    expect(screen.getByText("ledig")).toBeTruthy();
    expect(container.querySelector("svg.text-red-700")).not.toBeNull();
    expect(screen.getByText("Taler:", { exact: false })).toBeTruthy();
  });

  test("har arrangementet ingen slik oppgave, står linja ikke der", () => {
    const { container } = render(<GatheringRoleHolders gatheringId="g9" tasks={tasks} assignments={[]} roles={roles} persons={persons} />);
    expect(container.textContent).toBe("");
  });
});
