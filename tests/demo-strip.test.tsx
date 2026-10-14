// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
// No congregation but the example lies ready (the choice between them: tests/demo-site-picker.test.tsx)
vi.mock("../src/services/demoSiteList", () => ({ listDemoSites: async () => [] }));

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

/** A screen without the strip, as when the level is read where the strip is not drawn. */
const openScreen = () =>
  render(
    <MemoryRouter>
      <Screen />
    </MemoryRouter>
  );

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

  test("sier at dette er en demo, har ingen nivåvelger inntil videre, og viser hele produktet", () => {
    installation.demo = {};
    openApp();

    const strip = within(screen.getByRole("complementary", { name: "Demo" }));
    expect(strip.getByText("Demo")).toBeTruthy();
    expect(strip.getByText("Alt du ser her, er eksempler.")).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByText("Nivået er plan")).toBeTruthy();
  });

  test("et nivå som ble valgt før velgeren ble tatt bort, glemmes, så demoen viser hele produktet", () => {
    installation.demo = {};
    chooseDemoLevel("plattform");
    openApp();

    expect(screen.getByText("Nivået er plan")).toBeTruthy();
    expect(readDemoLevel()).toBeNull();
  });

  test("et nivå som velges, huskes i nettleseren til den som ser på (klart til velgeren kommer tilbake)", () => {
    installation.demo = {};
    chooseDemoLevel("plattform");

    openScreen();
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
    openScreen();
    expect(screen.getByText("Nivået er plan")).toBeTruthy();

    act(() => chooseDemoLevel("plattform"));
    expect(screen.getByText("Nivået er plattform")).toBeTruthy();
    expect(readDemoLevel()).toBe("plattform");
  });

  test("et valg gjort i en annen fane i samme nettleser følges", () => {
    installation.demo = {};
    openScreen();
    act(() => chooseDemoLevel("plan"));

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
