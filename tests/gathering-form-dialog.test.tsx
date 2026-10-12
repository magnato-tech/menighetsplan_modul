// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The quick form for a new event leads on to the full one, and the full one is also the form an
// event is changed in. A template and a series are mock-ups for now, and say so.

const { installation } = vi.hoisted(() => ({ installation: { demo: null as null | Record<string, string> } }));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));

import { GatheringFormDialog } from "../src/components/gathering/GatheringFormDialog";
import { GatheringsTab } from "../src/pages/admin/tabs/GatheringsTab";
import type { StudioData } from "../src/pages/admin/studio";
import { chooseDemoLevel, forgetDemoLevel } from "../src/services/demoLevel";
import { combineDateAndTimeToIso } from "../src/utils/dates";
import { newGatheringForm, type GatheringFormValues } from "../src/utils/gatheringForm";

const groups = [
  { id: "lovsang", name: "Lovsang", memberIds: ["p1"], leaderIds: ["p2"] },
  { id: "kalender", name: "Kalender", memberIds: [], leaderIds: [] },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  forgetDemoLevel();
  installation.demo = null;
});

describe("Det store skjemaet for et nytt arrangement", () => {
  const onSave = vi.fn((_values: GatheringFormValues) => ({ success: true }) as { success: boolean; error?: string });
  const onClose = vi.fn();
  const show = (start: Partial<GatheringFormValues> = {}, showGroup = true) =>
    render(<GatheringFormDialog isNew initial={newGatheringForm({ groupId: "lovsang", ...start })} groups={groups} showGroup={showGroup} onSave={onSave} onClose={onClose} />);
  const write = (name: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
  const save = () => fireEvent.click(screen.getByRole("button", { name: "Opprett arrangement" }));

  test("har alle feltene, og lagrer det som er fylt ut", () => {
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

    expect(onSave).toHaveBeenCalledWith({
      title: "Høstfest",
      date: "2026-10-18",
      time: "17:00",
      endDate: "",
      endTime: "20:00",
      location: "Storsalen",
      groupId: "kalender",
      isGudstjeneste: false,
      theme: "Takk",
      bibleText: "Sal 100",
      visibility: "fremhevet",
      cancelled: false,
      imageUrl: "",
      imageAlt: "",
      summary: "",
      content: "",
      linkUrl: "",
      linkLabel: "",
    });
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

  test("delen om nettsiden står sammenfoldet når den er tom, så skjemaet ikke er lengre enn det må", () => {
    show();
    const section = screen.getByRole("region", { name: "På nettsiden" });
    expect(within(section).getByRole("button", { name: "Legg til bilde og tekst" })).toBeTruthy();
    expect(screen.queryByLabelText("Ingress")).toBeNull();
  });

  test("et arrangement kan ikke avlyses før det finnes", () => {
    show();
    expect(screen.queryByLabelText("Arrangementet er avlyst")).toBeNull();
  });

  test("uten planleggeren velges ingen gruppe", () => {
    show({}, false);
    expect(screen.queryByLabelText("Ansvarlig gruppe")).toBeNull();
  });

  test("en mal er merket som prøveutgave, og fyller inn tittel og klokkeslett", () => {
    show({ date: "2026-10-18" });
    const section = screen.getByRole("region", { name: /Start fra en mal/ });
    expect(within(section).getByText("Prøveutgave")).toBeTruthy();

    fireEvent.click(within(section).getByRole("button", { name: /Kulturkveld/ }));
    expect((screen.getByLabelText("Tittel") as HTMLInputElement).value).toBe("Kulturkveld");
    expect((screen.getByLabelText("Starter kl.") as HTMLInputElement).value).toBe("18:00");
    expect((screen.getByLabelText("Slutter kl. (valgfritt)") as HTMLInputElement).value).toBe("21:00");
    expect((screen.getByLabelText("Dette er en gudstjeneste") as HTMLInputElement).checked).toBe(false);
    expect(within(section).getByRole("button", { name: /Kulturkveld/ }).getAttribute("aria-pressed")).toBe("true");
  });

  test("en serie er merket som prøveutgave, viser dagene, og sier at bare det første arrangementet opprettes", () => {
    show({ title: "Gudstjeneste", date: "2026-10-18" });
    const section = screen.getByRole("region", { name: /Gjenta som serie/ });
    expect(within(section).getByText("Prøveutgave")).toBeTruthy();
    expect(within(section).queryByLabelText("Hvor ofte")).toBeNull();

    fireEvent.click(within(section).getByLabelText("Arrangementet gjentas"));
    write("Hvor ofte", "every2");
    write("Siste dato", "2026-11-15");

    expect(within(section).getByText("Serien gir 3 arrangementer:")).toBeTruthy();
    expect(within(section).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["søndag 18. oktober", "søndag 1. november", "søndag 15. november"]);
    expect(within(section).getByText("Serier er ikke bygget ennå. Når du lagrer, opprettes bare det første arrangementet.")).toBeTruthy();

    save();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: "Gudstjeneste", date: "2026-10-18" });
  });
});

describe("Det store skjemaet for et arrangement som finnes", () => {
  test("har ikke mal og serie, men kan avlyse", () => {
    const onSave = vi.fn((_values: GatheringFormValues) => ({ success: true }));
    render(
      <GatheringFormDialog
        isNew={false}
        initial={newGatheringForm({ title: "Høstfest", date: "2026-10-18", groupId: "lovsang" })}
        groups={groups}
        showGroup
        onSave={onSave}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "Rediger arrangement" })).toBeTruthy();
    expect(screen.queryByText("Prøveutgave")).toBeNull();
    expect(screen.queryByRole("region", { name: /Gjenta som serie/ })).toBeNull();

    fireEvent.click(screen.getByLabelText("Arrangementet er avlyst"));
    fireEvent.click(screen.getByRole("button", { name: "Lagre endringer" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: "Høstfest", cancelled: true });
  });
});

describe("«Flere valg» i det raske skjemaet", () => {
  const createGathering = vi.fn((_data: unknown) => ({ success: true, gathering: { id: "ny" } }));
  const studio = {
    adminGatherings: [],
    adminGroups: groups.map((group) => ({ group })),
    createGathering,
    createTask: vi.fn(),
  } as unknown as StudioData;
  const showFeedback = vi.fn();
  const show = () =>
    render(
      <MemoryRouter>
        <GatheringsTab studio={studio} showFeedback={showFeedback} />
      </MemoryRouter>
    );

  test("åpner det store skjemaet med det som er skrevet, og oppretter arrangementet derfra", () => {
    show();
    fireEvent.change(screen.getByPlaceholderText("Tittel, f.eks. Søndagsgudstjeneste & dåp"), { target: { value: "Høstfest" } });
    fireEvent.change(screen.getByPlaceholderText("Valgfritt tema..."), { target: { value: "Takk" } });
    fireEvent.click(screen.getByRole("button", { name: "Flere valg" }));

    const form = screen.getByRole("dialog", { name: "Nytt arrangement" });
    expect((within(form).getByLabelText("Tittel") as HTMLInputElement).value).toBe("Høstfest");
    expect((within(form).getByLabelText("Tema (valgfritt)") as HTMLInputElement).value).toBe("Takk");
    expect((within(form).getByLabelText("Ansvarlig gruppe") as HTMLSelectElement).value).toBe("lovsang");

    fireEvent.change(within(form).getByLabelText("Dato"), { target: { value: "2026-10-18" } });
    fireEvent.change(within(form).getByLabelText("Sted"), { target: { value: "Storsalen" } });
    fireEvent.click(within(form).getByRole("button", { name: "Opprett arrangement" }));

    expect(createGathering).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Høstfest", theme: "Takk", location: "Storsalen", groupId: "lovsang", startsAt: combineDateAndTimeToIso("2026-10-18", "11:00"), visibility: "offentlig" })
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(showFeedback).toHaveBeenCalledWith("Nytt arrangement opprettet og lagt i kalenderen!");
    // The quick form is empty again
    expect((screen.getByPlaceholderText("Tittel, f.eks. Søndagsgudstjeneste & dåp") as HTMLInputElement).value).toBe("");
  });

  test("det raske skjemaet lagrer fortsatt med én gang", () => {
    show();
    fireEvent.change(screen.getByPlaceholderText("Tittel, f.eks. Søndagsgudstjeneste & dåp"), { target: { value: "Gudstjeneste" } });
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2026-10-18" } });
    fireEvent.click(screen.getByRole("button", { name: "Legg til i planleggeren" }));

    expect(createGathering).toHaveBeenCalledWith(expect.objectContaining({ title: "Gudstjeneste", groupId: "lovsang" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("uten planleggeren spør ingen av skjemaene etter gruppe, og arrangementet går til gruppen som holder kalenderen", () => {
    installation.demo = {};
    chooseDemoLevel("plattform");
    show();

    expect(screen.queryByLabelText("Ansvarlig gruppe")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Tittel, f.eks. Søndagsgudstjeneste & dåp"), { target: { value: "Høstfest" } });
    fireEvent.click(screen.getByRole("button", { name: "Flere valg" }));
    const form = screen.getByRole("dialog", { name: "Nytt arrangement" });
    expect(within(form).queryByLabelText("Ansvarlig gruppe")).toBeNull();

    fireEvent.change(within(form).getByLabelText("Dato"), { target: { value: "2026-10-18" } });
    fireEvent.click(within(form).getByRole("button", { name: "Opprett arrangement" }));
    expect(createGathering).toHaveBeenCalledWith(expect.objectContaining({ title: "Høstfest", groupId: "kalender" }));
  });
});
