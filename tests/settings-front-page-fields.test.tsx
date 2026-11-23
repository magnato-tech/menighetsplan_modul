// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { cms, app, auth } = vi.hoisted(() => ({
  cms: {
    settings: {} as Record<string, unknown>,
    pages: [],
    saveSettings: vi.fn(async (_settings: Record<string, unknown>) => true),
    surfaces: { minSide: true, ownWebsite: true, externalSiteUrl: "", externalCalendarUrl: "", dismissedUids: [] as string[], keptUids: [] as string[] },
    surfacesState: "ready" as const,
  },
  app: { session: { status: "signedOut" }, signOut: vi.fn(async () => {}), standInAs: undefined, allPersons: [], currentUser: { id: "", name: "", globalRole: "member" } },
  auth: {
    signInWithGoogle: vi.fn(async () => {}),
    sendSignInLink: vi.fn(async () => {}),
    isSignInLink: vi.fn(() => false),
    completeSignInLink: vi.fn(async () => "signedIn"),
    describeSignInError: () => "Feil",
  },
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => app }));
vi.mock("../src/services/auth", () => auth);
vi.mock("../src/services/mediaStorage", () => ({ uploadImageFile: vi.fn(async () => "https://lager.example/logo.png") }));

import { SiteSettingsTab } from "../src/pages/admin/tabs/SiteSettingsTab";

const HEADLINE = "Velkommen til Sentrumskirken";
const INTRO = "Her finner du alt om menigheten.";

beforeEach(() => {
  cms.settings = {
    churchName: "Sentrumskirken",
    appName: "Menighetsplan",
    tagline: "Et sted å høre til",
    welcomeHeadline: HEADLINE,
    welcomeSubtext: INTRO,
  };
  cms.saveSettings.mockClear();
});

afterEach(() => {
  cleanup();
});

const renderTab = (onOpenFrontPage?: () => void) =>
  render(
    <MemoryRouter>
      <SiteSettingsTab onOpenFrontPage={onOpenFrontPage} />
    </MemoryRouter>,
  );

describe("Forside-feltene i Nettside-innstillinger", () => {
  test("de to feltene for forsiden er borte fra innstillingene", () => {
    renderTab();
    expect(screen.queryByText("Hovedoverskrift på forsiden (Hero)")).toBeNull();
    expect(screen.queryByText("Ingresstekst på forsiden")).toBeNull();
    expect(screen.queryByDisplayValue(HEADLINE)).toBeNull();
    expect(screen.queryByDisplayValue(INTRO)).toBeNull();
  });

  test("en infoboks viser hvor overskriften og ingressen endres, med knapp til forsiden", () => {
    const onOpenFrontPage = vi.fn();
    renderTab(onOpenFrontPage);
    expect(screen.getByText("Overskriften og ingressen på forsiden")).toBeTruthy();
    expect(screen.getByText(/endrer du på selve forsiden, der du ser hvordan de blir\./)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Åpne Forsiden i Sider & Innhold" }));
    expect(onOpenFrontPage).toHaveBeenCalledTimes(1);
  });

  test("lagring sender de samme overskriftene og ingressen som før", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Lagre alle innstillinger" }));
    await waitFor(() => expect(cms.saveSettings).toHaveBeenCalledTimes(1));
    expect(cms.saveSettings.mock.calls[0][0]).toMatchObject({ welcomeHeadline: HEADLINE, welcomeSubtext: INTRO });
  });

  test("feltet for appnavnet heter Navnet på appen og har en hjelpetekst", () => {
    renderTab();
    expect(screen.getByText("Navnet på appen")).toBeTruthy();
    expect(screen.getByText("Vises i nettleserfanen og øverst på nettsiden.")).toBeTruthy();
    expect(screen.queryByText("Plattformnavn")).toBeNull();
  });
});
