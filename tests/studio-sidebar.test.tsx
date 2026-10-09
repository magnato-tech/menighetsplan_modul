// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
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
  },
}));
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
import { StudioAppearanceProvider } from "../src/pages/admin/studioAppearance";
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
/** The menu as the studio shows it. Returns the menu itself, without the bar a phone has above it. */
const renderMenu = () => {
  const { container } = render(
    <MemoryRouter>
      <StudioAppearanceProvider>
        <StudioSidebar studio={studio} activeTab="dashboard" onTabChange={onTabChange} sidebarOpen onToggleSidebar={() => {}} />
      </StudioAppearanceProvider>
    </MemoryRouter>
  );
  return within(container.querySelector("aside") as HTMLElement);
};
const stockImages = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `bilde-${i}` })) as never;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  cms.addons = {};
  installation.demo = null;
  installation.owner = "locked";
});

describe("Demo-oppsett i menyen", () => {
  const setup = (menu: ReturnType<typeof renderMenu>) => menu.queryByRole("button", { name: "Demo-oppsett" });

  test("står der for eieren av demoen, og fører til fanen", () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(0));
    installation.demo = {};
    installation.owner = "owner";
    const menu = renderMenu();

    fireEvent.click(setup(menu)!);
    expect(onTabChange).toHaveBeenCalledWith("demo-oppsett");
  });

  test("står ikke der for en besøkende i demoen, heller ikke mens koden prøves", () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(0));
    installation.demo = {};
    for (const owner of ["locked", "checking"] as const) {
      installation.owner = owner;
      expect(setup(renderMenu())).toBeNull();
      cleanup();
    }
  });

  test("står aldri der hos en menighet", () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(0));
    installation.owner = "owner";
    expect(setup(renderMenu())).toBeNull();
  });
});

describe("Menyen i admin", () => {
  test("veiene ut av admin står ett sted hver, øverst i menyen", () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(0));
    const menu = renderMenu();

    const website = menu.getAllByRole("link", { name: /Åpne offentlig nettside/ });
    expect(website).toHaveLength(1);
    expect(website[0].getAttribute("href")).toBe("/");
    expect(website[0].getAttribute("target")).toBe("_blank");

    const myPage = menu.getAllByRole("link", { name: /Gå til Min Side/ });
    expect(myPage).toHaveLength(1);
    expect(myPage[0].getAttribute("href")).toBe("/minside");

    // Right under the overview, ahead of the first menu item, and with nothing after the last one
    const comesBefore = (first: Element, second: Element) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    const overview = menu.getByRole("button", { name: "Oversikt & Dashboard" });
    const firstItem = menu.getByRole("button", { name: /Sider & Innhold/ });
    for (const link of [myPage[0], website[0]]) {
      expect(comesBefore(overview, link)).toBe(true);
      expect(comesBefore(link, firstItem)).toBe(true);
    }
    const lastItem = menu.getByRole("button", { name: /Moduler/ });
    expect(menu.getAllByRole("link").every((link) => comesBefore(link, lastItem))).toBe(true);
  });

  test("Database og Testdata er ett menypunkt, ikke også en snarvei", () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(0));
    const menu = renderMenu();

    const database = menu.getAllByRole("button", { name: /Database/ });
    expect(database).toHaveLength(1);
    fireEvent.click(database[0]);
    expect(onTabChange).toHaveBeenCalledWith("database-admin");
  });

  test("en modul som ikke er slått på, står ikke i menyen", () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(0));
    const menu = renderMenu();

    expect(menu.queryByRole("button", { name: "Analysebord" })).toBeNull();
    expect(menu.queryByRole("button", { name: "Besøk på nettsiden" })).toBeNull();
    // Nor is the heading they would have stood under
    expect(menu.queryByText("Analyse")).toBeNull();

    const modules = menu.getByRole("button", { name: /Moduler/ });
    expect(modules.textContent).toBe("Moduler0 av 2 på");
    fireEvent.click(modules);
    expect(onTabChange).toHaveBeenCalledWith("moduler");
  });

  test("en modul som er slått på, får sin plass i menyen, og den andre er fortsatt borte", () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(0));
    cms.addons = { nettsidebesok: true };
    const menu = renderMenu();

    expect(menu.getByText("Analyse")).toBeTruthy();
    expect(menu.queryByRole("button", { name: "Analysebord" })).toBeNull();
    fireEvent.click(menu.getByRole("button", { name: "Besøk på nettsiden" }));
    expect(onTabChange).toHaveBeenCalledWith("nettsidebesok");
    expect(menu.getByRole("button", { name: /Moduler/ }).textContent).toBe("Moduler1 av 2 på");
  });

  test("med begge modulene på står de under én overskrift, Analysebord først", () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(0));
    cms.addons = { analysebord: true, nettsidebesok: true };
    const menu = renderMenu();

    expect(menu.getAllByText("Analyse")).toHaveLength(1);
    const board = menu.getByRole("button", { name: "Analysebord" });
    const visits = menu.getByRole("button", { name: "Besøk på nettsiden" });
    expect(Boolean(board.compareDocumentPosition(visits) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    fireEvent.click(board);
    expect(onTabChange).toHaveBeenCalledWith("analyse");
  });

  test("ingenting i menyen står to ganger", () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(0));
    const menu = renderMenu();

    // The number beside a menu item is not part of what it is called
    const names = [...menu.getAllByRole("button"), ...menu.getAllByRole("link")].map((element) =>
      (element.querySelector("span")?.textContent ?? element.textContent ?? "").trim()
    );
    expect(names.length).toBeGreaterThan(15);
    expect(names.every((name) => name !== "")).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  test("tallet ved Mediebibliotek teller bildene som følger med og de opplastede som er klare", async () => {
    vi.mocked(listStockImages).mockResolvedValue(stockImages(30));
    const menu = renderMenu();

    const library = menu.getByRole("button", { name: /Mediebibliotek/ });
    await waitFor(() => expect(library.textContent).toBe("Mediebibliotek32"));
  });

  test("kan ikke bildene som følger med telles, viser tallet de opplastede", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listStockImages).mockRejectedValue(new Error("Ingen forbindelse"));
    const menu = renderMenu();

    await waitFor(() => expect(logged).toHaveBeenCalled());
    expect(menu.getByRole("button", { name: /Mediebibliotek/ }).textContent).toBe("Mediebibliotek2");
  });
});
