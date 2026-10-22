// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings } from "../src/data/cmsData";

// Backlog 7: a press on a section in the preview beside the editor opens that section in the editor,
// and a press on an event's card in «Hva skjer» opens the event's picture and text.

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: demoCmsSettings, pages: [], news: [], sermons: [], staff: [], media: [] }),
}));

import { acceptParentMessage } from "../src/utils/previewBridge";
import { VisualBlockManager } from "../src/pages/admin/tabs/pages/VisualBlockManager";
import type { VisualBlock } from "../src/utils/cmsBlocks";

afterEach(cleanup);

describe("Meldingen fra forhåndsvisningen", () => {
  const iframe = {} as Window;
  const from = (data: unknown) => acceptParentMessage({ origin: "https://kirke.no", source: iframe, data } as never, "https://kirke.no", iframe);

  test("et trykk på en seksjon sier hvilken, og på et kort også hvilket arrangement", () => {
    expect(from({ type: "preview:select", blockId: "block-module-sermon-4" })).toEqual({ type: "preview:select", blockId: "block-module-sermon-4" });
    expect(from({ type: "preview:select", blockId: "block-module-calendar-2", gatheringId: "gathering-1" })).toEqual({
      type: "preview:select",
      blockId: "block-module-calendar-2",
      gatheringId: "gathering-1",
    });
  });

  test("noe annet enn en seksjon, eller fra et annet vindu, tas ikke imot", () => {
    expect(from({ type: "preview:select", blockId: "<script>" })).toBeNull();
    expect(from({ type: "preview:select" })).toBeNull();
    expect(acceptParentMessage({ origin: "https://andre.no", source: iframe, data: { type: "preview:select", blockId: "hero" } } as never, "https://kirke.no", iframe)).toBeNull();
  });
});

describe("Seksjonen åpnes i redigeringen", () => {
  test("blokken som ble trykket på, åpner feltene sine", () => {
    const blocks: VisualBlock[] = [
      { id: "block-module-news-0", type: "module-news", title: "Nyheter og artikler", isDynamic: true, rawContent: "" },
      { id: "block-module-sermon-1", type: "module-sermon", title: "Siste tale fra søndagen", isDynamic: true, rawContent: "" },
    ];
    render(
      <MemoryRouter>
        <VisualBlockManager blocks={blocks} onChange={vi.fn()} onOpenBlockPicker={vi.fn()} openRequest={{ blockId: "block-module-sermon-1", nonce: 1 }} />
      </MemoryRouter>
    );
    const sermon = document.querySelector('[data-cms-editor-target="block-module-sermon-1"]')!;
    expect(sermon.textContent).toContain("Rediger presentasjon");
    const news = document.querySelector('[data-cms-editor-target="block-module-news-0"]')!;
    expect(news.textContent).not.toContain("Rediger presentasjon");
    expect(screen.getByText("Bruk endringer")).toBeTruthy();
  });
});
