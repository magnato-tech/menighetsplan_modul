// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings, emptyCmsSettings, type CmsSettings } from "../src/data/cmsData";

const { cms } = vi.hoisted(() => ({ cms: { settings: {} as CmsSettings } }));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));

import { GivingModule } from "../src/components/cms/modules/GivingModule";
import { NotConfiguredNotice } from "../src/components/NotConfiguredNotice";
import { PublicFooter } from "../src/components/public/PublicFooter";

const footer = (settings: CmsSettings) => {
  cms.settings = settings;
  return render(
    <MemoryRouter>
      <PublicFooter />
    </MemoryRouter>
  );
};

afterEach(cleanup);

describe("Bunnen av nettsiden viser bare det menigheten har lagt inn", () => {
  test("uten egne innstillinger står navnet «Menigheten», og ingen kontakt- eller gaveopplysninger", () => {
    const { container } = footer(emptyCmsSettings);

    expect(screen.getByRole("heading", { name: "Menigheten" })).toBeTruthy();
    for (const absent of ["Besøk & Kontakt", "Gaver & Kollekt", "Vipps", "Bankkonto:", "Orgnr:"]) {
      expect(screen.queryByText(absent)).toBeNull();
    }
    // Nothing is said about which church body the congregation belongs to, and no link leads nowhere
    expect(container.textContent).not.toMatch(/Misjonskirken|tilknyttet/);
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull();
  });

  test("med innstillinger vises hver opplysning som er fylt inn", () => {
    footer(demoCmsSettings);

    expect(screen.getByText("Besøk & Kontakt")).toBeTruthy();
    expect(screen.getByText(demoCmsSettings.address)).toBeTruthy();
    expect(screen.getByRole("link", { name: demoCmsSettings.phone }).getAttribute("href")).toBe(`tel:${demoCmsSettings.phone}`);
    expect(screen.getByRole("link", { name: demoCmsSettings.email }).getAttribute("href")).toBe(`mailto:${demoCmsSettings.email}`);
    expect(screen.getByText(demoCmsSettings.officeHours)).toBeTruthy();
    expect(screen.getByText(demoCmsSettings.vippsNumber)).toBeTruthy();
    expect(screen.getByText(demoCmsSettings.bankAccount)).toBeTruthy();
    expect(screen.getByText(demoCmsSettings.orgNumber)).toBeTruthy();
    expect(screen.getByText(demoCmsSettings.tagline)).toBeTruthy();
  });

  test("har menigheten bare konto og telefon, vises bare det", () => {
    footer({ ...emptyCmsSettings, churchName: "Sentrumskirken", phone: "400 00 000", bankAccount: "1234.56.78901" });

    expect(screen.getByRole("heading", { name: "Sentrumskirken" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "400 00 000" })).toBeTruthy();
    expect(screen.getByText("1234.56.78901")).toBeTruthy();
    expect(screen.queryByText("Vipps")).toBeNull();
    expect(screen.queryByText("Orgnr:")).toBeNull();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });
});

describe("Gaveblokken viser bare måtene å gi på som er lagt inn", () => {
  test("uten nummer og konto vises teksten, men ingen tomme bokser", () => {
    cms.settings = emptyCmsSettings;
    render(<GivingModule />);

    expect(screen.getByRole("heading", { name: "Støtt menighetens arbeid" })).toBeTruthy();
    expect(screen.queryByText("Vipps til nummer")).toBeNull();
    expect(screen.queryByText("Bankkonto for gaver")).toBeNull();
  });

  test("Vipps-varianten tegnes ikke uten et nummer", () => {
    cms.settings = emptyCmsSettings;
    const { container } = render(<GivingModule variant="vipps" />);
    expect(container.textContent).toBe("");

    cleanup();
    cms.settings = { ...emptyCmsSettings, churchName: "Sentrumskirken", vippsNumber: "#55555" };
    render(<GivingModule variant="vipps" />);
    expect(screen.getByText("#55555")).toBeTruthy();
    expect(screen.getByText("Takk for din gave til arbeidet i Sentrumskirken!")).toBeTruthy();
  });

  test("med bare konto vises kontoen, ikke Vipps", () => {
    cms.settings = { ...emptyCmsSettings, bankAccount: "1234.56.78901" };
    render(<GivingModule />);

    expect(screen.getByText("1234.56.78901")).toBeTruthy();
    expect(screen.queryByText("Vipps til nummer")).toBeNull();
  });
});

describe("En installasjon som ikke er satt opp", () => {
  test("sier det, og hvilke innstillinger som mangler", () => {
    render(<NotConfiguredNotice missing={["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID"]} />);

    expect(screen.getByRole("heading", { name: "Denne installasjonen er ikke satt opp ennå" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID"]);
  });
});
