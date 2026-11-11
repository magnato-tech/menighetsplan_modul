import { describe, expect, test } from "vitest";
import { minSideFrameClass } from "../src/utils/minSideFrame";

const classes = (value: string) => value.split(" ");

describe("Rammen rundt Min side", () => {
  test("bredden følger skjermen: en telefonkolonne, bredere på nettbrett og PC", () => {
    const wide = classes(minSideFrameClass("wide"));
    expect(wide).toContain("max-w-md");
    expect(wide).toContain("sm:max-w-2xl");
    expect(wide).toContain("lg:max-w-6xl");
    expect(wide).toContain("mx-auto");
    expect(wide).not.toContain("pb-[calc(6.5rem+env(safe-area-inset-bottom))]");

    const narrow = classes(minSideFrameClass("narrow"));
    expect(narrow).toContain("max-w-md");
    expect(narrow).toContain("sm:max-w-xl");
    expect(narrow.some((c) => c.startsWith("lg:max-w"))).toBe(false);
  });

  test("standard er bred, og kortet har det som gjelder for alle rammene", () => {
    expect(minSideFrameClass()).toBe(minSideFrameClass("wide"));
    for (const width of ["wide", "narrow"] as const) {
      const frame = classes(minSideFrameClass(width));
      expect(frame).toEqual(expect.arrayContaining(["w-full", "bg-slate-50", "min-h-screen", "sm:rounded-3xl", "sm:border", "sm:border-slate-200/80", "overflow-hidden"]));
    }
  });

  test("bottomNavRoom gir plass til menyen nederst på telefonen, og bare da", () => {
    expect(classes(minSideFrameClass("wide", true))).toContain("pb-[calc(6.5rem+env(safe-area-inset-bottom))]");
    expect(classes(minSideFrameClass("wide", true))).toContain("sm:pb-8");
    expect(classes(minSideFrameClass("narrow", true))).toContain("pb-[calc(6.5rem+env(safe-area-inset-bottom))]");
    expect(minSideFrameClass("narrow", false)).not.toContain("pb-");
  });
});
