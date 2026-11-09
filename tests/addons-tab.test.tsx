// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { cms } = vi.hoisted(() => ({
  cms: {
    addons: {} as { analysebord?: boolean; nettsidebesok?: boolean },
    addonsState: "ready" as "loading" | "ready" | "failed",
    setAddon: vi.fn(async (_id: string, _on: boolean) => true),
    minSideModules: {} as Record<string, boolean>,
    setMinSideModule: vi.fn(async (_id: string, _on: boolean) => true),
  },
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));

import { AddonsTab } from "../src/pages/admin/tabs/AddonsTab";

const showFeedback = vi.fn();
const onTabChange = vi.fn();
const renderTab = () => render(<AddonsTab showFeedback={showFeedback} onTabChange={onTabChange} />);
/** The card of one module part, found by its name. */
const card = (name: string) => within(screen.getByRole("article", { name }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  cms.addons = {};
  cms.addonsState = "ready";
  cms.minSideModules = {};
  cms.setAddon.mockImplementation(async () => true);
  cms.setMinSideModule.mockImplementation(async () => true);
});

describe("Siden Moduler", () => {
  test("hver del av Analyse har sitt kort med bryter, og ingen er på før den er valgt", () => {
    renderTab();

    expect(screen.getByRole("heading", { name: "Moduler" })).toBeTruthy();
    expect(screen.getByText("0 av 2 er på")).toBeTruthy();
    const analyse = within(screen.getByRole("region", { name: "Analyse" }));
    expect(analyse.getAllByRole("article")).toHaveLength(2);

    for (const name of ["Analysebord", "Besøk på nettsiden"]) {
      const part = card(name);
      expect(part.getByRole("switch", { name }).getAttribute("aria-checked")).toBe("false");
      expect(part.getByText("Av")).toBeTruthy();
      // Off, there is nothing to open, and the card says what being off means
      expect(part.queryByRole("button", { name: /Åpne/ })).toBeNull();
      expect(part.getByText(/^Av: /)).toBeTruthy();
    }
    expect(card("Besøk på nettsiden").getByText("Av: nettsiden teller ingen besøk. Tall som alt er telt, blir stående.")).toBeTruthy();
  });

  test("bryteren slår på den ene delen, og sier hvor den havnet", async () => {
    renderTab();
    fireEvent.click(card("Analysebord").getByRole("switch", { name: "Analysebord" }));

    expect(cms.setAddon).toHaveBeenCalledTimes(1);
    expect(cms.setAddon).toHaveBeenCalledWith("analysebord", true);
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("«Analysebord» er slått på. Du finner den i menyen under Analyse."));
  });

  test("en del som er på, kan åpnes fra kortet og slås av igjen uten at noe slettes", async () => {
    cms.addons = { nettsidebesok: true };
    renderTab();

    expect(screen.getByText("1 av 2 er på")).toBeTruthy();
    const visits = card("Besøk på nettsiden");
    expect(visits.getByRole("switch", { name: "Besøk på nettsiden" }).getAttribute("aria-checked")).toBe("true");
    expect(visits.getByText("På: ligger i menyen under Analyse.")).toBeTruthy();
    fireEvent.click(visits.getByRole("button", { name: "Åpne Besøk på nettsiden" }));
    expect(onTabChange).toHaveBeenCalledWith("nettsidebesok");
    // The other part is as it was
    expect(card("Analysebord").queryByRole("button", { name: /Åpne/ })).toBeNull();

    fireEvent.click(visits.getByRole("switch", { name: "Besøk på nettsiden" }));
    expect(cms.setAddon).toHaveBeenCalledWith("nettsidebesok", false);
    await waitFor(() =>
      expect(showFeedback).toHaveBeenCalledWith("«Besøk på nettsiden» er slått av og tatt ut av menyen. Ingenting er slettet.")
    );
  });

  test("mens valget lagres, venter bryteren, og et valg som ikke ble lagret, gir ingen melding om at det gikk", async () => {
    let finish: (saved: boolean) => void = () => {};
    cms.setAddon.mockImplementation(() => new Promise<boolean>((resolve) => (finish = resolve)));
    renderTab();

    const toggle = card("Analysebord").getByRole("switch", { name: "Analysebord" }) as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(toggle.disabled).toBe(true);
    // The other switch is not held back by this one
    expect((card("Besøk på nettsiden").getByRole("switch", { name: "Besøk på nettsiden" }) as HTMLButtonElement).disabled).toBe(false);

    finish(false);
    await waitFor(() => expect(toggle.disabled).toBe(false));
    expect(showFeedback).not.toHaveBeenCalled();
  });

  test("før databasen har svart, vises ingen brytere, og kan den ikke spørres, sies det", () => {
    cms.addonsState = "loading";
    const { unmount } = renderTab();
    expect(screen.getByText("Henter modulene …")).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Analysebord" })).toBeNull();
    unmount();

    cms.addonsState = "failed";
    renderTab();
    expect(screen.getByRole("alert").textContent).toContain("Det kunne ikke hentes hvilke moduler som er slått på");
    expect(screen.queryByRole("switch", { name: "Analysebord" })).toBeNull();
  });

  test("modulene som ikke er laget, står som navn uten bryter", () => {
    renderTab();

    const planned = within(screen.getByRole("region", { name: "Planlagte moduler" }));
    expect(planned.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Givertjeneste",
      "Utleie",
      "Arrangement",
      "Kommunikasjon",
      "Skjemaer",
      "AI-assistent",
    ]);
    expect(planned.queryByRole("switch")).toBeNull();
    expect(planned.getByText(/Ikke laget ennå/)).toBeTruthy();
    expect(screen.queryByText(/Regnskap/)).toBeNull();
  });

  test("Min side-modulene er alle på til de slås av, og står ikke under arbeid lenger", () => {
    renderTab();

    expect(screen.queryByRole("region", { name: "Moduler under arbeid" })).toBeNull();
    const minSide = within(screen.getByRole("region", { name: "Min side" }));
    for (const name of ["Grupper", "Gruppechat", "Husfellesskap", "Tjeneste og bemanning", "Semesterplan", "Kalender"]) {
      expect(minSide.getByRole("switch", { name }).getAttribute("aria-checked")).toBe("true");
    }
    // The count of add-ons is not changed by them
    expect(screen.getByText("0 av 2 er på")).toBeTruthy();
  });

  test("slår en Min side-modul av, og en modul som krever Grupper er låst mens Grupper er av", async () => {
    cms.minSideModules = { grupper: false };
    renderTab();

    const minSide = within(screen.getByRole("region", { name: "Min side" }));
    // Gruppechat and Husfellesskap are off with their group, and cannot be switched while it is
    const chat = minSide.getByRole("switch", { name: "Gruppechat" }) as HTMLButtonElement;
    expect(chat.disabled).toBe(true);
    expect(chat.getAttribute("aria-checked")).toBe("false");
    expect(minSide.getAllByText("Krever Grupper")).toHaveLength(2);

    fireEvent.click(minSide.getByRole("switch", { name: "Grupper" }));
    expect(cms.setMinSideModule).toHaveBeenCalledWith("grupper", true);
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("«Grupper» er slått på."));
  });

  test("en Min side-modul som slås av, sier at ingenting er slettet", async () => {
    renderTab();
    fireEvent.click(within(screen.getByRole("region", { name: "Min side" })).getByRole("switch", { name: "Kalender" }));

    expect(cms.setMinSideModule).toHaveBeenCalledWith("kalender", false);
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("«Kalender» er slått av. Ingenting er slettet."));
  });
});
