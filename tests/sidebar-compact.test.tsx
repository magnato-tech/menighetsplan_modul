// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { cms } = vi.hoisted(() => ({
  cms: {
    pages: [{ id: "p1" }, { id: "p2" }],
    news: [],
    sermons: [],
    staff: [],
    // Two uploaded images ready for use, and one put away
    media: [{ status: "ready" }, { status: "ready" }, { status: "archived" }],
    settings: { churchName: "Lillesand Misjonskirke" },
    // No module is on until a test turns one on
    addons: {} as { analysebord?: boolean; nettsidebesok?: boolean },
    surfaces: { minSide: true, ownWebsite: true, externalSiteUrl: "", externalCalendarUrl: "", dismissedUids: [] as string[], keptUids: [] as string[] },
    surfacesState: "ready" as const,
  },
}));
vi.mock("../src/hooks/useExternalCalendarQueue", () => ({ useExternalCalendarPending: () => 0 }));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
// A congregation's own installation until a test says demo, and nobody is the owner of a demo
const { installation } = vi.hoisted(() => ({
  installation: { demo: null as null | object, owner: "locked" as "checking" | "locked" | "owner" },
}));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));
vi.mock("../src/hooks/useDemoOwner", () => ({ useDemoOwner: () => installation.owner }));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn() }));

import { StudioSidebar } from "../src/pages/admin/StudioSidebar";
import type { StudioData } from "../src/pages/admin/studio";
import type { StudioArea } from "../src/pages/admin/studioAreas";
import { StudioAppearanceProvider } from "../src/pages/admin/studioAppearance";
import { readStoredFlag, writeStoredFlag } from "../src/utils/storedFlag";
import { listStockImages } from "../src/services/stockImages";

const studio = {
  currentUser: { id: "person-1", name: "Kari Nordmann" },
  adminPersons: [],
  adminGroups: [],
  adminGatherings: [],
  adminTasks: [],
  adminVolunteerRoles: [],
} as unknown as StudioData;

const onTabChange = vi.fn();
const onAreaChange = vi.fn();
const onToggleCompact = vi.fn();

/** The menu alone, with the optional compact props. Returns the aside as a scoped query. */
const renderMenu = (props: { area?: StudioArea; compact?: boolean; onToggleCompact?: () => void } = {}) => {
  const { container } = render(
    <MemoryRouter>
      <StudioAppearanceProvider>
        <StudioSidebar
          studio={studio}
          activeTab="dashboard"
          onTabChange={onTabChange}
          area={props.area ?? "nettside"}
          onAreaChange={onAreaChange}
          sidebarOpen
          onToggleSidebar={() => {}}
          compact={props.compact}
          onToggleCompact={props.onToggleCompact}
        />
      </StudioAppearanceProvider>
    </MemoryRouter>
  );
  return {
    aside: container.querySelector("aside") as HTMLElement,
    menu: within(container.querySelector("aside") as HTMLElement),
  };
};

beforeEach(() => {
  onTabChange.mockClear();
  onToggleCompact.mockClear();
  // The menu counts the stock images on mount, so the mock answers with none
  vi.mocked(listStockImages).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("compact side menu", () => {
  test("compact keeps the button names for screen readers and gives the toggle", () => {
    const { aside, menu } = renderMenu({ compact: true, onToggleCompact });

    expect(aside.getAttribute("data-compact")).toBe("true");
    // The name stays, so the button still has an accessible name though its text is hidden
    expect(menu.getByRole("button", { name: /Aktuelt & Nyheter/ })).toBeTruthy();

    fireEvent.click(menu.getByRole("button", { name: "Vis hele menyen" }));
    expect(onToggleCompact).toHaveBeenCalledTimes(1);
  });

  test("not compact with a toggle shows the button that folds the menu", () => {
    const { aside, menu } = renderMenu({ onToggleCompact });

    expect(aside.getAttribute("data-compact")).toBeNull();
    expect(menu.getByRole("button", { name: "Brett sammen menyen" })).toBeTruthy();
    expect(menu.queryByRole("button", { name: "Vis hele menyen" })).toBeNull();
  });

  test("without a toggle handler neither toggle button exists", () => {
    const { menu } = renderMenu();

    expect(menu.queryByRole("button", { name: "Brett sammen menyen" })).toBeNull();
    expect(menu.queryByRole("button", { name: "Vis hele menyen" })).toBeNull();
  });
});

describe("stored menu choice", () => {
  test("writing a flag can be read back", () => {
    writeStoredFlag("menighetsplan:test-flagg", true);
    expect(readStoredFlag("menighetsplan:test-flagg", false)).toBe(true);

    writeStoredFlag("menighetsplan:test-flagg", false);
    expect(readStoredFlag("menighetsplan:test-flagg", true)).toBe(false);
  });

  test("a missing value gives the fallback", () => {
    expect(readStoredFlag("menighetsplan:finnes-ikke", false)).toBe(false);
    expect(readStoredFlag("menighetsplan:finnes-ikke", true)).toBe(true);
  });
});
