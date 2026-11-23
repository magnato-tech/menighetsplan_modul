// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Gathering } from "../src/types";
import type { StudioData } from "../src/pages/admin/studio";

const { cms } = vi.hoisted(() => ({
  cms: {
    pages: [] as { id: string; title: string; updatedAt: string }[],
    news: [] as never[],
    media: [] as never[],
    sermons: [] as never[],
    staff: [] as never[],
    settings: { churchName: "Lillesand Misjonskirke" },
    addons: {} as Record<string, boolean>,
    surfaces: { minSide: true, ownWebsite: true, externalSiteUrl: "", externalCalendarUrl: "", dismissedUids: [] as string[], keptUids: [] as string[] },
    surfacesState: "ready" as const,
  },
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
vi.mock("../src/hooks/useExternalCalendarQueue", () => ({ useExternalCalendarPending: () => 0 }));
vi.mock("../src/demo", () => ({ DEMO: null }));
vi.mock("../src/hooks/useDemoOwner", () => ({ useDemoOwner: () => "locked" }));
vi.mock("../src/hooks/useMemberProposals", () => ({ usePendingProposalCounts: () => new Map() }));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn().mockResolvedValue([]) }));
// The dialog for an event is a stub here: this test is about the bell and the panel, not the dialog.
vi.mock("../src/components/gathering/GatheringWebsiteDialog", () => ({
  GatheringWebsiteDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Bilde og tekst">
      <button type="button" onClick={onClose}>Lukk test</button>
    </div>
  ),
}));

import { WeekBell } from "../src/pages/admin/WeekBell";
import { DashboardTab } from "../src/pages/admin/tabs/DashboardTab";
import { StudioAppearanceProvider } from "../src/pages/admin/studioAppearance";

/** Monday 23. november 2026, 10:00 local time: the week runs 23.–29. november. */
const NOW = new Date(2026, 10, 23, 10, 0).getTime();
const iso = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour, 0).toISOString();

/** A public event this week with no image and no text: it misses both on the website. */
const missingEvent = (id: string, title: string, startsAt: string) =>
  ({ id, title, startsAt, visibility: "offentlig", isPublic: true, cancelled: false, imageUrl: "", summary: "", content: "" }) as unknown as Gathering;

const gatherings = [missingEvent("bonne", "Bønnemøte", iso(10, 24, 18)), missingEvent("konsert", "Konsert", iso(10, 26, 18))];

const studioFor = (role: "admin" | "nettredaktor" | "member", list: Gathering[] = gatherings) =>
  ({
    currentUser: { id: "person-1", name: "Kari Nordmann", globalRole: role },
    adminPersons: [],
    adminGroups: [],
    adminGatherings: list.map((gathering) => ({ gathering })),
    adminTasks: [],
    adminVolunteerRoles: [],
    updateGathering: vi.fn(() => ({ success: true })),
  }) as unknown as StudioData;

const renderBell = (studio: StudioData, onTabChange = vi.fn()) =>
  render(
    <MemoryRouter>
      <StudioAppearanceProvider>
        <WeekBell studio={studio} onTabChange={onTabChange} />
      </StudioAppearanceProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Denne uka-klokken på mobil", () => {
  test("klokken viser antall arrangementer som mangler før søndag", () => {
    const { container } = renderBell(studioFor("admin"));
    const bell = container.querySelector("button") as HTMLElement;
    expect(bell.getAttribute("aria-label")).toBe("Denne uka, 2 mangler før søndag");
    expect(bell.textContent).toContain("2");
  });

  test("ingen merke når ingenting mangler", () => {
    const ready = [{ ...missingEvent("klar", "Klar", iso(10, 24, 18)), imageUrl: "bilde.jpg", summary: "Ingress" }] as Gathering[];
    const { container } = renderBell(studioFor("admin", ready));
    const bell = container.querySelector("button") as HTMLElement;
    expect(bell.getAttribute("aria-label")).toBe("Denne uka");
    expect(bell.textContent).toBe("");
  });

  test("å trykke åpner en dialog med tittelen Denne uka og de tre delene", () => {
    const { getByRole } = renderBell(studioFor("admin"));
    fireEvent.click(getByRole("button", { name: /Denne uka/ }));

    const dialog = within(getByRole("dialog", { name: "Denne uka" }));
    expect(dialog.getByText("Mangler før søndag")).toBeTruthy();
    expect(dialog.getByText("Publiseres")).toBeTruthy();
    expect(dialog.getByText("Sist endret")).toBeTruthy();
  });

  test("✕ lukker panelet", () => {
    const { getByRole, queryByRole } = renderBell(studioFor("admin"));
    fireEvent.click(getByRole("button", { name: /Denne uka/ }));
    fireEvent.click(getByRole("button", { name: "Lukk" }));
    expect(queryByRole("dialog", { name: "Denne uka" })).toBeNull();
  });

  test("Escape lukker panelet", () => {
    const { getByRole, queryByRole } = renderBell(studioFor("admin"));
    fireEvent.click(getByRole("button", { name: /Denne uka/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByRole("dialog", { name: "Denne uka" })).toBeNull();
  });

  test("å velge en annen fane fra panelet lukker panelet og går dit", () => {
    const onTabChange = vi.fn();
    cms.pages = [{ id: "p1", title: "Forside", updatedAt: iso(10, 23, 9) }];
    const { getByRole, queryByRole } = renderBell(studioFor("admin"), onTabChange);
    fireEvent.click(getByRole("button", { name: /Denne uka/ }));
    fireEvent.click(getByRole("button", { name: /Forside/ }));
    expect(onTabChange).toHaveBeenCalledWith("cms-sider");
    expect(queryByRole("dialog", { name: "Denne uka" })).toBeNull();
    cms.pages = [];
  });

  test("vises ikke for en vanlig frivillig", () => {
    const { container } = renderBell(studioFor("member"));
    expect(container.querySelector("button")).toBeNull();
  });

  test("vises for en nettredaktør", () => {
    const { container } = renderBell(studioFor("nettredaktor"));
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Denne uka, 2 mangler før søndag");
  });
});

describe("Oversikten på mobil", () => {
  test("uke-kortet er skjult under md, og vises fra md og opp", () => {
    const { container } = render(
      <MemoryRouter>
        <StudioAppearanceProvider>
          <DashboardTab
            studio={studioFor("nettredaktor")}
            area="nettside"
            webEditor
            onTabChange={vi.fn()}
            onAreaChange={vi.fn()}
            onCreateIn={vi.fn()}
          />
        </StudioAppearanceProvider>
      </MemoryRouter>
    );
    const heading = container.querySelector("#denne-uka-paa-nettsiden");
    expect(heading).not.toBeNull();
    const wrapper = heading?.closest("section")?.parentElement as HTMLElement;
    expect(wrapper.className).toContain("hidden");
    expect(wrapper.className).toContain("md:block");
  });
});
