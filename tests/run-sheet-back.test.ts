import { describe, expect, test } from "vitest";
import { runSheetBackLabel, runSheetBackLink } from "../src/utils/runSheetBack";

describe("Tilbakelenken på kjøreplanen", () => {
  test("med fra=gudstjenester går den tilbake til Gudstjenester", () => {
    expect(runSheetBackLink("?fra=gudstjenester")).toBe("/minside?view=gudstjenester");
    expect(runSheetBackLabel("?fra=gudstjenester")).toBe("Tilbake til gudstjenestene");
  });

  test("uten noe i adressen går den tilbake til kalenderen, som før", () => {
    expect(runSheetBackLink("")).toBe("/minside?view=kalender");
    expect(runSheetBackLabel("")).toBe("Tilbake til kalenderen");
  });

  test("andre parametre gir kalenderen", () => {
    expect(runSheetBackLink("?fra=kjoreplan")).toBe("/minside?view=kalender");
    expect(runSheetBackLink("?fra=gudstjenester-ikke")).toBe("/minside?view=kalender");
    expect(runSheetBackLink("?view=gudstjenester")).toBe("/minside?view=kalender");
    expect(runSheetBackLink("?x=1&fra=gudstjenester")).toBe("/minside?view=gudstjenester");
  });
});
