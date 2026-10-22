import { describe, expect, test } from "vitest";
import {
  blockLookSummary,
  blockPeriodBadge,
  blockPeriodLabel,
  blockPeriodState,
  cleanBlockSettings,
  formatBlockSettingsLine,
  parseBlockSettingsLine,
} from "../src/utils/blockSettings";
import {
  parseContentToVisualBlocks,
  serializeVisualBlocksToContent,
  type VisualBlock,
} from "../src/utils/cmsBlocks";

// Noon keeps the day the same in every time zone
const day = (year: number, month: number, date: number) => new Date(year, month - 1, date, 12);

// Blocks without their ids, so round trips compare what the editor cares about
const withoutIds = (blocks: VisualBlock[]) => blocks.map(({ id: _id, ...rest }) => rest);

describe("Blokkinnstillinger: verdier", () => {
  test("cleanBlockSettings beholder bare gyldige verdier", () => {
    const clean = cleanBlockSettings({
      visFra: "2026-1-1",
      visTil: "2026-12-31",
      bakgrunn: "#ABCDEF",
      bakgrunnsbilde: "/bilder/a--b.jpg",
      hvitTekst: "yes",
      luft: "stor",
    });
    expect(clean).toEqual({ visTil: "2026-12-31", bakgrunn: "#abcdef" });
  });

  test("cleanBlockSettings godtar et gyldig bilde og lagrer hvitTekst og luft", () => {
    expect(
      cleanBlockSettings({ bakgrunnsbilde: " /bilder/hero.jpg ", hvitTekst: true, luft: "ingen" })
    ).toEqual({ bakgrunnsbilde: "/bilder/hero.jpg", hvitTekst: true, luft: "ingen" });
  });

  test("formatBlockSettingsLine gir null uten innstillinger og en kommentarlinje ellers", () => {
    expect(formatBlockSettingsLine(undefined)).toBeNull();
    expect(formatBlockSettingsLine({})).toBeNull();
    expect(formatBlockSettingsLine({ visTil: "2026-12-31" })).toBe('<!-- blokk {"visTil":"2026-12-31"} -->');
  });

  test("format og parse gir samme innstillinger tilbake", () => {
    const settings = { visFra: "2026-12-01", visTil: "2026-12-31", bakgrunn: "#1e3a5f", hvitTekst: true, luft: "liten" as const };
    const line = formatBlockSettingsLine(settings);
    expect(line).not.toBeNull();
    expect(parseBlockSettingsLine(line as string)).toEqual(settings);
  });

  test("parseBlockSettingsLine skiller innstillingslinjer fra vanlig tekst", () => {
    expect(parseBlockSettingsLine("## Hei")).toBeNull();
    expect(parseBlockSettingsLine("<!-- cms-anchor: om-oss -->")).toBeNull();
    // A broken settings line is still a settings line, but gives no settings
    expect(parseBlockSettingsLine("<!-- blokk {ikke json} -->")).toEqual({});
  });
});

describe("Blokkinnstillinger: periode", () => {
  const period = { visFra: "2026-10-01", visTil: "2026-10-31" };

  test("blockPeriodState teller både første og siste dag som synlig", () => {
    expect(blockPeriodState(period, day(2026, 9, 30))).toBe("before");
    expect(blockPeriodState(period, day(2026, 10, 1))).toBe("active");
    expect(blockPeriodState(period, day(2026, 10, 31))).toBe("active");
    expect(blockPeriodState(period, day(2026, 11, 1))).toBe("after");
  });

  test("blockPeriodState uten periode er alltid synlig", () => {
    expect(blockPeriodState(undefined, day(2026, 1, 1))).toBe("active");
    expect(blockPeriodState({}, day(2030, 1, 1))).toBe("active");
  });

  test("blockPeriodLabel: samme måned, ulike måneder, bare fra og bare til", () => {
    expect(blockPeriodLabel({ visFra: "2026-12-01", visTil: "2026-12-31" })).toBe("1.–31. des");
    expect(blockPeriodLabel({ visFra: "2026-11-28", visTil: "2026-12-02" })).toBe("28. nov – 2. des");
    expect(blockPeriodLabel({ visFra: "2026-12-01" })).toBe("fra 1. des");
    expect(blockPeriodLabel({ visTil: "2026-12-31" })).toBe("til 31. des");
    expect(blockPeriodLabel({})).toBeNull();
  });

  test("blockPeriodBadge viser fra, til eller utløpt", () => {
    const both = { visFra: "2026-12-01", visTil: "2026-12-31" };
    expect(blockPeriodBadge(both, day(2026, 11, 30))).toBe("fra 1.12.");
    expect(blockPeriodBadge(both, day(2026, 12, 15))).toBe("til 31.12.");
    expect(blockPeriodBadge(both, day(2027, 1, 1))).toBe("utløpt");
    expect(blockPeriodBadge({ visTil: "2026-12-31" }, day(2026, 12, 15))).toBe("til 31.12.");
    expect(blockPeriodBadge({ bakgrunn: "#123456" }, day(2026, 12, 15))).toBeNull();
  });

  test("blockLookSummary beskriver utseendet i ord", () => {
    expect(
      blockLookSummary({ bakgrunnsbilde: "/x.jpg", bakgrunn: "#000000", hvitTekst: true, luft: "liten" })
    ).toBe("bakgrunnsbilde · hvit tekst · liten luft");
    expect(blockLookSummary({ bakgrunn: "#123456" })).toBe("egen bakgrunnsfarge");
    expect(blockLookSummary({ luft: "ingen" })).toBe("ingen luft");
    expect(blockLookSummary({})).toBeNull();
  });
});

describe("Blokkinnstillinger i sideinnholdet", () => {
  const source = [
    '<!-- blokk {"visTil":"2026-12-31","bakgrunn":"#1e3a5f","hvitTekst":true} -->',
    "## Jul",
    "Tekst om julen.",
    "",
    '<!-- blokk {"luft":"ingen"} -->',
    ":::module-worship[highlight]",
    ":::",
    "",
    "<!-- hidden -->",
    '<!-- blokk {"visFra":"2026-11-01"} -->',
    "Skjult tekst.",
    "<!-- /hidden -->",
    "",
    "Uten innstillinger.",
  ].join("\n");

  test("innstillinger leses for tekst, modul og skjult blokk, men ikke for blokker uten", () => {
    const blocks = parseContentToVisualBlocks(source);
    expect(blocks.map((block) => block.type)).toEqual(["text", "module-worship", "text", "text"]);
    expect(blocks[0].settings).toEqual({ visTil: "2026-12-31", bakgrunn: "#1e3a5f", hvitTekst: true });
    expect(blocks[1].settings).toEqual({ luft: "ingen" });
    expect(blocks[2].hidden).toBe(true);
    expect(blocks[2].settings).toEqual({ visFra: "2026-11-01" });
    expect("settings" in blocks[3]).toBe(false);
  });

  test("parse og serialize gir samme blokker tilbake, og innholdet er stabilt", () => {
    const first = serializeVisualBlocksToContent(parseContentToVisualBlocks(source));
    const reparsed = parseContentToVisualBlocks(first);
    expect(withoutIds(reparsed)).toEqual(withoutIds(parseContentToVisualBlocks(source)));

    const second = serializeVisualBlocksToContent(reparsed);
    expect(second).toBe(first);
  });

  test("blokker uten innstillinger skrives uten innstillingslinje", () => {
    const content = serializeVisualBlocksToContent(parseContentToVisualBlocks("## Enkel\nTekst."));
    expect(content).not.toContain("<!-- blokk");
    expect(parseContentToVisualBlocks(content)[0]).not.toHaveProperty("settings");
  });

  test("en innstillingslinje uten blokk etter seg forsvinner", () => {
    expect(parseContentToVisualBlocks('<!-- blokk {"visTil":"2026-12-31"} -->')).toEqual([]);
  });
});
