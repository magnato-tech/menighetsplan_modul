// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageTreeList } from "../src/pages/admin/tabs/pages/PageTreeList";
import { buildPageTree, findOrphanPages } from "../src/utils/menu";
import type { CmsPage } from "../src/data/cmsData";

vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ pages: [] }) }));

const page = (id: string, extra: Partial<CmsPage> = {}): CmsPage => ({
  id,
  slug: id,
  title: id,
  summary: "",
  content: "",
  isPublished: true,
  inNavMenu: true,
  parentId: null,
  navOrder: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});

const pages = [
  page("forside", { title: "Forside", navOrder: 1 }),
  page("om-oss", { title: "Om oss", navOrder: 2 }),
  page("historie", { title: "Vår historie", parentId: "om-oss" }),
  page("skjult", { title: "Skjult side", navOrder: 3, inNavMenu: false }),
  page("kladd", { title: "Kladd side", navOrder: 4, isPublished: false }),
];

const IN_MENU = "I menyen. Klikk for å ta siden ut av menyen.";
const NOT_IN_MENU = "Ikke i menyen. Klikk for å vise siden i menyen.";
const OPEN = "Åpne siden i ny fane";

const rowOf = (id: string) => document.getElementById(`side-${id}`) as HTMLElement;

const renderList = () => {
  const onToggleNavMenu = vi.fn();
  render(
    <MemoryRouter>
      <PageTreeList
        hierarchicalPages={buildPageTree(pages)}
        orphanPages={findOrphanPages(pages)}
        onOpenNewPage={vi.fn()}
        onOpenEditPage={vi.fn()}
        onRequestDelete={vi.fn()}
        onToggleNavMenu={onToggleNavMenu}
      />
    </MemoryRouter>
  );
  return onToggleNavMenu;
};

beforeEach(() => {
  localStorage.clear();
  // The list is shown as on a phone, without the menu bar
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

describe("Knappen for menyen i Sider", () => {
  test("en hovedside i menyen: klikk på «I toppmeny» sender siden til onToggleNavMenu", () => {
    const onToggleNavMenu = renderList();
    fireEvent.click(within(rowOf("forside")).getByRole("button", { name: IN_MENU }));
    expect(onToggleNavMenu).toHaveBeenCalledTimes(1);
    expect(onToggleNavMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "forside" }));
  });

  test("en underside i menyen: klikk på «I meny» sender undersiden til onToggleNavMenu", () => {
    const onToggleNavMenu = renderList();
    fireEvent.click(within(rowOf("historie")).getByRole("button", { name: IN_MENU }));
    expect(onToggleNavMenu).toHaveBeenCalledTimes(1);
    expect(onToggleNavMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "historie" }));
  });

  test("en side som er skjult fra menyen viser den alternative teksten, og klikk sender siden videre", () => {
    const onToggleNavMenu = renderList();
    const toggle = within(rowOf("skjult")).getByRole("button", { name: NOT_IN_MENU });
    expect(toggle.textContent).toBe("Skjult fra meny");
    fireEvent.click(toggle);
    expect(onToggleNavMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "skjult" }));
  });

  test("hver rad har nøyaktig én knapp for å åpne siden i ny fane, og den peker til forhåndsvisningen", () => {
    renderList();
    // Five rows, one open-in-new-tab link each (sub-pages included)
    const opens = screen.getAllByRole("link", { name: OPEN });
    expect(opens).toHaveLength(pages.length);
    for (const id of ["forside", "historie", "skjult", "kladd"]) {
      expect(within(rowOf(id)).getAllByRole("link", { name: OPEN })).toHaveLength(1);
    }
    // The preview link also works for drafts
    const draft = within(rowOf("kladd")).getByRole("link", { name: OPEN });
    expect(draft.getAttribute("href")).toContain("preview=true");
    expect(draft.getAttribute("target")).toBe("_blank");
    // The old eye and external-link buttons are gone
    expect(document.querySelectorAll('a[target="_blank"]')).toHaveLength(pages.length);
  });
});
