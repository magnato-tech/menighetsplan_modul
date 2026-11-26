// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { GivingAccess } from "../src/utils/giving/access";

// The admin for someone whose only way in is a right in givertjeneste: no other tab, and the page for the rights
// opens. Everything here is made up, and the tabs themselves are stubbed.

const { cms, giving, person } = vi.hoisted(() => ({
  cms: {
    pages: [],
    news: [],
    sermons: [],
    staff: [],
    media: [],
    settings: { churchName: "Lillesand Misjonskirke", vippsNumber: "", vippsDescription: "", bankAccount: "", orgNumber: "" },
    addons: { givertjeneste: true } as Record<string, boolean>,
    addonsState: "ready" as const,
    surfaces: { minSide: true, ownWebsite: true, externalSiteUrl: "", externalCalendarUrl: "", dismissedUids: [] as string[], keptUids: [] as string[] },
    surfacesState: "ready" as const,
    minSideModules: {},
    contentReady: true,
  },
  giving: { loading: false, access: null as GivingAccess | null },
  person: { id: "ola", name: "Ola Hansen", globalRole: "member", membershipClerk: false } as Record<string, unknown>,
}));

vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
vi.mock("../src/demo", () => ({ DEMO: null }));
vi.mock("../src/hooks/useExternalCalendarQueue", () => ({ useExternalCalendarPending: () => 0 }));
vi.mock("../src/hooks/useDemoOwner", () => ({ useDemoOwner: () => "locked" }));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn(async () => []) }));
vi.mock("../src/hooks/useGivingAccess", () => ({
  useGivingAccess: () => ({ loading: giving.loading, access: giving.access, state: "active", reload: () => {} }),
}));
vi.mock("../src/hooks/useAppHooks", () => ({
  useAdminDashboard: () => ({
    currentUser: person,
    adminPersons: [],
    adminGroups: [],
    adminGatherings: [],
    adminTasks: [],
    adminVolunteerRoles: [],
    signOut: async () => {},
  }),
}));
vi.mock("../src/pages/admin/WeekBell", () => ({ WeekBell: () => <span>Ukeklokke</span> }));
vi.mock("../src/pages/admin/tabs/GivingSettingsTab", () => ({
  GivingSettingsTab: () => <p>Gaveinnstillinger-siden</p>,
}));

import { AdminStudio } from "../src/pages/admin/AdminStudio";

const open = (address: string) =>
  render(
    <MemoryRouter initialEntries={[address]}>
      <Routes>
        <Route path="/admin/*" element={<AdminStudio />} />
      </Routes>
    </MemoryRouter>
  );

const rightOnly: GivingAccess = {
  address: "ola@eksempel.no",
  personId: "ola",
  name: "Ola Hansen",
  overview: true,
  budget: false,
  individual: false,
  manage: false,
  version: 1,
};

afterEach(() => {
  cleanup();
  giving.loading = false;
  giving.access = null;
  person.globalRole = "member";
  person.membershipClerk = false;
  cms.addons = { givertjeneste: true };
});

describe("Den som bare har en rettighet i givertjeneste", () => {
  test("åpner siden for rettighetene, og ingen andre faner eller menypunkter", async () => {
    giving.access = rightOnly;
    open("/admin");

    expect(await screen.findByText("Gaveinnstillinger-siden")).toBeTruthy();
    const menu = within(document.querySelector("aside") as HTMLElement);
    expect(menu.getByRole("button", { name: "Gaveinnstillinger" })).toBeTruthy();
    expect(menu.getByRole("button", { name: "Hjelp" })).toBeTruthy();
    for (const gone of ["Oversikt", "Sider & Innhold", "Personer", "Database og Testdata", "Moduler", "Gaveformål"]) {
      expect(menu.queryByRole("button", { name: new RegExp(gone) }), gone).toBeNull();
    }
    expect(screen.queryByText("Ukeklokke")).toBeNull();
  });

  test("en annen fane i adressen sendes til siden for rettighetene", async () => {
    giving.access = rightOnly;
    open("/admin?tab=planlegger-personer");

    expect(await screen.findByText("Gaveinnstillinger-siden")).toBeTruthy();
    expect(screen.queryByText("Personer")).toBeNull();
  });
});

describe("Administrator", () => {
  test("ser fortsatt oversikten, og ikke bare siden for rettighetene", async () => {
    person.globalRole = "admin";
    giving.access = null;
    open("/admin?tab=dashboard");

    const menu = within(document.querySelector("aside") as HTMLElement);
    expect(await menu.findByRole("button", { name: "Oversikt" })).toBeTruthy();
    expect(menu.getByRole("button", { name: /Moduler/ })).toBeTruthy();
  });
});
