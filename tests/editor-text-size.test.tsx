// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  EDITOR_TEXT_ZOOM,
  EditorTextSizeControl,
  useEditorTextSize,
} from "../src/components/admin/EditorTextSize";
import type { EditorTextSize } from "../src/components/admin/EditorTextSize";

const KEY = "menighetsplan:tekststorrelse-redigering";

// Shows the hook's current value and exposes its setter through a button.
function HookProbe({ next }: { next: EditorTextSize }) {
  const [size, setSize] = useEditorTextSize();
  return (
    <div>
      <span data-testid="size">{size}</span>
      <button type="button" onClick={() => setSize(next)}>
        velg
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("EditorTextSizeControl", () => {
  test("marks only the active button with aria-pressed and reports the clicked size", () => {
    const onChange = vi.fn();
    render(<EditorTextSizeControl value="storre" onChange={onChange} />);

    expect(screen.getByRole("group", { name: "Tekststørrelse i feltene" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Normal tekst" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Større tekst" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Størst tekst" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Størst tekst" }));
    expect(onChange).toHaveBeenCalledWith("storst");
  });
});

describe("useEditorTextSize", () => {
  test("reads a stored valid value", () => {
    localStorage.setItem(KEY, "storst");
    render(<HookProbe next="normal" />);
    expect(screen.getByTestId("size").textContent).toBe("storst");
  });

  test("ignores an invalid stored value and falls back to normal", () => {
    localStorage.setItem(KEY, "gigantisk");
    render(<HookProbe next="normal" />);
    expect(screen.getByTestId("size").textContent).toBe("normal");
  });

  test("writes the chosen size to localStorage", () => {
    render(<HookProbe next="storre" />);
    fireEvent.click(screen.getByRole("button", { name: "velg" }));
    expect(screen.getByTestId("size").textContent).toBe("storre");
    expect(localStorage.getItem(KEY)).toBe("storre");
  });
});

describe("EDITOR_TEXT_ZOOM", () => {
  test("maps each size to its zoom factor", () => {
    expect(EDITOR_TEXT_ZOOM).toEqual({ normal: 1, storre: 1.15, storst: 1.3 });
  });
});
