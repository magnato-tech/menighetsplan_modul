import { describe } from "vitest";
import { assert } from "./assert";
import { COLLECTIONS } from "../src/data/collections";
import { getMockDocuments } from "../src/data/mockDocuments";
import {
  SIMULATED_COLLECTIONS,
  buildSimulatedChurchLife,
  isSimulatedDocument,
  type SimulationInput,
} from "../src/data/simulatedChurchLife";
import { buildChurchAnalytics } from "../src/utils/churchAnalytics";
import { headcountIdFor } from "../src/utils/headcount";
import { isWorshipService } from "../src/utils/gatherings";
import { parseIsoToDateAndTime } from "../src/utils/dates";
import { taskStatusFor } from "../src/utils/staffing";
import type {
  Assignment,
  Gathering,
  GatheringAttendance,
  GatheringHeadcount,
  Group,
  GroupMessage,
  Person,
  Task,
  VolunteerRole,
} from "../src/types";

describe("Simulert menighetsliv", () => {
  const now = new Date("2026-10-05T12:00:00.000Z").getTime();
  const mock = getMockDocuments();
  const rowsOf = <T,>(name: string, docs = mock) => docs.filter((d) => d.collection === name).map((d) => d.data as T);

  const input: SimulationInput = {
    now,
    weeks: 26,
    persons: rowsOf<Person>(COLLECTIONS.PERSONS),
    groups: rowsOf<Group>(COLLECTIONS.GROUPS),
    volunteerRoles: rowsOf<VolunteerRole>(COLLECTIONS.VOLUNTEER_ROLES),
    gatherings: rowsOf<Gathering>(COLLECTIONS.GATHERINGS),
  };
  const docs = buildSimulatedChurchLife(input);
  const sim = <T,>(name: string) => rowsOf<T>(name, docs);
  const gatherings = sim<Gathering>(COLLECTIONS.GATHERINGS);
  const tasks = sim<Task>(COLLECTIONS.TASKS);
  const assignments = sim<Assignment>(COLLECTIONS.ASSIGNMENTS);
  const attendances = sim<GatheringAttendance>(COLLECTIONS.GATHERING_ATTENDANCES);
  const headcounts = sim<GatheringHeadcount>(COLLECTIONS.GATHERING_HEADCOUNTS);
  const messages = sim<GroupMessage>(COLLECTIONS.GROUP_MESSAGES);

  // 1. What is made, and that it can be found again
  assert(gatherings.length > 26 && tasks.length > 0 && assignments.length > 0, "Et halvår gir samlinger, oppgaver og tildelinger");
  assert(attendances.length > 0 && headcounts.length > 0 && messages.length > 0, "Det gir også svar, oppmøtetall og meldinger");
  assert(docs.every((d) => (SIMULATED_COLLECTIONS as readonly string[]).includes(d.collection)), "Bare samlingene simuleringen eier skrives til");
  assert(docs.every((d) => isSimulatedDocument(d.id, d.data as object)), "Alt som simuleres kan kjennes igjen og fjernes");
  assert(!mock.some((d) => isSimulatedDocument(d.id, d.data as object)), "Demodataene ellers kjennes ikke igjen som simulert");
  const paths = docs.map((d) => `${d.collection}/${d.id}`);
  assert(new Set(paths).size === paths.length, "Ingen simulerte dokumenter deler sti");
  const mockPaths = new Set(mock.map((d) => `${d.collection}/${d.id}`));
  assert(!paths.some((p) => mockPaths.has(p)), "Simuleringen overskriver ingen dokumenter som finnes fra før");

  // 2. Everything points at something that exists
  const personIds = new Set(input.persons.map((p) => p.id));
  const groupIds = new Set(input.groups.map((g) => g.id));
  const gatheringIds = new Set(gatherings.map((g) => g.id));
  const taskIds = new Set(tasks.map((t) => t.id));
  assert(gatherings.every((g) => groupIds.has(g.groupId)), "Hver samling har en ansvarlig gruppe som finnes");
  assert(tasks.every((t) => gatheringIds.has(t.gatheringId) && (!t.groupId || groupIds.has(t.groupId))), "Oppgavene hører til simulerte samlinger");
  assert(assignments.every((a) => taskIds.has(a.taskId) && personIds.has(a.personId)), "Tildelingene peker på oppgaver og personer som finnes");
  assert(attendances.every((a) => gatheringIds.has(a.gatheringId) && personIds.has(a.personId)), "Svarene peker på samlinger og personer som finnes");
  assert(attendances.every((a) => a.id === `att-${a.gatheringId}-${a.personId}`), "Én person har ett svar per samling, som i appen");
  assert(headcounts.every((h) => gatheringIds.has(h.gatheringId) && h.id === headcountIdFor(h.gatheringId)), "Ett oppmøtetall per samling, med samme ID som appen bruker");
  assert(messages.every((m) => groupIds.has(m.groupId) && personIds.has(m.senderPersonId)), "Meldingene er skrevet av personer i grupper som finnes");

  // 3. It is history, and it agrees with the rules of the app
  assert(gatherings.every((g) => new Date(g.startsAt).getTime() < now), "Alt som simuleres har allerede skjedd");
  assert(messages.every((m) => new Date(m.createdAt).getTime() < now), "Ingen meldinger fra fremtiden");
  const day = (iso: string) => parseIsoToDateAndTime(iso).date;
  const existingServiceDays = new Set(input.gatherings.filter(isWorshipService).map((g) => day(g.startsAt)));
  assert(
    !gatherings.some((g) => isWorshipService(g) && existingServiceDays.has(day(g.startsAt))),
    "En søndag som allerede har en gudstjeneste får ikke en til"
  );
  assert(
    tasks.every((t) => t.status === taskStatusFor(t, assignments.filter((a) => a.taskId === t.id))),
    "Oppgavens status følger av tildelingene"
  );
  assert(
    tasks.every((t) => {
      const people = assignments.filter((a) => a.taskId === t.id).map((a) => a.personId);
      return new Set(people).size === people.length;
    }),
    "Ingen står to ganger på samme oppgave"
  );
  assert(!headcounts.some((h) => gatherings.find((g) => g.id === h.gatheringId)?.cancelled), "En avlyst samling har ikke oppmøtetall");
  assert(assignments.some((a) => a.response === "withdrawn") && assignments.some((a) => a.response === "declined"), "Både forfall og avslag forekommer");

  // 4. Same input, same history
  assert(JSON.stringify(buildSimulatedChurchLife(input)) === JSON.stringify(docs), "Samme utgangspunkt gir samme historikk");
  // The panel passes every gathering in the database, the simulated ones from last time included
  assert(
    JSON.stringify(buildSimulatedChurchLife({ ...input, gatherings: [...input.gatherings, ...gatherings] })) === JSON.stringify(docs),
    "En ny simulering lar seg ikke stoppe av dagene den forrige simuleringen fylte"
  );
  assert(buildSimulatedChurchLife({ ...input, persons: [] }).length === 0, "Uten personer simuleres ingenting");

  // 5. The analysis board has something to show
  const analytics = buildChurchAnalytics(
    {
      persons: input.persons,
      groups: input.groups,
      gatherings: [...input.gatherings, ...gatherings],
      tasks: [...rowsOf<Task>(COLLECTIONS.TASKS), ...tasks],
      assignments: [...rowsOf<Assignment>(COLLECTIONS.ASSIGNMENTS), ...assignments],
      attendances,
      headcounts: [...rowsOf<GatheringHeadcount>(COLLECTIONS.GATHERING_HEADCOUNTS), ...headcounts],
      messages,
      volunteerRoles: input.volunteerRoles,
      pages: [],
      news: [],
      sermons: [],
    },
    "3m",
    now
  );
  assert(analytics.attendance.worship.length >= 12 && analytics.attendance.averageWorship !== null, "Tre måneder har gudstjenester med snitt");
  assert(analytics.attendance.missing.length > 0, "Noen samlinger mangler fortsatt oppmøtetall, slik det er i virkeligheten");
  assert(
    analytics.volunteers.fillRate !== null && analytics.volunteers.fillRate > 0.5 && analytics.volunteers.fillRate < 1,
    "Bemanningen er god, men ikke perfekt"
  );
  assert(analytics.volunteers.highLoad.length > 0, "Noen står på så ofte at de løftes fram");
  assert(analytics.groups.groups.some((g) => g.responses.possible > 0), "Husfellesskapene har svar på samlingene");
  assert(
    tasks.some((t) => t.title === "Møteleder" && t.groupId === "group-moteledere") && tasks.some((t) => t.title === "Taler" && t.groupId === "group-moteledere"),
    "Møteleder og taler hører til teamet Møteledere og talere"
  );
  assert(
    tasks.filter((t) => !t.groupId).every((t) => t.neededCount === 1),
    "En rolle uten team trenger én person"
  );
  assert(
    analytics.multiTasks.occurrences.length > 0 && analytics.multiTasks.combinations.some((c) => c.roles.includes("Møteleder")),
    "Noen får flere oppgaver på samme søndag, også møteleder sammen med noe annet"
  );
  assert(
    analytics.fullStaffing.rate !== null && analytics.fullStaffing.rate > 0 && analytics.fullStaffing.rate < 1,
    "Noen samlinger er fullt bemannet, andre ikke"
  );
});
