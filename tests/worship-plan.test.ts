import { describe } from "vitest";
import { assert } from "./assert";
import { upcomingWorshipServices, worshipPlanRows } from "../src/utils/worshipPlan";
import type { Assignment, Gathering, Task, VolunteerRole } from "../src/types";

const NOW = new Date("2026-11-08T12:00:00Z").getTime();
const gathering = (id: string, startsAt: string, extra: Partial<Gathering> = {}): Gathering => ({
  id,
  groupId: "g-gudstjeneste",
  title: "Gudstjeneste",
  startsAt,
  visibility: "offentlig",
  isGudstjeneste: true,
  ...extra,
});

describe("Gudstjenestene framover", () => {
  const list = [
    gathering("sent", "2026-11-22T11:00:00Z"),
    gathering("neste", "2026-11-15T11:00:00Z"),
    gathering("avlyst", "2026-11-12T11:00:00Z", { cancelled: true }),
    gathering("fortid", "2026-11-01T11:00:00Z"),
    gathering("intern", "2026-11-13T11:00:00Z", { visibility: "intern" }),
    gathering("ikke-gudstjeneste", "2026-11-14T11:00:00Z", { title: "Lagmøte", isGudstjeneste: false }),
    gathering("gruppe", "2026-11-16T11:00:00Z", { type: "gruppesamling" }),
    gathering("tredje", "2026-11-29T11:00:00Z"),
  ];
  const ids = (items: Gathering[]) => items.map((g) => g.id);

  assert(JSON.stringify(ids(upcomingWorshipServices(list, NOW, 6))) === JSON.stringify(["neste", "sent", "tredje"]), "Bare åpne, ikke avlyste gudstjenester framover, nærmest først");
  assert(JSON.stringify(ids(upcomingWorshipServices(list, NOW, 2))) === JSON.stringify(["neste", "sent"]), "Grensen gir de nærmeste");
  assert(upcomingWorshipServices(list, NOW, 0).length === 0, "Grense null gir ingen");
  assert(upcomingWorshipServices([gathering("i-gar", "2026-11-08T08:00:00Z")], NOW, 6).length === 0, "En gudstjeneste som er startet, er ikke framover");
  assert(upcomingWorshipServices([gathering("eldre-merke", "2026-11-20T11:00:00Z", { isGudstjeneste: undefined, title: "Gudstjeneste i kirken" })], NOW, 6).length === 1, "Eldre arrangement finnes på tittelen");
});

describe("Hvem som gjør hva på en gudstjeneste", () => {
  const service = gathering("gt", "2026-11-15T11:00:00Z", {
    programSchedule: [
      { time: "11:00", title: "Velkommen", taskId: "t-lyd" },
      { time: "11:10", title: "Preken", taskId: "t-taler" },
    ],
  });
  const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, gatheringId: "gt", title: `Tittel ${id}`, status: "assigned", neededCount: 1, ...extra });
  const roles: VolunteerRole[] = [{ id: "role-lyd", name: "Lyd", sortOrder: 1 }];
  const names: Record<string, string> = { kari: "Kari Nordmann", ola: "Ola Hansen" };
  const assignment = (id: string, taskId: string, personId: string, response: Assignment["response"], personName?: string): Assignment => ({
    id,
    taskId,
    personId,
    response,
    personName,
  });
  const input = (tasks: Task[], assignments: Assignment[], me = "ola") => ({
    gathering: service,
    tasks,
    assignments,
    volunteerRoles: roles,
    personName: (id: string) => names[id],
    me,
  });

  const rows = worshipPlanRows(
    input(
      [
        task("t-taler", { title: "Taler" }),
        task("t-lyd", { volunteerRoleId: "role-lyd", title: "Lyd og bilde" }),
        task("t-avlyst", { title: "Avlyst oppgave", status: "cancelled" }),
        task("t-ledig", { title: "Kaffe" }),
      ],
      [
        assignment("a1", "t-lyd", "kari", "confirmed"),
        assignment("a2", "t-lyd", "ola", "confirmed"),
        assignment("a3", "t-lyd", "per", "pending"),
        assignment("a4", "t-lyd", "lise", "declined"),
        assignment("a5", "t-taler", "ola", "pending"),
        assignment("a6", "t-avlyst", "kari", "confirmed"),
        assignment("a7", "t-taler", "ukjent", "confirmed"),
        assignment("a8", "t-taler", "x", "confirmed", "Navn fra tildelingen"),
      ]
    )
  );

  assert(rows.map((row) => row.taskId).join() === "t-lyd,t-taler,t-ledig", "Radene følger programmet, og en avlyst oppgave er borte");
  assert(rows[0].role === "Lyd" && rows[1].role === "Taler", "Rollen er navnet på rollen, ellers tittelen på oppgaven");
  assert(rows[0].people.map((p) => p.name).join() === "Kari Nordmann,Ola Hansen", "Bare dem som har sagt ja står med");
  assert(rows[0].isMine && !rows[1].isMine, "Egen rad er markert, og bare der man står som ja");
  assert(rows[0].people.find((p) => p.personId === "ola")?.isMe === true, "Den innloggede er merket i navnelisten");
  assert(rows[1].people.length === 1 && rows[1].people[0].name === "Navn fra tildelingen", "Navnet på tildelingen brukes når personen er ukjent i registeret");
  assert(rows.find((row) => row.taskId === "t-ledig")?.people.length === 0, "En rolle uten noen som har sagt ja, står tom");
  assert(!JSON.stringify(rows).includes("ukjent"), "En person uten kjent navn vises aldri med id");
});
