// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { cms } = vi.hoisted(() => ({
  cms: {
    pages: [{ id: "p1" }, { id: "p2" }],
    news: [],
    sermons: [],
    staff: [],
    media: [],
    settings: { churchName: "Lillesand Misjonskirke" },
    addons: {} as Record<string, boolean>,
  },
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
vi.mock("../src/demo", () => ({ DEMO: null }));
vi.mock("../src/hooks/useDemoOwner", () => ({ useDemoOwner: () => "locked" }));
vi.mock("../src/hooks/useMemberProposals", () => ({ usePendingProposalCounts: () => new Map() }));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn().mockResolvedValue([]) }));

import { DashboardTab } from "../src/pages/admin/tabs/DashboardTab";
import { StudioSidebar } from "../src/pages/admin/StudioSidebar";
import { useStudioMenuEntries } from "../src/pages/admin/studioMenu";
import type { StudioData, StudioTab } from "../src/pages/admin/studio";
import type { StudioArea } from "../src/pages/admin/studioAreas";
import { StudioAppearanceProvider } from "../src/pages/admin/studioAppearance";

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
/** An upcoming gathering as the planning gets it from the studio (no tasks, so nothing to staff yet) */
const gathering = (id: string, title: string, days: number, isGudstjeneste: boolean) => ({
  gathering: { id, title, startsAt: inDays(days), cancelled: false, isPublic: true, isGudstjeneste, location: "Kirken" },
});

const studio = {
  currentUser: { id: "person-1", name: "Kari Nordmann" },
  adminPersons: [{ id: "a" }, { id: "b" }],
  adminGroups: [{ id: "g" }],
  adminGatherings: [gathering("g1", "Småsamling", 2, false), gathering("g2", "Gudstjeneste", 5, true)],
  adminTasks: [],
  adminVolunteerRoles: [{ id: "r" }],
} as unknown as StudioData;

const onTabChange = vi.fn();
const onAreaChange = vi.fn();
const onCreateIn = vi.fn();

const renderOverview = (props: { area?: StudioArea; webEditor?: boolean; studio?: StudioData } = {}) => {
  const { container } = render(
    <MemoryRouter>
      <DashboardTab
        studio={props.studio ?? studio}
        area={props.area ?? "planlegging"}
        webEditor={props.webEditor}
        onTabChange={onTabChange}
        onAreaChange={onAreaChange}
        onCreateIn={onCreateIn}
      />
    </MemoryRouter>
  );
  const nav = within(container.querySelector('nav[aria-label="Admin-menyen"]') as HTMLElement);
  return { container, nav };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Startsiden på mobil", () => {
  test("planleggingen: menyen har radene, og Kalender åpner fanen", () => {
    const { nav } = renderOverview();

    for (const name of [/^Kalender/, /^Trenger oppfølging/, /^Grupper & Husfellesskap/, /^Personer/, /^Maler/, /^Årshjul/, /^Send e-post/, /^Roller/]) {
      expect(nav.getByRole("button", { name })).toBeTruthy();
    }
    expect(nav.queryByRole("button", { name: /Sider & Innhold/ })).toBeNull();
    // The count and the warning are on the row
    expect(nav.getByRole("button", { name: /^Kalender/ }).textContent).toContain("2");

    fireEvent.click(nav.getByRole("button", { name: /^Kalender/ }));
    expect(onTabChange).toHaveBeenCalledWith("planlegger-samlinger");
  });

  test("valget mellom Planlegging og Nettside: Nettside gir onAreaChange", () => {
    const { container } = renderOverview();
    const tabs = within(container.querySelector('[role="tablist"]') as HTMLElement);

    fireEvent.click(tabs.getByRole("tab", { name: "Nettside" }));
    expect(onAreaChange).toHaveBeenCalledWith("nettside");
  });

  test("nettsiden: menyen har sidene, og en nettredaktør får verken valget eller Lederskap & Stab", () => {
    const { nav } = renderOverview({ area: "nettside" });
    expect(nav.getByRole("button", { name: /Sider & Innhold/ })).toBeTruthy();
    expect(nav.getByRole("button", { name: /Lederskap & Stab/ })).toBeTruthy();
    expect(nav.queryByRole("button", { name: /Kalender/ })).toBeNull();
    cleanup();

    const editor = renderOverview({ area: "nettside", webEditor: true });
    expect(editor.container.querySelector('[role="tablist"]')).toBeNull();
    expect(editor.nav.queryByRole("button", { name: /Lederskap & Stab/ })).toBeNull();
    expect(editor.nav.getByRole("button", { name: /Sider & Innhold/ })).toBeTruthy();
  });

  test("neste gudstjeneste lenker til bemanningen, og første arrangement når ingen er gudstjeneste", () => {
    const { container } = renderOverview();
    const next = container.querySelector('a[href="/admin/samling/g2?vis=bemanning"]');
    expect(next).not.toBeNull();
    expect(next?.textContent).toContain("Gudstjeneste");
    cleanup();

    const noService = {
      ...studio,
      adminGatherings: [gathering("g1", "Småsamling", 2, false), gathering("g3", "Konsert", 4, false)],
    } as unknown as StudioData;
    const plain = renderOverview({ studio: noService });
    expect(plain.container.querySelector('a[href="/admin/samling/g1?vis=bemanning"]')?.textContent).toContain("Småsamling");
  });

  test("ingen arrangement framover: ingen neste-kort", () => {
    const { container } = renderOverview({ studio: { ...studio, adminGatherings: [] } as unknown as StudioData });
    expect(container.querySelector('a[href*="/admin/samling/"]')).toBeNull();
  });
});

describe("Menyen på startsiden og i sidemenyen er den samme", () => {
  // The titles the side menu gives its buttons that are not part of the parts (see StudioSidebar)
  const SHARED = ["Oversikt", "Hjelp", "Database og Testdata", "Moduler", "Demo-oppsett"];

  const HookList = ({ area, webEditor }: { area: StudioArea; webEditor: boolean }) => {
    const entries = useStudioMenuEntries(studio, area, { webEditor });
    return (
      <ul>
        {entries.map((entry) => (
          <li key={entry.tab} data-tab={entry.tab}>
            {entry.label}
          </li>
        ))}
      </ul>
    );
  };

  const cases: [StudioArea, boolean][] = [
    ["planlegging", false],
    ["nettside", false],
    ["nettside", true],
  ];

  test.each(cases)("%s (webEditor %s): samme faner og samme navn", (area, webEditor) => {
    // The hook's rows
    const hook = render(<HookList area={area} webEditor={webEditor} />);
    const fromHook = [...hook.container.querySelectorAll("li")].map((li) => `${li.textContent}|${li.getAttribute("data-tab")}`);
    hook.unmount();
    expect(fromHook.length).toBeGreaterThan(5);

    // The side menu's buttons, and the tab each one opens
    const onTab = vi.fn();
    const side = render(
      <MemoryRouter>
        <StudioAppearanceProvider>
          <StudioSidebar
            studio={studio}
            activeTab="dashboard"
            onTabChange={(tab: StudioTab) => onTab(tab)}
            area={area}
            onAreaChange={() => {}}
            webEditor={webEditor}
            sidebarOpen
            onToggleSidebar={() => {}}
          />
        </StudioAppearanceProvider>
      </MemoryRouter>
    );
    // The theme buttons have a title too, but they do not open a tab, so they are left out
    const buttons = [...side.container.querySelectorAll("aside button[title]")].filter(
      (button) => !SHARED.includes(button.getAttribute("title") ?? "")
    );
    const fromSidebar = buttons.flatMap((button) => {
      onTab.mockClear();
      fireEvent.click(button);
      const tab = onTab.mock.calls[0]?.[0];
      return tab ? [`${button.getAttribute("title")}|${tab}`] : [];
    });
    side.unmount();

    expect([...fromSidebar].sort()).toEqual([...fromHook].sort());
  });
});
