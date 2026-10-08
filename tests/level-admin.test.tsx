// @vitest-environment jsdom
import React, { useEffect } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { cms, installation } = vi.hoisted(() => ({
  cms: {
    pages: [],
    news: [],
    sermons: [],
    staff: [],
    media: [],
    settings: { churchName: "Menigheten" },
    addons: {},
    addonsState: "ready",
  },
  installation: { demo: null as null | Record<string, string> },
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn().mockResolvedValue([]) }));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));

import { DemoGate } from "../src/pages/admin/DemoGate";
import { LevelGate } from "../src/pages/admin/LevelGate";
import { StudioSidebar } from "../src/pages/admin/StudioSidebar";
import type { StudioData, StudioTab } from "../src/pages/admin/studio";
import { StudioAppearanceProvider } from "../src/pages/admin/studioAppearance";
import { chooseDemoLevel, forgetDemoLevel } from "../src/services/demoLevel";

const studio = {
  currentUser: { id: "person-1", name: "Kari Nordmann" },
  adminPersons: [],
  adminGroups: [],
  adminGatherings: [],
  adminTasks: [],
  adminVolunteerRoles: [],
} as unknown as StudioData;

const renderMenu = () => {
  const { container } = render(
    <MemoryRouter>
      <StudioAppearanceProvider>
        <StudioSidebar studio={studio} activeTab="dashboard" onTabChange={() => {}} sidebarOpen onToggleSidebar={() => {}} />
      </StudioAppearanceProvider>
    </MemoryRouter>
  );
  return within(container.querySelector("aside") as HTMLElement);
};

const PLANNER_ITEMS = [/Trenger oppfølging/, /Grupper & Husfellesskap/, /^Roller/];
const IN_BOTH = [/Sider & Innhold/, /Nyheter/, /Design/, /^Arrangementer/, /^Personer/];
const NOT_IN_DEMO = [/Database/, /Moduler/];

const started = vi.fn();
const stopped = vi.fn();
/** Stands in for a tab: it starts reading when it is drawn, and stops when it is taken away. */
const Tab: React.FC = () => {
  useEffect(() => {
    started();
    return stopped;
  }, []);
  return <p>Innholdet på fanen</p>;
};
const gate = (tab: StudioTab) => (
  <LevelGate tab={tab}>
    <Tab />
  </LevelGate>
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  forgetDemoLevel();
  installation.demo = null;
});

describe("Menyen i admin følger nivået", () => {
  test("hos en menighet står hele planleggeren i menyen", () => {
    const menu = renderMenu();
    for (const name of [...PLANNER_ITEMS, ...IN_BOTH, ...NOT_IN_DEMO]) expect(menu.getByRole("button", { name })).toBeTruthy();
    expect(menu.getByText("Arrangementer & Bemanning")).toBeTruthy();
    expect(menu.getByText("System & Database")).toBeTruthy();
  });

  test("i demoen, med Menighetsplan valgt, står hele planleggeren i menyen", () => {
    installation.demo = {};
    chooseDemoLevel("plan");
    const menu = renderMenu();
    for (const name of [...PLANNER_ITEMS, ...IN_BOTH]) expect(menu.getByRole("button", { name })).toBeTruthy();
  });

  test("med Menighetsplattform valgt er oppgavene, gruppene og rollene borte, og resten står", () => {
    installation.demo = {};
    chooseDemoLevel("plattform");
    const menu = renderMenu();

    for (const name of PLANNER_ITEMS) expect(menu.queryByRole("button", { name })).toBeNull();
    for (const name of IN_BOTH) expect(menu.getByRole("button", { name })).toBeTruthy();
    // The heading no longer promises staffing
    expect(menu.queryByText("Arrangementer & Bemanning")).toBeNull();
    expect(menu.getByText("Arrangementer & Personer")).toBeTruthy();
  });

  test("menyen følger med når nivået byttes mens den står åpen", () => {
    installation.demo = {};
    const menu = renderMenu();
    expect(menu.getByRole("button", { name: /Trenger oppfølging/ })).toBeTruthy();

    act(() => chooseDemoLevel("plattform"));
    expect(menu.queryByRole("button", { name: /Trenger oppfølging/ })).toBeNull();

    act(() => chooseDemoLevel("plan"));
    expect(menu.getByRole("button", { name: /Trenger oppfølging/ })).toBeTruthy();
  });
});

describe("Admin i demoen", () => {
  test("menyen har verken databaseverktøyene eller modulene, heller ikke en modul som er slått på i databasen", () => {
    installation.demo = {};
    (cms as { addons: Record<string, boolean> }).addons = { analysebord: true, nettsidebesok: true };
    const menu = renderMenu();

    for (const name of NOT_IN_DEMO) expect(menu.queryByRole("button", { name })).toBeNull();
    expect(menu.queryByText("System & Database")).toBeNull();
    expect(menu.queryByRole("button", { name: "Analysebord" })).toBeNull();
    expect(menu.queryByText("Analyse")).toBeNull();
    for (const name of [...PLANNER_ITEMS, ...IN_BOTH]) expect(menu.getByRole("button", { name })).toBeTruthy();
    cms.addons = {};
  });

  test("en fane som ikke er med, tegnes ikke når adressen skrives inn, og siden sier hvorfor", () => {
    installation.demo = {};
    for (const tab of ["database-admin", "moduler", "analyse", "nettsidebesok"] as const) {
      render(
        <DemoGate tab={tab}>
          <Tab />
        </DemoGate>
      );
      expect(screen.queryByText("Innholdet på fanen")).toBeNull();
      expect(screen.getByRole("heading", { name: "Ikke med i demoen" })).toBeTruthy();
      cleanup();
    }
    expect(started).not.toHaveBeenCalled();
  });

  test("resten av fanene tegnes i demoen, og hos en menighet tegnes alle", () => {
    installation.demo = {};
    render(
      <DemoGate tab="planlegger-samlinger">
        <Tab />
      </DemoGate>
    );
    expect(screen.getByText("Innholdet på fanen")).toBeTruthy();
    cleanup();

    installation.demo = null;
    render(
      <DemoGate tab="database-admin">
        <Tab />
      </DemoGate>
    );
    expect(screen.getByText("Innholdet på fanen")).toBeTruthy();
  });
});

describe("En fane som hører til planleggeren", () => {
  test("tegnes på Menighetsplan", () => {
    render(gate("planlegger-grupper"));
    expect(screen.getByText("Innholdet på fanen")).toBeTruthy();
  });

  test("tegnes ikke på Menighetsplattform: siden sier hvor den hører til, og hva nivået har", () => {
    installation.demo = {};
    chooseDemoLevel("plattform");
    render(gate("planlegger-grupper"));

    expect(screen.queryByText("Innholdet på fanen")).toBeNull();
    expect(started).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Dette hører til Menighetsplan" })).toBeTruthy();
    expect(screen.getByText(/Menighetsplattform har nettsiden, kalenderen og en\s+enkel Min side\./)).toBeTruthy();
    expect(screen.getByText("Velg Menighetsplan i stripen øverst for å se det.")).toBeTruthy();
  });

  test("en fane som er med på begge nivå, tegnes på Menighetsplattform", () => {
    installation.demo = {};
    chooseDemoLevel("plattform");
    for (const tab of ["planlegger-samlinger", "planlegger-personer", "cms-sider", "dashboard"] as const) {
      render(gate(tab));
      expect(screen.getByText("Innholdet på fanen")).toBeTruthy();
      cleanup();
    }
  });

  test("tas bort når nivået byttes mens den er åpen, og kommer tilbake når det byttes igjen", () => {
    installation.demo = {};
    render(gate("planlegger-oppgaver"));
    expect(started).toHaveBeenCalledTimes(1);

    act(() => chooseDemoLevel("plattform"));
    expect(screen.queryByText("Innholdet på fanen")).toBeNull();
    expect(stopped).toHaveBeenCalledTimes(1);

    act(() => chooseDemoLevel("plan"));
    expect(screen.getByText("Innholdet på fanen")).toBeTruthy();
  });
});
