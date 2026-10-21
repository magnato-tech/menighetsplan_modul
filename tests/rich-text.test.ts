import { describe, expect, test } from "vitest";
import { initialCmsPages } from "../src/data/cmsData";
import { parseContentToVisualBlocks, readStaticFields, applyStaticFields } from "../src/utils/cmsBlocks";
import { parseCmsContent } from "../src/components/cms/CmsContentRenderer";
import { canonicalText, fitsRichText, richDocOf, textOfRichDoc, type RichTextMode } from "../src/utils/richText";

// Backlog 5: the text field with buttons stores the same text with signs as before. A text that goes in
// and out of the field must look the same on the website.

const roundTrip = (text: string, mode: RichTextMode) => textOfRichDoc(richDocOf(text, mode), mode);

describe("Tegnene inn i feltet og ut igjen", () => {
  test("overskrifter, lister, fet, kursiv og lenker kommer ut som de gikk inn", () => {
    const text = [
      "## Velkommen",
      "Vi møtes **hver søndag** kl. 11, og *alle* er velkommen.",
      "",
      "### Praktisk",
      "- Kaffe etter møtet",
      "- Søndagsskole for barna",
      "1. Kom",
      "2. Bli med",
      "Les mer på [kontaktsiden](/kontakt) eller [nettet](https://example.no).",
    ].join("\n");
    expect(fitsRichText(text, "full")).toBe(true);
    expect(roundTrip(text, "full")).toBe(text);
  });

  test("lister med * og feil tall lagres med - og tall fra 1, og ser like ut", () => {
    const text = "* en\n* to\n3. tre\n7. fire";
    expect(roundTrip(text, "full")).toBe("- en\n- to\n1. tre\n2. fire");
    expect(fitsRichText(text, "full")).toBe(true);
  });

  test("i et kort eller en infoboks er ## bare tekst", () => {
    const text = "## ikke en overskrift\n**fet** linje";
    expect(roundTrip(text, "inline")).toBe(text);
    expect(richDocOf(text, "inline").content?.every((node) => node.type === "paragraph")).toBe(true);
  });

  test("tegn feltet ikke har knapper for, vises som tekst", () => {
    expect(fitsRichText(":::callout[info]\nhei\n:::", "full")).toBe(false);
    expect(fitsRichText("> et sitat", "full")).toBe(false);
    expect(fitsRichText("[Knapp: Les mer](/om)", "full")).toBe(false);
  });

  test("tom tekst og tomme linjer går gjennom", () => {
    expect(roundTrip("", "full")).toBe("");
    expect(roundTrip("a\n\nb", "full")).toBe("a\n\nb");
    expect(canonicalText("  a  \n", "full")).toBe("a");
  });
});

describe("Alle demosidene", () => {
  const editable = new Set(["text", "media-left", "media-right", "callout", "grid"]);
  const cases: { page: string; block: string; mode: RichTextMode; text: string }[] = [];
  for (const page of initialCmsPages) {
    for (const block of parseContentToVisualBlocks(page.content || "")) {
      if (!editable.has(block.type)) continue;
      const fields = readStaticFields(block);
      if (block.type === "grid") {
        for (const card of fields.cards) cases.push({ page: page.title, block: block.type, mode: "inline", text: card.body });
      } else {
        cases.push({ page: page.title, block: block.type, mode: block.type === "text" ? "full" : "inline", text: fields.body });
      }
    }
  }

  test("det finnes tekster å prøve", () => {
    expect(cases.length).toBeGreaterThan(5);
  });

  test("en tekst som vises formatert, ser lik ut på nettsiden etter lagring", () => {
    for (const item of cases) {
      if (!fitsRichText(item.text, item.mode)) continue;
      const again = roundTrip(item.text, item.mode);
      expect(again, `${item.page}: ${item.block}`).toBe(canonicalText(item.text, item.mode));
      expect(parseCmsContent(again), `${item.page}: ${item.block}`).toEqual(parseCmsContent(item.text));
    }
  });

  test("de fleste tekstene kan vises formatert", () => {
    const fitting = cases.filter((item) => fitsRichText(item.text, item.mode));
    expect(fitting.length / cases.length).toBeGreaterThan(0.8);
  });

  test("hele siden er lik etter at hver tekst har gått gjennom feltet", () => {
    for (const page of initialCmsPages) {
      const blocks = parseContentToVisualBlocks(page.content || "");
      for (const block of blocks) {
        if (block.type !== "text") continue;
        const fields = readStaticFields(block);
        if (!fitsRichText(fields.body, "full")) continue;
        const after = applyStaticFields(block, { ...fields, body: roundTrip(fields.body, "full") });
        expect(parseCmsContent(after.rawContent || ""), page.title).toEqual(
          parseCmsContent(applyStaticFields(block, fields).rawContent || "")
        );
      }
    }
  });
});
