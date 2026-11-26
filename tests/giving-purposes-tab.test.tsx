// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { GivingPurpose } from "../src/utils/giving/purposes";
import { isTabInDemo } from "../src/pages/admin/demoTabs";
import { webEditorMayOpen } from "../src/pages/admin/webEditor";
import { membershipClerkMayOpen } from "../src/pages/admin/membershipClerk";
import { GivingPurposesTab } from "../src/pages/admin/tabs/GivingPurposesTab";
import { createGivingPurpose, renameGivingPurpose, setGivingPurposeActive } from "../src/services/giving/purposes";
import { reportWriteError } from "../src/services/writeErrors";

// The page for the gift purposes, with the service mocked: nothing is sent to a database.
// Everything here is made up.

const service = vi.hoisted(() => ({
  purposes: [] as GivingPurpose[],
  /** Read but not answered yet */
  pending: false,
  /** Set to make the reading fail */
  error: null as unknown,
}));

vi.mock("../src/services/giving/purposes", () => ({
  subscribeGivingPurposes: (onChange: (purposes: GivingPurpose[]) => void, onError: (error: unknown) => void) => {
    if (service.error) onError(service.error);
    else if (!service.pending) onChange(service.purposes);
    return () => undefined;
  },
  createGivingPurpose: vi.fn(async (_purpose: GivingPurpose) => undefined),
  renameGivingPurpose: vi.fn(async (_id: string, _name: string, _personId: string) => undefined),
  setGivingPurposeActive: vi.fn(async (_id: string, _active: boolean, _personId: string) => undefined),
}));
vi.mock("../src/services/writeErrors", () => ({ reportWriteError: vi.fn() }));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ currentUser: { id: "kari", name: "Kari Nordmann", globalRole: "admin" } }),
}));

const showFeedback = vi.fn();
const renderTab = () => render(<GivingPurposesTab showFeedback={showFeedback} />);

const purpose = (id: string, name: string, usage: GivingPurpose["usage"], active = true): GivingPurpose => ({
  id,
  name,
  usage,
  active,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  updatedBy: "kari",
});

const nameInput = () => screen.getByLabelText("Navn") as HTMLInputElement;
const addButton = () => screen.getByRole("button", { name: "Legg til" }) as HTMLButtonElement;
/** The row of one purpose, found by its name. */
const row = (name: string) => within(screen.getByText(name, { selector: "p" }).closest("li") as HTMLElement);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  service.purposes = [];
  service.pending = false;
  service.error = null;
});

describe("Skjemaet for nytt gaveformål", () => {
  test("ingenting er valgt fra start: ingen type, og navnet er tomt", () => {
    renderTab();

    expect(nameInput().value).toBe("");
    expect((screen.getByRole("radio", { name: "Ordinær drift" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("radio", { name: "Øremerket" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Typen kan ikke endres etterpå.")).toBeTruthy();
    expect(screen.getByText("Ingen gaveformål ennå.")).toBeTruthy();
  });

  test("hver feil sies med sine ord, i den rekkefølgen de sjekkes", () => {
    service.purposes = [purpose("p1", "Orgel", "drift")];
    renderTab();

    fireEvent.click(addButton());
    expect(screen.getByRole("alert").textContent).toBe("Skriv et navn.");

    fireEvent.change(nameInput(), { target: { value: "Diakoni" } });
    fireEvent.click(addButton());
    expect(screen.getByRole("alert").textContent).toBe("Velg om formålet er ordinær drift eller øremerket.");

    fireEvent.change(nameInput(), { target: { value: "  orgel " } });
    fireEvent.click(screen.getByRole("radio", { name: "Ordinær drift" }));
    fireEvent.click(addButton());
    expect(screen.getByRole("alert").textContent).toBe("Det finnes allerede et gaveformål med dette navnet.");

    fireEvent.change(nameInput(), { target: { value: "a".repeat(81) } });
    fireEvent.click(addButton());
    expect(screen.getByRole("alert").textContent).toBe("Navnet kan ha høyst 80 tegn.");

    expect(createGivingPurpose).not.toHaveBeenCalled();
  });

  test("et gyldig skjema lagrer formålet med riktige data, og tømmes", async () => {
    service.purposes = [];
    renderTab();

    fireEvent.change(nameInput(), { target: { value: "  Diakoni  " } });
    fireEvent.click(screen.getByRole("radio", { name: "Øremerket" }));
    fireEvent.click(addButton());

    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("«Diakoni» er lagt til."));
    expect(createGivingPurpose).toHaveBeenCalledTimes(1);
    expect(createGivingPurpose).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Diakoni", usage: "oremerket", active: true, updatedBy: "kari" })
    );
    expect(nameInput().value).toBe("");
    expect((screen.getByRole("radio", { name: "Øremerket" }) as HTMLInputElement).checked).toBe(false);
  });

  test("ved en feilet lagring står skjemaet ved det som ble skrevet, og feilen meldes", async () => {
    vi.mocked(createGivingPurpose).mockRejectedValueOnce(new Error("Nettet svarte ikke"));
    renderTab();

    fireEvent.change(nameInput(), { target: { value: "Diakoni" } });
    fireEvent.click(screen.getByRole("radio", { name: "Ordinær drift" }));
    fireEvent.click(addButton());

    await waitFor(() => expect(reportWriteError).toHaveBeenCalledWith("lagre gaveformålet", expect.any(Error)));
    expect(nameInput().value).toBe("Diakoni");
    expect(showFeedback).not.toHaveBeenCalled();
  });

  test("mens en lagring er på vei, er knappen låst", () => {
    vi.mocked(createGivingPurpose).mockImplementationOnce(() => new Promise<void>(() => undefined));
    renderTab();

    fireEvent.change(nameInput(), { target: { value: "Diakoni" } });
    fireEvent.click(screen.getByRole("radio", { name: "Ordinær drift" }));
    fireEvent.click(addButton());

    expect(addButton().disabled).toBe(true);
    fireEvent.click(addButton());
    expect(createGivingPurpose).toHaveBeenCalledTimes(1);
  });
});

describe("Listen", () => {
  test("i bruk først, så etter navn, og ute av bruk står det", () => {
    service.purposes = [purpose("p1", "Zebra", "drift", false), purpose("p2", "Orgel", "oremerket"), purpose("p3", "Diakoni", "drift")];
    renderTab();

    const names = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(names[0].startsWith("Diakoni")).toBe(true);
    expect(names[1].startsWith("Orgel")).toBe(true);
    expect(names[2].startsWith("Zebra")).toBe(true);
    expect(names[1]).toContain("Øremerket");
    expect(names[2]).toContain("Ute av bruk");
    expect(names[0]).not.toContain("Ute av bruk");
  });

  test("ingen knapp sletter et formål", () => {
    service.purposes = [purpose("p1", "Orgel", "drift")];
    renderTab();

    expect(screen.queryByRole("button", { name: /slett|fjern/i })).toBeNull();
    expect(within(screen.getByRole("list")).getByText("Orgel")).toBeTruthy();
  });
});

describe("Endre navn", () => {
  test("raden blir et felt med Lagre og Avbryt, og navnet lagres med den som endrer", async () => {
    service.purposes = [purpose("p1", "Orgel", "drift")];
    renderTab();

    fireEvent.click(row("Orgel").getByRole("button", { name: "Endre navn" }));
    const field = screen.getByRole("textbox", { name: "Nytt navn for Orgel" }) as HTMLInputElement;
    expect(field.value).toBe("Orgel");
    fireEvent.change(field, { target: { value: "Orgelfond" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));

    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("Navnet er endret til «Orgelfond»."));
    expect(renameGivingPurpose).toHaveBeenCalledWith("p1", "Orgelfond", "kari");
  });

  test("et navn som finnes fra før, sies det om, og lagres ikke", () => {
    service.purposes = [purpose("p1", "Orgel", "drift"), purpose("p2", "Diakoni", "drift")];
    renderTab();

    fireEvent.click(row("Orgel").getByRole("button", { name: "Endre navn" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nytt navn for Orgel" }), { target: { value: "diakoni" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));

    expect(screen.getByRole("alert").textContent).toBe("Det finnes allerede et gaveformål med dette navnet.");
    expect(renameGivingPurpose).not.toHaveBeenCalled();
  });

  test("Avbryt går tilbake uten å lagre", () => {
    service.purposes = [purpose("p1", "Orgel", "drift")];
    renderTab();

    fireEvent.click(row("Orgel").getByRole("button", { name: "Endre navn" }));
    fireEvent.click(screen.getByRole("button", { name: "Avbryt" }));

    expect(screen.queryByRole("textbox", { name: "Nytt navn for Orgel" })).toBeNull();
    expect(renameGivingPurpose).not.toHaveBeenCalled();
  });
});

describe("Ute av bruk", () => {
  test("et formål tas ut av bruk, og står igjen i listen", async () => {
    service.purposes = [purpose("p1", "Orgel", "drift")];
    renderTab();

    fireEvent.click(row("Orgel").getByRole("button", { name: "Ta ut av bruk" }));

    expect(setGivingPurposeActive).toHaveBeenCalledWith("p1", false, "kari");
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("«Orgel» er tatt ut av bruk. Ingenting er slettet."));
  });

  test("et formål ute av bruk kan tas i bruk igjen", async () => {
    service.purposes = [purpose("p1", "Orgel", "drift", false)];
    renderTab();

    expect(row("Orgel").getByText("Ute av bruk")).toBeTruthy();
    fireEvent.click(row("Orgel").getByRole("button", { name: "Ta i bruk igjen" }));

    expect(setGivingPurposeActive).toHaveBeenCalledWith("p1", true, "kari");
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("«Orgel» er tatt i bruk igjen."));
  });
});

describe("Tilstandene siden", () => {
  test("mens listen leses, vises ikke skjemaet", () => {
    service.pending = true;
    renderTab();

    expect(screen.getByText("Henter gaveformålene …")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Legg til" })).toBeNull();
  });

  test("når reglene ikke er publisert, sies det, og skjemaet vises ikke", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    service.error = { code: "permission-denied" };
    renderTab();

    expect(screen.getByRole("alert").textContent).toBe(
      "Databasen avviste lesingen. Sikkerhetsreglene må publiseres på nytt før gaveformål kan brukes."
    );
    expect(screen.queryByRole("button", { name: "Legg til" })).toBeNull();
    spy.mockRestore();
  });

  test("ved en annen feil sies det, og skjemaet vises ikke", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    service.error = { code: "unavailable" };
    renderTab();

    expect(screen.getByRole("alert").textContent).toBe("Gaveformålene kunne ikke hentes. Last siden på nytt for å prøve igjen.");
    expect(screen.queryByRole("button", { name: "Legg til" })).toBeNull();
    spy.mockRestore();
  });
});

describe("Hvem som ser fanen", () => {
  test("fanen er i demoen (eierens valg), og verken nettredaktør eller protokollansvarlig har den", () => {
    expect(isTabInDemo("gaveformal")).toBe(true);
    expect(webEditorMayOpen("gaveformal")).toBe(false);
    expect(membershipClerkMayOpen("gaveformal")).toBe(false);
  });
});
