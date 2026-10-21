// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildChurchAnalytics, type AnalyticsPeriodId, type ChurchData } from "../src/utils/churchAnalytics";
import type { Gathering } from "../src/types";

const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
const service = (id: string, startsAt: string, title = "Gudstjeneste"): Gathering => ({
  id,
  groupId: "g-team",
  title,
  startsAt,
  type: "arrangement",
  visibility: "offentlig",
  isGudstjeneste: true,
});

const data: ChurchData = {
  persons: [
    { id: "p1", name: "Anne Admin", globalRole: "admin" },
    { id: "p2", name: "Bjørn Bærer", globalRole: "member" },
    { id: "p3", name: "Frode Utenfor", globalRole: "member" },
  ],
  groups: [{ id: "g-team", name: "Søndagsteam", category: "tjenestegruppe", memberIds: ["p2"], leaderIds: ["p1"] }],
  gatherings: [service("w1", daysAgo(14), "Høstgudstjeneste"), service("w2", daysAgo(7), "Familiegudstjeneste")],
  tasks: [{ id: "t1", gatheringId: "w1", title: "Lyd", status: "confirmed", neededCount: 1 }],
  assignments: [{ id: "a1", taskId: "t1", personId: "p2", response: "confirmed" }],
  attendances: [],
  headcounts: [{ id: "headcount-w1", gatheringId: "w1", adults: 80, children: 20, registeredAt: daysAgo(14) }],
  messages: [],
  volunteerRoles: [],
  pages: [],
  news: [],
  sermons: [],
};

const registerHeadcount = vi.fn(() => ({ success: true }));
const removeHeadcount = vi.fn(() => ({ success: true }));
const setModuleHidden = vi.fn((_id: string, _hidden: boolean) => ({ success: true }));
const showAllModules = vi.fn(() => ({ success: true }));
const requestedPeriods: AnalyticsPeriodId[] = [];
let hiddenModules: string[] = [];
let canCustomize = true;
let websiteVisits: "counted" | "paused" | "off" = "counted";

vi.mock("../src/hooks/useAppHooks", () => ({
  useAdminAnalytics: (periodId: AnalyticsPeriodId) => {
    requestedPeriods.push(periodId);
    return {
      analytics: buildChurchAnalytics({ ...data, websiteVisits }, periodId, now),
      websiteVisits,
      registerHeadcount,
      removeHeadcount,
      hiddenModules,
      canCustomize,
      setModuleHidden,
      showAllModules,
    };
  },
}));

import { AnalyticsTab } from "../src/pages/admin/tabs/AnalyticsTab";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  hiddenModules = [];
  canCustomize = true;
  websiteVisits = "counted";
});

function renderTab() {
  const showFeedback = vi.fn();
  const onTabChange = vi.fn();
  render(
    <MemoryRouter>
      <AnalyticsTab showFeedback={showFeedback} onTabChange={onTabChange} />
    </MemoryRouter>
  );
  return { showFeedback, onTabChange };
}

describe("Analysebord", () => {
  test("viser nøkkeltallene for perioden", () => {
    renderTab();
    expect(screen.getByRole("heading", { name: "Analysebord" })).toBeTruthy();
    expect(screen.getByText("Talt på 1 av 2 gudstjenester")).toBeTruthy();
    expect(screen.getByText("1 av 1 plasser bekreftet")).toBeTruthy();
    expect(screen.getByText("2 personer i minst én gruppe, 1 uten")).toBeTruthy();
  });

  test("lister samlinger som mangler oppmøtetall, og lagrer en ny telling", () => {
    const { showFeedback } = renderTab();
    expect(screen.getByText("Mangler oppmøtetall: 1 samling")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Registrer$/ }));

    const dialog = screen.getByRole("dialog", { name: "Registrer oppmøtetall" });
    expect(within(dialog).getByText(/Familiegudstjeneste/)).toBeTruthy();

    // Nobody counted is refused, and nothing is stored
    fireEvent.click(within(dialog).getByRole("button", { name: "Lagre oppmøtetall" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Skriv inn hvor mange som var til stede.");
    expect(registerHeadcount).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Voksne"), { target: { value: "72" } });
    fireEvent.change(within(dialog).getByLabelText("Barn"), { target: { value: "15" } });
    expect(within(dialog).getByText("87")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Lagre oppmøtetall" }));

    expect(registerHeadcount).toHaveBeenCalledWith("w2", { adults: 72, children: 15 });
    expect(showFeedback).toHaveBeenCalledWith("Oppmøtetallet for «Familiegudstjeneste» er lagret.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("en registrert telling kan rettes eller fjernes fra diagrammet", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Høstgudstjeneste .*: 100 til stede/ }));
    const dialog = screen.getByRole("dialog", { name: "Endre oppmøtetall" });
    expect((within(dialog).getByLabelText("Voksne") as HTMLInputElement).value).toBe("80");
    fireEvent.click(within(dialog).getByRole("button", { name: "Fjern tellingen" }));
    expect(removeHeadcount).toHaveBeenCalledWith("w1");
  });

  test("tabellvisningen viser tallene uten diagram", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Vis som tabell" }));
    const table = screen.getByRole("table", { name: "Oppmøte per samling" });
    expect(within(table).getByText("Ikke registrert")).toBeTruthy();
    expect(within(table).getByText("100")).toBeTruthy();
  });

  test("perioden kan byttes", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Siste 12 måneder" }));
    expect(requestedPeriods[requestedPeriods.length - 1]).toBe("12m");
    expect(screen.getByRole("button", { name: "Siste 12 måneder" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("bordet kan se framover, med de samme boksene som bakover, bortsett fra oppmøte", () => {
    renderTab();
    const headings = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    const back = headings();
    const ahead = screen.getByRole("group", { name: "Periode framover" });
    expect(within(ahead).getAllByRole("button").map((button) => button.textContent)).toEqual(["Neste 4 uker", "Neste 3 måneder", "Neste halvår"]);
    expect(within(screen.getByRole("group", { name: "Periode bakover" })).getAllByRole("button")).toHaveLength(3);

    fireEvent.click(within(ahead).getByRole("button", { name: "Neste 3 måneder" }));
    expect(requestedPeriods[requestedPeriods.length - 1]).toBe("next3m");
    expect(screen.getByText(/Det som er planlagt: bemanningen på arrangementene som kommer/)).toBeTruthy();
    // Every box that is there looking back, is there looking ahead, except attendance
    expect(back).toContain("Oppmøte");
    expect(headings()).toEqual(back.filter((title) => title !== "Oppmøte"));
    expect(screen.getByText(/Oppmøte vises ikke framover: det telles når samlingene er holdt/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vis som tabell" })).toBeNull();
    // The words are of what is planned, and nothing is compared with a period before
    expect(screen.getByText(/oppgaver de har sagt ja til i perioden som kommer/)).toBeTruthy();
    expect(screen.getByText(/Oppgavene på arrangementene som kommer i perioden/)).toBeTruthy();
    expect(screen.getByText("Oppmøte telles når gudstjenestene er holdt")).toBeTruthy();
    expect(screen.queryByText(/fra forrige/)).toBeNull();

    // And back again
    fireEvent.click(screen.getByRole("button", { name: "Siste 3 måneder" }));
    expect(headings()).toEqual(back);
  });

  test("en boks som er skjult under «Tilpass bordet», er skjult begge veier", () => {
    hiddenModules = ["grupper"];
    renderTab();
    expect(screen.queryByRole("heading", { name: "Grupper og fellesskap" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Neste 4 uker" }));
    expect(screen.queryByRole("heading", { name: "Grupper og fellesskap" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Frivillighet og bemanning" })).toBeTruthy();
  });

  test("de nye modulene vises: bemanning per arrangement, flere oppgaver, per måned og hver enkelt", () => {
    renderTab();
    expect(screen.getByRole("heading", { name: "Bemanning per arrangement" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Flere oppgaver på samme samling" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Oppgaver og aktiviteter per måned" })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Oppgaver og grupper per person" });
    expect(within(table).getByText("Bjørn Bærer")).toBeTruthy();
  });

  test("en modul kan skjules fra kortet, og valget lagres", () => {
    const { showFeedback } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Skjul Oppmøte" }));
    expect(setModuleHidden).toHaveBeenCalledWith("oppmote", true);
    expect(showFeedback).toHaveBeenCalledWith("«Oppmøte» er skjult. Du får den tilbake under Tilpass bordet.");
  });

  test("en skjult modul vises ikke, og bordet sier at noe er skjult", () => {
    hiddenModules = ["oppmote", "hver-enkelt", "modul-som-ikke-finnes"];
    renderTab();
    expect(screen.queryByRole("heading", { name: "Oppmøte" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Hver enkelt" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Frivillighet og bemanning" })).toBeTruthy();
    expect(screen.getByText(/2 moduler er skjult/)).toBeTruthy();
  });

  test("Tilpass bordet slår moduler av og på, og viser alle igjen", () => {
    hiddenModules = ["grupper"];
    renderTab();
    // One in the heading, one in the note at the bottom that says something is hidden
    const openButtons = screen.getAllByRole("button", { name: "Tilpass bordet" });
    expect(openButtons).toHaveLength(2);
    fireEvent.click(openButtons[0]);
    const dialog = screen.getByRole("dialog", { name: "Tilpass bordet" });
    const groups = within(dialog).getByLabelText(/Grupper og fellesskap/) as HTMLInputElement;
    expect(groups.checked).toBe(false);
    fireEvent.click(groups);
    expect(setModuleHidden).toHaveBeenCalledWith("grupper", false);
    fireEvent.click(within(dialog).getByLabelText(/Nøkkeltall/));
    expect(setModuleHidden).toHaveBeenCalledWith("nokkeltall", true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Vis alle" }));
    expect(showAllModules).toHaveBeenCalled();
  });

  test("uten en aktiv bruker i personregisteret kan ingenting skjules, så ingen får en falsk bekreftelse", () => {
    canCustomize = false;
    renderTab();
    expect(screen.queryByRole("button", { name: /^Skjul / })).toBeNull();
    expect((screen.getByRole("button", { name: "Tilpass bordet" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("etter at en modul er skjult, står fokus på Tilpass bordet", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Skjul Oppmøte" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tilpass bordet" }));
  });

  test("datagrunnlaget sier hva som ikke er målt, og lenker ikke til testdata utenfor demo", () => {
    const { onTabChange } = renderTab();
    // Visits are counted, on a board of their own, and the board says so in both places
    expect(screen.getAllByText(/Besøk på nettsiden telles anonymt/).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Se besøk på nettsiden" }));
    expect(onTabChange).toHaveBeenCalledWith("nettsidebesok");
    // Simulated history is offered in a demo only (tests/no-testdata-in-production.test.tsx)
    expect(screen.queryByRole("button", { name: "Database og Testdata" })).toBeNull();
  });

  test("er modulen for besøk ikke slått på, sier bordet det og viser veien til Moduler", () => {
    websiteVisits = "off";
    const { onTabChange } = renderTab();

    expect(screen.queryByText(/telles anonymt/)).toBeNull();
    expect(screen.getAllByText(/Besøk på nettsiden telles ikke/).length).toBe(2);
    // The board over the visits is not there to open while its module is off
    expect(screen.queryByRole("button", { name: "Se besøk på nettsiden" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Åpne Moduler" }));
    expect(onTabChange).toHaveBeenCalledWith("moduler");
  });

  test("er tellingen satt på vent, sier bordet det og leder til bordet der den slås på igjen", () => {
    websiteVisits = "paused";
    const { onTabChange } = renderTab();

    expect(screen.queryByText(/telles anonymt/)).toBeNull();
    expect(screen.getAllByText(/Tellingen av besøk på nettsiden er slått av/).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Se besøk på nettsiden" }));
    expect(onTabChange).toHaveBeenCalledWith("nettsidebesok");
  });
});
