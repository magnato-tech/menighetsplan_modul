import { describe } from "vitest";
import { assert } from "./assert";
import { STUDIO_TABS } from "../src/pages/admin/studio";
import { areaOfTab, areaToShow, defaultArea, parseArea } from "../src/pages/admin/studioAreas";
import { parseAdminDetailRoute } from "../src/utils/adminStudioRoutes";

describe("Planlegging og Nettside i admin", () => {
  // 1. Every tab has a place
  for (const tab of STUDIO_TABS) {
    assert(areaOfTab(tab) !== undefined, `«${tab}» er plassert`);
  }
  assert(areaOfTab("planlegger-samlinger") === "planlegging" && areaOfTab("cms-overstyringer") === "nettside", "Arrangementer planlegges, og vises på nettsiden");
  assert(areaOfTab("analyse") === "planlegging" && areaOfTab("nettsidebesok") === "nettside", "Analysebordet under Planlegging, besøkene under Nettside");
  for (const tab of ["dashboard", "cms-hjelp", "moduler", "database-admin", "demo-oppsett"] as const) {
    assert(areaOfTab(tab) === null, `«${tab}» står i begge`);
  }
  for (const path of ["/admin/person/p1", "/admin/gruppe/g1", "/admin/samling/s1", "/admin/oppgave/o1"]) {
    const route = parseAdminDetailRoute(path)!;
    assert(areaOfTab(route.backTab) === "planlegging", `${path} hører til Planlegging`);
  }

  // 2. Which part is shown
  assert(areaToShow("cms-sider", "planlegging", "plan") === "nettside", "En side fra Nettside viser Nettside, uansett hva som var valgt");
  assert(areaToShow("dashboard", "nettside", "plan") === "nettside", "Oversikten følger det som er valgt");
  assert(areaToShow("dashboard", null, "plan") === "planlegging", "Første gang med Menighetsplan: Planlegging");
  assert(areaToShow("dashboard", null, "plattform") === "nettside", "Første gang med Menighetsplattform: Nettside");
  assert(defaultArea("plan") === "planlegging" && defaultArea("plattform") === "nettside", "Standarden følger nivået");
  assert(parseArea("nettside") === "nettside" && parseArea("noe annet") === null, "Bare de to delene kan huskes");
});
