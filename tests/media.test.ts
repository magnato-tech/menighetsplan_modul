import { describe, expect, test } from "vitest";
import type { CmsMedia, CmsPage } from "../src/data/cmsData";
import {
  filterMediaLibrary,
  findMediaUsages,
  isMediaRef,
  parseMediaId,
  resolveMediaUrl,
  resolveShareableMediaUrl,
  toMediaRef,
  formatMediaAltComment,
  parseMediaAltComment,
} from "../src/utils/media";

const sampleMedia: CmsMedia = {
  id: "media-1",
  title: "Gudstjeneste",
  altText: "Folk i kirkebenken",
  tags: ["gudstjeneste"],
  status: "ready",
  approvedForAi: false,
  source: "upload",
  sourcePath: "media/media-1/source.jpg",
  variants: {
    web: "https://example.com/web.jpg",
    thumb: "https://example.com/thumb.jpg",
    og: "https://example.com/og.jpg",
  },
  width: 2000,
  height: 1200,
  byteSize: 500000,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mediaById = { "media-1": sampleMedia };

describe("media refs", () => {
  test("parses and builds media references", () => {
    expect(toMediaRef("media-1")).toBe("media:media-1");
    expect(isMediaRef("media:media-1")).toBe(true);
    expect(parseMediaId("media:media-1")).toBe("media-1");
    expect(parseMediaId("https://x")).toBeNull();
  });

  test("resolveMediaUrl maps refs to variant URLs", () => {
    expect(resolveMediaUrl("media:media-1", mediaById, "web")).toBe("https://example.com/web.jpg");
    expect(resolveMediaUrl("media:media-1", mediaById, "og")).toBe("https://example.com/og.jpg");
    expect(resolveMediaUrl("https://legacy.example/a.jpg", mediaById)).toBe("https://legacy.example/a.jpg");
    expect(resolveMediaUrl("media:missing", mediaById)).toBe("");
  });

  test("resolveShareableMediaUrl maps media refs to og variant only", () => {
    expect(resolveShareableMediaUrl("media:media-1", mediaById)).toBe("https://example.com/og.jpg");
    expect(resolveShareableMediaUrl("https://share.example/x.jpg", mediaById)).toBeUndefined();
    expect(resolveShareableMediaUrl("data:image/jpeg;base64,AAAA", mediaById)).toBeUndefined();
  });
});

describe("media alt comments", () => {
  test("round-trips alt comment syntax", () => {
    const line = formatMediaAltComment("Barn i søndagsskolen");
    expect(parseMediaAltComment(line)).toBe("Barn i søndagsskolen");
    expect(formatMediaAltComment("")).toBe("");
  });
});

describe("findMediaUsages", () => {
  const pages: CmsPage[] = [
    {
      id: "page-1",
      slug: "forside",
      title: "Forside",
      summary: "",
      content: "",
      isPublished: true,
      updatedAt: "",
      heroImage: "media:media-1",
      ogImage: "",
    },
    {
      id: "page-2",
      slug: "om-oss",
      title: "Om oss",
      summary: "",
      content: ":::media-left[media:media-1]\nTekst\n:::",
      isPublished: true,
      updatedAt: "",
    },
  ];

  test("finds hero and block references", () => {
    const usages = findMediaUsages("media-1", pages, [], []);
    expect(usages.some((u) => u.label.includes("hovedbilde"))).toBe(true);
    expect(usages.some((u) => u.label.includes("Om oss"))).toBe(true);
  });

  test("finner bildet til en tale, så et bilde som er i bruk der, ikke slettes", () => {
    const sermons = [
      { id: "sermon-1", title: "Fred", speaker: "Kari Nordmann", date: "2026-09-27T12:00:00.000Z", imageUrl: "media:media-1" },
      { id: "sermon-2", title: "Glede", speaker: "Kari Nordmann", date: "2026-09-14T12:00:00.000Z", imageUrl: "https://menigheten.example/glede.jpg" },
    ];
    expect(findMediaUsages("media-1", [], [], [], sermons)).toEqual([{ type: "sermon", id: "sermon-1", label: "Talen «Fred»" }]);
    expect(findMediaUsages("media-2", [], [], [], sermons)).toEqual([]);
  });
});

describe("filterMediaLibrary", () => {
  test("filters archived and search query", () => {
    const archived = { ...sampleMedia, id: "media-2", title: "Arkivert", status: "archived" as const };
    const list = filterMediaLibrary([sampleMedia, archived], "gudstjeneste", false);
    expect(list).toHaveLength(1);
    expect(filterMediaLibrary([sampleMedia, archived], "", true)).toHaveLength(2);
  });
});
