// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings } from "../src/data/cmsData";

// Ferdig on a block that was opened but not changed leaves the page as it was, so it is not marked
// «Ikke lagret»; and a text block that is changed keeps its anchor, so links to the section still work.

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: demoCmsSettings, pages: [], news: [], sermons: [], staff: [], media: [] }),
}));

import { VisualBlockManager } from "../src/pages/admin/tabs/pages/VisualBlockManager";
import { applyStaticFields, readStaticFields, type VisualBlock } from "../src/utils/cmsBlocks";

afterEach(cleanup);

const block: VisualBlock = {
  id: "block-text-0",
  type: "text",
  title: "Kurs",
  isDynamic: false,
  rawContent: "<!-- cms-anchor:kurs -->\n## Kurs\nHovedsalen rommer 250.",
};

describe("Ferdig uten endringer", () => {
  test("blokken blir som den var", () => {
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <VisualBlockManager blocks={[block]} onChange={onChange} onOpenBlockPicker={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("Rediger innhold"));
    fireEvent.click(screen.getByText("Ferdig"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Ankeret i en tekstblokk", () => {
  test("blir med når teksten endres", () => {
    const fields = readStaticFields(block);
    const changed = applyStaticFields(block, { ...fields, body: "Hovedsalen rommer 300." });
    expect(changed.rawContent?.startsWith("<!-- cms-anchor:kurs -->\n")).toBe(true);
    expect(changed.rawContent).toContain("Hovedsalen rommer 300.");
  });

  test("en blokk uten anker får ikke noe", () => {
    const plain = { ...block, rawContent: "## Kurs\nTekst" };
    expect(applyStaticFields(plain, readStaticFields(plain)).rawContent).not.toContain("cms-anchor");
  });
});
