import { describe, expect, test } from "vitest";
import { parseCmsContent } from "../src/components/cms/CmsContentRenderer";
import {
  applyStaticFields,
  gridColumnsClass,
  gridColumnsFrom,
  parseContentToVisualBlocks,
  readStaticFields,
  serializeVisualBlocksToContent,
} from "../src/utils/cmsBlocks";

const CARDS = ":::card A\nFørste kort\n:::\n:::card B\nAndre kort\n:::\n:::";

describe("grid columns", () => {
  test("plain :::grid is two columns and keeps its bracket-free form", () => {
    const [block] = parseContentToVisualBlocks(`:::grid\n${CARDS}`);
    expect(readStaticFields(block).columns).toBe(2);

    const written = applyStaticFields(block, readStaticFields(block));
    expect(written.rawContent?.startsWith(":::grid\n")).toBe(true);
  });

  test(":::grid[3] is read as three columns and written back with the bracket", () => {
    const [block] = parseContentToVisualBlocks(`:::grid[3]\n${CARDS}`);
    expect(readStaticFields(block).columns).toBe(3);

    const written = applyStaticFields(block, readStaticFields(block));
    expect(written.rawContent?.startsWith(":::grid[3]\n")).toBe(true);
  });

  test("a changed column count is saved and survives a round trip", () => {
    const [block] = parseContentToVisualBlocks(`:::grid\n${CARDS}`);
    const changed = applyStaticFields(block, { ...readStaticFields(block), columns: 4 });
    expect(changed.rawContent?.startsWith(":::grid[4]\n")).toBe(true);

    const serialized = serializeVisualBlocksToContent([changed]);
    const [again] = parseContentToVisualBlocks(serialized);
    expect(readStaticFields(again).columns).toBe(4);
    expect(readStaticFields(again).cards.map((card) => card.title)).toEqual(["A", "B"]);
  });

  test("the public renderer reads the column count from the opening line", () => {
    const [plain] = parseCmsContent(`:::grid\n${CARDS}`);
    const [four] = parseCmsContent(`:::grid[4]\n${CARDS}`);
    expect(plain).toMatchObject({ type: "grid", columns: 2 });
    expect(four).toMatchObject({ type: "grid", columns: 4 });
  });

  test("an unknown count falls back to two columns", () => {
    expect(gridColumnsFrom(":::grid[7]")).toBe(2);
    expect(gridColumnsFrom(":::grid")).toBe(2);
  });

  test("site classes give one column on phones, two from md and the chosen count from lg", () => {
    expect(gridColumnsClass(2)).toBe("md:grid-cols-2");
    expect(gridColumnsClass(3)).toBe("md:grid-cols-2 lg:grid-cols-3");
    expect(gridColumnsClass(4)).toBe("md:grid-cols-2 lg:grid-cols-4");
  });
});
