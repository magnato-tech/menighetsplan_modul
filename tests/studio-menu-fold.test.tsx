// @vitest-environment jsdom
import type { FC } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
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
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn().mockResolvedValue([]) }));

import { StudioSidebar } from "../src/pages/admin/StudioSidebar";
import { MENU_FOLD_KEY, useStudioMenuFold } from "../src/pages/admin/studioMenuFold";
import type { StudioData } from "../src/pages/admin/studio";
import type { StudioArea } from "../src/pages/admin/studioAreas";
import { StudioAppearanceProvider } from "../src/pages/admin/studioAppearance";

// The window's width drives every media query: min-width queries match from their width and up
let width = 1400;
const listeners = new Set<() => void>();
const resize = (px: number) => {
  width = px;
  act(() => listeners.forEach((listen) => listen()));
};

beforeEach(() => {
  width = 1400;
  listeners.clear();
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = Number(/min-width: (\d+)px/.exec(query)?.[1] ?? 0);
    return {
      get matches() {
        return width >= min;
      },
      media: query,
      addEventListener: (_type: string, listen: () => void) => listeners.add(listen),
      removeEventListener: (_type: string, listen: () => void) => listeners.delete(listen),
    };
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

/** The button that folds the menu, and whether the menu is folded (data-folded), for a component that uses the fold */
const FoldProbe: FC<{ editing?: boolean }> = ({ editing = false }) => {
  const { folded, toggle } = useStudioMenuFold(editing);
  return (
    <button type="button" data-folded={folded ? "true" : "false"} onClick={toggle}>
      Bryt
    </button>
  );
};
const probe = (container: HTMLElement) => container.querySelector("button") as HTMLButtonElement;

describe("Hovedmenyen: foldet eller åpen", () => {
  test("foldet som standard under 1280 px, åpen fra 1280 px", () => {
    width = 1100;
    const narrow = render(<FoldProbe />);
    expect(probe(narrow.container).dataset.folded).toBe("true");
    cleanup();

    width = 1400;
    const wide = render(<FoldProbe />);
    expect(probe(wide.container).dataset.folded).toBe("false");
  });

  test("følger vinduet når det endres størrelse, så lenge ingen har valgt selv", () => {
    const { container } = render(<FoldProbe />);
    expect(probe(container).dataset.folded).toBe("false");

    resize(1100);
    expect(probe(container).dataset.folded).toBe("true");
  });

  test("mens en side redigeres, foldes menyen, også på bred skjerm", () => {
    const { container } = render(<FoldProbe editing />);
    expect(probe(container).dataset.folded).toBe("true");
  });

  test("knappen bryter, og valget huskes etter ny montering", () => {
    const first = render(<FoldProbe />);
    fireEvent.click(probe(first.container));
    expect(probe(first.container).dataset.folded).toBe("true");
    expect(window.localStorage.getItem(MENU_FOLD_KEY)).toBe("folded");
    cleanup();

    const second = render(<FoldProbe />);
    expect(probe(second.container).dataset.folded).toBe("true");
    fireEvent.click(probe(second.container));
    expect(probe(second.container).dataset.folded).toBe("false");
    expect(window.localStorage.getItem(MENU_FOLD_KEY)).toBe("open");
  });

  test("et valg fra brukeren vinner over bredden, og menyen følger ikke vinduet lenger", () => {
    const { container } = render(<FoldProbe />);
    fireEvent.click(probe(container));
    expect(probe(container).dataset.folded).toBe("true");

    resize(1400);
    expect(probe(container).dataset.folded).toBe("true");
  });

  test("et lagret valg vinner over bredden, også mens en side redigeres", () => {
    window.localStorage.setItem(MENU_FOLD_KEY, "open");
    width = 1100;
    expect(probe(render(<FoldProbe editing />).container).dataset.folded).toBe("false");
    cleanup();

    window.localStorage.setItem(MENU_FOLD_KEY, "folded");
    width = 1400;
    expect(probe(render(<FoldProbe />).container).dataset.folded).toBe("true");
  });

  test("blokkert lagring gir standard uten feil", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blokkert");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blokkert");
    });
    width = 1100;
    const { container } = render(<FoldProbe />);
    expect(probe(container).dataset.folded).toBe("true");
    expect(() => fireEvent.click(probe(container))).not.toThrow();
    expect(probe(container).dataset.folded).toBe("false");
  });

  test("AdminStudio gir alltid bryteren til menyen, ikke bare når en side redigeres", () => {
    const source = readFileSync("src/pages/admin/AdminStudio.tsx", "utf8");
    expect(source).toContain("onToggleCompact={toggleMenu}");
    expect(source).not.toContain("editingPageShown ? toggleMenu");
  });
});

const studio = {
  currentUser: { id: "person-1", name: "Kari Nordmann" },
  adminPersons: [],
  adminGroups: [],
  adminGatherings: [],
  adminTasks: [],
  adminVolunteerRoles: [],
} as unknown as StudioData;

const renderMenu = (props: { area?: StudioArea; compact?: boolean; sidebarOpen?: boolean; unsavedTabs?: string[] } = {}) => {
  const onToggleSidebar = vi.fn();
  const onToggleCompact = vi.fn();
  const { container } = render(
    <MemoryRouter>
      <StudioAppearanceProvider>
        <StudioSidebar
          studio={studio}
          activeTab="dashboard"
          onTabChange={vi.fn()}
          area={props.area ?? "nettside"}
          onAreaChange={vi.fn()}
          sidebarOpen={props.sidebarOpen ?? true}
          onToggleSidebar={onToggleSidebar}
          unsavedTabs={props.unsavedTabs}
          compact={props.compact}
          onToggleCompact={onToggleCompact}
        />
      </StudioAppearanceProvider>
    </MemoryRouter>
  );
  const aside = container.querySelector("aside") as HTMLElement;
  return { container, aside, menu: within(aside), onToggleSidebar, onToggleCompact };
};

describe("Foldet meny", () => {
  test("alle punkter har sitt navn og sin tooltip, også foldet", () => {
    const { aside, menu } = renderMenu({ compact: true });
    expect(aside.getAttribute("data-compact")).toBe("true");

    // A count after a name is part of the name for a screen reader, so the names are matched from their start
    for (const name of [/^Oversikt$/, /^Sider & Innhold/, /^Aktuelt & Nyheter/, /^Taler & Prekener/, /^Mediebibliotek/, /^Hjelp$/, /^Database og Testdata/, /^Moduler/, /^Logg ut$/]) {
      expect(menu.getByRole("button", { name }), String(name)).toBeTruthy();
    }
    expect(menu.getByRole("link", { name: /^Gå til Min Side/ }).getAttribute("title")).toBe("Gå til Min Side");
    expect(menu.getByRole("link", { name: /^Åpne offentlig nettside/ }).getAttribute("title")).toBe("Åpne offentlig nettside");
    expect(aside.querySelector('[title="Oversikt"]')).not.toBeNull();
    expect(aside.querySelector('[title="Hjelp"]')).not.toBeNull();
  });

  test("planleggingen foldet: Kalender har navnet sitt", () => {
    const { menu } = renderMenu({ compact: true, area: "planlegging" });
    expect(menu.getByRole("button", { name: /^Kalender/ })).toBeTruthy();
  });

  test("Logg ut er en ikonknapp med navn, og bytte av meny-tema finnes som sol eller måne", () => {
    const { menu, onToggleCompact } = renderMenu({ compact: true });
    expect(menu.getByRole("button", { name: "Logg ut" }).getAttribute("aria-label")).toBe("Logg ut");
    expect(menu.getByRole("button", { name: /^(Mørk|Lys) meny\./ })).toBeTruthy();
    fireEvent.click(menu.getByRole("button", { name: "Vis hele menyen" }));
    expect(onToggleCompact).toHaveBeenCalledTimes(1);
  });

  test("en side med ulagrede endringer får en prikk på ikonet, ikke teksten", () => {
    const { menu } = renderMenu({ compact: true, unsavedTabs: ["cms-sider"] });
    const sider = menu.getByRole("button", { name: /^Sider & Innhold/ });
    expect(sider.querySelector(".sidebar-folded")).not.toBeNull();
    expect(sider.textContent).toContain("Ikke lagret");
  });

  test("uten folding er punktene uendret, og bryteren står på en vanlig fane", () => {
    const { menu, aside } = renderMenu();
    expect(aside.getAttribute("data-compact")).toBeNull();
    expect(menu.getByRole("button", { name: "Brett sammen menyen" })).toBeTruthy();
  });
});

describe("Telefon", () => {
  test("menyen glir inn fra ☰ i den øverste linjen, og bryteren er skjult under md", () => {
    const { container, aside, menu, onToggleSidebar } = renderMenu({ sidebarOpen: false });
    expect(aside.className).toContain("-translate-x-full md:translate-x-0");

    const topbar = container.querySelector("div.md\\:hidden") as HTMLElement;
    fireEvent.click(within(topbar).getByRole("button"));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);

    // The row of the fold button is hidden below md; the button sits in it
    expect(menu.getByRole("button", { name: "Brett sammen menyen" }).parentElement?.className).toContain("hidden md:flex");
  });
});
