import { describe, expect, test } from "vitest";
import type { Assignment, Gathering, Group, Task } from "../src/types";
import {
  answerInRound,
  canTakeMore,
  overlappingPlan,
  cardsFor,
  formatDay,
  formatDayLong,
  myPlanTasks,
  nextCardIndex,
  planFormProblems,
  planGatherings,
  planPersonIds,
  planStatus,
  planSummary,
  semesterAnswerId,
  semesterPlanPath,
  taskLabel,
  waitsForAnswer,
  type SemesterPlan,
} from "../src/utils/semesterPlan";

// The semester plan: which events a plan holds, who gets the flag, and the cards one person goes
// through, with the tasks of all their teams on the same card.

const plan: SemesterPlan = {
  id: "plan-1",
  name: "Våren",
  firstDay: "2027-01-01",
  lastDay: "2027-06-01",
  answerBy: "2026-12-01",
  opensAt: "2026-10-27T17:00:00.000Z",
  createdAt: "2026-10-20T10:00:00.000Z",
};

const gathering = (id: string, startsAt: string, extra: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "group-menighet",
  title: id,
  startsAt,
  visibility: "offentlig",
  ...extra,
});

const task = (id: string, gatheringId: string, groupId: string | undefined, extra: Partial<Task> = {}): Task => ({
  id,
  gatheringId,
  ...(groupId ? { groupId } : {}),
  title: id,
  status: "open",
  neededCount: 1,
  ...extra,
});

const groups: Group[] = [
  { id: "lyd", name: "Lyd", memberIds: ["anne", "bjorn"], leaderIds: ["leder"] },
  { id: "kjokken", name: "Kjøkken", memberIds: ["anne", "carl"], leaderIds: [] },
  { id: "bonn", name: "Bønn", memberIds: ["dina"], leaderIds: [] },
];

const gatherings: Gathering[] = [
  gathering("g-mars", "2027-03-07T10:00:00.000Z"),
  gathering("g-jan", "2027-01-10T10:00:00.000Z"),
  gathering("g-for", "2026-12-20T10:00:00.000Z"),
  gathering("g-etter", "2027-06-13T10:00:00.000Z"),
  gathering("g-avlyst", "2027-02-07T10:00:00.000Z", { cancelled: true }),
  gathering("g-uten-team", "2027-02-14T10:00:00.000Z"),
  gathering("g-kjokken", "2027-01-31T10:00:00.000Z"),
];

const tasks: Task[] = [
  task("t-jan-lyd", "g-jan", "lyd"),
  task("t-jan-kjokken", "g-jan", "kjokken", { neededCount: 2 }),
  task("t-mars-lyd", "g-mars", "lyd"),
  task("t-for-lyd", "g-for", "lyd"),
  task("t-etter-lyd", "g-etter", "lyd"),
  task("t-avlyst-lyd", "g-avlyst", "lyd"),
  task("t-taler", "g-uten-team", undefined),
  task("t-kjokken", "g-kjokken", "kjokken"),
  task("t-kjokken-avlyst", "g-mars", "kjokken", { status: "cancelled" }),
];

const assignments: Assignment[] = [{ id: "a1", taskId: "t-mars-lyd", personId: "bjorn", response: "confirmed" }];

const data = { gatherings, tasks, groups, assignments };

describe("Arrangementene i planen", () => {
  test("er de mellom første og siste dag med oppgaver for et team, og ikke avlyste, i rekkefølge", () => {
    expect(planGatherings(plan, gatherings, tasks).map((g) => g.id)).toEqual(["g-jan", "g-kjokken", "g-mars"]);
  });

  test("en periode som er snudd, gir ingen", () => {
    expect(planGatherings({ firstDay: "2027-06-01", lastDay: "2027-01-01" }, gatherings, tasks)).toEqual([]);
  });

  test("flagget går til alle i teamene, med ledere, og telles én gang per person", () => {
    expect(planPersonIds(plan, gatherings, tasks, groups).sort()).toEqual(["anne", "bjorn", "carl", "leder"]);
    expect(planSummary(plan, gatherings, tasks, groups)).toEqual({ gatheringCount: 3, personCount: 4 });
  });
});

describe("Kortene for én person", () => {
  test("én i to team får oppgavene fra begge på samme kort", () => {
    const cards = cardsFor(plan, "anne", data);
    expect(cards.map((card) => card.gathering.id)).toEqual(["g-jan", "g-kjokken", "g-mars"]);
    expect(cards[0].tasks.map((item) => item.task.id)).toEqual(["t-jan-kjokken", "t-jan-lyd"]);
    expect(cards[0].tasks.find((item) => item.task.id === "t-jan-kjokken")?.free).toBe(2);
  });

  test("én i ett team får bare det teamets arrangementer", () => {
    expect(cardsFor(plan, "carl", data).map((card) => card.gathering.id)).toEqual(["g-jan", "g-kjokken"]);
    expect(cardsFor(plan, "carl", data)[0].tasks.map((item) => item.task.id)).toEqual(["t-jan-kjokken"]);
  });

  test("én uten team med oppgaver i perioden får ingen kort", () => {
    expect(cardsFor(plan, "dina", data)).toEqual([]);
    expect(cardsFor(plan, "ukjent", data)).toEqual([]);
  });

  test("en oppgave man står på, er merket, og en full oppgave kan ikke tas", () => {
    const mars = cardsFor(plan, "bjorn", data).find((card) => card.gathering.id === "g-mars")!;
    expect(mars.tasks[0].holdsPlace).toBe(true);
    expect(canTakeMore(mars)).toBe(false);
    const forAnne = cardsFor(plan, "anne", data).find((card) => card.gathering.id === "g-mars")!;
    expect(forAnne.tasks[0].free).toBe(0);
    expect(canTakeMore(forAnne)).toBe(false);
  });

  test("et forfall gir ikke plass, og plassen er ledig igjen", () => {
    const withdrawn = [{ ...assignments[0], response: "withdrawn" as const }];
    const mars = cardsFor(plan, "bjorn", { ...data, assignments: withdrawn }).find((card) => card.gathering.id === "g-mars")!;
    expect(mars.tasks[0].holdsPlace).toBe(false);
    expect(mars.tasks[0].mine?.id).toBe("a1");
    expect(canTakeMore(mars)).toBe(true);
  });

  test("oppgaven heter det rollen heter", () => {
    expect(taskLabel({ title: "Video- og lydoverføring", volunteerRoleId: "r1" }, [{ id: "r1", name: "Bilde" }])).toBe("Bilde");
    expect(taskLabel({ title: "Kirkekaffe" }, [])).toBe("Kirkekaffe");
  });

  test("man starter på første kort man ikke har gått forbi, og etter siste er man ved slutten", () => {
    const cards = cardsFor(plan, "anne", data);
    expect(nextCardIndex(cards, null)).toBe(0);
    expect(nextCardIndex(cards, { passed: ["g-jan"] })).toBe(1);
    expect(nextCardIndex(cards, { passed: ["g-jan", "g-mars"] })).toBe(1);
    expect(nextCardIndex(cards, { passed: ["g-jan", "g-kjokken", "g-mars"] })).toBe(3);
  });

  test("oppgavene man står på, listes i kortenes rekkefølge", () => {
    const cards = cardsFor(plan, "bjorn", data);
    expect(myPlanTasks(cards).map(({ item }) => item.task.id)).toEqual(["t-mars-lyd"]);
  });
});

describe("Når planen vises", () => {
  test("ikke før den åpner, og ikke etter svarfristen", () => {
    expect(planStatus(plan, new Date("2026-10-27T16:59:00.000Z"))).toBe("planlagt");
    expect(planStatus(plan, new Date("2026-10-27T17:00:00.000Z"))).toBe("apen");
    expect(planStatus(plan, new Date("2026-12-01T09:00:00.000Z"))).toBe("apen");
    expect(planStatus(plan, new Date("2026-12-03T09:00:00.000Z"))).toBe("lukket");
  });

  test("åpnet på nytt er den en ny runde: man starter fra første kort, og det man ikke kan, huskes", () => {
    const old = { id: "x", planId: plan.id, personId: "anne", passed: ["g-jan"], declined: ["g-mars"], finishedAt: "2026-11-01T10:00:00.000Z", round: plan.opensAt };
    expect(answerInRound(plan, old)).toBe(old);
    const reopened = { ...plan, opensAt: "2027-01-05T08:00:00.000Z", answerBy: "2027-01-20" };
    const now = answerInRound(reopened, old)!;
    expect(now.passed).toEqual([]);
    expect(now.declined).toEqual(["g-mars"]);
    expect(now.finishedAt).toBeUndefined();
    expect(waitsForAnswer(reopened, cardsFor(reopened, "anne", data), old, new Date("2027-01-06T10:00:00.000Z"))).toBe(true);
    expect(answerInRound(plan, null)).toBeNull();
  });

  test("flagget står til man er ferdig", () => {
    const cards = cardsFor(plan, "anne", data);
    const now = new Date("2026-11-01T10:00:00.000Z");
    const answer = { id: "x", planId: plan.id, personId: "anne", passed: [], declined: [], round: plan.opensAt };
    expect(waitsForAnswer(plan, cards, null, now)).toBe(true);
    expect(waitsForAnswer(plan, cards, answer, now)).toBe(true);
    expect(waitsForAnswer(plan, cards, { ...answer, finishedAt: "2026-11-01T10:00:00.000Z" }, now)).toBe(false);
    expect(waitsForAnswer(plan, cards, { ...answer, finishedAt: "2026-11-01T10:00:00.000Z", round: "før" }, now)).toBe(true);
    expect(waitsForAnswer(plan, [], null, now)).toBe(false);
    expect(waitsForAnswer(plan, cards, null, new Date("2026-10-01T10:00:00.000Z"))).toBe(false);
  });

  test("svaret har én id per plan og person, og lenken går til Min side", () => {
    expect(semesterAnswerId("plan-1", "anne")).toBe("semester-answer-plan-1-anne");
    expect(semesterPlanPath("plan-1")).toBe("/minside/semesterplan/plan-1");
  });
});

describe("Skjemaet i admin", () => {
  const form = { name: "Våren 2027", firstDay: "2027-01-01", lastDay: "2027-06-01", answerBy: "2026-12-01", opensDate: "2026-10-27", opensTime: "18:00" };

  test("et utfylt skjema kan lagres", () => {
    expect(planFormProblems(form)).toEqual([]);
  });

  test("planer kan ligge side om side, men ikke overlappe", () => {
    const spring = { name: "Våren 2027", firstDay: "2027-01-01", lastDay: "2027-06-30" };
    expect(overlappingPlan({ firstDay: "2027-07-01", lastDay: "2027-12-31" }, [spring])).toBeUndefined();
    expect(overlappingPlan({ firstDay: "2027-06-30", lastDay: "2027-12-31" }, [spring])).toBe(spring);
    expect(overlappingPlan({ firstDay: "2026-08-01", lastDay: "2027-12-31" }, [spring])).toBe(spring);
    expect(planFormProblems({ ...form, firstDay: "2027-05-01", lastDay: "2027-12-31" }, [spring])).toEqual([
      "Dagene går inn i Våren 2027 (01.01.2027–30.06.2027). Semesterplaner kan ikke overlappe.",
    ]);
  });

  test("sier fra om navn, snudd periode, svarfrist og åpning", () => {
    expect(planFormProblems({ ...form, name: " " })).toEqual(["Gi planen et navn."]);
    expect(planFormProblems({ ...form, firstDay: "2027-07-01" })).toEqual(["Første dag må komme før siste dag."]);
    expect(planFormProblems({ ...form, answerBy: "" })).toEqual(["Velg svarfrist."]);
    expect(planFormProblems({ ...form, opensTime: "" })).toEqual(["Velg når planen åpner."]);
    expect(planFormProblems({ ...form, answerBy: "2026-10-01" })).toEqual(["Svarfristen må komme etter at planen åpner."]);
  });

  test("datoene skrives som på norsk", () => {
    expect(formatDay("2027-01-10")).toBe("10.01.2027");
    expect(formatDayLong("2026-12-01")).toBe("1. desember");
  });
});
