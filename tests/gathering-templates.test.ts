import { describe, expect, test } from "vitest";
import { buildGathering, buildTask, type NewGatheringInput, type NewTaskInput } from "../src/data/newDocuments";
import type { Gathering, Task, VolunteerRole } from "../src/types";
import { combineDateAndTimeToIso } from "../src/utils/dates";
import { newGatheringForm } from "../src/utils/gatheringForm";
import {
  clockOf,
  applyTemplateToGathering,
  createPlannedGathering,
  endClockOf,
  formValuesForTemplateApply,
  formValuesFromTemplate,
  itemClock,
  minutesOf,
  planGathering,
  roleNameOf,
  standardServiceTemplate,
  tasksOfTemplate,
  templateFromGathering,
  type GatheringTemplate,
} from "../src/utils/gatheringTemplates";
import { suggestedLastDay } from "../src/utils/series";

// A template is the recipe for a kind of event: its facts, its programme and the staffing it
// needs. An event made from one is an ordinary event, with the programme at its own time of day.

const role = (id: string, name: string, groupId?: string): VolunteerRole => ({ id, name, groupId, sortOrder: 0 });
const roles = [role("r-leder", "Møteleder"), role("r-lovsang", "Lovsang", "group-lovsang"), role("r-vert", "Møtevert", "group-vert"), role("r-taler", "Taler")];

const form = (changes = {}) => newGatheringForm({ title: "Gudstjeneste", date: "2026-10-18", time: "11:00", groupId: "g1", ...changes });

/** The app's three actions, storing nothing: what they were asked to store is kept. */
function fakeActions() {
  const stored = { gatherings: [] as Gathering[], tasks: [] as Task[], updates: [] as [string, Partial<Gathering>][] };
  return {
    stored,
    actions: {
      createGathering: (data: NewGatheringInput) => {
        const gathering = buildGathering(data);
        stored.gatherings.push(gathering);
        return { success: true, gathering };
      },
      createTask: (data: NewTaskInput) => {
        const task = buildTask(data);
        stored.tasks.push(task);
        return { success: true, task };
      },
      updateGathering: (id: string, updates: Partial<Gathering>) => {
        stored.updates.push([id, updates]);
        return { success: true };
      },
    },
  };
}

describe("Klokka i et program", () => {
  test("leses og skrives som klokkeslett, og går rundt ved midnatt", () => {
    expect(minutesOf("11:07")).toBe(667);
    expect(minutesOf("9.30")).toBe(570);
    expect(minutesOf("25:00")).toBeNull();
    expect(minutesOf("snart")).toBeNull();
    expect(clockOf(667)).toBe("11:07");
    expect(clockOf(-15)).toBe("23:45");
    expect(clockOf(24 * 60 + 5)).toBe("00:05");
  });

  test("et punkt står så mange minutter fra starten som malen sier, også før start", () => {
    expect(itemClock("11:00", { offsetMinutes: -15 })).toBe("10:45");
    expect(itemClock("17:00", { offsetMinutes: 37 })).toBe("17:37");
    expect(endClockOf("11:00", { durationMinutes: 90 })).toBe("12:30");
    expect(endClockOf("11:00", { durationMinutes: 0 })).toBe("");
  });
});

describe("Standardmalen for gudstjeneste", () => {
  const template = standardServiceTemplate(roles);

  test("har programmet i rekkefølge, fra velkomsten ved inngangen til kirkekaffen", () => {
    const program = template.program.map((item) => `${itemClock(template.time, item)} ${item.title}`);
    expect(program).toHaveLength(18);
    expect(program[0]).toBe("10:45 Velkommen ved inngang");
    expect(program[1]).toBe("11:00 Lovsang x2");
    expect(program[9]).toBe("11:42 Tale / undervisning");
    expect(program[16]).toBe("12:30 Lovsang (avslutningssang)");
    expect(program[17]).toBe("12:32 Kirkekaffe");
    expect(template).toMatchObject({ name: "Gudstjeneste", time: "11:00", durationMinutes: 92, isGudstjeneste: true, visibility: "offentlig" });
  });

  test("knytter hvert punkt til rollen med samme navn i menighetens egne roller, når den finnes", () => {
    const talk = template.program.find((item) => item.title === "Tale / undervisning")!;
    expect(talk).toMatchObject({ roleId: "r-taler", roleName: "Taler" });
    // A role the congregation does not have keeps its name, and can be tied later
    const kids = template.program.find((item) => item.title === "Barnekirke")!;
    expect(kids.roleId).toBeUndefined();
    expect(roleNameOf(kids, roles)).toBe("Barnekirke");
    // A point nobody has
    expect(roleNameOf(template.program.find((item) => item.title.startsWith("Nattverd"))!, roles)).toBe("");
    expect(template.program.find((item) => item.title === "Velkommen. Åpningsord")?.description).toBe("Dagens tema");
    expect(template.program.find((item) => item.title === "Kollekt")?.description).toBe("Vipps-skjerm under lovsang");
  });

  test("gir én oppgave per rolle, uansett hvor mange punkter rollen har", () => {
    const tasks = tasksOfTemplate(template, roles);
    expect(tasks.map((task) => task.title)).toEqual(["Møtevert", "Lovsang", "Møteleder", "Barnekirke", "Taler", "Forbønn"]);
    expect(tasks.find((task) => task.title === "Lovsang")).toMatchObject({ volunteerRoleId: "r-lovsang", groupId: "group-lovsang", neededCount: 1, from: "program" });
    expect(tasks.find((task) => task.title === "Barnekirke")?.volunteerRoleId).toBeUndefined();
  });

  test("følger rollen når den får nytt navn i rollebiblioteket", () => {
    const renamed = roles.map((r) => (r.id === "r-taler" ? { ...r, name: "Forkynner" } : r));
    expect(tasksOfTemplate(template, renamed).map((task) => task.title)).toContain("Forkynner");
  });
});

describe("Oppgavene en mal gir", () => {
  const base: Pick<GatheringTemplate, "program" | "extraStaffing"> = {
    program: [{ id: "a", offsetMinutes: 0, durationMinutes: 5, title: "Lovsang", roleId: "r-lovsang", roleName: "Lovsang" }],
    extraStaffing: [],
  };

  test("en ekstra vakt kommer i tillegg til dem programmet gir", () => {
    const tasks = tasksOfTemplate({ ...base, extraStaffing: [{ id: "x", roleName: "Rigging", neededCount: 3 }] }, roles);
    expect(tasks).toEqual([
      { key: "r-lovsang", title: "Lovsang", volunteerRoleId: "r-lovsang", groupId: "group-lovsang", neededCount: 1, from: "program" },
      { key: "navn:rigging", title: "Rigging", volunteerRoleId: undefined, groupId: undefined, neededCount: 3, from: "extra" },
    ]);
  });

  test("en rolle som står begge steder, er én oppgave, med antallet den ekstra vakten sier", () => {
    const tasks = tasksOfTemplate({ ...base, extraStaffing: [{ id: "x", roleId: "r-lovsang", roleName: "Lovsang", neededCount: 4 }] }, roles);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: "Lovsang", neededCount: 4, from: "program" });
  });
});

describe("Et arrangement fra en mal", () => {
  const template = { ...standardServiceTemplate(roles), id: "mal-1", location: "Kirkesalen", summary: "Velkommen til gudstjeneste.", imageUrl: "media:m1" };

  test("skjemaet fylles ut fra malen, og dagen er skjemaets egen", () => {
    const values = formValuesFromTemplate(template, form({ title: "", time: "17:00", date: "2026-11-01" }));
    expect(values).toMatchObject({ title: "Gudstjeneste", date: "2026-11-01", time: "11:00", endTime: "12:32", location: "Kirkesalen", isGudstjeneste: true, summary: "Velkommen til gudstjeneste.", imageUrl: "media:m1", groupId: "g1" });
  });

  test("får programmet og oppgavene, og er merket med malen", () => {
    const plan = planGathering(form(), { template, roles });
    expect(plan.gathering).toMatchObject({ title: "Gudstjeneste", templateId: "mal-1", startsAt: combineDateAndTimeToIso("2026-10-18", "11:00") });
    expect(plan.tasks.map((task) => task.input.title)).toEqual(["Møtevert", "Lovsang", "Møteleder", "Barnekirke", "Taler", "Forbønn"]);
    expect(plan.program).toHaveLength(18);
    expect(plan.program[0]).toEqual({ time: "10:45", durationMinutes: 15, title: "Velkommen ved inngang", description: undefined, taskKey: "r-vert" });
    // The point nobody has, is in the programme without a task
    expect(plan.program.find((item) => item.title.startsWith("Nattverd"))?.taskKey).toBeUndefined();
  });

  test("programmet følger arrangementets egen starttid", () => {
    const evening = planGathering(form({ time: "17:00" }), { template, roles });
    expect(evening.program[0].time).toBe("16:45");
    expect(evening.program[9]).toMatchObject({ time: "17:42", title: "Tale / undervisning" });
  });

  test("uten mal, og på nivået uten planleggeren, er det et arrangement uten program og oppgaver", () => {
    expect(planGathering(form())).toMatchObject({ tasks: [], program: [] });
    expect(planGathering(form()).gathering).not.toHaveProperty("templateId");
    const withoutPlanner = planGathering(form(), { template, roles, withPlanner: false });
    expect(withoutPlanner).toMatchObject({ tasks: [], program: [] });
    expect(withoutPlanner.gathering.templateId).toBe("mal-1");
  });

  test("et arrangement i en serie er merket med serien", () => {
    expect(planGathering(form(), { template, roles, seriesId: "serie-1" }).gathering.seriesId).toBe("serie-1");
  });

  test("lagres som arrangement, oppgaver og så programmet, med hvert punkt knyttet til oppgaven sin", () => {
    const { actions, stored } = fakeActions();
    const result = createPlannedGathering(actions, planGathering(form(), { template, roles }));

    expect(result.success).toBe(true);
    expect(stored.gatherings).toHaveLength(1);
    expect(stored.tasks).toHaveLength(6);
    expect(stored.tasks.every((task) => task.gatheringId === stored.gatherings[0].id && task.status === "open")).toBe(true);

    const [[id, { programSchedule }]] = stored.updates;
    expect(id).toBe(stored.gatherings[0].id);
    const leader = stored.tasks.find((task) => task.title === "Møteleder")!;
    const song = stored.tasks.find((task) => task.title === "Lovsang")!;
    expect(programSchedule!.filter((item) => item.taskId === leader.id).map((item) => item.title)).toEqual(["Velkommen. Åpningsord", "Bønn", "Kunngjøringer", "Bønn før tale", "Kollekt", "Velsignelsen"]);
    expect(programSchedule!.find((item) => item.title === "Lovsang x3")).toMatchObject({ time: "11:18", taskId: song.id, groupId: "group-lovsang" });
    expect(programSchedule!.find((item) => item.title.startsWith("Nattverd"))).not.toHaveProperty("taskId");
  });

  test("uten mal lagres bare arrangementet", () => {
    const { actions, stored } = fakeActions();
    createPlannedGathering(actions, planGathering(form()));
    expect([stored.gatherings.length, stored.tasks.length, stored.updates.length]).toEqual([1, 0, 0]);
  });

  test("går ikke lagringen av arrangementet, lagres ingenting mer", () => {
    const { actions, stored } = fakeActions();
    const failing = { ...actions, createGathering: () => ({ success: false, error: "Ingen kontakt med databasen." }) };
    expect(createPlannedGathering(failing, planGathering(form(), { template, roles }))).toEqual({ success: false, error: "Ingen kontakt med databasen." });
    expect(stored.tasks).toHaveLength(0);
  });

  test("kan legges på et arrangement som allerede finnes", () => {
    const { actions, stored } = fakeActions();
    const created = createPlannedGathering(actions, planGathering(form({ title: "Tomt arrangement" }), { roles }));
    const gatheringId = created.gathering!.id;
    stored.tasks.length = 0;
    stored.updates.length = 0;

    const plan = planGathering(formValuesForTemplateApply(template, form({ title: "Tomt arrangement", time: "11:00" })), { template, roles });
    expect(applyTemplateToGathering(gatheringId, plan, actions).success).toBe(true);
    expect(stored.tasks).toHaveLength(6);
    expect(stored.updates[0][0]).toBe(gatheringId);
    expect(stored.updates[0][1].templateId).toBe("mal-1");
    expect(stored.updates[0][1].programSchedule).toHaveLength(18);
  });
});

describe("En mal laget av et arrangement", () => {
  const { actions, stored } = fakeActions();
  const source = { ...standardServiceTemplate(roles), id: "mal-1", location: "Kirkesalen", extraStaffing: [{ id: "x", roleName: "Rigging", neededCount: 2 }] };
  // The form is filled in from the template first, as it is on the screen
  createPlannedGathering(actions, planGathering({ ...formValuesFromTemplate(source, form()), summary: "Velkommen." }, { template: source, roles }));
  const gathering = { ...stored.gatherings[0], ...stored.updates[0][1] };
  const made = templateFromGathering(gathering, stored.tasks, roles, "Søndagsgudstjeneste");

  test("har arrangementets fakta og presentasjon", () => {
    expect(made).toMatchObject({ name: "Søndagsgudstjeneste", title: "Gudstjeneste", time: "11:00", durationMinutes: 92, location: "Kirkesalen", isGudstjeneste: true, summary: "Velkommen." });
    expect(made.id).not.toBe("mal-1");
  });

  test("har programmet som minutter fra starten, og hvert punkt varer til det neste begynner", () => {
    expect(made.program).toHaveLength(18);
    expect(made.program[0]).toMatchObject({ offsetMinutes: -15, durationMinutes: 15, title: "Velkommen ved inngang", roleId: "r-vert", roleName: "Møtevert" });
    expect(made.program[9]).toMatchObject({ offsetMinutes: 42, durationMinutes: 20, title: "Tale / undervisning", roleName: "Taler" });
    expect(made.program.at(-1)).toMatchObject({ title: "Kirkekaffe", durationMinutes: 0 });
  });

  test("har vaktene som ikke står i programmet, som ekstra vakter", () => {
    expect(made.extraStaffing.map((extra) => [extra.roleName, extra.neededCount])).toEqual([["Rigging", 2]]);
  });

  test("gir de samme oppgavene og det samme programmet igjen", () => {
    const again = planGathering(form({ time: "18:00" }), { template: made, roles });
    expect(again.tasks.map((task) => task.input.title).sort()).toEqual(["Barnekirke", "Forbønn", "Lovsang", "Møteleder", "Møtevert", "Rigging", "Taler"]);
    expect(again.program[0]).toMatchObject({ time: "17:45", title: "Velkommen ved inngang" });
  });
});

describe("Siste dato som foreslås for en serie", () => {
  test("er sommeren som kommer: ut året og fram til 30. juni", () => {
    expect(suggestedLastDay("2026-10-12")).toBe("2027-06-30");
    expect(suggestedLastDay("2027-01-05")).toBe("2027-06-30");
    expect(suggestedLastDay("2027-06-30")).toBe("2027-06-30");
    expect(suggestedLastDay("2027-07-01")).toBe("2028-06-30");
    expect(suggestedLastDay("")).toBe("");
  });
});
