// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageEditModal } from "../src/pages/admin/tabs/pages/PageEditModal";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";

const { savePage } = vi.hoisted(() => ({ savePage: vi.fn(async () => true) }));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: demoCmsSettings,
    pages: [],
    media: [],
    news: [],
    sermons: [],
    staff: [],
    savePage,
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
  savePage.mockClear();
});

const side: Partial<CmsPage> = { id: "page-om-oss", slug: "om-oss", title: "Om oss" };

const rediger = (props: { isNewPage?: boolean; onDuplicate?: () => void; onDelete?: () => void }) =>
  render(
    <MemoryRouter>
      <PageEditModal
        editingPage={side}
        isNewPage={props.isNewPage ?? false}
        availableParentPages={[]}
        onUpdate={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={props.onDuplicate}
        onDelete={props.onDelete}
      />
    </MemoryRouter>
  );

describe("«Mer»-menyen i redigeringen av en side", () => {
  test("«Mer» åpner en meny med «Kopier siden» og «Slett siden»", () => {
    const view = rediger({ onDuplicate: vi.fn(), onDelete: vi.fn() });
    const mer = view.getByRole("button", { name: "Mer" });
    expect(mer.getAttribute("aria-expanded")).toBe("false");
    expect(view.queryByRole("menu")).toBeNull();

    fireEvent.click(mer);
    expect(mer.getAttribute("aria-expanded")).toBe("true");
    expect(view.getByRole("menu")).toBeTruthy();
    expect(view.getByRole("menuitem", { name: "Kopier siden" })).toBeTruthy();
    expect(view.getByRole("menuitem", { name: "Slett siden" })).toBeTruthy();
  });

  test("«Kopier siden» kaller onDuplicate og lukker menyen", () => {
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const view = rediger({ onDuplicate, onDelete });
    fireEvent.click(view.getByRole("button", { name: "Mer" }));
    fireEvent.click(view.getByRole("menuitem", { name: "Kopier siden" }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(view.queryByRole("menu")).toBeNull();
  });

  test("«Slett siden» kaller onDelete og lukker menyen", () => {
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const view = rediger({ onDuplicate, onDelete });
    fireEvent.click(view.getByRole("button", { name: "Mer" }));
    fireEvent.click(view.getByRole("menuitem", { name: "Slett siden" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDuplicate).not.toHaveBeenCalled();
    expect(view.queryByRole("menu")).toBeNull();
  });

  test("Escape lukker menyen", () => {
    const view = rediger({ onDuplicate: vi.fn(), onDelete: vi.fn() });
    fireEvent.click(view.getByRole("button", { name: "Mer" }));
    expect(view.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(view.queryByRole("menu")).toBeNull();
  });

  test("et klikk utenfor menyen lukker den", () => {
    const view = rediger({ onDuplicate: vi.fn(), onDelete: vi.fn() });
    fireEvent.click(view.getByRole("button", { name: "Mer" }));
    fireEvent.mouseDown(document.body);
    expect(view.queryByRole("menu")).toBeNull();
  });

  test("ingen «Mer» for en ny side", () => {
    const view = rediger({ isNewPage: true, onDuplicate: vi.fn(), onDelete: vi.fn() });
    expect(view.queryByRole("button", { name: "Mer" })).toBeNull();
  });

  test("ingen «Mer» når verken onDuplicate eller onDelete er gitt", () => {
    const view = rediger({});
    expect(view.queryByRole("button", { name: "Mer" })).toBeNull();
  });
});
