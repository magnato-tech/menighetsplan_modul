// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LOGO_MAX_BYTES, logoFileError, logoOf, menuLogoOf } from "../src/utils/logo";

// A tiny picture as it is kept in the settings
const LOGO = "data:image/png;base64,iVBORw0KGgo=";

const { cms, app, auth } = vi.hoisted(() => ({
  cms: {
    settings: { churchName: "Sentrumskirken", appName: "Menighetsplan", tagline: "Et sted å høre til" } as Record<string, unknown>,
    pages: [],
    saveSettings: vi.fn(async (_settings: Record<string, unknown>) => true),
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

import { PublicNavbar } from "../src/components/public/PublicNavbar";
import { SignInPage } from "../src/pages/SignInPage";
import { SiteSettingsTab } from "../src/pages/admin/tabs/SiteSettingsTab";

const inRouter = (element: React.ReactElement, address = "/") => render(<MemoryRouter initialEntries={[address]}>{element}</MemoryRouter>);

beforeEach(() => {
  cms.settings = { churchName: "Sentrumskirken", appName: "Menighetsplan", tagline: "Et sted å høre til" };
  cms.saveSettings.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("Hva som kan være logoen", () => {
  test("et lite bilde av en kjent type", () => {
    expect(logoFileError({ type: "image/png", size: 31_710 })).toBeNull();
    expect(logoFileError({ type: "image/svg+xml", size: 2_338 })).toBeNull();
  });

  test("ikke en fil som ikke er et bilde, en tom fil eller en som er for stor", () => {
    expect(logoFileError({ type: "application/pdf", size: 1000 })).toMatch(/PNG, SVG, JPG eller WebP/);
    expect(logoFileError({ type: "image/png", size: 0 })).toBe("Filen er tom.");
    expect(logoFileError({ type: "image/png", size: LOGO_MAX_BYTES + 1 })).toMatch(/for stor \(200 kB\)/);
  });

  test("bare et bilde vises som logo", () => {
    expect(logoOf({ logoUrl: LOGO })).toBe(LOGO);
    expect(logoOf({ logoUrl: "https://kirken.example/logo.png" })).toBe("https://kirken.example/logo.png");
    expect(logoOf({})).toBeUndefined();
    expect(logoOf({ logoUrl: "  " })).toBeUndefined();
    expect(logoOf({ logoUrl: "javascript:alert(1)" })).toBeUndefined();
    expect(logoOf({ logoUrl: "data:text/html;base64,PGI+" })).toBeUndefined();
  });
});

describe("Logoen på nettsiden og innloggingssiden", () => {
  test("uten logo står navnet skrevet ut øverst på nettsiden", () => {
    inRouter(<PublicNavbar />);
    expect(screen.queryByRole("img", { name: "Sentrumskirken" })).toBeNull();
    expect(screen.getByText("Sentrumskirken")).toBeTruthy();
    expect(screen.getByText("Et sted å høre til")).toBeTruthy();
  });

  test("med logo vises den i stedet for navnet, og fører til forsiden", () => {
    cms.settings.logoUrl = LOGO;
    inRouter(<PublicNavbar />);
    const logo = screen.getByRole("img", { name: "Sentrumskirken" });
    expect(logo.getAttribute("src")).toBe(LOGO);
    expect(logo.closest("a")?.getAttribute("href")).toBe("/");
    expect(screen.queryByText("Et sted å høre til")).toBeNull();
  });

  test("logoen kan tas av toppen av nettsiden: da står navnet skrevet ut der, og logoen står på innloggingssiden", () => {
    cms.settings.logoUrl = LOGO;
    cms.settings.hideLogoInMenu = true;
    expect(menuLogoOf(cms.settings)).toBeUndefined();
    expect(menuLogoOf({ logoUrl: LOGO })).toBe(LOGO);
    expect(menuLogoOf({ logoUrl: LOGO, hideLogoInMenu: false })).toBe(LOGO);

    inRouter(<PublicNavbar />);
    expect(screen.queryByRole("img", { name: "Sentrumskirken" })).toBeNull();
    // The congregation's own name, once, and not the name of the product
    expect(screen.getAllByText("Sentrumskirken")).toHaveLength(1);
    expect(screen.queryByText("Menighetsplan")).toBeNull();
    expect(screen.getByText("Et sted å høre til")).toBeTruthy();
    cleanup();

    inRouter(<SignInPage />, "/logg-inn");
    expect(screen.getByRole("img", { name: "Sentrumskirken" }).getAttribute("src")).toBe(LOGO);
  });

  test("innloggingssiden viser logoen når det er en, og ellers navnet", () => {
    inRouter(<SignInPage />, "/logg-inn");
    expect(screen.getByText("Sentrumskirken")).toBeTruthy();
    cleanup();

    cms.settings.logoUrl = LOGO;
    inRouter(<SignInPage />, "/logg-inn");
    expect(screen.getByRole("img", { name: "Sentrumskirken" }).getAttribute("src")).toBe(LOGO);
    expect(screen.getByRole("heading", { name: "Logg inn" })).toBeTruthy();
  });
});

describe("Veien til admin øverst på nettsiden", () => {
  test("en administrator har et lite symbol, uten tekst", () => {
    app.currentUser = { id: "kari", name: "Kari Nordmann", globalRole: "admin" };
    inRouter(<PublicNavbar />);
    const link = screen.getByRole("link", { name: "Administrasjon" });
    expect(link.getAttribute("href")).toBe("/admin");
    expect(link.textContent).toBe("");
    expect(screen.queryByText("Admin Studio")).toBeNull();
  });

  test("andre har ingen vei dit", () => {
    app.currentUser = { id: "ola", name: "Ola Hansen", globalRole: "member" };
    inRouter(<PublicNavbar />);
    expect(screen.queryByRole("link", { name: "Administrasjon" })).toBeNull();
  });
});

describe("Logoen i innstillingene", () => {
  const choose = (file: File) => fireEvent.change(screen.getByLabelText("Logofil"), { target: { files: [file] } });

  test("en valgt logo vises, og lagres sammen med resten av innstillingene", async () => {
    inRouter(<SiteSettingsTab />);
    expect(screen.getByRole("button", { name: "Velg logo" })).toBeTruthy();

    choose(new File(["bilde"], "logo.png", { type: "image/png" }));
    const preview = await screen.findByRole("img", { name: "Logoen til Sentrumskirken" });
    expect(preview.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(screen.getByText(/Trykk «Lagre alle innstillinger»/)).toBeTruthy();
    expect(cms.saveSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Lagre alle innstillinger" }));
    await waitFor(() => expect(cms.saveSettings).toHaveBeenCalledTimes(1));
    expect(cms.saveSettings.mock.calls[0][0].logoUrl).toMatch(/^data:image\/png;base64,/);
    expect(cms.saveSettings.mock.calls[0][0].churchName).toBe("Sentrumskirken");
  });

  test("valget om logoen øverst på nettsiden står bare når det er en logo, er på til det tas av, og lagres", async () => {
    inRouter(<SiteSettingsTab />);
    expect(screen.queryByLabelText("Vis logoen øverst på nettsiden")).toBeNull();
    cleanup();

    cms.settings.logoUrl = LOGO;
    inRouter(<SiteSettingsTab />);
    const choice = screen.getByLabelText("Vis logoen øverst på nettsiden") as HTMLInputElement;
    expect(choice.checked).toBe(true);
    fireEvent.click(choice);
    expect(choice.checked).toBe(false);
    expect(screen.getByText("Navnet står skrevet ut øverst på nettsiden. Logoen vises på innloggingssiden.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Lagre alle innstillinger" }));
    await waitFor(() => expect(cms.saveSettings).toHaveBeenCalledTimes(1));
    expect(cms.saveSettings.mock.calls[0][0]).toMatchObject({ logoUrl: LOGO, hideLogoInMenu: true });
  });

  test("en fil som ikke kan være logo, sies fra om, og logoen som var, står", async () => {
    cms.settings.logoUrl = LOGO;
    inRouter(<SiteSettingsTab />);
    choose(new File(["tekst"], "brev.pdf", { type: "application/pdf" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/PNG, SVG, JPG eller WebP/);
    expect(screen.getByRole("img", { name: "Logoen til Sentrumskirken" }).getAttribute("src")).toBe(LOGO);
  });

  test("logoen kan fjernes", async () => {
    cms.settings.logoUrl = LOGO;
    inRouter(<SiteSettingsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Fjern logoen" }));
    expect(screen.queryByRole("img", { name: "Logoen til Sentrumskirken" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Lagre alle innstillinger" }));
    await waitFor(() => expect(cms.saveSettings).toHaveBeenCalledTimes(1));
    expect(cms.saveSettings.mock.calls[0][0].logoUrl).toBeUndefined();
  });
});
