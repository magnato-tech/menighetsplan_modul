import { describe, expect, test } from "vitest";
import { ALL_MIN_SIDE_MODULES_ON, MIN_SIDE_MODULE_IDS, isMinSideModuleOn, parseMinSideModules } from "../src/utils/minSideModules";
import { ADDONS_RECORD } from "../src/utils/addons";
import { MIN_SIDE_ADMIN_TABS, MIN_SIDE_MODULE_TEXT, requiresText } from "../src/pages/admin/minSideModules";
import { STUDIO_TABS } from "../src/pages/admin/studio";

describe("Hvilke deler av Min side som er på", () => {
  test("alt er på til det er valgt av", () => {
    expect(ALL_MIN_SIDE_MODULES_ON).toEqual({});
    for (const id of MIN_SIDE_MODULE_IDS) {
      expect(isMinSideModuleOn(undefined, id)).toBe(true);
      expect(isMinSideModuleOn({}, id)).toBe(true);
      expect(isMinSideModuleOn({ [id]: true }, id)).toBe(true);
    }
  });

  test("bare en lagret false slår en modul av, og andre moduler påvirkes ikke", () => {
    expect(isMinSideModuleOn({ kalender: false }, "kalender")).toBe(false);
    expect(isMinSideModuleOn({ kalender: false }, "tjeneste")).toBe(true);
    expect(isMinSideModuleOn({ tjeneste: false }, "kalender")).toBe(true);
  });

  test("gruppechat og husfellesskap krever grupper, også når de ikke er nevnt", () => {
    expect(isMinSideModuleOn({ grupper: false }, "grupper")).toBe(false);
    expect(isMinSideModuleOn({ grupper: false }, "gruppechat")).toBe(false);
    expect(isMinSideModuleOn({ grupper: false }, "husfellesskap")).toBe(false);
    expect(isMinSideModuleOn({ grupper: false, gruppechat: true }, "gruppechat")).toBe(false);
    // Grupper on, and chat off, leaves the groups as they are
    expect(isMinSideModuleOn({ gruppechat: false }, "grupper")).toBe(true);
    expect(isMinSideModuleOn({ gruppechat: false }, "husfellesskap")).toBe(true);
    expect(isMinSideModuleOn({ gruppechat: false }, "gruppechat")).toBe(false);
  });

  test("det lagrede feltet leses forsiktig: bare kjente moduler som står av, tas med", () => {
    expect(parseMinSideModules(undefined)).toEqual({});
    expect(parseMinSideModules({})).toEqual({});
    // A field in another document is not a choice of Min side
    expect(parseMinSideModules({ recordType: "operatingMode", minSide: { kalender: false } })).toEqual({});
    expect(parseMinSideModules({ recordType: ADDONS_RECORD })).toEqual({});
    expect(parseMinSideModules({ recordType: ADDONS_RECORD, minSide: "alt" })).toEqual({});
    expect(parseMinSideModules({ recordType: ADDONS_RECORD, minSide: null })).toEqual({});

    expect(
      parseMinSideModules({
        recordType: ADDONS_RECORD,
        minSide: { kalender: false, grupper: true, tjeneste: "nei", gudstjenesteplan: false, semesterplan: 0 },
      })
    ).toEqual({ kalender: false });

    // The add-on choices in the same document are not read as Min side choices
    expect(parseMinSideModules({ recordType: ADDONS_RECORD, on: { kalender: false } })).toEqual({});
  });
});

describe("Teksten til modulene", () => {
  test("hver modul har navn, sammendrag og hva av betyr", () => {
    for (const id of MIN_SIDE_MODULE_IDS) {
      const text = MIN_SIDE_MODULE_TEXT[id];
      expect(text.name.length).toBeGreaterThan(0);
      expect(text.summary.length).toBeGreaterThan(0);
      expect(text.whenOff.startsWith("Av: ")).toBe(true);
    }
    expect(requiresText("gruppechat")).toBe("Krever Grupper");
    expect(requiresText("husfellesskap")).toBe("Krever Grupper");
    expect(requiresText("grupper")).toBeUndefined();
  });

  test("semesterplanfanen i admin hører til modulen Semesterplan, og fanen finnes", () => {
    expect(MIN_SIDE_ADMIN_TABS["planlegger-semesterplan"]).toBe("semesterplan");
    for (const tab of Object.keys(MIN_SIDE_ADMIN_TABS)) expect(STUDIO_TABS).toContain(tab);
  });
});
