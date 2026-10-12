import { describe } from "vitest";
import { assert } from "./assert";
import { countUrgentTasks, stillToStaff, type StudioData } from "../src/pages/admin/studio";

type Item = StudioData["adminTasks"][number];

describe("Trenger oppfølging", () => {
  const now = new Date("2026-10-05T12:00:00.000Z").getTime();
  const hours = (h: number) => new Date(now + h * 60 * 60 * 1000).toISOString();
  const item = (id: string, startsAt: string | null, urgent: boolean): Item =>
    ({
      task: { id, gatheringId: "g", title: id, status: urgent ? "vacant" : "confirmed" },
      gathering: startsAt === null ? undefined : { id: "g", groupId: "x", title: "Samling", startsAt, visibility: "intern" },
      taskStaffing: { hasForfall: false, color: urgent ? "red" : "green" },
    }) as unknown as Item;

  const items = [
    item("om-to-dager", hours(48), true),
    item("pagaar-naa", hours(-2), true),
    item("forrige-uke", hours(-7 * 24), true),
    item("uten-samling", null, true),
    item("dekket", hours(24), false),
  ];

  assert(
    stillToStaff(items, now).map((i) => i.task.id).join(",") === "om-to-dager,pagaar-naa,uten-samling,dekket",
    "En oppgave på en samling som er over, trenger ikke oppfølging; en som pågår, gjør det"
  );
  assert(countUrgentTasks(items, now) === 3, "Bare kommende og pågående samlinger telles som ubesatt");

  const notNeeded = { ...item("trengs-ikke", hours(48), true), task: { id: "trengs-ikke", gatheringId: "g", title: "Kjøkken", status: "cancelled" } } as unknown as Item;
  assert(countUrgentTasks([...items, notNeeded], now) === 3, "En oppgave som ikke trengs på arrangementet, telles ikke som ubesatt");
});
