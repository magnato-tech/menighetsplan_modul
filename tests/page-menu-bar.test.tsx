// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageTreeList } from "../src/pages/admin/tabs/pages/PageTreeList";
import { buildPageTree } from "../src/utils/menu";
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
  page("livet", { title: "Livet i kirka", navOrder: 3, isPublished: false }),
];

const largeScreen = (large: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: large, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

const show = () =>
  render(
    <MemoryRouter>
      <PageTreeList hierarchicalPages={buildPageTree(pages)} orphanPages={[]} onOpenNewPage={vi.fn()} onOpenEditPage={vi.fn()} onRequestDelete={vi.fn()} />
    </MemoryRouter>
  );

const scrolledTo: string[] = [];

beforeEach(() => {
  localStorage.clear();
  scrolledTo.length = 0;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolledTo.push(this.id);
  } as Element["scrollIntoView"];
});
afterEach(() => cleanup());

describe("Menylinjen i Sider", () => {
  test("på en stor skjerm står nettsidens meny øverst, med kladder merket", () => {
    largeScreen(true);
    show();
    const bar = within(screen.getByRole("navigation", { name: "Menyen på nettsiden" }));
    expect(bar.getByRole("button", { name: /^Forside/ })).toBeTruthy();
    expect(bar.getByRole("button", { name: /^Livet i kirka/ }).textContent).toContain("Kladd");
    // «Kollaps alle» and «Utvid alle» stand in the bar, not twice
    expect(screen.getAllByRole("button", { name: /^Kollaps alle$/ })).toHaveLength(1);
  });

  test("et trykk på en underside åpner fanen den står under og ruller dit", () => {
    largeScreen(true);
    localStorage.setItem("menighetsplan_collapsed_pages", JSON.stringify(["om-oss"]));
    show();
    expect(screen.queryByText("Vår historie", { selector: "h4" })).toBeNull();

    const bar = within(screen.getByRole("navigation", { name: "Menyen på nettsiden" }));
    fireEvent.click(bar.getByRole("button", { name: "Vår historie" }));
    expect(screen.getByText("Vår historie", { selector: "h4" })).toBeTruthy();
    expect(scrolledTo).toContain("side-historie");
  });

  test("et trykk på en hovedfane ruller til den", () => {
    largeScreen(true);
    show();
    const bar = within(screen.getByRole("navigation", { name: "Menyen på nettsiden" }));
    fireEvent.click(bar.getByRole("button", { name: /^Forside/ }));
    expect(scrolledTo).toContain("side-forside");
  });

  test("på en liten skjerm er linjen borte, og listen er som før", () => {
    largeScreen(false);
    show();
    expect(screen.queryByRole("navigation", { name: "Menyen på nettsiden" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Kollaps alle$/ })).toBeTruthy();
  });
});
