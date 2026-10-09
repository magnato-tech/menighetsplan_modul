// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { DemoSiteChoice } from "../src/services/demoSiteList";

// The strip in the demo lets a visitor choose which congregation to look at, among those that
// lie ready in the demo's database.

const { installation, browser, database } = vi.hoisted(() => ({
  installation: { demo: {} as null | object },
  // The congregation this visitor is looking at
  browser: { site: null as string | null },
  // What the demo's database has ready, or null when the list could not be fetched
  database: { sites: [] as DemoSiteChoice[] | null, asked: 0 },
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
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => ({ session: { status: "signedOut" } }) }));
vi.mock("../src/services/demoSiteList", () => ({
  listDemoSites: async () => {
    database.asked++;
    return database.sites;
  },
}));
const chooseDemoSite = vi.fn();
vi.mock("../src/services/demoSite", () => ({ chooseDemoSite: (site: string | null) => chooseDemoSite(site) }));

import { DemoStrip } from "../src/components/DemoStrip";

const floy: DemoSiteChoice = { id: "floy", name: "Flekkerøy misjonskirke", source: "fløymk.no" };
const sogne: DemoSiteChoice = { id: "sogne", name: "Søgne Misjonskirke", source: "sognemisjonskirke.no" };

const openStrip = () =>
  render(
    <MemoryRouter>
      <DemoStrip />
    </MemoryRouter>
  );
const picker = () => screen.findByRole("combobox", { name: "Velg menighet" });
/** Lets the answer from the database arrive. */
const settled = () => waitFor(() => expect(database.asked).toBeGreaterThan(0)).then(() => new Promise((done) => setTimeout(done, 0)));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  installation.demo = {};
  browser.site = null;
  database.sites = [];
  database.asked = 0;
});

describe("Valget av menighet i demoen", () => {
  test("menighetene som ligger klare, står i en liste, med eksempelmenigheten først og valgt", async () => {
    database.sites = [floy, sogne];
    openStrip();

    const select = (await picker()) as HTMLSelectElement;
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Eksempelmenighet",
      "Flekkerøy misjonskirke",
      "Søgne Misjonskirke",
    ]);
    expect(select.value).toBe("");
    expect(screen.getByText("Alt du ser her, er eksempler.")).toBeTruthy();
  });

  test("lista sier hva valget er til", async () => {
    database.sites = [sogne];
    openStrip();
    const select = await picker();
    expect(select.closest("label")?.getAttribute("title")).toBe("Se med ett klikk hvordan løsningen ser ut for din menighet");
    expect(screen.getByText("Se din menighet")).toBeTruthy();
  });

  test("et valg gjelder menigheten som ble valgt, og eksempelmenigheten kan velges igjen", async () => {
    database.sites = [floy, sogne];
    openStrip();
    const select = await picker();

    fireEvent.change(select, { target: { value: "sogne" } });
    expect(chooseDemoSite).toHaveBeenLastCalledWith("sogne");

    fireEvent.change(select, { target: { value: "" } });
    expect(chooseDemoSite).toHaveBeenLastCalledWith(null);
  });

  test("den som ser på en menighet, ser hvilken, og hvor nettsiden er hentet fra", async () => {
    database.sites = [floy, sogne];
    browser.site = "sogne";
    openStrip();

    expect(((await picker()) as HTMLSelectElement).value).toBe("sogne");
    expect(screen.getByText("Nettsiden er hentet fra sognemisjonskirke.no for å vise løsningen.")).toBeTruthy();
    expect(screen.queryByText("Alt du ser her, er eksempler.")).toBeNull();
    expect(chooseDemoSite).not.toHaveBeenCalled();
  });

  test("uten noen menighet klar i databasen finnes ikke lista, og nivåvelgeren står som før", async () => {
    openStrip();
    await settled();

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  test("den som har valgt en menighet demoen ikke har, tas til eksempelmenigheten", async () => {
    database.sites = [floy];
    browser.site = "sogne";
    openStrip();

    await waitFor(() => expect(chooseDemoSite).toHaveBeenCalledWith(null));
  });

  test("kan lista ikke hentes, endres ingenting: valget står, og ingen liste vises", async () => {
    database.sites = null;
    browser.site = "sogne";
    openStrip();
    await settled();

    expect(chooseDemoSite).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  test("hos en menighet spørres det aldri om andre menigheter", async () => {
    installation.demo = null;
    database.sites = [floy, sogne];
    openStrip();
    await new Promise((done) => setTimeout(done, 0));

    expect(database.asked).toBe(0);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
