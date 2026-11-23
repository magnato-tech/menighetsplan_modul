// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageEditModal } from "../src/pages/admin/tabs/pages/PageEditModal";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: demoCmsSettings,
    pages: [],
    media: [],
    news: [],
    sermons: [],
    staff: [],
    savePage: vi.fn(async () => true),
    deletePage: vi.fn(),
    reorderPages: vi.fn(),
    getPageBySlug: () => undefined,
  }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ currentUser: { id: "p1", name: "Kari Nordmann", globalRole: "admin" }, allPersons: [], gatherings: [], groups: [] }),
}));

afterEach(() => {
  cleanup();
});

const forside: Partial<CmsPage> = { id: "page-forside", slug: "forside", linkUrl: "/", title: "Forside" };
const omOss: Partial<CmsPage> = { id: "page-om-oss", slug: "om-oss", title: "Om oss" };

const rediger = (page: Partial<CmsPage>, onUpdate = vi.fn()) => {
  const view = render(
    <MemoryRouter>
      <PageEditModal editingPage={page} isNewPage={false} availableParentPages={[]} onUpdate={onUpdate} onSave={vi.fn()} onClose={vi.fn()} />
    </MemoryRouter>
  );
  return { ...view, onUpdate };
};

describe("Toppbildet med færre valg synlig", () => {
  test("hovedfeltene står synlige: bildene, overskriften, og høyden som tre knapper", () => {
    const { getByText, getByRole, getAllByRole } = rediger({ ...forside, heroImage: "https://example.org/ett.jpg" });
    expect(getByText("Bilder")).toBeTruthy();
    expect(getByText("Tittel i Hero")).toBeTruthy();
    expect(getByText("Høyde på datamaskin")).toBeTruthy();
    const knapper = getAllByRole("radio");
    expect(knapper.map((knapp) => knapp.textContent)).toEqual(["Lav", "Middels", "Hele skjermen"]);
    expect(getByRole("radiogroup", { name: "Høyde på datamaskin" })).toBeTruthy();
  });

  test("«Flere valg» er lukket, og inneholder «Slør over bildet» og «Menyen øverst»", () => {
    const { getByText, getByLabelText } = rediger({ ...forside, heroImage: "https://example.org/ett.jpg" });
    const flere = getByText("Flere valg").closest("details") as HTMLDetailsElement;
    expect(flere.open).toBe(false);
    expect(flere.contains(getByLabelText("Slør over bildet"))).toBe(true);
    expect(flere.contains(getByLabelText("Menyen øverst"))).toBe(true);
  });

  test("et klikk på en høyde gir samme oppdatering som valget i listen før", () => {
    const { getByRole, onUpdate } = rediger({ ...forside, heroImage: "https://example.org/ett.jpg" });
    expect(getByRole("radio", { name: "Middels" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(getByRole("radio", { name: "Hele skjermen" }));
    expect(onUpdate).toHaveBeenCalledWith({ heroHeight: "full" });
    fireEvent.click(getByRole("radio", { name: "Lav" }));
    expect(onUpdate).toHaveBeenCalledWith({ heroHeight: "low" });
  });

  test("bilde 2 dukker først opp når hovedbildet er valgt, og bilde 3 når bilde 2 er valgt", () => {
    const { queryByText, getByText, rerender } = rediger({ ...forside });
    expect(queryByText("Toppbilde 2")).toBeNull();
    expect(queryByText("Toppbilde 3")).toBeNull();

    rerender(
      <MemoryRouter>
        <PageEditModal editingPage={{ ...forside, heroImage: "https://example.org/ett.jpg" }} isNewPage={false} availableParentPages={[]} onUpdate={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(getByText("Toppbilde 2")).toBeTruthy();
    expect(queryByText("Toppbilde 3")).toBeNull();

    rerender(
      <MemoryRouter>
        <PageEditModal editingPage={{ ...forside, heroImage: "https://example.org/ett.jpg", heroImages: ["https://example.org/to.jpg"] }} isNewPage={false} availableParentPages={[]} onUpdate={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(getByText("Toppbilde 3")).toBeTruthy();
  });

  test("en tom bildeflate viser «+ Legg til bilde»", () => {
    const { getByText } = rediger({ ...forside, heroImage: "https://example.org/ett.jpg" });
    expect(getByText("+ Legg til bilde")).toBeTruthy();
  });

  test("en vanlig side har ingen høydeknapper", () => {
    const { queryByRole } = rediger(omOss);
    expect(queryByRole("radiogroup", { name: "Høyde på datamaskin" })).toBeNull();
  });
});
