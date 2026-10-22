// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VisualBlockFlow } from "../src/components/cms/VisualBlockFlow";
import type { VisualBlock } from "../src/utils/cmsBlocks";

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ media: [], pages: [], news: [], sermons: [], staff: [] }),
}));

vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ allPersons: [], gatherings: [], groups: [] }),
}));

const textBlock = (settings?: VisualBlock["settings"]): VisualBlock => ({
  id: "block-text-0",
  type: "text",
  title: "Hei",
  isDynamic: false,
  rawContent: "## Hei\nTekst",
  ...(settings ? { settings } : {}),
});

const renderFlow = (blocks: VisualBlock[], preview = false) =>
  render(
    <MemoryRouter>
      <VisualBlockFlow blocks={blocks} preview={preview} />
    </MemoryRouter>
  );

beforeEach(() => {
  // Only the date is faked, so React and the test library keep working normally
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 22, 12));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("VisualBlockFlow med blokkinnstillinger", () => {
  test("en blokk hvis periode er over vises ikke", () => {
    const { container } = renderFlow([textBlock({ visFra: "2026-10-01", visTil: "2026-10-21" })]);
    expect(container.querySelector("[data-cms-block]")).toBeNull();
    expect(container.textContent).not.toContain("Hei");
  });

  test("i forhåndsvisning vises en blokk utenfor perioden, merket og nedtonet", () => {
    const { container } = renderFlow(
      [textBlock({ visFra: "2026-10-01", visTil: "2026-10-21" })],
      true
    );
    const block = container.querySelector("[data-cms-block]");
    expect(block).not.toBeNull();
    const note = container.querySelector("[data-block-period-note]");
    expect(note?.textContent).toBe("Vises 1.–21. okt – ikke synlig nå");
    expect(container.querySelector(".opacity-50")).not.toBeNull();
  });

  test("en blokk med bakgrunn og hvit tekst får bakgrunnsfarge og hvit tekst", () => {
    const { container } = renderFlow([textBlock({ bakgrunn: "#1e3a5f", hvitTekst: true, luft: "ingen" })]);
    const look = container.querySelector<HTMLElement>("[data-block-look]");
    expect(look).not.toBeNull();
    expect(look?.style.backgroundColor).toBe("rgb(30, 58, 95)");
    expect(look?.className).toContain("text-white");
    expect(look?.className).toContain("py-0");
  });

  test("en blokk uten innstillinger får ingen utseende-wrapper", () => {
    const { container } = renderFlow([textBlock()]);
    expect(container.querySelector("[data-block-look]")).toBeNull();
    expect(container.querySelector("[data-cms-block]")?.textContent).toContain("Hei");
  });
});
