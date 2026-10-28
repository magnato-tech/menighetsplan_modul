import { describe, expect, test } from "vitest";
import { speakerNamesOf } from "../src/utils/gatherings";
import type { Assignment, Person, Task, VolunteerRole } from "../src/types";

// Who speaks at a gathering: those who have said yes to the task «Taler» (the volunteer role, or a task with
// that name). Shown on the card in the admin calendar.

const roles: Pick<VolunteerRole, "id" | "name">[] = [
  { id: "r-taler", name: "Taler" },
  { id: "r-lovsang", name: "Lovsang" },
];
const persons: Pick<Person, "id" | "name">[] = [
  { id: "astri", name: "Astri Berg" },
  { id: "preben", name: "Preben Dahl" },
  { id: "kari", name: "Kari Nordmann" },
];
const task = (id: string, gatheringId: string, fields: Partial<Task> = {}): Pick<Task, "id" | "gatheringId" | "volunteerRoleId" | "title"> => ({
  id,
  gatheringId,
  title: id,
  ...fields,
});
const yes = (taskId: string, personId: string, fields: Partial<Assignment> = {}): Pick<Assignment, "taskId" | "personId" | "response" | "personName"> => ({
  taskId,
  personId,
  response: "confirmed",
  ...fields,
});

describe("Hvem som taler på et arrangement", () => {
  const tasks = [
    task("taler", "g1", { volunteerRoleId: "r-taler", title: "Taler" }),
    task("lovsang", "g1", { volunteerRoleId: "r-lovsang", title: "Lovsang" }),
    task("dagens", "g2", { title: "Dagens taler" }),
    task("tittel", "g3", { title: "taler" }),
  ];

  test("den som har sagt ja til Taler, står som taler", () => {
    const assignments = [yes("taler", "astri")];
    expect(speakerNamesOf("g1", tasks, assignments, roles, persons)).toEqual(["Astri Berg"]);
  });

  test("bare den som har sagt ja, står; den som er spurt eller har sagt nei, er ikke med", () => {
    const assignments = [
      yes("taler", "astri"),
      yes("taler", "preben", { response: "pending" }),
      yes("taler", "kari", { response: "declined" }),
    ];
    expect(speakerNamesOf("g1", tasks, assignments, roles, persons)).toEqual(["Astri Berg"]);
  });

  test("ingen har sagt ja, og så står ingen taler", () => {
    const assignments = [yes("taler", "preben", { response: "pending" })];
    expect(speakerNamesOf("g1", tasks, assignments, roles, persons)).toEqual([]);
    expect(speakerNamesOf("g1", tasks, [], roles, persons)).toEqual([]);
  });

  test("en oppgave med navnet «Dagens taler» eller «Taler» uten rolle teller også", () => {
    expect(speakerNamesOf("g2", tasks, [yes("dagens", "kari")], roles, persons)).toEqual(["Kari Nordmann"]);
    expect(speakerNamesOf("g3", tasks, [yes("tittel", "kari")], roles, persons)).toEqual(["Kari Nordmann"]);
  });

  test("andre oppgaver, som Lovsang, gir ingen taler", () => {
    expect(speakerNamesOf("g1", tasks, [yes("lovsang", "astri")], roles, persons)).toEqual([]);
  });

  test("en oppgave hos et annet arrangement gir ingen taler her", () => {
    expect(speakerNamesOf("g2", tasks, [yes("taler", "astri")], roles, persons)).toEqual([]);
  });

  test("flere talere står i den rekkefølgen de er satt, uten dobbelt navn", () => {
    const more = [task("taler-2", "g1", { volunteerRoleId: "r-taler" })];
    const assignments = [yes("taler", "preben"), yes("taler-2", "astri"), yes("taler", "preben")];
    expect(speakerNamesOf("g1", [...tasks, ...more], assignments, roles, persons)).toEqual(["Preben Dahl", "Astri Berg"]);
  });

  test("står personen ikke i registeret lenger, brukes navnet som ble skrevet på tildelingen", () => {
    expect(speakerNamesOf("g1", tasks, [yes("taler", "borte", { personName: "Ola Gammel" })], roles, persons)).toEqual(["Ola Gammel"]);
  });
});
