// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings } from "../src/data/cmsData";

// A text block opens with a press on its title or text, and what is typed shows in the preview by
// itself, without «Bruk endringer», as the modules already do.

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: demoCmsSettings, pages: [], news: [], sermons: [], staff: [], media: [] }),
}));

import { VisualBlockManager } from "../src/pages/admin/tabs/pages/VisualBlockManager";
import type { VisualBlock } from "../src/utils/cmsBlocks";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const block: VisualBlock = { id: "block-text-0", type: "text", title: "Kurs", isDynamic: false, rawContent: "## Kurs\nHovedsalen rommer 250." };

const show = (onChange = vi.fn()) =>
  render(
    <MemoryRouter>
      <VisualBlockManager blocks={[block]} onChange={onChange} onOpenBlockPicker={vi.fn()} />
    </MemoryRouter>
  );

describe("Tekstblokken direkte", () => {
  test("et trykk på tittelen eller teksten åpner feltene", () => {
    show();
    fireEvent.click(screen.getByTitle("Trykk for å redigere"));
    expect(screen.getByText("Vises i forhåndsvisningen med en gang")).toBeTruthy();
    expect(screen.queryByText("Bruk endringer")).toBeNull();
  });

  test("en endret tittel gjelder av seg selv litt etter, og å se uten å endre gjør ingenting", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    show(onChange);
    fireEvent.click(screen.getByTitle("Trykk for å redigere"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).not.toHaveBeenCalled();

    const title = screen.getAllByRole("textbox").find((element) => (element as HTMLInputElement).value === "Kurs") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Kurs og konferanser" } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).toHaveBeenCalledOnce();
    expect((onChange.mock.calls[0][0] as VisualBlock[])[0].rawContent).toContain("## Kurs og konferanser");
  });
});
