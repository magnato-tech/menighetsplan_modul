// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings } from "../src/data/cmsData";

// Backlog 21 October: earlier versions of pages and articles, pictures kept as text moved to the
// picture store, a module's fields shown in the preview at once, and pictures from a template.

const { versions } = vi.hoisted(() => ({ versions: { list: [] as unknown[] } }));

vi.mock("../src/services/contentVersions", () => ({
  fetchVersions: vi.fn(async () => versions.list),
  keepVersion: vi.fn(async () => {}),
}));
vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: demoCmsSettings, pages: [], news: [], sermons: [], staff: [], media: [] }),
}));

import { contentChanged, restoredFields, versionOf, versionsToPrune, MAX_VERSIONS, type ContentVersion } from "../src/utils/contentVersions";
import { findStoredImages, storedImagesIn, storedImageType, withStoredImagesReplaced } from "../src/utils/storedImages";
import { templateImageFor } from "../src/utils/gatheringPresentation";
import { VersionHistoryDialog } from "../src/components/admin/VersionHistoryDialog";
import { VisualBlockManager, LIVE_APPLY_MS } from "../src/pages/admin/tabs/pages/VisualBlockManager";
import { readModulePresentation } from "../src/utils/modulePresentation";
import type { VisualBlock } from "../src/utils/cmsBlocks";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  versions.list = [];
});

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const JPG = "data:image/jpeg;base64,/9j/4AAQ=";

describe("Tidligere versjoner av sider og nyheter", () => {
  const page = { id: "page-om-oss", title: "Om oss", content: "Tekst", updatedAt: "2026-10-20T10:00:00.000Z", status: "published" };

  test("en lagring uten endring i innholdet tar ikke vare på noen versjon", () => {
    expect(contentChanged(page, { ...page, updatedAt: "2026-10-21T10:00:00.000Z" })).toBe(false);
    expect(contentChanged(page, { ...page, content: "Ny tekst" })).toBe(true);
  });

  test("versjonen er siden slik den var lagret, med tiden den ble lagret", () => {
    const version = versionOf("page", page, new Date("2026-10-21T12:00:00.000Z"), () => "v1");
    expect(version).toMatchObject({ id: "v1", kind: "page", targetId: "page-om-oss", savedAt: page.updatedAt, title: "Om oss" });
    expect(version.snapshot.content).toBe("Tekst");
  });

  test(`bare de ${MAX_VERSIONS} nyeste tas vare på`, () => {
    const many = Array.from({ length: MAX_VERSIONS + 3 }, (_, i) => ({ id: `v${i}`, replacedAt: `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00.000Z` }) as ContentVersion);
    expect(versionsToPrune(many)).toEqual(["v2", "v1", "v0"]);
  });

  test("en gjenopprettet versjon legges i redigeringen på samme side, uten blokkene redigeringen holdt", () => {
    const version = versionOf("page", page, new Date(), () => "v1");
    const fields = restoredFields(version);
    expect(fields.id).toBe("page-om-oss");
    expect(fields.content).toBe("Tekst");
    expect("blocks" in fields && fields.blocks === undefined).toBe(true);
    expect(fields.updatedAt).toBeUndefined();
  });

  test("Historikk viser versjonene, nyeste først, og Gjenopprett gir versjonen tilbake", async () => {
    const older = versionOf("page", { ...page, title: "Om oss (gammel)" }, new Date("2026-10-19T10:00:00.000Z"), () => "v-old");
    const newer = versionOf("page", page, new Date("2026-10-21T10:00:00.000Z"), () => "v-new");
    versions.list = [newer, older];
    const onRestore = vi.fn();
    render(<VersionHistoryDialog kind="page" targetId="page-om-oss" onRestore={onRestore} onClose={vi.fn()} />);
    const buttons = await screen.findAllByText("Gjenopprett");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onRestore).toHaveBeenCalledWith(older);
  });

  test("uten tidligere versjoner sier Historikk det", async () => {
    render(<VersionHistoryDialog kind="news" targetId="news-1" onRestore={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText(/Ingen tidligere versjoner ennå/)).toBeTruthy();
  });
});

describe("Bilder lagret som tekst", () => {
  test("finnes i felt, i lister og inne i teksten på en side", () => {
    expect(storedImagesIn(PNG)).toEqual([PNG]);
    expect(storedImagesIn(["https://x/y.jpg", JPG])).toEqual([JPG]);
    expect(storedImagesIn(`Tekst\n:::media-left[${JPG}]\nMer\n:::`)).toEqual([JPG]);
    const places = findStoredImages("page", [
      { id: "a", title: "Forside", heroImage: PNG, content: "ingen" },
      { id: "b", title: "Om oss", heroImage: "https://x/y.jpg" },
    ]);
    expect(places).toEqual([{ kind: "page", id: "a", title: "Forside", fields: ["heroImage"] }]);
  });

  test("erstattes med adressen i bildelageret, og resten står", () => {
    const addresses = new Map([[PNG, "https://lager/logo.png"], [JPG, "https://lager/bilde.jpg"]]);
    const doc = { heroImage: PNG, heroImages: [JPG, "https://x/z.jpg"], content: `Før ![](${JPG}) etter` };
    expect(withStoredImagesReplaced(doc, ["heroImage", "heroImages", "content"], addresses)).toEqual({
      heroImage: "https://lager/logo.png",
      heroImages: ["https://lager/bilde.jpg", "https://x/z.jpg"],
      content: "Før ![](https://lager/bilde.jpg) etter",
    });
  });

  test("beholder filtypen, så en logo med gjennomsiktig bakgrunn blir PNG", () => {
    expect(storedImageType(PNG)).toEqual({ contentType: "image/png", extension: "png" });
    expect(storedImageType(JPG)).toEqual({ contentType: "image/jpeg", extension: "jpg" });
    expect(storedImageType("data:image/svg+xml;base64,PHN2Zz4=").extension).toBe("svg");
  });
});

describe("Bilde fra malen", () => {
  const templates = [{ id: "mal-gudstjeneste", imageUrl: "https://x/kirke.jpg", imageAlt: "Kirken" }, { id: "mal-uten" }];

  test("et arrangement uten bilde, laget fra en mal med bilde, kan få malens", () => {
    expect(templateImageFor({ templateId: "mal-gudstjeneste" }, templates)).toEqual({ imageUrl: "https://x/kirke.jpg", imageAlt: "Kirken" });
  });

  test("ikke når arrangementet har eget bilde, ingen mal, eller malen ikke har bilde", () => {
    expect(templateImageFor({ templateId: "mal-gudstjeneste", imageUrl: "https://x/eget.jpg" }, templates)).toBeNull();
    expect(templateImageFor({}, templates)).toBeNull();
    expect(templateImageFor({ templateId: "mal-uten" }, templates)).toBeNull();
  });
});

describe("Valgene i en modul vises i forhåndsvisningen med en gang", () => {
  test(`uten «Bruk endringer», ${LIVE_APPLY_MS} ms etter siste endring, og feltene blir stående åpne`, async () => {
    vi.useFakeTimers();
    const blocks: VisualBlock[] = [{ id: "module-news-0", type: "module-news", title: "Nyheter og artikler", isDynamic: true, rawContent: "" }];
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <VisualBlockManager blocks={blocks} onChange={onChange} onOpenBlockPicker={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("Rediger innhold"));
    const title = screen.getByText("Seksjonstittel").parentElement!.querySelector("input")!;
    fireEvent.change(title, { target: { value: "Siste nytt" } });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(LIVE_APPLY_MS));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next] = onChange.mock.calls[0] as [VisualBlock[]];
    expect(readModulePresentation(next[0]).title).toBe("Siste nytt");
    // Still open for more changes
    expect(screen.getByText("Bruk endringer")).toBeTruthy();
  });
});
