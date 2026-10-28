// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Gathering } from "../src/types";
import { GatheringDateNav } from "../src/components/gathering/GatheringDateNav";
import { gatheringSequence, type SequenceItem } from "../src/utils/gatheringSequence";
import { combineDateAndTimeToIso } from "../src/utils/dates";

// The arrows and the date of the gathering page: the arrows step, the date opens the list of the gatherings around it.

const day = (n: number) => combineDateAndTimeToIso(`2026-11-${String(n).padStart(2, "0")}`, "11:00");
const item = (id: string, n: number, fields: Partial<Gathering> = {}): SequenceItem => ({
  gathering: { id, groupId: "kor", title: "Gudstjeneste", startsAt: day(n), visibility: "offentlig", isGudstjeneste: true, ...fields } as Gathering,
});
const all = Array.from({ length: 16 }, (_, i) => item(`g${i + 1}`, i + 1, i === 5 ? { cancelled: true, theme: "Advent" } : {}));

function renderNav(currentId: string) {
  const currentItem = all.find((i) => i.gathering.id === currentId)!;
  const sequence = gatheringSequence(currentItem, all);
  const onOpen = vi.fn();
  render(
    <MemoryRouter>
      <GatheringDateNav gathering={currentItem.gathering} sequence={sequence} onOpen={onOpen} />
    </MemoryRouter>
  );
  return { onOpen };
}

afterEach(() => cleanup());

describe("GatheringDateNav", () => {
  test("pilene har aria-label med dato, og er av der det ikke finnes flere", () => {
    renderNav("g1");
    expect((screen.getByRole("button", { name: "Ingen tidligere" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^Neste: / }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("Neste og Forrige melder den nabosamlingen", () => {
    const { onOpen } = renderNav("g5");
    fireEvent.click(screen.getByRole("button", { name: /^Neste: / }));
    expect(onOpen).toHaveBeenLastCalledWith("g6");
    fireEvent.click(screen.getByRole("button", { name: /^Forrige: / }));
    expect(onOpen).toHaveBeenLastCalledWith("g4");
  });

  test("datoen åpner listen: tre før og ti etter, gjeldende merket, avlyst og tema vist", () => {
    const { onOpen } = renderNav("g8");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(document.getElementById("gathering-date-button")!);
    const dialog = screen.getByRole("dialog");
    const rows = within(dialog).getAllByRole("button");
    expect(rows).toHaveLength(12);
    const current = dialog.querySelector('[aria-current="true"]') as HTMLElement;
    expect(current.textContent).toContain("8. nov.");
    expect(rows[0].textContent).toContain("5. nov.");
    expect(within(dialog).getByText("Avlyst")).toBeTruthy();
    expect(within(dialog).getByText("Advent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Neste: / }));
    expect(onOpen).toHaveBeenLastCalledWith("g9");
  });

  test("en rad i listen går til sin samling, og Escape lukker", () => {
    const { onOpen } = renderNav("g8");
    fireEvent.click(document.getElementById("gathering-date-button")!);
    fireEvent.click(within(screen.getByRole("dialog")).getByText(/fre\. 13\./));
    expect(onOpen).toHaveBeenLastCalledWith("g13");
    fireEvent.click(document.getElementById("gathering-date-button")!);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("et klikk utenfor lukker listen", () => {
    renderNav("g8");
    fireEvent.click(document.getElementById("gathering-date-button")!);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
