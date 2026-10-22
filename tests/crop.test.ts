import { describe, expect, test } from "vitest";
import { cropFromRect, formatCrop, objectStyleOf, parseCrop, parseFocusPoint, visibleRect } from "../src/utils/focusPoint";

const wide = { w: 2000, h: 1000 }; // 2:1, wider than 16:9
const tall = { w: 1000, h: 2000 }; // 1:2, taller than 16:9
const aspect = 16 / 9;

describe("utsnitt med zoom", () => {
  test("to og tre deler leses, og zoom 1 faller bort ved lagring", () => {
    expect(parseCrop("30% 20%")).toEqual({ x: 30, y: 20, zoom: 1 });
    expect(parseCrop("30% 20% 2")).toEqual({ x: 30, y: 20, zoom: 2 });
    expect(parseCrop("30% 20% 9")).toEqual({ x: 30, y: 20, zoom: 3 });
    expect(parseCrop("midt")).toBeNull();
    expect(parseCrop("150% 20% 2")).toBeNull();
    expect(parseFocusPoint("30% 20% 2")).toEqual({ x: 30, y: 20 });
    expect(parseFocusPoint("30% 20%")).toEqual({ x: 30, y: 20 });
    expect(formatCrop({ x: 30, y: 20, zoom: 1 })).toBe("30% 20%");
    expect(formatCrop({ x: 30, y: 20, zoom: 1.04 })).toBe("30% 20%");
    expect(formatCrop({ x: 30, y: 20, zoom: 2 })).toBe("30% 20% 2.0");
    expect(formatCrop({ x: 30.4, y: 19.6, zoom: 1.66 })).toBe("30% 20% 1.7");
    expect(formatCrop({ x: 30, y: 20, zoom: 5 })).toBe("30% 20% 3.0");
  });

  test("stilen flytter bildet og zoomer rundt samme punkt, og midten uten zoom gir ingenting", () => {
    expect(objectStyleOf(undefined)).toEqual({});
    expect(objectStyleOf("50% 50%")).toEqual({});
    expect(objectStyleOf("30% 20%")).toEqual({ objectPosition: "30% 20%", transform: undefined, transformOrigin: undefined });
    expect(objectStyleOf("30% 20% 2")).toEqual({ objectPosition: "30% 20%", transform: "scale(2)", transformOrigin: "30% 20%" });
  });

  test("synlig del for et bredt bilde", () => {
    expect(visibleRect(wide, aspect, { x: 0, y: 50, zoom: 1 })).toEqual({ left: 0, top: 0, width: aspect / 2, height: 1 });
    const zoomed = visibleRect(wide, aspect, { x: 100, y: 50, zoom: 2 });
    expect(zoomed.width).toBeCloseTo(aspect / 2 / 2);
    expect(zoomed.height).toBeCloseTo(0.5);
    expect(zoomed.left).toBeCloseTo(1 - zoomed.width);
    expect(zoomed.top).toBeCloseTo(0.25);
  });

  test("synlig del for et høyt bilde", () => {
    const rect = visibleRect(tall, aspect, { x: 50, y: 100, zoom: 1 });
    expect(rect.width).toBe(1);
    expect(rect.height).toBeCloseTo((1000 / aspect) / 2000);
    expect(rect.left).toBe(0);
    expect(rect.top).toBeCloseTo(1 - rect.height);
    const zoomed = visibleRect(tall, aspect, { x: 50, y: 50, zoom: 2 });
    expect(zoomed.height).toBeCloseTo(rect.height / 2);
    expect(zoomed.top).toBeCloseTo((1 - zoomed.height) / 2);
  });

  test("cropFromRect er det omvendte av visibleRect", () => {
    for (const natural of [wide, tall]) {
      for (const crop of [
        { x: 0, y: 0, zoom: 1 },
        { x: 25, y: 70, zoom: 1 },
        { x: 100, y: 100, zoom: 2.5 },
        { x: 60, y: 10, zoom: 1.5 },
      ]) {
        const rect = visibleRect(natural, aspect, crop);
        const back = cropFromRect(rect.left, rect.top, rect.width, rect.height);
        // A side with no room to move has no point to read back, so it is the middle
        if (rect.width < 1) expect(back.x).toBeCloseTo(crop.x);
        else expect(back.x).toBe(50);
        if (rect.height < 1) expect(back.y).toBeCloseTo(crop.y);
        else expect(back.y).toBe(50);
      }
    }
    expect(cropFromRect(0.1, 0.1, 1, 1)).toEqual({ x: 50, y: 50 });
  });
});
