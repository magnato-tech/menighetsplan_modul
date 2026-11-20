import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { MIN_SIDE_CARD_GRID, MIN_SIDE_DIALOG_OVERLAY, MIN_SIDE_DIALOG_PANEL, MIN_SIDE_LIST_COLUMN, minSideFrameClass } from "../src/utils/minSideFrame";

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

describe("Kortene på Min side", () => {
  test("én kolonne på telefon, to på nettbrett og tre på PC", () => {
    const grid = MIN_SIDE_CARD_GRID.split(" ");
    expect(grid).toContain("grid");
    expect(grid).toContain("sm:grid-cols-2");
    expect(grid).toContain("lg:grid-cols-3");
  });

  test("gruppene og gudstjenestene står i kolonner", () => {
    for (const file of ["src/pages/myPage/MyGroupsSection.tsx", "src/pages/myPage/WorshipPlanPanel.tsx"]) {
      expect(readFileSync(file, "utf8")).toContain("className={MIN_SIDE_CARD_GRID}");
    }
  });
});

describe("Mine oppgaver", () => {
  test("én kolonne på alle skjermer, som på PC ikke blir bredere enn på nettbrett", () => {
    expect(MIN_SIDE_LIST_COLUMN.split(" ")).toContain("lg:max-w-2xl");
    expect(readFileSync("src/pages/MyPage.tsx", "utf8")).toContain("className={MIN_SIDE_LIST_COLUMN}");
  });
});

describe("Dialogene på Min side", () => {
  test("overlegget er en bunnark på telefon og midtstilt fra nettbrett", () => {
    expect(MIN_SIDE_DIALOG_OVERLAY).toContain("items-end sm:items-center");
    expect(MIN_SIDE_DIALOG_OVERLAY.split(" ")).toEqual(expect.arrayContaining(["fixed", "inset-0", "z-50"]));
  });

  test("panelet er bredere på PC, og har rundt hjørne øverst på telefon", () => {
    expect(MIN_SIDE_DIALOG_PANEL).toContain("lg:max-w-xl");
    expect(MIN_SIDE_DIALOG_PANEL.split(" ")).toEqual(expect.arrayContaining(["rounded-t-3xl", "sm:rounded-3xl"]));
  });

  test.each([
    "src/pages/myPage/AttentionModal.tsx",
    "src/pages/myPage/VolunteerHelp.tsx",
    "src/components/gathering/InstructionDialog.tsx",
    "src/components/gathering/ProgramPostDialog.tsx",
    "src/components/husfellesskap/CreateMeetingDialog.tsx",
    "src/components/husfellesskap/EditMeetingDialog.tsx",
  ])("%s bruker overlegget og panelet", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toContain("MIN_SIDE_DIALOG_OVERLAY");
    expect(source).toContain("MIN_SIDE_DIALOG_PANEL");
  });
});
