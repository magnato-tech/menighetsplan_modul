import { describe } from "vitest";
import { assert } from "./assert";
import { buildRunSheet, maySeeRunSheet, sharedRunSheet, type RunSheetTask } from "../src/utils/runSheet";
import type { Assignment, Group, ProgramItem } from "../src/types";
import { RESPONSE_LABELS } from "../src/utils/staffing";

describe("Kjøreplan for alle", () => {
  const person = (personId: string, name: string, response: Assignment["response"]) => ({
    assignment: { id: `a-${personId}`, taskId: "t", personId, personName: name, response },
    statusLabel: RESPONSE_LABELS[response],
    response,
  });
  const task = (id: string, people: ReturnType<typeof person>[], instruction = "Møt opp kl. 10:00."): RunSheetTask => ({
    task: { id, gatheringId: "g", groupId: "group-lyd", title: `Rolle ${id}`, status: "open", neededCount: 3, instruction },
    taskGroup: { id: "group-lyd", name: "Lyd og bilde", memberIds: [], leaderIds: [] },
    isMyGroup: false,
    neededCount: 3,
    assignedPersons: people,
    confirmedPersonsCount: people.filter((p) => p.response === "confirmed").length,
    isFullyCovered: false,
    hasWithdrawn: people.some((p) => p.response === "withdrawn"),
  });

  const program: ProgramItem[] = [
    { time: "11:00", title: "Velkommen" },
    { time: "11:05", title: "Lovsang", taskId: "lovsang" },
    { time: "12:35", title: "Kirkekaffe", taskId: "kaffe" },
  ];
  const tasks = [
    task("lovsang", [person("thomas", "Thomas Viken", "confirmed")]),
    task("kaffe", [
      person("ingrid", "Ingrid Berg", "declined"),
      person("jonas", "Jonas Lie", "pending"),
      person("kari", "Kari Nordmann", "withdrawn"),
      person("ola", "Ola Hansen", "confirmed"),
    ]),
  ];
  const rows = (personId: string) => sharedRunSheet(buildRunSheet(program, tasks), personId);

  // 1. Only those who have accepted are named
  const [welcome, worship, coffee] = rows("noen-andre");
  assert(welcome.names.length === 0 && !welcome.isMine, "Et programpunkt uten oppgave har ingen ansvarlig");
  assert(worship.names.join() === "Thomas Viken", "Den som har akseptert, vises");
  assert(coffee.names.join() === "Ola Hansen", "Forespurt, forfall og avslått vises ikke");
  assert(!coffee.isMine && coffee.instruction === undefined, "Instruksen gis ikke på andres oppgaver");

  // 2. The reader's own task is marked and has its instruction, also when only asked
  const asJonas = rows("jonas")[2];
  assert(asJonas.isMine && asJonas.instruction === "Møt opp kl. 10:00.", "Den som er forespurt, ser oppgaven som sin, med instruks");
  assert(asJonas.names.join() === "Ola Hansen", "Navnet til den som bare er forespurt, vises fortsatt ikke for andre");
  assert(rows("thomas")[1].isMine, "Den som har akseptert, ser oppgaven som sin");
  assert(!rows("kari")[2].isMine && !rows("ingrid")[2].isMine, "Forfall og avslått er ikke lenger ens egen oppgave");

  // 3. Who may see it
  const group: Group = { id: "group-lyd", name: "Lyd og bilde", memberIds: ["hakon"], leaderIds: ["ola"] };
  const open = { visibility: "offentlig" as const, isPublic: true };
  const internal = { visibility: "intern" as const, isPublic: false };
  const may = (gathering: typeof open | typeof internal, personId: string, extra: { mayPlan?: boolean; standsOnTask?: boolean } = {}) =>
    maySeeRunSheet({ gathering, gatheringGroup: group, personId, mayPlan: false, standsOnTask: false, ...extra });
  assert(may(open, "hvem-som-helst"), "Et arrangement for menigheten vises for alle");
  assert(may(internal, "hakon") && may(internal, "ola"), "Et gruppearrangement vises for gruppens medlemmer og leder");
  assert(!may(internal, "utenforstaaende"), "Et gruppearrangement vises ikke for andre");
  assert(may(internal, "utenforstaaende", { standsOnTask: true }), "Den som står på en oppgave, ser det");
  assert(may(internal, "admin", { mayPlan: true }), "Den som kan planlegge det, ser det");
});
