import { describe, expect, test } from "vitest";
import { gatheringDeleteQuestion } from "../src/components/gathering/useGatheringDeletion";

const when = "søndag 8. november kl. 11:00";

describe("Spørsmålet før et arrangement slettes", () => {
  test("nevner programmet og oppgavene med antall, og at det ikke kan angres", () => {
    expect(gatheringDeleteQuestion({ title: "Gudstjeneste", when, programCount: 2, taskCount: 1, inSeries: false })).toBe(
      "Vil du slette «Gudstjeneste» (søndag 8. november kl. 11:00)?\nProgrammet (2 poster) og 1 oppgave slettes også. Dette kan ikke angres."
    );
  });

  test("bare oppgaver, med flertall", () => {
    expect(gatheringDeleteQuestion({ title: "Kaffe", when, programCount: 0, taskCount: 3, inSeries: false }).split("\n")[1]).toBe(
      "3 oppgaver slettes også. Dette kan ikke angres."
    );
  });

  test("bare programmet, med én post", () => {
    expect(gatheringDeleteQuestion({ title: "Kaffe", when, programCount: 1, taskCount: 0, inSeries: false }).split("\n")[1]).toBe(
      "Programmet (1 post) slettes også. Dette kan ikke angres."
    );
  });

  test("ingen program og ingen oppgaver: bare at det ikke kan angres", () => {
    expect(gatheringDeleteQuestion({ title: "Kaffe", when, programCount: 0, taskCount: 0, inSeries: false }).split("\n")[1]).toBe("Dette kan ikke angres.");
  });

  test("i en serie står det at bare dette arrangementet slettes", () => {
    const lines = gatheringDeleteQuestion({ title: "Kaffe", when, programCount: 0, taskCount: 1, inSeries: true }).split("\n");
    expect(lines[2]).toBe("Bare dette arrangementet slettes, ikke resten av serien.");
  });
});
