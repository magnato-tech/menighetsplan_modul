import { describe, expect, test } from "vitest";
import { mayOpenTab, type TabWho } from "../src/pages/admin/tabAccess";
import { STUDIO_TABS, type StudioTab } from "../src/pages/admin/studio";
import { membershipClerkMayOpen } from "../src/pages/admin/membershipClerk";
import { webEditorMayOpen } from "../src/pages/admin/webEditor";

// Which tabs of the admin each kind of person may open. Everything here is made up.

const ADMIN: TabWho = { isAdmin: true, webEditor: false, clerk: false, giving: false };
const ADMIN_WITH_RIGHT: TabWho = { ...ADMIN, giving: true };
const WEB_EDITOR: TabWho = { isAdmin: false, webEditor: true, clerk: false, giving: false };
const WEB_EDITOR_WITH_RIGHT: TabWho = { ...WEB_EDITOR, giving: true };
const CLERK: TabWho = { isAdmin: false, webEditor: false, clerk: true, giving: false };
const CLERK_WITH_RIGHT: TabWho = { ...CLERK, giving: true };
const GIVING_ONLY: TabWho = { isAdmin: false, webEditor: false, clerk: false, giving: true };
const NOBODY: TabWho = { isAdmin: false, webEditor: false, clerk: false, giving: false };

const tabsFor = (who: TabWho): StudioTab[] => STUDIO_TABS.filter((tab) => mayOpenTab(tab, who));

describe("Hvilke faner hver har", () => {
  test("administrator: alle faner, også innlogging og gaveformål", () => {
    expect(tabsFor(ADMIN)).toEqual([...STUDIO_TABS]);
    expect(tabsFor(ADMIN_WITH_RIGHT)).toEqual([...STUDIO_TABS]);
  });

  test("nettredaktør uten rettighet: nøyaktig de samme fanene som før", () => {
    for (const tab of STUDIO_TABS) expect(mayOpenTab(tab, WEB_EDITOR), tab).toBe(webEditorMayOpen(tab));
  });

  test("protokollansvarlig uten rettighet: nøyaktig de samme fanene som før", () => {
    for (const tab of STUDIO_TABS) expect(mayOpenTab(tab, CLERK), tab).toBe(membershipClerkMayOpen(tab));
  });

  test("bare en rettighet i givertjeneste: gaveinnstillinger og hjelp, ingen andre faner", () => {
    expect(tabsFor(GIVING_ONLY)).toEqual(STUDIO_TABS.filter((tab) => tab === "giver-innstillinger" || tab === "cms-hjelp"));
  });

  test("ingen av dem: ingen fane", () => {
    expect(tabsFor(NOBODY)).toEqual([]);
  });

  test("nettredaktør med rettighet: sine faner, og gaveinnstillinger og hjelp i tillegg", () => {
    for (const tab of STUDIO_TABS) {
      const expected = webEditorMayOpen(tab) || tab === "giver-innstillinger";
      expect(mayOpenTab(tab, WEB_EDITOR_WITH_RIGHT), tab).toBe(expected);
    }
  });

  test("protokollansvarlig med rettighet: sine faner, og gaveinnstillinger og hjelp i tillegg", () => {
    for (const tab of STUDIO_TABS) {
      const expected = membershipClerkMayOpen(tab) || tab === "giver-innstillinger";
      expect(mayOpenTab(tab, CLERK_WITH_RIGHT), tab).toBe(expected);
    }
  });
});

describe("Gaveformål og innlogging er administratorens alene", () => {
  test("ingen andre får dem, uansett rettighet i givertjeneste", () => {
    for (const who of [WEB_EDITOR, WEB_EDITOR_WITH_RIGHT, CLERK, CLERK_WITH_RIGHT, GIVING_ONLY, NOBODY]) {
      expect(mayOpenTab("gaveformal", who)).toBe(false);
      expect(mayOpenTab("innlogging", who)).toBe(false);
    }
    expect(mayOpenTab("gaveformal", ADMIN)).toBe(true);
    expect(mayOpenTab("innlogging", ADMIN)).toBe(true);
  });
});

describe("Siden for rettighetene", () => {
  test("en administrator uten rettighet får se forklaringen", () => {
    expect(mayOpenTab("giver-innstillinger", ADMIN)).toBe(true);
  });

  test("den som ikke har noen rettighet, får den ikke", () => {
    for (const who of [WEB_EDITOR, CLERK, NOBODY]) expect(mayOpenTab("giver-innstillinger", who)).toBe(false);
  });
});
