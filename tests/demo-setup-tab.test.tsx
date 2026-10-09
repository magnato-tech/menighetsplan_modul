// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { DemoOwnerStatus } from "../src/services/demoOwner";
import type { DemoSetStatus } from "../src/services/demoSiteList";
import { ownerCodeHashOf } from "../src/utils/demoOwner";

// Demo-oppsett: the tab where the owner of the demo decides which congregations every visitor
// is offered, and opens or sends the link to one.

// The test browser has no fingerprinting of its own
if (!globalThis.crypto?.subtle) vi.stubGlobal("crypto", webcrypto);

const { installation, browser, database } = vi.hoisted(() => ({
  installation: { demo: {} as null | object, ownerSetUp: true },
  browser: { owner: "owner" as DemoOwnerStatus, site: null as string | null, rightCode: "riktig-eierkode-2026" },
  database: { sets: [] as DemoSetStatus[] | null, failSave: false },
}));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));
vi.mock("../src/demoSite", () => ({
  get DEMO_SITE() {
    return browser.site;
  },
}));
vi.mock("../src/hooks/useDemoOwner", () => ({ useDemoOwner: () => browser.owner }));
const unlockDemoOwner = vi.fn(async (code: string) => code === browser.rightCode);
const lockDemoOwner = vi.fn();
vi.mock("../src/services/demoOwner", () => ({
  isDemoOwnerSetUp: () => installation.ownerSetUp,
  unlockDemoOwner: (code: string) => unlockDemoOwner(code),
  lockDemoOwner: () => lockDemoOwner(),
}));
const saveSiteListing = vi.fn(async (_site: string, _listed: boolean) => {
  if (database.failSave) throw new Error("Missing or insufficient permissions.");
});
vi.mock("../src/services/demoSiteList", () => ({
  listDemoSetStatuses: async () => database.sets,
  saveSiteListing: (site: string, listed: boolean) => saveSiteListing(site, listed),
}));
const chooseDemoSite = vi.fn();
vi.mock("../src/services/demoSite", () => ({ chooseDemoSite: (site: string | null) => chooseDemoSite(site) }));
const reportWriteError = vi.fn();
vi.mock("../src/services/writeErrors", () => ({ reportWriteError: (action: string, error: unknown) => reportWriteError(action, error) }));

import { DemoSetupTab } from "../src/pages/admin/tabs/DemoSetupTab";

const lmk: DemoSetStatus = { id: "lmk", name: "Lillesand Misjonskirke", source: "lillesandmisjonskirke.no", ready: true, listed: true };
const sogne: DemoSetStatus = { id: "sogne", name: "Søgne Misjonskirke", source: "sognemisjonskirke.no", ready: true, listed: false };
const tromso: DemoSetStatus = { id: "tromso", name: "Tromsø Misjonskirke", source: "tromsomisjonskirke.no", ready: false, listed: false };

const showFeedback = vi.fn();
const openTab = () => render(<DemoSetupTab showFeedback={showFeedback} />);
const rowOf = async (name: string) => within((await screen.findByRole("heading", { name })).closest("li") as HTMLElement);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  installation.demo = {};
  installation.ownerSetUp = true;
  browser.owner = "owner";
  browser.site = null;
  database.sets = [];
  database.failSave = false;
});

describe("Demo-oppsett for den som ikke er eieren", () => {
  test("hos en menighet finnes det ikke", () => {
    installation.demo = null;
    openTab();
    expect(screen.getByText("Demo-oppsettet finnes bare i demoen.")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(document.querySelector("input")).toBeNull();
  });

  test("uten eierkoden vises ingen menigheter og ingen brytere, bare feltet for koden", () => {
    browser.owner = "locked";
    database.sets = [lmk, sogne];
    openTab();

    expect(screen.getByRole("heading", { name: "For eieren av demoen" })).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText("Søgne Misjonskirke")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lås" })).toBeNull();
  });

  test("feil kode åpner ikke, og siden sier det", async () => {
    browser.owner = "locked";
    openTab();
    fireEvent.change(screen.getByLabelText("Eierkode"), { target: { value: "feil-kode-2026-xx" } });
    fireEvent.click(screen.getByRole("button", { name: "Lås opp" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Det var ikke eierkoden.");
    expect(unlockDemoOwner).toHaveBeenCalledWith("feil-kode-2026-xx");
  });

  test("riktig kode prøves mot innstillingene, og gir ingen feilmelding", async () => {
    browser.owner = "locked";
    openTab();
    fireEvent.change(screen.getByLabelText("Eierkode"), { target: { value: browser.rightCode } });
    fireEvent.click(screen.getByRole("button", { name: "Lås opp" }));

    await waitFor(() => expect(unlockDemoOwner).toHaveBeenCalledWith(browser.rightCode));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("mens den lagrede koden prøves, vises verken feltet eller menighetene", () => {
    browser.owner = "checking";
    database.sets = [lmk];
    openTab();
    expect(screen.queryByLabelText("Eierkode")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("Før eierkoden er satt opp", () => {
  test("siden lager linja som skal inn i demoens innstillinger: fingeravtrykket, ikke koden", async () => {
    installation.ownerSetUp = false;
    browser.owner = "locked";
    openTab();
    expect(screen.getByRole("heading", { name: "Eierkoden er ikke satt opp" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Velg en eierkode/), { target: { value: "min-nye-eierkode-1" } });
    const line = `VITE_DEMO_OWNER_CODE_HASH=${await ownerCodeHashOf("min-nye-eierkode-1")}`;
    expect(await screen.findByText(line)).toBeTruthy();
    expect(document.body.textContent).not.toContain("min-nye-eierkode-1");
  });

  test("en for kort kode gir ingen linje, og siden sier hvorfor", async () => {
    installation.ownerSetUp = false;
    browser.owner = "locked";
    openTab();
    fireEvent.change(screen.getByLabelText(/Velg en eierkode/), { target: { value: "kort" } });

    expect(screen.getByText(/Koden må ha minst 12 tegn/)).toBeTruthy();
    expect(screen.queryByText(/VITE_DEMO_OWNER_CODE_HASH=/)).toBeNull();
  });
});

describe("Demo-oppsett for eieren", () => {
  test("hver menighet står med bryteren sin, og bryteren viser om den er i lista for alle", async () => {
    database.sets = [lmk, sogne];
    openTab();

    expect((await rowOf("Lillesand Misjonskirke")).getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect((await rowOf("Søgne Misjonskirke")).getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect((await rowOf("Søgne Misjonskirke")).getByText(/Hentet fra sognemisjonskirke\.no\. Står ikke i lista\./)).toBeTruthy();
  });

  test("å slå på en menighet lagrer valget og sier hva det betyr", async () => {
    database.sets = [lmk, sogne];
    openTab();
    fireEvent.click((await rowOf("Søgne Misjonskirke")).getByRole("switch"));

    await waitFor(() => expect(saveSiteListing).toHaveBeenCalledWith("sogne", true));
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("Søgne Misjonskirke står nå i lista alle besøkende ser."));
    expect((await rowOf("Søgne Misjonskirke")).getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  test("å slå av tar menigheten ut av lista, og sier at lenken fortsatt virker", async () => {
    database.sets = [lmk];
    openTab();
    fireEvent.click((await rowOf("Lillesand Misjonskirke")).getByRole("switch"));

    await waitFor(() => expect(saveSiteListing).toHaveBeenCalledWith("lmk", false));
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("Lillesand Misjonskirke er tatt ut av lista. Den kan fortsatt åpnes med lenken."));
  });

  test("et valg som ikke ble lagret, meldes som feil, og bryteren står som den sto", async () => {
    database.sets = [sogne];
    database.failSave = true;
    openTab();
    fireEvent.click((await rowOf("Søgne Misjonskirke")).getByRole("switch"));

    await waitFor(() => expect(reportWriteError).toHaveBeenCalledWith("lagre valget for Søgne Misjonskirke", expect.any(Error)));
    expect((await rowOf("Søgne Misjonskirke")).getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect(showFeedback).not.toHaveBeenCalled();
  });

  test("hver menighet har lenken sin, og den kan kopieres", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    database.sets = [sogne];
    openTab();
    const row = await rowOf("Søgne Misjonskirke");
    const link = `${window.location.origin}/?menighet=sogne`;

    expect(row.getByText(link)).toBeTruthy();
    fireEvent.click(row.getByRole("button", { name: "Kopier lenke" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link));
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("Lenken til Søgne Misjonskirke er kopiert."));
  });

  test("eieren kan vise en menighet som ikke står i lista", async () => {
    database.sets = [sogne];
    openTab();
    fireEvent.click((await rowOf("Søgne Misjonskirke")).getByRole("button", { name: "Vis denne menigheten" }));
    expect(chooseDemoSite).toHaveBeenCalledWith("sogne");
  });

  test("en menighet som ikke ligger i databasen ennå, kan ikke vises, og siden sier det", async () => {
    database.sets = [tromso];
    openTab();
    const row = await rowOf("Tromsø Misjonskirke");

    expect(row.getByText(/Ligger ikke i demoens database ennå/)).toBeTruthy();
    expect((row.getByRole("button", { name: "Vis denne menigheten" }) as HTMLButtonElement).disabled).toBe(true);
    // The choice can be made ahead of time
    expect((row.getByRole("switch") as HTMLButtonElement).disabled).toBe(false);
  });

  test("siden sier hvilken menighet eieren ser på nå", async () => {
    database.sets = [lmk, sogne];
    browser.site = "sogne";
    openTab();
    expect((await rowOf("Søgne Misjonskirke")).getByText(/Du ser på denne nå\./)).toBeTruthy();
    expect((await rowOf("Lillesand Misjonskirke")).queryByText(/Du ser på denne nå\./)).toBeNull();
  });

  test("kan lista ikke hentes, sier siden det", async () => {
    database.sets = null;
    openTab();
    expect((await screen.findByRole("alert")).textContent).toMatch(/kunne ikke hentes/);
  });

  test("eieren kan låse oppsettet igjen", () => {
    openTab();
    fireEvent.click(screen.getByRole("button", { name: "Lås" }));
    expect(lockDemoOwner).toHaveBeenCalled();
  });
});
