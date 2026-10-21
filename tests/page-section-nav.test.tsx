// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PageSectionNav, moveBlockId, type PageSection } from "../src/components/admin/PageSectionNav";

afterEach(cleanup);

const sections: PageSection[] = [
  { id: "settings", kind: "settings", label: "Innstillinger" },
  { id: "hero", kind: "hero", label: "Toppbilde" },
  { id: "b1", kind: "block", label: "Velkommen" },
  { id: "b2", kind: "block", label: "Hva skjer", hidden: false },
  { id: "b3", kind: "block", label: "Kontakt", hidden: true, unsaved: true },
  { id: "seo", kind: "seo", label: "SEO" },
  { id: "publish", kind: "publish", label: "Publisering" },
];

const setup = (activeId: string | null = null) => {
  const handlers = {
    onSelect: vi.fn(),
    onReorderBlocks: vi.fn(),
    onToggleHidden: vi.fn(),
    onCollapse: vi.fn(),
  };
  render(<PageSectionNav sections={sections} activeId={activeId} {...handlers} />);
  return handlers;
};

/** The row's container <li>, found from the main button that carries the label. */
const rowOf = (label: string) => screen.getByRole("button", { name: label }).parentElement as HTMLElement;

describe("PageSectionNav", () => {
  test("trykk på en rad velger seksjonen, og aktiv rad er markert", () => {
    const { onSelect } = setup("hero");
    fireEvent.click(screen.getByRole("button", { name: "Toppbilde" }));
    expect(onSelect).toHaveBeenCalledWith("hero");
    expect(screen.getByRole("button", { name: "Toppbilde" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "SEO" }).getAttribute("aria-current")).toBeNull();
  });

  test("moveBlockId flytter id-en til målets opprinnelige plass", () => {
    expect(moveBlockId(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveBlockId(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveBlockId(["a", "b", "c"], "a", "a")).toEqual(["a", "b", "c"]);
    expect(moveBlockId(["a", "b", "c"], "x", "a")).toEqual(["a", "b", "c"]);
    expect(moveBlockId(["a", "b", "c"], "a", "x")).toEqual(["a", "b", "c"]);
  });

  test("øyet skjuler eller viser blokken, og merkes etter tilstanden", () => {
    const { onToggleHidden } = setup();
    const eye = within(rowOf("Velkommen")).getByRole("button", { name: "Skjul på nettsiden" });
    fireEvent.click(eye);
    expect(onToggleHidden).toHaveBeenCalledWith("b1");
    expect(within(rowOf("Kontakt")).getByRole("button", { name: "Vis på nettsiden" })).toBeTruthy();
  });

  test("Alt+ned flytter blokken ett hakk ned, og Alt+opp på første blokk gjør ingenting", () => {
    const { onReorderBlocks } = setup();
    const b1 = screen.getByRole("button", { name: "Velkommen" });
    fireEvent.keyDown(b1, { key: "ArrowDown", altKey: true });
    expect(onReorderBlocks).toHaveBeenCalledWith(["b2", "b1", "b3"]);

    onReorderBlocks.mockClear();
    fireEvent.keyDown(b1, { key: "ArrowUp", altKey: true });
    expect(onReorderBlocks).not.toHaveBeenCalled();
  });

  test("«Ikke lagret»-prikken vises kun for blokken som er endret", () => {
    setup();
    const dots = screen.getAllByRole("img", { name: "Ikke lagret" });
    expect(dots).toHaveLength(1);
    expect(within(rowOf("Kontakt")).getByRole("img", { name: "Ikke lagret" })).toBeTruthy();
  });

  test("«Skjul seksjoner» kaller onCollapse", () => {
    const { onCollapse } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Skjul seksjoner" }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  test("dra og slipp en blokk over en annen gir ny rekkefølge", () => {
    const { onReorderBlocks } = setup();
    const dataTransfer = { setData() {}, getData() { return ""; }, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(rowOf("Kontakt"), { dataTransfer });
    fireEvent.dragOver(rowOf("Velkommen"), { dataTransfer });
    fireEvent.drop(rowOf("Velkommen"), { dataTransfer });
    expect(onReorderBlocks).toHaveBeenCalledWith(["b3", "b1", "b2"]);
  });
});
