import { describe } from "vitest";
import { assert } from "./assert";
import { applyAssignmentChange, currentAssignments } from "../src/utils/staffing";
import type { Assignment } from "../src/types";

type Row = {
  id: string;
  taskId: string;
  personId: string;
  response: "pending" | "confirmed" | "declined" | "withdrawn";
  assignedAt?: string;
  respondedAt?: string;
};

const row = (id: string, taskId: string, personId: string, extra: Partial<Row> = {}): Row => ({
  id,
  taskId,
  personId,
  response: "confirmed",
  assignedAt: "2026-11-01T10:00:00.000Z",
  ...extra,
});
const ids = (list: Row[]) => list.map((item) => item.id);

describe("Gjeldende tildelinger", () => {
  // A person has one status per task. Taking the task again stores a new copy, so the old one must not count.
  const confirmed = row("assign-b", "task-1", "person-1", { assignedAt: "2026-11-05T10:00:00.000Z" });
  const withdrawn = row("assign-a", "task-1", "person-1", {
    response: "withdrawn",
    assignedAt: "2026-11-01T10:00:00.000Z",
    respondedAt: "2026-11-03T09:00:00.000Z",
  });

  assert(ids(currentAssignments([withdrawn, confirmed])).join() === "assign-b", "Trukket og så bekreftet igjen: bare den bekreftede teller");
  assert(ids(currentAssignments([confirmed, withdrawn])).join() === "assign-b", "Rekkefølgen i listen endrer ikke hvem som er nyest");

  const cycles = [
    row("c1", "task-1", "person-1", { assignedAt: "2026-11-01T10:00:00.000Z", respondedAt: "2026-11-02T10:00:00.000Z", response: "withdrawn" }),
    row("c2", "task-1", "person-1", { assignedAt: "2026-11-03T10:00:00.000Z", respondedAt: "2026-11-04T10:00:00.000Z", response: "withdrawn" }),
    row("c3", "task-1", "person-1", { assignedAt: "2026-11-05T10:00:00.000Z", response: "confirmed" }),
  ];
  assert(ids(currentAssignments(cycles)).join() === "c3", "Tre ganger trukket og tatt igjen: én tildeling står igjen");

  const others = [
    row("p1", "task-1", "person-1"),
    row("p2", "task-1", "person-2", { assignedAt: "2026-11-02T10:00:00.000Z" }),
  ];
  assert(ids(currentAssignments(others)).join() === "p1,p2", "To ulike personer på samme oppgave står begge");

  const twoTasks = [row("t1", "task-1", "person-1"), row("t2", "task-2", "person-1")];
  assert(ids(currentAssignments(twoTasks)).join() === "t1,t2", "Samme person på to oppgaver står på begge");

  const tieLow = row("a-1", "task-1", "person-1", { assignedAt: "2026-11-01T10:00:00.000Z" });
  const tieHigh = row("a-2", "task-1", "person-1", { assignedAt: "2026-11-01T10:00:00.000Z" });
  assert(ids(currentAssignments([tieLow, tieHigh])).join() === "a-2", "Likt tidspunkt: den med største id vinner");
  assert(ids(currentAssignments([tieHigh, tieLow])).join() === "a-2", "Likt tidspunkt gir samme svar uansett rekkefølge");

  const answered = row("r-1", "task-1", "person-1", { assignedAt: "2026-11-01T10:00:00.000Z", respondedAt: "2026-11-20T10:00:00.000Z", response: "confirmed" });
  const assignedLater = row("r-2", "task-1", "person-1", { assignedAt: "2026-11-10T10:00:00.000Z" });
  assert(ids(currentAssignments([assignedLater, answered])).join() === "r-1", "Den nyeste datoen av svar og tildeling avgjør");

  const undated = row("u-1", "task-1", "person-1", { assignedAt: undefined });
  const dated = row("u-2", "task-1", "person-1", { assignedAt: "2026-01-01T00:00:00.000Z" });
  assert(ids(currentAssignments([undated, dated])).join() === "u-2", "En tildeling uten dato teller som den eldste");

  const order = [
    row("o-3", "task-2", "person-1"),
    row("o-1", "task-1", "person-1", { assignedAt: "2026-11-01T10:00:00.000Z" }),
    row("o-2", "task-1", "person-2"),
    row("o-4", "task-1", "person-1", { assignedAt: "2026-11-09T10:00:00.000Z" }),
  ];
  assert(ids(currentAssignments(order)).join() === "o-3,o-2,o-4", "Rekkefølgen beholdes for dem som står igjen");

  assert(currentAssignments([]).length === 0, "Ingen tildelinger gir en tom liste");
});

describe("Å fjerne en person fra en oppgave", () => {
  const row = (id: string, response: Assignment["response"]): Assignment => ({ id, taskId: "t", personId: "p", response, assignedAt: "2026-11-01T10:00:00.000Z" });
  const after = applyAssignmentChange([row("gammel", "withdrawn"), row("ny", "confirmed"), { ...row("annen", "confirmed"), personId: "q" }], { remove: ["gammel", "ny"] });
  assert(after.map((a) => a.id).join() === "annen", "Alle kopiene av personen fjernes, og de andre blir stående");
  assert(applyAssignmentChange([row("en", "confirmed")], { remove: "en" }).length === 0, "Én tildeling kan fortsatt fjernes alene");
});
