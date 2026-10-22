// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CropPicker } from "../src/components/admin/CropPicker";

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ media: [] }),
}));

const IMAGE = "https://example.org/bilde.jpg";

/** Renders the picker and tells it the picture has loaded, 2:1, so the frame can be shown. */
function renderLoaded(props: { value?: string; onChange: (value: string) => void }) {
  const utils = render(<CropPicker image={IMAGE} {...props} />);
  const img = utils.container.querySelector("img") as HTMLImageElement;
  Object.defineProperty(img, "naturalWidth", { value: 2000, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: 1000, configurable: true });
  fireEvent.load(img);
  return utils;
}

describe("CropPicker", () => {
  afterEach(() => {
    cleanup();
  });

  test("zoom-glidebryteren lagrer et utsnitt med tre deler", () => {
    const onChange = vi.fn();
    renderLoaded({ value: "", onChange });
    fireEvent.change(screen.getByLabelText("Zoom"), { target: { value: "2" } });
    expect(onChange).toHaveBeenLastCalledWith("50% 50% 2.0");
  });

  test("Tilbakestill gir tilbake midten uten zoom", () => {
    const onChange = vi.fn();
    renderLoaded({ value: "30% 20% 2", onChange });
    fireEvent.click(screen.getByRole("button", { name: "Tilbakestill" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  test("piltasten flytter rammen 2 % av bildet", () => {
    const onChange = vi.fn();
    const { container } = renderLoaded({ value: "", onChange });
    const frame = container.querySelector("[data-crop-frame]") as HTMLElement;
    expect(frame).not.toBeNull();
    fireEvent.keyDown(frame, { key: "ArrowRight" });
    // The frame is 0.889 of the width, so 0.02 of the picture is 18 percentage points of the crop
    expect(onChange).toHaveBeenLastCalledWith("68% 50%");
  });
});
