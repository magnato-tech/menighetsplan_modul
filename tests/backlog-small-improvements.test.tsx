// @vitest-environment jsdom
import { useRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { demoCmsSettings, initialCmsPages } from "../src/data/cmsData";

// The backlog after the survey of other publishing tools: the small things first.

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: demoCmsSettings, pages: [], news: [], sermons: [], staff: [], media: [] }),
}));

import { useSaveShortcut } from "../src/hooks/useUnsavedChanges";
import { copySlug, pageCopyOf } from "../src/utils/pageCopy";
import { VisualBlockManager } from "../src/pages/admin/tabs/pages/VisualBlockManager";
import type { VisualBlock } from "../src/utils/cmsBlocks";
import { seoLengthHint, seoLengthOf } from "../src/utils/seoLength";
import { cardImageClass, whatsOnOptionsOf } from "../src/utils/whatsOn";
import { MODULE_PRESENTATION_FIELDS } from "../src/utils/modulePresentation";
import { daysStandingLong } from "../src/utils/news";

afterEach(cleanup);

function Editor({ shown, save }: { shown: boolean; save: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useSaveShortcut(ref, true, save);
  return <div ref={ref} hidden={!shown} />;
}

describe("1. Ctrl+S lagrer", () => {
  test("det som er åpent, ikke det som ligger i en skjult fane", () => {
    const shown = vi.fn();
    const hidden = vi.fn();
    const { container } = render(
      <>
        <Editor shown save={shown} />
        <Editor shown={false} save={hidden} />
      </>
    );
    // jsdom lays nothing out, so offsetParent is null for both; give the shown one a parent to be seen
    const [first] = Array.from(container.children);
    Object.defineProperty(first, "offsetParent", { get: () => document.body });
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(shown).toHaveBeenCalledOnce();
    expect(hidden).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  test("bare S uten Ctrl gjør ingenting", () => {
    const save = vi.fn();
    render(<Editor shown save={save} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));
    expect(save).not.toHaveBeenCalled();
  });
});

describe("2. Kopier en side", () => {
  const page = initialCmsPages.find((candidate) => candidate.slug === "om-oss")!;

  test("kopien er en kladd utenfor menyen, med egen adresse og uten id", () => {
    const copy = pageCopyOf(page, initialCmsPages);
    expect(copy.id).toBeUndefined();
    expect(copy.title).toBe(`${page.title} (kopi)`);
    expect(copy.slug).toBe("om-oss-kopi");
    expect(copy.isPublished).toBe(false);
    expect(copy.inNavMenu).toBe(false);
    expect(copy.content).toBe(page.content);
  });

  test("en adresse som er tatt, får et tall", () => {
    expect(copySlug("om-oss", [{ slug: "om-oss-kopi" }, { slug: "om-oss-kopi-2" }])).toBe("om-oss-kopi-3");
    expect(copySlug("", [])).toBe("forside-kopi");
  });

  test("forsidens kopi er en vanlig side", () => {
    const home = initialCmsPages.find((candidate) => candidate.linkUrl === "/")!;
    expect(pageCopyOf(home, initialCmsPages).linkUrl).toBeUndefined();
  });
});

describe("3. Kopier en blokk", () => {
  test("kopien legges rett under, uten blokkens anker", () => {
    const block: VisualBlock = { id: "block-text-0", type: "text", title: "Kurs", isDynamic: false, rawContent: "<!-- cms-anchor:kurs -->\n## Kurs\nTekst" };
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <VisualBlockManager blocks={[block]} onChange={onChange} onOpenBlockPicker={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Kopier blokken" }));
    const next = onChange.mock.calls[0][0] as VisualBlock[];
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(block);
    expect(next[1].rawContent).toBe("## Kurs\nTekst");
    expect(next[1].id).not.toBe(block.id);
  });
});

describe("4. Tegnteller for SEO-beskrivelsen", () => {
  test("sier om lengden passer", () => {
    expect(seoLengthOf("")).toBe("empty");
    expect(seoLengthOf("Kort")).toBe("short");
    expect(seoLengthOf("a".repeat(155))).toBe("good");
    expect(seoLengthOf("a".repeat(170))).toBe("long");
    expect(seoLengthHint("a".repeat(170))).toBe("170 tegn. Google kutter etter omtrent 160 tegn.");
  });
});

describe("5. Bildeform «hele plakaten»", () => {
  test("Hva skjer og nyhetene har valget, og fyller kortet som før når det ikke er valgt", () => {
    expect(whatsOnOptionsOf({}).imageFit).toBe("cover");
    expect(whatsOnOptionsOf({ imageFit: "contain" }).imageFit).toBe("contain");
    expect(cardImageClass("contain")).toContain("object-contain");
    expect(cardImageClass("cover")).toContain("object-cover");
    expect(MODULE_PRESENTATION_FIELDS["module-calendar"].some((field) => field.key === "imageFit")).toBe(true);
    expect(MODULE_PRESENTATION_FIELDS["module-news"].some((field) => field.key === "imageFit")).toBe(true);
  });
});

describe("7. Nyheter som har stått lenge uten siste dag", () => {
  const now = Date.parse("2026-10-21T10:00:00Z");

  test("merkes etter to uker, ikke før, og ikke med siste dag", () => {
    expect(daysStandingLong({ publishedAt: "2026-10-01T10:00:00Z" }, [], now)).toBe(20);
    expect(daysStandingLong({ publishedAt: "2026-10-15T10:00:00Z" }, [], now)).toBeNull();
    expect(daysStandingLong({ publishedAt: "2026-10-01T10:00:00Z", expiresAt: "2026-12-01" }, [], now)).toBeNull();
    expect(daysStandingLong({ publishedAt: "2026-10-01T10:00:00Z", isPublished: false }, [], now)).toBeNull();
  });
});
