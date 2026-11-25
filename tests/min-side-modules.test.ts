import { describe, expect, test } from "vitest";
import { ALL_MIN_SIDE_MODULES_ON, MIN_SIDE_MODULE_IDS, groupAudienceOf, groupsListedFor, isMinSideModuleOn, isMinSideModuleOnFor, mayOpenGroupPage, parseMinSideModules } from "../src/utils/minSideModules";
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

  test("gudstjenesteplan krever tjeneste og bemanning", () => {
    expect(isMinSideModuleOn({ tjeneste: false }, "gudstjenesteplan")).toBe(false);
    expect(isMinSideModuleOn({ gudstjenesteplan: false }, "gudstjenesteplan")).toBe(false);
    expect(isMinSideModuleOn({ gudstjenesteplan: false }, "tjeneste")).toBe(true);
    expect(isMinSideModuleOn({}, "gudstjenesteplan")).toBe(true);
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
        minSide: { kalender: false, grupper: true, tjeneste: "nei", ukjent: false, semesterplan: 0 },
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
      expect(text.whenOff.startsWith(id === "grupper" ? "Ingen: " : "Av: ")).toBe(true);
    }
    expect(requiresText("gruppechat")).toBe("Krever Grupper");
    expect(requiresText("husfellesskap")).toBe("Krever Grupper");
    expect(requiresText("grupper")).toBeUndefined();
    expect(requiresText("gudstjenesteplan")).toBe("Krever Tjeneste og bemanning");
    expect(MIN_SIDE_MODULE_TEXT.gudstjenesteplan.name).toBe("Gudstjenesteplan");
  });

  test("semesterplanfanen i admin hører til modulen Semesterplan, og fanen finnes", () => {
    expect(MIN_SIDE_ADMIN_TABS["planlegger-semesterplan"]).toBe("semesterplan");
    for (const tab of Object.keys(MIN_SIDE_ADMIN_TABS)) expect(STUDIO_TABS).toContain(tab);
  });
});

describe("Hvem gruppene vises for", () => {
  const led = { id: "g1", memberIds: ["leder", "med"], leaderIds: ["leder"], deputyLeaderIds: ["neste"] };
  const other = { id: "g2", memberIds: ["leder", "med"], leaderIds: ["annen"] };
  const leaderPerson = { id: "leder" };
  const memberPerson = { id: "med" };
  const admin = { id: "adm", globalRole: "admin" };

  test("alle er valgt til noe annet er lagret, og gammel «av» er fortsatt ingen", () => {
    expect(groupAudienceOf(undefined)).toBe("alle");
    expect(groupAudienceOf({})).toBe("alle");
    expect(groupAudienceOf({ grupper: false })).toBe("ingen");
    expect(groupAudienceOf({ groupsFor: "ledere" })).toBe("ledere");
    // Off beats leaders only
    expect(groupAudienceOf({ grupper: false, groupsFor: "ledere" })).toBe("ingen");
  });

  test("valget leses fra dokumentet, og bare «ledere» tas med mens gruppene er på", () => {
    const record = { recordType: ADDONS_RECORD };
    expect(parseMinSideModules({ ...record, groupAudience: "ledere" })).toEqual({ groupsFor: "ledere" });
    expect(parseMinSideModules({ ...record, groupAudience: "alle" })).toEqual({});
    expect(parseMinSideModules({ ...record, groupAudience: "ingen", minSide: { grupper: false } })).toEqual({ grupper: false });
    expect(parseMinSideModules({ ...record, groupAudience: "ledere", minSide: { grupper: false } })).toEqual({ grupper: false });
    expect(parseMinSideModules({ ...record, groupAudience: "tull" })).toEqual({});
    expect(parseMinSideModules({ recordType: "operatingMode", groupAudience: "ledere" })).toEqual({});
  });

  test("med bare ledere er gruppene, chatten og husfellesskap for dem som leder en gruppe", () => {
    const choices = { groupsFor: "ledere" } as const;
    for (const id of ["grupper", "gruppechat", "husfellesskap"] as const) {
      expect(isMinSideModuleOnFor(choices, id, true)).toBe(true);
      expect(isMinSideModuleOnFor(choices, id, false)).toBe(false);
    }
    // What does not belong to the groups is not touched
    expect(isMinSideModuleOnFor(choices, "tjeneste", false)).toBe(true);
    expect(isMinSideModuleOnFor(choices, "kalender", false)).toBe(true);
    // With everyone, and with nobody, leading makes no difference
    expect(isMinSideModuleOnFor({}, "grupper", false)).toBe(true);
    expect(isMinSideModuleOnFor({ grupper: false }, "grupper", true)).toBe(false);
  });

  test("hvem som åpner gruppesiden: alle i gruppen, bare lederne, eller ingen", () => {
    expect(mayOpenGroupPage({}, led, memberPerson)).toBe(true);
    expect(mayOpenGroupPage({}, led, { id: "utenfor" })).toBe(false);

    const leadersOnly = { groupsFor: "ledere" } as const;
    expect(mayOpenGroupPage(leadersOnly, led, leaderPerson)).toBe(true);
    expect(mayOpenGroupPage(leadersOnly, led, { id: "neste" })).toBe(true);
    expect(mayOpenGroupPage(leadersOnly, led, memberPerson)).toBe(false);
    // A leader leads this group, not the one where she is only a member
    expect(mayOpenGroupPage(leadersOnly, other, leaderPerson)).toBe(false);
    expect(mayOpenGroupPage(leadersOnly, other, admin)).toBe(true);

    expect(mayOpenGroupPage({ grupper: false }, led, leaderPerson)).toBe(false);
    expect(mayOpenGroupPage({ grupper: false }, led, admin)).toBe(false);
  });

  test("Mine grupper lister bare gruppene en leder leder, når det er valgt", () => {
    expect(groupsListedFor({}, [led, other], "leder").map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(groupsListedFor({ groupsFor: "ledere" }, [led, other], "leder").map((g) => g.id)).toEqual(["g1"]);
    expect(groupsListedFor({ groupsFor: "ledere" }, [led, other], "med")).toEqual([]);
  });
});
