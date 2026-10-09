// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Session } from "../src/utils/session";

// The settings the app was built with: a congregation's own installation until a test says demo
const { installation, app } = vi.hoisted(() => ({
  installation: { demo: null as null | { signUpUrl?: string; salesSiteUrl?: string } },
  app: { session: { status: "signedOut" } as Session },
}));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => app }));

import { DemoFrame, DemoStrip } from "../src/components/DemoStrip";
import { useLevel } from "../src/hooks/useLevel";
import { chooseDemoLevel, forgetDemoLevel, readDemoLevel } from "../src/services/demoLevel";

/** Stands in for any screen that differs between the levels. */
const Screen: React.FC = () => <p>Nivået er {useLevel()}</p>;

/** The app as it is put together: the strip, when there is one, above a screen. */
const openApp = () =>
  render(
    <MemoryRouter>
      <DemoFrame>
        <Screen />
      </DemoFrame>
    </MemoryRouter>
  );
const openStrip = () =>
  render(
    <MemoryRouter>
      <DemoStrip />
    </MemoryRouter>
  );

const levelButton = (name: string) => screen.getByRole("radio", { name });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  forgetDemoLevel();
  installation.demo = null;
  app.session = { status: "signedOut" };
});

describe("Stripen øverst i demoen", () => {
  test("finnes ikke hos en menighet, og der er nivået hele produktet uansett hva nettleseren har lagret", () => {
    chooseDemoLevel("plattform");
    openApp();

    expect(screen.queryByRole("complementary", { name: "Demo" })).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Nivået er plan")).toBeTruthy();
  });

  test("sier at dette er en demo, og viser hele produktet til noe er valgt", () => {
    installation.demo = {};
    openApp();

    const strip = within(screen.getByRole("complementary", { name: "Demo" }));
    expect(strip.getByText("Demo")).toBeTruthy();
    expect(strip.getByText("Alt du ser her, er eksempler.")).toBeTruthy();
    expect(levelButton("Menighetsplan").getAttribute("aria-checked")).toBe("true");
    expect(levelButton("Menighetsplattform").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Nivået er plan")).toBeTruthy();
  });

  test("velgeren har to valg, og et valg endrer skjermen under med en gang", () => {
    installation.demo = {};
    openApp();
    expect(screen.getAllByRole("radio")).toHaveLength(2);

    fireEvent.click(levelButton("Menighetsplattform"));
    expect(screen.getByText("Nivået er plattform")).toBeTruthy();
    expect(levelButton("Menighetsplattform").getAttribute("aria-checked")).toBe("true");
    expect(levelButton("Menighetsplan").getAttribute("aria-checked")).toBe("false");

    fireEvent.click(levelButton("Menighetsplan"));
    expect(screen.getByText("Nivået er plan")).toBeTruthy();
  });

  test("valget huskes i nettleseren til den som ser på", () => {
    installation.demo = {};
    openStrip();
    fireEvent.click(levelButton("Menighetsplattform"));
    cleanup();

    openApp();
    expect(screen.getByText("Nivået er plattform")).toBeTruthy();
  });

  test("stenger nettleseren lagringen, gjelder valget likevel så lenge siden er åpen", () => {
    installation.demo = {};
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Lagring er stengt");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Lagring er stengt");
    });
    openApp();
    expect(screen.getByText("Nivået er plan")).toBeTruthy();

    fireEvent.click(levelButton("Menighetsplattform"));
    expect(screen.getByText("Nivået er plattform")).toBeTruthy();
    expect(readDemoLevel()).toBe("plattform");
  });

  test("et valg gjort i en annen fane i samme nettleser følges", () => {
    installation.demo = {};
    openApp();
    fireEvent.click(levelButton("Menighetsplan"));

    window.localStorage.setItem("menighetsplan_demo_nivaa", "plattform");
    fireEvent(window, new StorageEvent("storage", { key: "menighetsplan_demo_nivaa", newValue: "plattform" }));
    expect(screen.getByText("Nivået er plattform")).toBeTruthy();
  });

  test("den som ikke er inne, får veien inn til CMS, admin og Min side", () => {
    installation.demo = {};
    openStrip();
    expect(screen.getByRole("link", { name: "Gå inn i CMS, admin og Min side" }).getAttribute("href")).toBe("/logg-inn");
  });

  test("den som er inne, kan bytte rolle fra stripen", () => {
    installation.demo = {};
    app.session = { status: "member", person: { id: "p1", name: "Kari Nordmann", globalRole: "member" }, account: null };
    openStrip();
    expect(screen.queryByRole("link", { name: /^Gå inn/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Bytt rolle" }).getAttribute("href")).toBe("/logg-inn");
  });

  test("uten adresser i innstillingene har stripen ingen lenker ut av demoen", () => {
    installation.demo = {};
    openStrip();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/logg-inn"]);
  });

  test("lenkene går til påmeldingen og tilbake til nettsiden som presenterer produktet", () => {
    installation.demo = { signUpUrl: "https://www.eksempel.no/kom-i-gang", salesSiteUrl: "https://www.eksempel.no" };
    openStrip();

    expect(screen.getByRole("link", { name: "Kom i gang" }).getAttribute("href")).toBe("https://www.eksempel.no/kom-i-gang");
    expect(screen.getByRole("link", { name: "Tilbake til eksempel.no" }).getAttribute("href")).toBe("https://www.eksempel.no");
  });

  test("en side som vises inni en annen, som forhåndsvisningen i admin, har ingen stripe", () => {
    installation.demo = {};
    const parent = vi.spyOn(window, "parent", "get").mockReturnValue({} as Window);
    openApp();
    expect(screen.queryByRole("complementary", { name: "Demo" })).toBeNull();
    expect(screen.getByText("Nivået er plan")).toBeTruthy();
    parent.mockRestore();
  });
});
