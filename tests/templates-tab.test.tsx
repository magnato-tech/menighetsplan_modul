// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// «Maler» in the admin: the congregation's templates for events, the form a template is made and
// changed in, and the way from a template to a series.

const { library, service } = vi.hoisted(() => ({
  library: { templates: [] as unknown[], ready: true },
  service: { save: vi.fn(async (_template: unknown) => true), remove: vi.fn(async (_id: string) => true) },
}));
vi.mock("../src/hooks/useGatheringTemplates", () => ({ useGatheringTemplates: () => library }));
vi.mock("../src/services/gatheringTemplates", () => ({ saveGatheringTemplate: service.save, deleteGatheringTemplate: service.remove }));
vi.mock("../src/demo", () => ({ DEMO: null }));

import { TemplateFormDialog } from "../src/components/gathering/TemplateFormDialog";
import { TemplatesTab } from "../src/pages/admin/tabs/TemplatesTab";
import type { StudioData } from "../src/pages/admin/studio";
import type { VolunteerRole } from "../src/types";
import { onDay, newGatheringForm } from "../src/utils/gatheringForm";
import { itemClock, standardServiceTemplate, type GatheringTemplate } from "../src/utils/gatheringTemplates";
import { restOfSeries } from "../src/utils/series";

const roles: VolunteerRole[] = ["Møteleder", "Lovsang", "Møtevert", "Taler", "Rigging"].map((name, index) => ({ id: `r-${index}`, name, sortOrder: index }));
const groups = [{ id: "lovsang", name: "Lovsang", memberIds: ["p1"], leaderIds: [] }];
const standard = { ...standardServiceTemplate(roles), id: "mal-1" };
const studio = { adminGatherings: [], adminGroups: groups.map((group) => ({ group })), adminVolunteerRoles: roles } as unknown as StudioData;
const showFeedback = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  library.templates = [];
  library.ready = true;
});

describe("Siden «Maler»", () => {
  const show = () =>
    render(
      <MemoryRouter>
        <TemplatesTab studio={studio} showFeedback={showFeedback} />
      </MemoryRouter>
    );

  test("uten maler sier siden hvordan den første lages", () => {
    show();
    expect(screen.getByText("Ingen maler ennå")).toBeTruthy();
  });

  test("standardmalen for gudstjeneste legges inn med ett trykk, knyttet til menighetens egne roller", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Legg inn standardmal for gudstjeneste" }));

    await waitFor(() => expect(service.save).toHaveBeenCalledTimes(1));
    const saved = service.save.mock.calls[0][0] as GatheringTemplate;
    expect(saved).toMatchObject({ name: "Gudstjeneste", time: "11:00", durationMinutes: 90, isGudstjeneste: true });
    expect(saved.program).toHaveLength(18);
    expect(saved.program.find((item) => item.title === "Tale / undervisning")?.roleId).toBe("r-3");
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith(expect.stringMatching(/^Standardmalen for gudstjeneste er lagt inn/)));
  });

  test("hver mal står med tid, programpunkter og oppgavene den gir", () => {
    library.templates = [standard];
    show();
    const row = screen.getByRole("heading", { name: "Gudstjeneste" }).closest("li") as HTMLElement;

    expect(row.textContent).toContain("kl. 11:00 · 90 minutter");
    expect(row.textContent).toContain("18 programpunkter");
    expect(row.textContent).toContain("6 oppgaver: Møtevert, Lovsang, Møteleder, Barnekirke, Taler, Forbønn");
  });

  test("«Planlegg serie» åpner skjemaet for et nytt arrangement, fylt ut fra malen og satt til å gjentas", () => {
    library.templates = [standard];
    show();
    fireEvent.click(screen.getByRole("button", { name: "Planlegg serie" }));

    const form = screen.getByRole("dialog", { name: "Nytt arrangement" });
    expect((within(form).getByLabelText("Tittel") as HTMLInputElement).value).toBe("Gudstjeneste");
    expect((within(form).getByLabelText("Starter kl.") as HTMLInputElement).value).toBe("11:00");
    expect((within(form).getByLabelText("Slutter kl. (valgfritt)") as HTMLInputElement).value).toBe("12:30");
    expect((within(form).getByLabelText("Arrangementet gjentas") as HTMLInputElement).checked).toBe(true);
    expect(within(form).getByRole("button", { name: /Gudstjeneste/ }).getAttribute("aria-pressed")).toBe("true");
  });

  test("en mal slettes først etter bekreftelse", async () => {
    library.templates = [standard];
    vi.stubGlobal("confirm", vi.fn(() => false));
    show();
    fireEvent.click(screen.getByRole("button", { name: "Slett malen Gudstjeneste" }));
    expect(service.remove).not.toHaveBeenCalled();

    vi.stubGlobal("confirm", vi.fn(() => true));
    fireEvent.click(screen.getByRole("button", { name: "Slett malen Gudstjeneste" }));
    await waitFor(() => expect(service.remove).toHaveBeenCalledWith("mal-1"));
  });
});

describe("Skjemaet for en mal", () => {
  const onSave = vi.fn(async (_template: GatheringTemplate) => true);
  const onClose = vi.fn();
  const small: GatheringTemplate = {
    ...standard,
    program: standard.program.slice(0, 3),
  };
  const show = (initial: GatheringTemplate = small, withPlanner = true) =>
    render(<TemplateFormDialog isNew={false} initial={initial} groups={groups} roles={roles} withPlanner={withPlanner} onSave={onSave} onClose={onClose} />);
  const save = () => fireEvent.click(screen.getByRole("button", { name: "Lagre mal" }));
  const saved = () => onSave.mock.calls[0][0];

  test("viser programmet med klokkeslett, minutter, tittel og rolle", () => {
    show();
    expect((screen.getByLabelText("Klokkeslett for punkt 1") as HTMLInputElement).value).toBe("10:45");
    expect((screen.getByLabelText("Tittel på punkt 2") as HTMLInputElement).value).toBe("Lovsang x2");
    expect((screen.getByLabelText("Minutter for punkt 2") as HTMLInputElement).value).toBe("7");
    expect((screen.getByLabelText("Rolle for punkt 3") as HTMLSelectElement).selectedOptions[0].textContent).toBe("Møteleder");
  });

  test("et punkt kan få ny tid, ny rolle og ny tittel, og lagres i rekkefølgen klokka gir", async () => {
    show();
    fireEvent.change(screen.getByLabelText("Klokkeslett for punkt 1"), { target: { value: "11:20" } });
    fireEvent.change(screen.getByLabelText("Tittel på punkt 1"), { target: { value: "Vitnesbyrd" } });
    fireEvent.change(screen.getByLabelText("Rolle for punkt 1"), { target: { value: "r-3" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(saved().program.map((item) => `${itemClock("11:00", item)} ${item.title}`)).toEqual(["11:00 Lovsang x2", "11:07 Velkommen. Åpningsord", "11:20 Vitnesbyrd"]);
    expect(saved().program[2]).toMatchObject({ roleId: "r-3", roleName: "Taler" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  test("et nytt punkt kommer etter det siste, og et punkt kan tas bort", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Legg til punkt" }));
    expect((screen.getByLabelText("Klokkeslett for punkt 4") as HTMLInputElement).value).toBe("11:10");
    fireEvent.change(screen.getByLabelText("Tittel på punkt 4"), { target: { value: "Bønn" } });
    fireEvent.click(screen.getByRole("button", { name: "Ta bort punkt 1" }));
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(saved().program.map((item) => item.title)).toEqual(["Lovsang x2", "Velkommen. Åpningsord", "Bønn"]);
  });

  test("to punkter bytter plass og tid når et flyttes", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Flytt punkt 2 ned" }));
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(saved().program.map((item) => `${itemClock("11:00", item)} ${item.title}`)).toEqual(["10:45 Velkommen ved inngang", "11:00 Velkommen. Åpningsord", "11:07 Lovsang x2"]);
  });

  test("oppgavene følger programmet, og en ekstra vakt kan legges til med antall", async () => {
    show();
    const staffing = screen.getByRole("region", { name: "Oppgaver som skal bemannes" });
    expect(within(staffing).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["MøtevertFra programmet1 person", "LovsangFra programmet1 person", "MøtelederFra programmet1 person"]);

    fireEvent.change(within(staffing).getByLabelText(/Legg til en vakt/), { target: { value: "r-4" } });
    fireEvent.change(within(staffing).getByLabelText("Antall på Rigging"), { target: { value: "3" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(saved().extraStaffing).toEqual([expect.objectContaining({ roleId: "r-4", roleName: "Rigging", neededCount: 3 })]);
  });

  test("en mal uten navn, og et punkt uten tittel, lagres ikke", () => {
    show({ ...small, name: " " });
    save();
    expect(screen.getByRole("alert").textContent).toBe("Malen må ha et navn.");
    cleanup();

    show();
    fireEvent.click(screen.getByRole("button", { name: "Legg til punkt" }));
    save();
    expect(screen.getByRole("alert").textContent).toBe("Hvert punkt i programmet må ha en tittel. Ta bort de tomme.");
    expect(onSave).not.toHaveBeenCalled();
  });

  test("uten planleggeren har malen verken program eller oppgaver", () => {
    show(small, false);
    expect(screen.queryByRole("region", { name: "Program" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Oppgaver som skal bemannes" })).toBeNull();
    expect(screen.queryByLabelText("Ansvarlig gruppe")).toBeNull();
    expect(screen.getByLabelText("Navn på malen")).toBeTruthy();
  });
});

describe("Dagene i en serie, og det som er igjen av den", () => {
  test("et arrangement over flere dager slutter like mange dager etter starten på hver dag i serien", () => {
    const camp = newGatheringForm({ title: "Leir", date: "2026-10-16", endDate: "2026-10-18", endTime: "14:00" });
    expect(onDay(camp, "2026-11-13")).toMatchObject({ date: "2026-11-13", endDate: "2026-11-15", endTime: "14:00" });
    expect(onDay(newGatheringForm({ date: "2026-10-18" }), "2026-10-25")).toMatchObject({ date: "2026-10-25", endDate: "" });
  });

  test("resten av en serie er arrangementet det pekes på og de etter, og de noen har svart på, står", () => {
    const event = (id: string, day: string, seriesId?: string) => ({ id, seriesId, startsAt: `${day}T09:00:00.000Z` });
    const events = [event("a", "2026-10-18", "s1"), event("b", "2026-10-25", "s1"), event("c", "2026-11-01", "s1"), event("x", "2026-11-01", "s2"), event("y", "2026-11-08")];

    const rest = restOfSeries(events, events[1], (candidate) => candidate.id === "c");
    expect(rest.remove.map((candidate) => candidate.id)).toEqual(["b"]);
    expect(rest.kept.map((candidate) => candidate.id)).toEqual(["c"]);
    // An event that is not part of a series has no rest
    expect(restOfSeries(events, events[4], () => false)).toEqual({ remove: [], kept: [] });
  });
});
