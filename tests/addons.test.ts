import { describe, expect, test } from "vitest";
import { BUILT_MODULES, PLANNED_MODULES, PRODUCT_MODULES, STUDIO_ADDONS, addonMenuSections, addonOfTab, moduleName } from "../src/pages/admin/addons";
import { STUDIO_TABS } from "../src/pages/admin/studio";
import { ADDON_IDS, ADDONS_RECORD, countAddonsOn, isAddonOn, parseAddonChoices } from "../src/utils/addons";

describe("Hvilke moduler som er på", () => {
  test("en modul er av til den er valgt", () => {
    expect(isAddonOn(undefined, "analysebord")).toBe(false);
    expect(isAddonOn({}, "analysebord")).toBe(false);
    expect(isAddonOn({ analysebord: false }, "analysebord")).toBe(false);
    expect(isAddonOn({ analysebord: true }, "analysebord")).toBe(true);
    // One module being on says nothing about another
    expect(isAddonOn({ analysebord: true }, "nettsidebesok")).toBe(false);

    expect(countAddonsOn(undefined)).toBe(0);
    expect(countAddonsOn({ analysebord: true, nettsidebesok: false })).toBe(1);
    expect(countAddonsOn({ analysebord: true, nettsidebesok: true })).toBe(2);
  });

  test("det lagrede dokumentet leses forsiktig: bare kjente moduler som står på, tas med", () => {
    expect(parseAddonChoices(undefined)).toEqual({});
    // Another marked document in the same collection is not a choice of modules
    expect(parseAddonChoices({ recordType: "operatingMode", on: { analysebord: true } })).toEqual({});
    expect(parseAddonChoices({ recordType: ADDONS_RECORD })).toEqual({});
    expect(parseAddonChoices({ recordType: ADDONS_RECORD, on: "alt" })).toEqual({});

    expect(
      parseAddonChoices({
        recordType: ADDONS_RECORD,
        on: { analysebord: true, nettsidebesok: false, regnskap: true, givertjeneste: "ja" },
      })
    ).toEqual({ analysebord: true });
    expect(parseAddonChoices({ recordType: ADDONS_RECORD, on: { givertjeneste: true } })).toEqual({ givertjeneste: true });
    // Anything but a plain yes is a no
    expect(parseAddonChoices({ recordType: ADDONS_RECORD, on: { analysebord: "true", nettsidebesok: 1 } })).toEqual({});
  });
});

describe("Modulene slik admin kjenner dem", () => {
  test("hver modul er beskrevet, og det den legger i menyen, er faner som finnes", () => {
    expect(STUDIO_ADDONS.map((addon) => addon.id)).toEqual([...ADDON_IDS]);

    for (const addon of STUDIO_ADDONS) {
      expect(addon.name).not.toBe("");
      expect(addon.summary).not.toBe("");
      expect(addon.whenOff).not.toBe("");
      expect(addon.gives.length).toBeGreaterThan(0);
      expect(addon.menu.length).toBeGreaterThan(0);
      for (const entry of addon.menu) expect(STUDIO_TABS).toContain(entry.tab);
    }

    // No tab belongs to two modules, or one of them could be turned off under the other
    const tabs = STUDIO_ADDONS.flatMap((addon) => addon.menu.map((entry) => entry.tab));
    expect(new Set(tabs).size).toBe(tabs.length);
  });

  test("en fane vet hvilken modul den hører til, og fanene som alltid er der, hører ikke til noen", () => {
    expect(addonOfTab("analyse")?.id).toBe("analysebord");
    expect(addonOfTab("nettsidebesok")?.id).toBe("nettsidebesok");
    expect(addonOfTab("gaveformal")?.id).toBe("givertjeneste");
    expect(addonOfTab("dashboard")).toBeUndefined();
    expect(addonOfTab("cms-sider")).toBeUndefined();
    // The page where the modules are turned on can never be turned off
    expect(addonOfTab("moduler")).toBeUndefined();
  });

  test("produktet har sju moduler, og Analyse og Givertjeneste har noe å slå på", () => {
    expect(PRODUCT_MODULES.map((module) => module.name)).toEqual([
      "Analyse",
      "Givertjeneste",
      "Utleie",
      "Arrangement",
      "Kommunikasjon",
      "Skjemaer",
      "AI-assistent",
    ]);
    // Accounting is not a module of its own
    expect(PRODUCT_MODULES.some((module) => /regnskap/i.test(module.name) || /regnskap/i.test(module.id))).toBe(false);

    expect(BUILT_MODULES.map((module) => [module.name, module.addons.map((addon) => addon.id)])).toEqual([
      ["Analyse", ["analysebord", "nettsidebesok"]],
      ["Givertjeneste", ["givertjeneste"]],
    ]);
    // Every part that can be turned on belongs to a module, and to one only
    expect(PRODUCT_MODULES.flatMap((module) => module.addons).map((addon) => addon.id).sort()).toEqual([...ADDON_IDS].sort());
    expect(moduleName(STUDIO_ADDONS[0].module)).toBe("Analyse");
  });

  test("menyen får bare det som er slått på, og ingen overskrift uten noe under", () => {
    expect(addonMenuSections(undefined)).toEqual([]);
    expect(addonMenuSections({})).toEqual([]);

    const labels = (choices: Parameters<typeof addonMenuSections>[0]) =>
      addonMenuSections(choices).map((section) => [section.heading, section.entries.map((entry) => `${entry.label} → ${entry.tab}`)]);
    expect(labels({ nettsidebesok: true })).toEqual([["Analyse", ["Besøk på nettsiden → nettsidebesok"]]]);
    expect(labels({ analysebord: true, nettsidebesok: true })).toEqual([
      ["Analyse", ["Analysebord → analyse", "Besøk på nettsiden → nettsidebesok"]],
    ]);
    expect(labels({ givertjeneste: true })).toEqual([
      ["Givertjeneste", ["Gaveformål → gaveformal", "Gaveinnstillinger → giver-innstillinger"]],
    ]);
  });

  test("en modul som ikke er laget, er bare et navn: ingen bryter, ingen fane og ingenting i menyen", () => {
    expect(PLANNED_MODULES.map((module) => module.name)).toEqual(["Utleie", "Arrangement", "Kommunikasjon", "Skjemaer", "AI-assistent"]);
    for (const module of PLANNED_MODULES) expect(module.addons).toEqual([]);

    // With every switch there is turned on, the menu still holds only what is built
    const everything = Object.fromEntries(ADDON_IDS.map((id) => [id, true]));
    expect(addonMenuSections(everything).map((section) => section.heading)).toEqual(["Analyse", "Givertjeneste"]);
  });
});
