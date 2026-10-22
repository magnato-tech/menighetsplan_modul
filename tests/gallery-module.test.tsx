// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { demoCmsSettings } from "../src/data/cmsData";

// «Bildegalleri» on a page: thumbnails, a lightbox with arrow keys and Escape,
// and a gallery block that survives a save and a load.

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: demoCmsSettings, pages: [], news: [], sermons: [], staff: [], media: [] }),
}));
vi.mock("../src/services/stockImages", () => ({ listStockImages: vi.fn().mockResolvedValue([]) }));
vi.mock("../src/demo", () => ({ DEMO: null }));

import { GalleryModule } from "../src/components/cms/modules/GalleryModule";
import {
  applyModulePresentation,
  MODULE_PRESENTATION_DEFAULTS,
  parseGalleryImages,
  readModulePresentation as readConfig,
  serializeGalleryImages,
  type GalleryImage,
} from "../src/utils/modulePresentation";
import {
  parseContentToVisualBlocks,
  serializeVisualBlocksToContent,
  type VisualBlock,
} from "../src/utils/cmsBlocks";

const PICTURES: GalleryImage[] = [
  { src: "https://example.org/a.jpg", caption: "Første" },
  { src: "https://example.org/b.jpg", caption: "Andre" },
  { src: "https://example.org/c.jpg", caption: "" },
];

const galleryConfig = (images: GalleryImage[]) => ({
  ...MODULE_PRESENTATION_DEFAULTS["module-gallery"],
  images: serializeGalleryImages(images),
});

const dialogOf = (container: HTMLElement) => container.querySelector('[role="dialog"]') as HTMLElement | null;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Bildegalleri på siden", () => {
  test("viser en miniatyr per bilde, og bildene uten tekst har tom alt-tekst", () => {
    const view = render(<GalleryModule presentation={galleryConfig(PICTURES)} />);
    const thumbs = view.container.querySelectorAll("img");
    expect(thumbs).toHaveLength(3);
    expect([...thumbs].map((img) => img.getAttribute("alt"))).toEqual(["Første", "Andre", ""]);
    expect(thumbs[0].getAttribute("loading")).toBe("lazy");
    expect(view.container.textContent).toContain("Bilder");
  });

  test("trykk på et bilde åpner det stort, piltastene bytter og Escape lukker", () => {
    const view = render(<GalleryModule presentation={galleryConfig(PICTURES)} />);
    fireEvent.click(view.getByLabelText("Vis bilde: Første"));

    let dialog = dialogOf(view.container);
    expect(dialog).not.toBeNull();
    expect(dialog?.querySelector("img")?.getAttribute("src")).toBe("https://example.org/a.jpg");
    expect(dialog?.textContent).toContain("Første");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    dialog = dialogOf(view.container);
    expect(dialog?.querySelector("img")?.getAttribute("src")).toBe("https://example.org/b.jpg");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(dialogOf(view.container)?.querySelector("img")?.getAttribute("src")).toBe("https://example.org/a.jpg");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialogOf(view.container)).toBeNull();
  });

  test("knappene Forrige og Neste går rundt, og trykk på den mørke bakgrunnen lukker", () => {
    const view = render(<GalleryModule presentation={galleryConfig(PICTURES)} />);
    fireEvent.click(view.getByLabelText("Vis bilde: Første"));
    fireEvent.click(view.getByRole("button", { name: "Forrige" }));
    expect(dialogOf(view.container)?.querySelector("img")?.getAttribute("src")).toBe("https://example.org/c.jpg");
    fireEvent.click(view.getByRole("button", { name: "Neste" }));
    expect(dialogOf(view.container)?.querySelector("img")?.getAttribute("src")).toBe("https://example.org/a.jpg");

    fireEvent.click(dialogOf(view.container) as HTMLElement);
    expect(dialogOf(view.container)).toBeNull();
  });

  test("uten bilder vises ingenting på nettsiden", () => {
    const view = render(<GalleryModule presentation={galleryConfig([])} />);
    expect(view.container.firstChild).toBeNull();
  });
});

describe("Bildegalleri-blokken lagres og leses igjen", () => {
  test("bildene, og tekster med kolon og anførselstegn, kommer tilbake uendret", () => {
    const pictures: GalleryImage[] = [
      { src: "media:abc123", caption: 'Kor: "sang" og lys' },
      { src: "https://example.org/b.jpg", caption: "" },
    ];
    const block: VisualBlock = applyModulePresentation(
      { id: "gallery-1", type: "module-gallery", title: "Bildegalleri", isDynamic: true, variant: "grid" },
      { title: "Bilder", images: serializeGalleryImages(pictures) }
    );

    const content = serializeVisualBlocksToContent([block]);
    const [parsed] = parseContentToVisualBlocks(content);

    expect(parsed.type).toBe("module-gallery");
    expect(parsed.variant).toBe("grid");
    expect(parseGalleryImages(readConfig(parsed).images)).toEqual(pictures);
  });

  test("ødelagt lagret verdi gir en tom galleri i stedet for å knekke siden", () => {
    expect(parseGalleryImages("ikke json")).toEqual([]);
    expect(parseGalleryImages('[{"caption":"mangler bilde"},{"src":"https://example.org/x.jpg"}]')).toEqual([
      { src: "https://example.org/x.jpg", caption: "" },
    ]);
  });
});
