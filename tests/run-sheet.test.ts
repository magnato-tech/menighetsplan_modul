import { describe } from "vitest";
import { assert } from "./assert";
import { buildRunSheet, meetingTimeOf, reorderProgramSchedule, type RunSheetTask } from "../src/utils/runSheet";
import type { ProgramItem, Task } from "../src/types";

describe("Kjøreplan", () => {
  const detail = (id: string, extra: Partial<Task> = {}, covered = true): RunSheetTask => ({
    task: { id, gatheringId: "g", groupId: "group-lyd", title: `Oppgave ${id}`, status: covered ? "confirmed" : "open", neededCount: 1, ...extra },
    taskGroup: { id: "group-lyd", name: "Lyd og bilde", memberIds: [], leaderIds: [] },
    isMyGroup: true,
    neededCount: 1,
    assignedPersons: covered
      ? [
          {
            assignment: { id: `a-${id}`, taskId: id, personId: "p1", response: "confirmed" },
            person: { id: "p1", name: "Kari Nordmann", globalRole: "member" },
            statusLabel: "Bekreftet",
            response: "confirmed",
          },
        ]
      : [],
    confirmedPersonsCount: covered ? 1 : 0,
    isFullyCovered: covered,
    hasWithdrawn: false,
  });
  const summary = (rows: ReturnType<typeof buildRunSheet>) => rows.map((r) => `${r.time || "–"} ${r.title}`).join(" | ");

  // 1. The meeting time is read from an instruction that opens with it, and from nothing else
  const meets = (instruction?: string) => meetingTimeOf({ instruction });
  assert(meets("Møt opp kl. 09:30 for rigging og lydsjekk.") === "09:30", "«Møt opp kl. 09:30» gir 09:30");
  assert(meets("Møt kl. 10:15. Trakte 3 kanner kaffe.") === "10:15", "«Møt kl. 10:15» gir 10:15");
  assert(meets("Oppmøte 11:30 på kjøkkenet.") === "11:30", "«Oppmøte 11:30» gir 11:30");
  assert(meets("oppmøte kl 9.05") === "09:05", "Punktum og ett siffer i timen tåles");
  assert(meets("Rydd salen. Ferdig til 13:00.") === undefined, "Et klokkeslett lenger ut i teksten er ikke et oppmøtetidspunkt");
  assert(meets(undefined) === undefined && meets("") === undefined, "Uten instruks er det ingen oppmøtetid");

  // 2. A programme with tasks linked to its items
  const program: ProgramItem[] = [
    { time: "11:00", title: "Velkommen" },
    { time: "11:05", title: "Lovsang", description: "Tre sanger", taskId: "lyd" },
    { time: "12:30", title: "Kirkekaffe", taskId: "slettet-oppgave" },
  ];
  const sound = detail("lyd", { title: "Lydtekniker", instruction: "Møt opp kl. 09:30 for rigging." });
  const withProgram = buildRunSheet(program, [sound]);
  assert(summary(withProgram) === "11:00 Velkommen | 11:05 Lovsang | 12:30 Kirkekaffe", "Programmet vises i rekkefølge");

  const [welcome, worship, coffee] = withProgram;
  assert(
    worship.task?.id === "lyd" && worship.roleTitle === "Lydtekniker" && worship.assignedPersons[0].person?.name === "Kari Nordmann",
    "Et programpunkt med oppgave viser oppgaven og hvem som har den"
  );
  assert(worship.meetAt === "09:30" && worship.time === "11:05", "Oppgaven står på programpunktets tid, med oppmøtetiden ved siden av");
  assert(worship.groupName === "Lyd og bilde" && worship.isMyGroup, "Gruppen kommer fra oppgaven");
  assert(
    welcome.task === undefined && welcome.assignedPersons.length === 0 && welcome.roleTitle === undefined,
    "Et programpunkt uten oppgave har ingen ansvarlig: ingenting diktes opp"
  );
  assert(welcome.isFullyCovered && !welcome.hasForfall, "Et programpunkt uten oppgave er ikke en mangel");
  assert(coffee.task === undefined && coffee.assignedPersons.length === 0, "En lenke til en oppgave som er slettet gir et vanlig programpunkt");

  // 3. Tasks outside the programme
  const coffeeTask = detail("kaffe", { title: "Kirkekaffe", instruction: "Møt kl. 10:15. Trakte kaffe." }, false);
  const host = detail("vert", { title: "Vert", description: "Ta imot folk i døra" });
  const mixed = buildRunSheet(program, [host, sound, coffeeTask]);
  assert(
    summary(mixed) === "10:15 Kirkekaffe | 11:00 Velkommen | 11:05 Lovsang | 12:30 Kirkekaffe | – Vert",
    "Oppgaver utenfor programmet står på oppmøtetiden sin, og de uten tid til slutt"
  );
  assert(mixed.filter((r) => r.task?.id === "lyd").length === 1, "En oppgave som er lenket til programmet vises én gang");
  const coffeeRow = mixed[0];
  assert(!coffeeRow.isFullyCovered && coffeeRow.assignedPersons.length === 0 && coffeeRow.task?.id === "kaffe", "En ubesatt oppgave vises som ubesatt");
  assert(mixed[4].description === "Ta imot folk i døra" && mixed[4].instruction === "Ta imot folk i døra", "Uten instruks brukes beskrivelsen");

  // 4. A gathering without a programme lists its tasks, and nothing is added
  const tasksOnly = buildRunSheet([], [host, coffeeTask]);
  assert(summary(tasksOnly) === "10:15 Kirkekaffe | – Vert", "Uten program vises bare oppgavene");
  assert(buildRunSheet([], []).length === 0, "Uten program og oppgaver er kjøreplanen tom");

  // 5. Forfall and odd clock formats
  const vacant = detail("lys", { status: "vacant" }, false);
  assert(buildRunSheet([], [vacant])[0].hasForfall, "En oppgave som står akutt ledig er merket som forfall");
  const odd = buildRunSheet(
    [
      { time: "9.30", title: "Rigg" },
      { time: "Etter møtet", title: "Rydding" },
      { time: "10:00", title: "Lydprøve" },
    ],
    []
  );
  assert(summary(odd) === "09:30 Rigg | 10:00 Lydprøve | Etter møtet Rydding", "«9.30» sorteres som 09:30, og tekst som ikke er et klokkeslett havner til slutt");

  const moved = reorderProgramSchedule(
    [
      { time: "11:00", title: "Velkommen" },
      { time: "11:05", title: "Lovsang", taskId: "lyd" },
      { time: "11:10", title: "Tale" },
    ],
    1,
    2
  );
  assert(
    moved.map((item) => `${item.time} ${item.title}`).join(" | ") === "11:00 Velkommen | 11:05 Tale | 11:10 Lovsang",
    "Flytting bytter innhold mellom radene, klokkeslettene på radene står"
  );
});
