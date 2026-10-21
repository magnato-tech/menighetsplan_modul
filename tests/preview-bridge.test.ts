import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import {
  acceptIframeMessage,
  acceptParentMessage,
  applyWarmDraft,
  buildDraftSnapshot,
  buildEmbeddedPreviewUrl,
  extractWarmDraft,
  writeDraftSnapshot,
  parseBridgeMessage,
  previewSearchFor,
  pathsMatchDraft,
} from "../src/utils/previewBridge";

describe("previewBridge", () => {
  test("extractWarmDraft excludes cold blobs", () => {
    const largeContent = "x".repeat(5000);
    const largeImage = "data:image/jpeg;base64," + "A".repeat(200_000);
    const warm = extractWarmDraft({
      id: "p1",
      title: "Tittel",
      content: largeContent,
      heroImage: largeImage,
      blocks: [{ id: "b1", type: "text", title: "T", isDynamic: false, rawContent: "hi" }],
    });
    expect(warm.title).toBe("Tittel");
    expect(warm).not.toHaveProperty("content");
    expect(warm).not.toHaveProperty("heroImage");
    expect(warm).not.toHaveProperty("blocks");
    expect(JSON.stringify(warm).length).toBeLessThan(500);
  });

  test("parseBridgeMessage rejects cold fields in cms:draft", () => {
    const msg = parseBridgeMessage({
      type: "cms:draft",
      pageId: "p1",
      revision: 1,
      draft: { title: "Ok", content: "secret" },
    });
    expect(msg).toBeNull();
  });

  test("acceptParentMessage rejects wrong source and origin", () => {
    const iframe = { postMessage: () => {} } as unknown as Window;
    const valid = acceptParentMessage(
      {
        origin: "http://localhost:3000",
        source: iframe,
        data: { type: "preview:location", path: "/om-oss", hash: "" },
      },
      "http://localhost:3000",
      iframe
    );
    expect(valid?.type).toBe("preview:location");

    expect(
      acceptParentMessage(
        {
          origin: "http://evil.test",
          source: iframe,
          data: { type: "preview:location", path: "/om-oss", hash: "" },
        },
        "http://localhost:3000",
        iframe
      )
    ).toBeNull();

    expect(
      acceptParentMessage(
        {
          origin: "http://localhost:3000",
          source: {} as Window,
          data: { type: "preview:location", path: "/om-oss", hash: "" },
        },
        "http://localhost:3000",
        iframe
      )
    ).toBeNull();
  });

  test("acceptIframeMessage rejects preview messages from parent", () => {
    const parent = { postMessage: () => {} } as unknown as Window;
    expect(
      acceptIframeMessage(
        {
          origin: "http://localhost:3000",
          source: parent,
          data: { type: "preview:ready", path: "/", hash: "", revision: 0 },
        },
        "http://localhost:3000",
        parent
      )
    ).toBeNull();
  });

  test("previewSearchFor keeps embedded flag", () => {
    expect(previewSearchFor({ preview: true, embedded: true })).toBe(
      "?preview=true&embedded=1"
    );
    expect(previewSearchFor({ preview: true, embedded: false })).toBe("?preview=true");
  });

  test("buildEmbeddedPreviewUrl includes preview params", () => {
    expect(buildEmbeddedPreviewUrl("/om-oss")).toBe("/om-oss?preview=true&embedded=1");
    expect(buildEmbeddedPreviewUrl("/")).toBe("/?preview=true&embedded=1");
  });

  test("pathsMatchDraft treats root paths equally", () => {
    expect(pathsMatchDraft("/", "/")).toBe(true);
    expect(pathsMatchDraft("/om-oss", "/om-oss")).toBe(true);
    expect(pathsMatchDraft("/om-oss", "/taler")).toBe(false);
  });

  test("applyWarmDraft merges without cold keys", () => {
    const merged = applyWarmDraft({ title: "Old" }, { title: "New", slug: "test" });
    expect(merged.title).toBe("New");
    expect(merged.slug).toBe("test");
  });

  test("firestore rules do not allow open read on cms_pages", () => {
    const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    const cmsPagesBlock = rules.match(/match \/cms_pages\/\{pageId\} \{[\s\S]*?\}/)?.[0] || "";
    expect(cmsPagesBlock).not.toContain("allow read: if true");
    expect(cmsPagesBlock).toContain("isPublished == true");
    // Written by an administrator or a web editor (writesWebsite in the rules)
    expect(cmsPagesBlock).toContain("writesWebsite()");
  });

  describe("siden som forhåndsvisningen får", () => {
    // A browser's storage with room for a set number of characters, like sessionStorage's 5 MB
    const storageWithRoom = (room: number): Storage => {
      const items = new Map<string, string>();
      const used = () => [...items].reduce((sum, [k, v]) => sum + k.length + v.length, 0);
      return {
        get length() { return items.size; },
        key: (i: number) => [...items.keys()][i] ?? null,
        getItem: (k: string) => items.get(k) ?? null,
        setItem: (k: string, v: string) => {
          const before = items.get(k);
          items.set(k, v);
          if (used() > room) {
            if (before === undefined) items.delete(k); else items.set(k, before);
            throw new DOMException("Full", "QuotaExceededError");
          }
        },
        removeItem: (k: string) => void items.delete(k),
        clear: () => items.clear(),
      };
    };
    const image = "data:image/jpeg;base64," + "A".repeat(400_000);
    const page = (extra = {}) =>
      buildDraftSnapshot({ id: "forside", slug: "", title: "Forside", showHeroPrimaryCta: false, heroImage: image, heroImages: [image, image], content: "Tekst", ...extra }, 3);

    test("en side som får plass, lagres hel og bare én gang", () => {
      const storage = storageWithRoom(5_000_000);
      expect(writeDraftSnapshot(page(), undefined, storage)).toBe("full");
      const stored = JSON.parse(storage.getItem("cms_preview_draft_id_forside")!);
      expect(stored.heroImages).toHaveLength(2);
      expect(storage.getItem("cms_preview_active")!.length).toBeLessThan(300);
    });

    test("med for store bilder får forhåndsvisningen likevel det som er skrevet i skjemaet", () => {
      const storage = storageWithRoom(1_000_000);
      expect(writeDraftSnapshot(page(), undefined, storage)).toBe("saved-images");
      const stored = JSON.parse(storage.getItem("cms_preview_draft_id_forside")!);
      expect(stored.showHeroPrimaryCta).toBe(false);
      expect(stored.content).toBe("Tekst");
      expect(stored).not.toHaveProperty("heroImage");
      expect(stored).not.toHaveProperty("heroImages");
    });

    test("en side som er for stor uten bildene også, gir skjemafeltene uten innholdsblokkene", () => {
      const storage = storageWithRoom(300_000);
      expect(writeDraftSnapshot(page({ content: "B".repeat(400_000) }), undefined, storage)).toBe("fields-only");
      const stored = JSON.parse(storage.getItem("cms_preview_draft_id_forside")!);
      expect(stored.showHeroPrimaryCta).toBe(false);
      expect(stored).not.toHaveProperty("content");
    });

    test("en side som er redigert før, tar ikke plassen", () => {
      const storage = storageWithRoom(600_000);
      expect(writeDraftSnapshot(page({ id: "om-oss", slug: "om-oss", heroImages: [] }), undefined, storage)).toBe("full");
      expect(writeDraftSnapshot(page({ heroImages: [] }), undefined, storage)).toBe("full");
      expect(storage.getItem("cms_preview_draft_id_om-oss")).toBeNull();
    });

    test("uten plass i det hele tatt sier den fra i stedet for å feile", () => {
      expect(writeDraftSnapshot(page(), undefined, storageWithRoom(10))).toBe("none");
    });
  });
});
