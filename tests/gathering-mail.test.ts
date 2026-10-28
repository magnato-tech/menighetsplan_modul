import { describe, expect, test } from "vitest";
import { mailPeopleOf, mailSubjectOf } from "../src/utils/gatheringMail";
import type { Assignment, Person } from "../src/types";

// E-mail to everyone on a gathering: who is asked (open assignments, each once) and what it is called.

const persons: Pick<Person, "id" | "name" | "email">[] = [
  { id: "astri", name: "Astri Berg", email: "Astri@Example.org" },
  { id: "preben", name: "Preben Dahl" },
  { id: "kari", name: "Kari Nordmann", email: "kari@example.org" },
  { id: "ola", name: "Ola Nordmann", email: "ola@example.org" },
];
const assignment = (taskId: string, personId: string, response: Assignment["response"], personName = ""): Pick<Assignment, "taskId" | "personId" | "response" | "personName"> => ({
  taskId,
  personId,
  response,
  personName,
});

describe("Hvem som får e-posten på et arrangement", () => {
  const taskIds = new Set(["t1", "t2"]);

  test("alle med en åpen tildeling, bekreftet eller spurt, én gang hver, sortert på navn", () => {
    const people = mailPeopleOf(taskIds, [assignment("t1", "kari", "confirmed"), assignment("t2", "kari", "pending"), assignment("t1", "astri", "pending"), assignment("t2", "preben", "confirmed")], persons);
    expect(people.map((person) => person.name)).toEqual(["Astri Berg", "Kari Nordmann", "Preben Dahl"]);
  });

  test("den som har sagt nei eller trukket seg, eller står på en annen samling, får ingen", () => {
    const people = mailPeopleOf(taskIds, [assignment("t1", "kari", "declined"), assignment("t1", "ola", "withdrawn"), assignment("annen", "astri", "confirmed")], persons);
    expect(people).toEqual([]);
  });

  test("uten brukbar adresse står personen med null, og får ingen e-post, men nevnes", () => {
    const people = mailPeopleOf(taskIds, [assignment("t1", "preben", "confirmed")], persons);
    expect(people).toEqual([{ id: "preben", name: "Preben Dahl", address: null }]);
    expect(mailPeopleOf(taskIds, [assignment("t1", "astri", "confirmed")], persons)[0].address).toBe("astri@example.org");
  });

  test("en som ikke står i registeret lenger, har navnet fra tildelingen", () => {
    const people = mailPeopleOf(taskIds, [assignment("t1", "borte", "confirmed", "Ole Gammel")], persons);
    expect(people).toEqual([{ id: "borte", name: "Ole Gammel", address: null }]);
  });
});

describe("Emnet og navnet på utsendingen", () => {
  test("emnet er tittelen og ukedagen med dato, på norsk", () => {
    expect(mailSubjectOf({ title: "Gudstjeneste", startsAt: "2026-11-08T10:00:00+01:00" })).toBe("Gudstjeneste søndag 8. november");
  });
});
