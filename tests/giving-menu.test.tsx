// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The menu of the admin for the people who have a right in givertjeneste. Everything here is made up.

const { cms } = vi.hoisted(() => ({
  cms: {
    pages: [],
    news: [],
    sermons: [],
    staff: [],
    media: [],
    settings: { churchName: "Lillesand Misjonskirke" },
    addons: {} as Record<string, boolean>,
    surfaces: { minSide: true, ownWebsite: true, externalSiteUrl: "", externalCalendarUrl: "", dismissedUids: [] as string[], keptUids: [] as string[] },
    surfacesState: "ready" as const,
  },
}));
vi.mock("../src/hooks/useExternalCalendarQueue", () => ({ useExternalCalendarPending: () => 0 }));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
const { installation } = vi.hoisted(() => ({
  installation: { demo: null as null | object },
}));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));
vi.mock("../src/hooks/useDemoOwner", () => ({ useDemoOwner: () => "locked" }));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn(async () => []) }));

import { StudioSidebar } from "../src/pages/admin/StudioSidebar";
import type { StudioData, StudioTab } from "../src/pages/admin/studio";
import type { StudioArea } from "../src/pages/admin/studioAreas";
import { StudioAppearanceProvider } from "../src/pages/admin/studioAppearance";

interface Who {
  globalRole: "admin" | "nettredaktor" | "member";
  membershipClerk?: boolean;
  /** Holds a right in givertjeneste */
  giving?: boolean;
  /** Which part of the admin the menu shows */
  area?: StudioArea;
  givingOnly?: boolean;
  webEditor?: boolean;
  membershipClerkOnly?: boolean;
}

const onTabChange = vi.fn();

const renderMenu = (who: Who) => {
  const studio = {
    currentUser: { id: "kari", name: "Kari Nordmann", globalRole: who.globalRole, membershipClerk: who.membershipClerk === true },
    adminPersons: [],
    adminGroups: [],
    adminGatherings: [],
    adminTasks: [],
    adminVolunteerRoles: [],
  } as unknown as StudioData;
  const { container } = render(
    <MemoryRouter>
      <StudioAppearanceProvider>
        <StudioSidebar
          studio={studio}
          activeTab={"dashboard" as StudioTab}
          onTabChange={onTabChange}
          area={who.area ?? "planlegging"}
          onAreaChange={() => {}}
          sidebarOpen
          onToggleSidebar={() => {}}
          webEditor={who.webEditor === true}
          membershipClerkOnly={who.membershipClerkOnly === true}
          givingOnly={who.givingOnly === true}
          givingRight={who.giving === true}
        />
      </StudioAppearanceProvider>
    </MemoryRouter>
  );
  return within(container.querySelector("aside") as HTMLElement);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  cms.addons = {};
  installation.demo = null;
});

describe("Den som bare har en rettighet i givertjeneste", () => {
  test("har bare Gaveinnstillinger og Hjelp i menyen, ingen andre faner", () => {
    cms.addons = { givertjeneste: true };
    const menu = renderMenu({ globalRole: "member", giving: true, givingOnly: true });

    const buttons = menu.getAllByRole("button").map((button) => button.textContent?.trim());
    expect(buttons).toContain("Gaveinnstillinger");
    expect(buttons).toContain("Hjelp");
    for (const gone of ["Oversikt", "Sider & Innhold", "Planlegging", "Personer", "Database og Testdata", "Moduler", "Papirkurv", "Gaveformål"]) {
      expect(menu.queryByRole("button", { name: new RegExp(gone) }), gone).toBeNull();
    }
    expect(menu.queryByRole("tablist")).toBeNull();
    expect(menu.queryByRole("link", { name: /Gå til Min Side/ })).toBeNull();
  });

  test("Gaveinnstillinger fører til fanen", () => {
    cms.addons = { givertjeneste: true };
    const menu = renderMenu({ globalRole: "member", giving: true, givingOnly: true });

    fireEvent.click(menu.getByRole("button", { name: "Gaveinnstillinger" }));
    expect(onTabChange).toHaveBeenCalledWith("giver-innstillinger");
  });
});

describe("Gaveinnstillinger i menyen", () => {
  test("administrator med rettighet ser både Gaveformål og Gaveinnstillinger", () => {
    cms.addons = { givertjeneste: true };
    const menu = renderMenu({ globalRole: "admin", giving: true });

    expect(menu.getByRole("button", { name: "Gaveformål" })).toBeTruthy();
    fireEvent.click(menu.getByRole("button", { name: "Gaveinnstillinger" }));
    expect(onTabChange).toHaveBeenCalledWith("giver-innstillinger");
  });

  test("administrator uten rettighet ser Gaveformål, men ikke Gaveinnstillinger", () => {
    cms.addons = { givertjeneste: true };
    const menu = renderMenu({ globalRole: "admin", giving: false });

    expect(menu.getByRole("button", { name: "Gaveformål" })).toBeTruthy();
    expect(menu.queryByRole("button", { name: "Gaveinnstillinger" })).toBeNull();
  });

  test("med rettighet, men modulen er av: ingen Gaveinnstillinger", () => {
    cms.addons = {};
    const menu = renderMenu({ globalRole: "admin", giving: true });

    expect(menu.queryByRole("button", { name: "Gaveinnstillinger" })).toBeNull();
    expect(menu.queryByRole("button", { name: "Gaveformål" })).toBeNull();
  });

  test("Gaveformål er bare for administrator, også med en rettighet", () => {
    cms.addons = { givertjeneste: true };
    const menu = renderMenu({ globalRole: "nettredaktor", giving: true, webEditor: true, area: "nettside" });

    expect(menu.queryByRole("button", { name: "Gaveformål" })).toBeNull();
    expect(menu.getByRole("button", { name: "Gaveinnstillinger" })).toBeTruthy();
  });

  test("protokollansvarlig med rettighet får Gaveinnstillinger i den lille menyen", () => {
    cms.addons = { givertjeneste: true };
    const menu = renderMenu({ globalRole: "member", membershipClerk: true, membershipClerkOnly: true, giving: true });

    expect(menu.getByRole("button", { name: "Gaveinnstillinger" })).toBeTruthy();
    expect(menu.queryByRole("button", { name: "Gaveformål" })).toBeNull();
  });

  test("protokollansvarlig uten rettighet får ikke Gaveinnstillinger", () => {
    cms.addons = { givertjeneste: true };
    const menu = renderMenu({ globalRole: "member", membershipClerk: true, membershipClerkOnly: true, giving: false });

    expect(menu.queryByRole("button", { name: "Gaveinnstillinger" })).toBeNull();
  });
});

describe("Demoen", () => {
  test("administrator i demoen ser bare Gaveformål og Gaveinnstillinger av tilleggene", () => {
    installation.demo = {};
    cms.addons = { givertjeneste: true, analysebord: true, nettsidebesok: true };
    const menu = renderMenu({ globalRole: "admin", giving: true });

    expect(menu.getByRole("button", { name: "Gaveformål" })).toBeTruthy();
    expect(menu.getByRole("button", { name: "Gaveinnstillinger" })).toBeTruthy();
    expect(menu.queryByRole("button", { name: "Analysebord" })).toBeNull();
    expect(menu.queryByRole("button", { name: "Besøk på nettsiden" })).toBeNull();
    expect(menu.queryByRole("button", { name: "Moduler" })).toBeNull();
    expect(menu.queryByRole("button", { name: "Database og Testdata" })).toBeNull();
  });
});
