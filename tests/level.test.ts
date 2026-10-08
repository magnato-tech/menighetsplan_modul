import { describe, expect, test } from "vitest";
import { readDemoInstallation } from "../src/installation";
import { PLANNER_TABS, isTabInLevel } from "../src/pages/admin/levelTabs";
import { STUDIO_TABS } from "../src/pages/admin/studio";
import { LEVELS, LEVEL_NAMES, LEVEL_SUMMARIES, hasPlanner, installationLevel, parseLevel } from "../src/utils/level";

describe("De to nivåene", () => {
  test("det er to, og det høyeste inneholder det laveste", () => {
    expect(LEVELS).toEqual(["plattform", "plan"]);
    expect(LEVEL_NAMES).toEqual({ plattform: "Menighetsplattform", plan: "Menighetsplan" });
    expect(hasPlanner("plattform")).toBe(false);
    expect(hasPlanner("plan")).toBe(true);
    for (const level of LEVELS) expect(LEVEL_SUMMARIES[level]).not.toBe("");
  });

  test("en lagret verdi er et nivå bare når den er ett av de to", () => {
    expect(parseLevel("plattform")).toBe("plattform");
    expect(parseLevel("plan")).toBe("plan");
    for (const nothing of ["", "Plan", "nivå 2", "premium", null, undefined, 2, true, {}]) {
      expect(parseLevel(nothing)).toBeNull();
    }
  });

  test("i demoen gjelder det den besøkende har valgt, og hele produktet til noe er valgt", () => {
    expect(installationLevel(true, null)).toBe("plan");
    expect(installationLevel(true, "plattform")).toBe("plattform");
    expect(installationLevel(true, "plan")).toBe("plan");
  });

  test("hos en menighet spør ingen nettleseren: et valg der endrer ingenting", () => {
    expect(installationLevel(false, null)).toBe("plan");
    expect(installationLevel(false, "plattform")).toBe("plan");
  });
});

describe("Fanene i admin følger nivået", () => {
  test("Menighetsplan har alle fanene", () => {
    expect(STUDIO_TABS.every((tab) => isTabInLevel(tab, "plan"))).toBe(true);
  });

  test("Menighetsplattform mangler oppgavene, gruppene og tjenesterollene, og ingenting annet", () => {
    const missing = STUDIO_TABS.filter((tab) => !isTabInLevel(tab, "plattform"));
    expect(missing).toEqual(["planlegger-oppgaver", "planlegger-grupper", "planlegger-roller"]);
    expect([...PLANNER_TABS].sort()).toEqual([...missing].sort());
  });

  test("nettsiden, kalenderen og personregisteret er med på begge nivå", () => {
    for (const tab of ["cms-sider", "cms-nyheter", "cms-design", "planlegger-samlinger", "planlegger-personer"] as const) {
      expect(isTabInLevel(tab, "plattform")).toBe(true);
    }
  });
});

describe("En installasjon er demoen bare når den er satt opp som det", () => {
  test("uten innstillingen er den en menighets egen", () => {
    expect(readDemoInstallation({})).toBeNull();
    expect(readDemoInstallation({ VITE_DEMO_SIGNUP_URL: "https://eksempel.no/start" })).toBeNull();
  });

  test("bare ordet true slår den på", () => {
    expect(readDemoInstallation({ VITE_DEMO: "true" })).toEqual({});
    expect(readDemoInstallation({ VITE_DEMO: " true " })).toEqual({});
    for (const other of ["", "false", "TRUE", "1", "ja", "yes", true, 1, null, undefined]) {
      expect(readDemoInstallation({ VITE_DEMO: other })).toBeNull();
    }
  });

  test("lenkene er med når de er vanlige nettadresser", () => {
    expect(
      readDemoInstallation({
        VITE_DEMO: "true",
        VITE_DEMO_SIGNUP_URL: "https://eksempel.no/kom-i-gang",
        VITE_DEMO_SALES_URL: "https://eksempel.no",
      })
    ).toEqual({ signUpUrl: "https://eksempel.no/kom-i-gang", salesSiteUrl: "https://eksempel.no" });
  });

  test("en adresse som ikke er en vanlig nettadresse, blir ingen lenke", () => {
    for (const bad of ["javascript:alert(1)", "http://eksempel.no", "eksempel.no", "https://", "https://eksempel", "https://eksempel.no/a b", "", 42]) {
      expect(readDemoInstallation({ VITE_DEMO: "true", VITE_DEMO_SIGNUP_URL: bad, VITE_DEMO_SALES_URL: bad })).toEqual({});
    }
  });
});
