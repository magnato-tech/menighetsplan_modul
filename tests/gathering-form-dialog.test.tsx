// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The quick form for a new event leads on to the full one, and the full one is also the form an
// event is changed in. A new event can start from one of the congregation's templates, and be
// repeated as a series.

const { installation, planner, library } = vi.hoisted(() => ({
  installation: { demo: null as null | Record<string, string> },
  planner: { assignments: [] as { taskId: string }[], deleteTask: vi.fn((_taskId: string) => ({ success: true })) },
  library: { templates: [] as unknown[] },
}));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => planner }));
vi.mock("../src/hooks/useGatheringTemplates", () => ({ useGatheringTemplates: () => ({ templates: library.templates, ready: true }) }));

import { GatheringFormDialog, type GatheringFormChoices } from "../src/components/gathering/GatheringFormDialog";
import { buildGathering, buildTask, type NewGatheringInput, type NewTaskInput } from "../src/data/newDocuments";
import { GatheringsTab } from "../src/pages/admin/tabs/GatheringsTab";
import type { StudioData } from "../src/pages/admin/studio";
import { chooseDemoLevel, forgetDemoLevel } from "../src/services/demoLevel";
import type { Gathering, Task, VolunteerRole } from "../src/types";
import { combineDateAndTimeToIso } from "../src/utils/dates";
import { newGatheringForm, type GatheringFormValues } from "../src/utils/gatheringForm";
import type { GatheringTemplate } from "../src/utils/gatheringTemplates";
import { standardServiceTemplate } from "../src/utils/gatheringTemplates";

const groups = [
  { id: "lovsang", name: "Lovsang", memberIds: ["p1"], leaderIds: ["p2"] },
  { id: "kalender", name: "Kalender", memberIds: [], leaderIds: [] },
];
const roles: VolunteerRole[] = ["Møteleder", "Lovsang", "Møtevert", "Taler"].map((name, index) => ({ id: `r-${index}`, name, sortOrder: index }));
const service = { ...standardServiceTemplate(roles), id: "mal-gudstjeneste", location: "Kirkesalen" };
const youth = { ...standardServiceTemplate(roles), id: "mal-ungdom", name: "Ungdomsmøte", title: "Ungdomsmøte", time: "19:00", durationMinutes: 120, isGudstjeneste: false, program: [] };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  forgetDemoLevel();
  installation.demo = null;
  planner.assignments = [];
  library.templates = [];
});

describe("Det store skjemaet for et nytt arrangement", () => {
  const onSave = vi.fn((_values: GatheringFormValues, _choices: GatheringFormChoices) => ({ success: true }) as { success: boolean; error?: string });
  const onClose = vi.fn();
  const show = (start: Partial<GatheringFormValues> = {}, props: Partial<React.ComponentProps<typeof GatheringFormDialog>> = {}) =>
    render(<GatheringFormDialog isNew initial={newGatheringForm({ groupId: "lovsang", ...start })} groups={groups} showGroup onSave={onSave} onClose={onClose} {...props} />);
  const write = (name: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
  const save = () => fireEvent.click(screen.getByRole("button", { name: /^Opprett/ }));
  const series = () => screen.getByRole("region", { name: "Gjenta som serie" });

  test("har alle feltene, og lagrer det som er fylt ut, uten mal og uten serie", () => {
    show();
    write("Tittel", "Høstfest");
    write("Dato", "2026-10-18");
    write("Starter kl.", "17:00");
    write("Slutter kl. (valgfritt)", "20:00");
    write("Sted", "Storsalen");
    write("Tema (valgfritt)", "Takk");
    write("Bibeltekst (valgfritt)", "Sal 100");
    write("Ansvarlig gruppe", "kalender");
    fireEvent.click(screen.getByLabelText("Dette er en gudstjeneste"));
    fireEvent.click(screen.getByRole("radio", { name: /Fremhevet/ }));
    save();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Høstfest", date: "2026-10-18", time: "17:00", endTime: "20:00", location: "Storsalen", groupId: "kalender", isGudstjeneste: false, theme: "Takk", bibleText: "Sal 100", visibility: "fremhevet", cancelled: false }),
      { templateId: null, days: [] }
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("sier hva som mangler, og lagrer ikke før det er rettet", () => {
    show();
    save();
    expect(screen.getByRole("alert").textContent).toBe("Arrangementet må ha en tittel.");

    write("Tittel", "Høstfest");
    write("Dato", "2026-10-18");
    write("Slutter kl. (valgfritt)", "10:00");
    save();
    expect(screen.getByRole("alert").textContent).toBe("Slutten må være etter starten.");
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("blir stående åpent med det som er skrevet, når lagringen ikke går", () => {
    onSave.mockReturnValueOnce({ success: false, error: "Ingen kontakt med databasen." });
    show({ title: "Høstfest", date: "2026-10-18" });
    save();

    expect(screen.getByRole("alert").textContent).toBe("Ingen kontakt med databasen.");
    expect((screen.getByLabelText("Tittel") as HTMLInputElement).value).toBe("Høstfest");
    expect(onClose).not.toHaveBeenCalled();
  });

  test("delen om nettsiden står sammenfoldet når den er tom, og et nytt arrangement kan ikke avlyses", () => {
    show();
    expect(within(screen.getByRole("region", { name: "På nettsiden" })).getByRole("button", { name: "Legg til bilde og tekst" })).toBeTruthy();
    expect(screen.queryByLabelText("Ingress")).toBeNull();
    expect(screen.queryByLabelText("Arrangementet er avlyst")).toBeNull();
  });

  test("uten planleggeren velges ingen gruppe", () => {
    show({}, { showGroup: false });
    expect(screen.queryByLabelText("Ansvarlig gruppe")).toBeNull();
  });

  describe("fra en mal", () => {
    test("uten maler sier skjemaet hvor en mal lages", () => {
      show();
      expect(within(screen.getByRole("region", { name: "Start fra en mal" })).getByText(/Ingen maler er laget ennå/)).toBeTruthy();
    });

    test("malen fyller inn skjemaet, og valget følger med når arrangementet opprettes", () => {
      show({ date: "2026-10-18" }, { templates: [service, youth] });
      const section = screen.getByRole("region", { name: "Start fra en mal" });
      expect(within(section).getAllByRole("button", { name: /Gudstjeneste/ })[0].textContent).toContain("Kl. 11:00 · 18 programpunkter");

      fireEvent.click(within(section).getAllByRole("button", { name: /Ungdomsmøte/ })[0]);
      expect((screen.getByLabelText("Tittel") as HTMLInputElement).value).toBe("Ungdomsmøte");
      expect((screen.getByLabelText("Starter kl.") as HTMLInputElement).value).toBe("19:00");
      expect((screen.getByLabelText("Slutter kl. (valgfritt)") as HTMLInputElement).value).toBe("21:00");
      expect((screen.getByLabelText("Dette er en gudstjeneste") as HTMLInputElement).checked).toBe(false);
      expect(within(section).getAllByRole("button", { name: /Ungdomsmøte/ })[0].getAttribute("aria-pressed")).toBe("true");

      save();
      expect(onSave.mock.calls[0][1]).toEqual({ templateId: "mal-ungdom", days: [] });
    });

    test("malen kan velges bort igjen: da opprettes arrangementet uten program og oppgaver", () => {
      show({ date: "2026-10-18" }, { templates: [service] });
      const section = screen.getByRole("region", { name: "Start fra en mal" });
      fireEvent.click(within(section).getAllByRole("button", { name: /Gudstjeneste/ })[0]);
      fireEvent.click(screen.getByRole("button", { name: /Ikke bruk mal/ }));
      save();
      expect(onSave.mock.calls[0][1].templateId).toBeNull();
      // What the template filled in, stands
      expect(onSave.mock.calls[0][0].location).toBe("Kirkesalen");
    });

    test("malen kan redigeres fra skjemaet før arrangementet opprettes", () => {
      const onSaveTemplate = vi.fn(async (_template: GatheringTemplate) => true);
      show({ date: "2026-10-18" }, { templates: [service], templateEditor: { roles, withPlanner: true, onSave: onSaveTemplate } });
      fireEvent.click(screen.getByRole("button", { name: "Rediger malen Gudstjeneste" }));
      expect(screen.getByRole("dialog", { name: /Rediger mal/ })).toBeTruthy();
      fireEvent.change(screen.getByLabelText("Navn på malen"), { target: { value: "Gudstjeneste søndag" } });
      fireEvent.click(screen.getByRole("button", { name: "Lagre mal" }));
      expect(onSaveTemplate).toHaveBeenCalled();
      expect(onSaveTemplate.mock.calls.at(0)?.[0]?.name).toBe("Gudstjeneste søndag");
    });
  });

  describe("som serie", () => {
    test("er av til den slås på, og foreslår da hver uke fram til sommeren", () => {
      show({ title: "Gudstjeneste", date: "2026-10-18" });
      expect(within(series()).queryByLabelText("Hvor ofte")).toBeNull();

      fireEvent.click(within(series()).getByLabelText("Arrangementet gjentas"));
      expect((screen.getByLabelText("Siste dato") as HTMLInputElement).value).toBe("2027-06-30");
      expect((screen.getByLabelText("Hvor ofte") as HTMLSelectElement).value).toBe("weekly");
      // Every Sunday from the 18th of October to the 27th of June
      expect(within(series()).getByText(/^37 arrangementer opprettes/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Opprett 37 arrangementer" })).toBeTruthy();
    });

    test("viser dagene før noe opprettes, og en dag kan tas ut", () => {
      show({ title: "Gudstjeneste", date: "2026-10-18" });
      fireEvent.click(within(series()).getByLabelText("Arrangementet gjentas"));
      write("Hvor ofte", "every2");
      write("Siste dato", "2026-11-29");

      const days = () => within(series()).getAllByRole("checkbox").slice(1) as HTMLInputElement[];
      expect(within(series()).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["søndag 18. oktober", "søndag 1. november", "søndag 15. november", "søndag 29. november"]);

      fireEvent.click(days()[2]);
      expect(within(series()).getByText(/^3 arrangementer opprettes/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Opprett 3 arrangementer" }));
      expect(onSave.mock.calls[0][1].days).toEqual(["2026-10-18", "2026-11-01", "2026-11-29"]);
    });

    test("sier fra der det alt ligger et arrangement", () => {
      show({ title: "Gudstjeneste", date: "2026-10-18" }, { existing: [{ day: "2026-10-25", title: "Familiegudstjeneste" }, { day: "2026-12-24", title: "Julaften" }] });
      fireEvent.click(within(series()).getByLabelText("Arrangementet gjentas"));
      write("Siste dato", "2026-11-01");

      const [first, second, third] = within(series()).getAllByRole("listitem");
      expect(first.textContent).toBe("søndag 18. oktober");
      expect(second.textContent).toBe("søndag 25. oktoberLigger allerede: Familiegudstjeneste");
      expect(third.textContent).toBe("søndag 1. november");
    });

    test("en serie uten dager opprettes ikke", () => {
      show({ title: "Gudstjeneste", date: "2026-10-18" });
      fireEvent.click(within(series()).getByLabelText("Arrangementet gjentas"));
      // The series has one day, and that day is left out
      write("Siste dato", "2026-10-18");
      fireEvent.click(within(series()).getAllByRole("checkbox")[1]);
      save();
      expect(screen.getByRole("alert").textContent).toMatch(/^Serien har ingen dager/);
      expect(onSave).not.toHaveBeenCalled();
    });

    test("åpnet fra en mal for å planlegge en serie, står malen valgt og gjentakelsen på", () => {
      show({ title: "Gudstjeneste", date: "2026-10-18" }, { templates: [service], initialTemplateId: service.id, initialRepeat: true });
      const section = screen.getByRole("region", { name: "Start fra en mal" });
      expect(within(section).getAllByRole("button", { name: /Gudstjeneste/ })[0].getAttribute("aria-pressed")).toBe("true");
      expect((within(series()).getByLabelText("Arrangementet gjentas") as HTMLInputElement).checked).toBe(true);
    });
  });
});

describe("Det store skjemaet for et arrangement som finnes", () => {
  test("har ikke mal og serie, men kan avlyse", () => {
    const onSave = vi.fn((_values: GatheringFormValues, _choices: GatheringFormChoices) => ({ success: true }));
    render(
      <GatheringFormDialog
        isNew={false}
        initial={newGatheringForm({ title: "Høstfest", date: "2026-10-18", groupId: "lovsang" })}
        groups={groups}
        showGroup
        templates={[service]}
        onSave={onSave}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "Rediger arrangement" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Start fra en mal" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Gjenta som serie" })).toBeNull();

    fireEvent.click(screen.getByLabelText("Arrangementet er avlyst"));
    fireEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: "Høstfest", cancelled: true });
    expect(onSave.mock.calls[0][1]).toEqual({ templateId: null, days: [] });
  });
});

describe("Arrangementer i admin", () => {
  const stored = { gatherings: [] as Gathering[], tasks: [] as Task[], programs: [] as [string, Partial<Gathering>][] };
  const createGathering = vi.fn((data: NewGatheringInput) => {
    const gathering = buildGathering(data);
    stored.gatherings.push(gathering);
    return { success: true, gathering };
  });
  const createTask = vi.fn((data: NewTaskInput) => {
    const task = buildTask(data);
    stored.tasks.push(task);
    return { success: true, task };
  });
  const updateGathering = vi.fn((id: string, updates: Partial<Gathering>) => {
    stored.programs.push([id, updates]);
    return { success: true };
  });
  const deleteGathering = vi.fn((_id: string) => ({ success: true }));
  const showFeedback = vi.fn();

  const studioWith = (adminGatherings: unknown[] = []) =>
    ({ adminGatherings, adminGroups: groups.map((group) => ({ group })), adminVolunteerRoles: roles, createGathering, createTask, updateGathering, deleteGathering }) as unknown as StudioData;
  const show = (adminGatherings: unknown[] = []) => {
    stored.gatherings = [];
    stored.tasks = [];
    stored.programs = [];
    return render(
      <MemoryRouter>
        <GatheringsTab studio={studioWith(adminGatherings)} showFeedback={showFeedback} />
      </MemoryRouter>
    );
  };
  const quickTitle = () => screen.getByPlaceholderText("Tittel, f.eks. Søndagsgudstjeneste & dåp") as HTMLInputElement;
  const openFullForm = () => {
    fireEvent.click(screen.getByRole("button", { name: "Flere valg" }));
    return screen.getByRole("dialog", { name: "Nytt arrangement" });
  };

  test("«Flere valg» åpner det store skjemaet med det som er skrevet, og oppretter arrangementet derfra", () => {
    show();
    fireEvent.change(quickTitle(), { target: { value: "Høstfest" } });
    fireEvent.change(screen.getByPlaceholderText("Valgfritt tema..."), { target: { value: "Takk" } });
    const form = openFullForm();
    expect((within(form).getByLabelText("Tittel") as HTMLInputElement).value).toBe("Høstfest");
    expect((within(form).getByLabelText("Tema (valgfritt)") as HTMLInputElement).value).toBe("Takk");
    expect((within(form).getByLabelText("Ansvarlig gruppe") as HTMLSelectElement).value).toBe("lovsang");

    fireEvent.change(within(form).getByLabelText("Dato"), { target: { value: "2026-10-18" } });
    fireEvent.change(within(form).getByLabelText("Sted"), { target: { value: "Storsalen" } });
    fireEvent.click(within(form).getByRole("button", { name: "Opprett arrangement" }));

    expect(createGathering).toHaveBeenCalledTimes(1);
    expect(stored.gatherings[0]).toMatchObject({ title: "Høstfest", theme: "Takk", location: "Storsalen", groupId: "lovsang", startsAt: combineDateAndTimeToIso("2026-10-18", "11:00"), visibility: "offentlig" });
    expect(stored.gatherings[0].seriesId).toBeUndefined();
    expect(createTask).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(showFeedback).toHaveBeenCalledWith("Nytt arrangement opprettet og lagt i kalenderen!");
    expect(quickTitle().value).toBe("");
  });

  test("det raske skjemaet lagrer fortsatt med én gang", () => {
    show();
    fireEvent.change(quickTitle(), { target: { value: "Gudstjeneste" } });
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2026-10-18" } });
    fireEvent.click(screen.getByRole("button", { name: "Legg til i planleggeren" }));

    expect(createGathering).toHaveBeenCalledWith(expect.objectContaining({ title: "Gudstjeneste", groupId: "lovsang" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("et arrangement fra en mal får malens program og oppgaver", () => {
    library.templates = [service];
    show();
    const form = openFullForm();
    const malSection = within(form).getByRole("region", { name: "Start fra en mal" });
    fireEvent.click(within(malSection).getAllByRole("button", { name: /Gudstjeneste/ })[0]);
    fireEvent.change(within(form).getByLabelText("Dato"), { target: { value: "2026-10-18" } });
    fireEvent.click(within(form).getByRole("button", { name: "Opprett arrangement" }));

    expect(stored.gatherings).toHaveLength(1);
    expect(stored.gatherings[0]).toMatchObject({ title: "Gudstjeneste", templateId: "mal-gudstjeneste", location: "Kirkesalen", endsAt: combineDateAndTimeToIso("2026-10-18", "12:32") });
    expect(stored.tasks.map((task) => task.title)).toEqual(["Møtevert", "Lovsang", "Møteleder", "Barnekirke", "Taler", "Forbønn"]);
    expect(stored.programs[0][0]).toBe(stored.gatherings[0].id);
    expect(stored.programs[0][1].programSchedule).toHaveLength(18);
    expect(showFeedback).toHaveBeenCalledWith("Nytt arrangement opprettet fra malen «Gudstjeneste» og lagt i kalenderen!");
  });

  test("en serie fra en mal gir ett arrangement per dag, hvert med program og oppgaver, merket som samme serie", () => {
    library.templates = [service];
    show();
    const form = openFullForm();
    const malSection = within(form).getByRole("region", { name: "Start fra en mal" });
    fireEvent.click(within(malSection).getAllByRole("button", { name: /Gudstjeneste/ })[0]);
    fireEvent.change(within(form).getByLabelText("Dato"), { target: { value: "2026-10-18" } });
    fireEvent.click(within(form).getByLabelText("Arrangementet gjentas"));
    fireEvent.change(within(form).getByLabelText("Siste dato"), { target: { value: "2026-11-01" } });
    fireEvent.click(within(form).getByRole("button", { name: "Opprett 3 arrangementer" }));

    expect(stored.gatherings.map((gathering) => gathering.startsAt)).toEqual(["2026-10-18", "2026-10-25", "2026-11-01"].map((day) => combineDateAndTimeToIso(day, "11:00")));
    expect(new Set(stored.gatherings.map((gathering) => gathering.seriesId)).size).toBe(1);
    expect(stored.gatherings[0].seriesId).toBeTruthy();
    expect(stored.tasks).toHaveLength(18);
    expect(stored.programs).toHaveLength(3);
    expect(showFeedback).toHaveBeenCalledWith("3 arrangementer opprettet fra malen «Gudstjeneste» og lagt i kalenderen!");
  });

  test("uten planleggeren spør ingen av skjemaene etter gruppe, og et arrangement fra en mal får ikke oppgaver", () => {
    installation.demo = {};
    chooseDemoLevel("plattform");
    library.templates = [service];
    show();

    expect(screen.queryByLabelText("Ansvarlig gruppe")).toBeNull();
    const form = openFullForm();
    expect(within(form).queryByLabelText("Ansvarlig gruppe")).toBeNull();
    const malSection = within(form).getByRole("region", { name: "Start fra en mal" });
    fireEvent.click(within(malSection).getAllByRole("button", { name: /Gudstjeneste/ })[0]);
    fireEvent.change(within(form).getByLabelText("Dato"), { target: { value: "2026-10-18" } });
    fireEvent.click(within(form).getByRole("button", { name: "Opprett arrangement" }));

    expect(stored.gatherings[0]).toMatchObject({ title: "Gudstjeneste", groupId: "kalender" });
    expect(createTask).not.toHaveBeenCalled();
    expect(updateGathering).not.toHaveBeenCalled();
  });

  test("resten av en serie kan slettes fra ett av arrangementene, og et arrangement noen har svart på, blir stående", () => {
    const item = (id: string, day: string, seriesId?: string) => ({
      gathering: { id, title: "Gudstjeneste", startsAt: combineDateAndTimeToIso(day, "11:00"), groupId: "lovsang", type: "arrangement", visibility: "offentlig", seriesId },
      tasks: [{ id: `oppgave-${id}`, title: "Taler" }],
      staffing: { color: "red" },
    });
    planner.assignments = [{ taskId: "oppgave-c" }];
    vi.stubGlobal("confirm", vi.fn(() => true));
    show([item("a", "2026-10-18", "serie-1"), item("b", "2026-10-25", "serie-1"), item("c", "2026-11-01", "serie-1"), item("d", "2026-11-08", "serie-1"), item("x", "2026-11-08", "serie-2"), item("y", "2026-11-15")]);

    expect(screen.getAllByText("Del av serie")).toHaveLength(5);
    // From the second event on: the first one stands, and so does the one somebody is asked about
    fireEvent.click(screen.getAllByRole("button", { name: "Slett resten av serien" })[1]);

    expect(vi.mocked(confirm).mock.calls[0][0]).toMatch(/^Vil du slette 2 arrangementer i serien.* 1 blir stående, fordi noen er spurt eller har svart\.$/);
    expect(deleteGathering.mock.calls.map(([id]) => id)).toEqual(["b", "d"]);
    expect(planner.deleteTask.mock.calls.map(([id]) => id)).toEqual(["oppgave-b", "oppgave-d"]);
    expect(showFeedback).toHaveBeenCalledWith("2 arrangementer i serien ble slettet");
  });

  test("uten bekreftelse slettes ingenting", () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    show([{ gathering: { id: "a", title: "Gudstjeneste", startsAt: combineDateAndTimeToIso("2026-10-18", "11:00"), groupId: "lovsang", seriesId: "serie-1" }, tasks: [], staffing: { color: "red" } }]);
    fireEvent.click(screen.getByRole("button", { name: "Slett resten av serien" }));
    expect(deleteGathering).not.toHaveBeenCalled();
  });

  test("ett arrangement kan slettes med Slett-knappen", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    show([
      {
        gathering: { id: "a", title: "Gudstjeneste & dåp", startsAt: combineDateAndTimeToIso("2026-10-18", "11:00"), groupId: "lovsang", type: "arrangement", visibility: "offentlig" },
        tasks: [{ id: "oppgave-a", title: "Lovsang" }],
        staffing: { color: "red" },
      },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Slett" }));
    expect(deleteGathering).toHaveBeenCalledWith("a");
    expect(planner.deleteTask).toHaveBeenCalledWith("oppgave-a");
    expect(showFeedback).toHaveBeenCalledWith("Arrangementet ble slettet");
  });

  test("arrangement med tildelinger kan ikke slettes med Slett-knappen", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    planner.assignments = [{ taskId: "oppgave-a" }];
    show([
      {
        gathering: { id: "a", title: "Gudstjeneste", startsAt: combineDateAndTimeToIso("2026-10-18", "11:00"), groupId: "lovsang", type: "arrangement", visibility: "offentlig" },
        tasks: [{ id: "oppgave-a", title: "Lovsang" }],
        staffing: { color: "red" },
      },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Slett" }));
    expect(deleteGathering).not.toHaveBeenCalled();
    expect(showFeedback).toHaveBeenCalledWith(expect.stringContaining("kan ikke slettes"), "error");
  });
});
