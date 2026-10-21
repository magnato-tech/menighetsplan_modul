import { describe, expect, test } from "vitest";
import { parseCmsContent } from "../src/components/cms/CmsContentRenderer";
import {
  applyGroupsModuleFields,
  applyStaticFields,
  parseContentToVisualBlocks,
  readGroupsModuleFields,
  readStaticFields,
  serializeVisualBlocksToContent,
  type VisualBlock,
} from "../src/utils/cmsBlocks";
import {
  applyModulePresentation,
  readModulePresentation,
} from "../src/utils/modulePresentation";

describe("Visuell blokkmodell", () => {
  test("Moduler, tekst og knapper blir egne kort og kan lagres tilbake", () => {
    const source = [
      ":::module-worship[highlight]",
      ":::",
      "",
      "## Velkommen",
      "Et åpent hjem.",
      "",
      "[Knapp: Meld deg på](/kontakt)",
      "",
      ":::module-calendar[list]",
      ":::",
    ].join("\n");

    const blocks = parseContentToVisualBlocks(source);
    expect(blocks.map((block) => block.type)).toEqual(["module-worship", "text", "cta", "module-calendar"]);
    expect(blocks[0].variant).toBe("highlight");
    expect(blocks[0].isDynamic).toBe(true);
    expect(blocks[3].variant).toBe("list");

    const again = parseContentToVisualBlocks(serializeVisualBlocksToContent(blocks));
    expect(again.map((block) => [block.type, block.variant || ""])).toEqual([
      ["module-worship", "highlight"],
      ["text", ""],
      ["cta", ""],
      ["module-calendar", "list"],
    ]);
    expect(readStaticFields(again[1]).title).toBe("Velkommen");
    expect(readStaticFields(again[2]).ctaLabel).toBe("Meld deg på");
  });

  test("Skjulte blokker blir med i lagringen, men ikke i den offentlige visningen", () => {
    const blocks: VisualBlock[] = [
      {
        id: "worship",
        type: "module-worship",
        title: "Neste gudstjeneste",
        isDynamic: true,
        variant: "compact",
        hidden: true,
      },
      {
        id: "text",
        type: "text",
        title: "Hilsen",
        isDynamic: false,
        rawContent: "## Hilsen\n\nVelkommen inn.",
      },
    ];

    const stored = serializeVisualBlocksToContent(blocks);
    const parsed = parseContentToVisualBlocks(stored);
    expect(parsed[0].hidden).toBe(true);
    expect(parsed[0].variant).toBe("compact");
    expect(parsed[1].hidden).toBeUndefined();

    const visible = parseCmsContent(stored);
    expect(visible.some((block) => block.type === "module-worship")).toBe(false);
    expect(visible.some((block) => block.type === "heading" && block.text === "Hilsen")).toBe(true);
  });

  test("Statiske felt skrives tilbake uten at redaktøren ser modulkode", () => {
    const media = parseContentToVisualBlocks(
      ":::media-left[https://example.com/kirke.jpg]\n### Fellesskap\nAlle er velkommen.\n:::"
    )[0];
    const fields = readStaticFields(media);
    expect(fields.imageUrl).toBe("https://example.com/kirke.jpg");
    expect(fields.title).toBe("Fellesskap");
    expect(fields.body).toBe("Alle er velkommen.");

    const updated = applyStaticFields(media, { ...fields, title: "Nytt fellesskap" });
    expect(updated.rawContent).toContain("### Nytt fellesskap");
    expect(updated.rawContent).not.toContain(":::module");

    const quote = parseContentToVisualBlocks(":::quote[Kari Nordmann]\nEt åpent hjem.\n:::")[0];
    expect(readStaticFields(quote).author).toBe("Kari Nordmann");
    expect(readStaticFields(quote).body).toBe("Et åpent hjem.");
  });

  test("Husfellesskapsmodulen kan lagre redigerbar tekst og bakgrunn", () => {
    const source = [
      ":::module-groups[banner]",
      "title: Våre grupper",
      "body: Bli med i et nært fellesskap.",
      "backgroundImage: https://example.com/bg.jpg",
      "backgroundColor: #112233",
      ":::",
    ].join("\n");

    const block = parseContentToVisualBlocks(source)[0];
    expect(block.type).toBe("module-groups");
    expect(readGroupsModuleFields(block).title).toBe("Våre grupper");
    expect(readGroupsModuleFields(block).backgroundImage).toBe("https://example.com/bg.jpg");

    const saved = serializeVisualBlocksToContent([
      applyGroupsModuleFields(block, {
        ...readGroupsModuleFields(block),
        title: "Finn din gruppe",
      }),
    ]);
    const again = parseContentToVisualBlocks(saved)[0];
    expect(readGroupsModuleFields(again).title).toBe("Finn din gruppe");
    expect(saved).toContain("backgroundImage: https://example.com/bg.jpg");
  });

  test("Kalendermodulen kan lagre redigerbar seksjonstekst", () => {
    const block = parseContentToVisualBlocks(":::module-calendar[grid]\n:::")[0];
    const saved = serializeVisualBlocksToContent([
      applyModulePresentation(block, {
        ...readModulePresentation(block),
        title: "Kommende i menigheten",
        badge: "Program",
      }),
    ]);
    const again = parseContentToVisualBlocks(saved)[0];
    expect(readModulePresentation(again).title).toBe("Kommende i menigheten");
    expect(readModulePresentation(again).badge).toBe("Program");
  });

  test("Kalendermodulen parser og lagrer innstillinger", () => {
    const block = parseContentToVisualBlocks(":::module-kalender[month]\ntitle: Min kalender\n:::")[0];
    expect(block.type).toBe("module-kalender");
    expect(block.variant).toBe("month");
    expect(readModulePresentation(block).title).toBe("Min kalender");

    const saved = serializeVisualBlocksToContent([
      applyModulePresentation(block, {
        ...readModulePresentation(block),
        badge: "Program",
        title: "Kommende",
      }),
    ]);
    const again = parseContentToVisualBlocks(saved)[0];
    expect(again.variant).toBe("month");
    expect(readModulePresentation(again).badge).toBe("Program");
    expect(saved).toContain("badge: Program");
  });
});

describe("Navnet på en tekstblokk", () => {
  test("er første linje i teksten, ikke merket en lenke til seksjonen peker på", () => {
    const content = "<!-- cms-anchor:velkommen-til-fjordvik-menighet -->\n## Velkommen til Fjordvik menighet\nEt åpent hjem for alle generasjoner.";
    const [block] = parseContentToVisualBlocks(content);
    expect(block.title).toBe("Velkommen til Fjordvik menighet");
    // The mark stays in the text, so the link to the section still finds it
    expect(block.rawContent).toContain("cms-anchor:velkommen-til-fjordvik-menighet");
  });

  test("en blokk med bare merket og tekst uten overskrift heter etter teksten", () => {
    const [block] = parseContentToVisualBlocks("<!-- cms-anchor:om -->\nKort om oss.");
    expect(block.title).toBe("Kort om oss.");
  });
});
