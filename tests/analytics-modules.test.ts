import { describe } from "vitest";
import { assert } from "./assert";
import { ANALYTICS_MODULES, hiddenModuleCount, isModuleShown } from "../src/utils/analyticsModules";

describe("Modulene på analysebordet", () => {
  const ids = ANALYTICS_MODULES.map((m) => m.id);
  assert(ids[0] === "oppgaver-tatt", "Oppgaver tatt står først på bordet");
  assert(new Set(ids).size === ids.length, "Hver modul har en unik ID");
  assert(ANALYTICS_MODULES.every((m) => m.title && m.description), "Hver modul har navn og beskrivelse");
  assert(
    ["bemanning", "flere-oppgaver", "per-maned", "hver-enkelt"].every((id) => ids.includes(id as (typeof ids)[number])),
    "De fire modulene om menighetens helse finnes"
  );
  assert(isModuleShown(undefined, "oppmote") && isModuleShown([], "oppmote"), "Uten valg vises alt, også nye moduler");
  assert(!isModuleShown(["oppmote"], "oppmote") && isModuleShown(["oppmote"], "grupper"), "En skjult modul vises ikke, de andre vises");
  assert(hiddenModuleCount(["oppmote", "oppmote-gammel", "grupper"]) === 2, "En lagret ID for en modul som ikke finnes lenger, telles ikke");
});
