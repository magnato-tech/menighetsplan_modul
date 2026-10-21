// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { initialCmsPages, type CmsNewsArticle, type CmsPage } from "../src/data/cmsData";
import type { Gathering } from "../src/types";
import { clearDraftBackup, draftTimeLabel, readDraftBackup, writeDraftBackup } from "../src/hooks/useDraftBackup";
import { siteCheck } from "../src/utils/siteCheck";
import { focusPointFromPress, formatFocusPoint, objectPositionOf, parseFocusPoint } from "../src/utils/focusPoint";
import { buildPageRecord } from "../src/utils/pageRecord";
import { formOfGathering, gatheringUpdatesOf } from "../src/utils/gatheringForm";
import { versionChanges } from "../src/utils/contentVersions";

// The backlog after the survey of other publishing tools: the middle-sized things.

afterEach(() => window.localStorage.clear());

describe("9. Autolagring i nettleseren", () => {
  test("et utkast kan leses tilbake, og er borte når det er fjernet", () => {
    writeDraftBackup("side:page-om", { title: "Om oss – endret" }, new Date("2026-10-21T12:05:00Z"));
    expect(readDraftBackup<{ title: string }>("side:page-om")).toEqual({ savedAt: "2026-10-21T12:05:00.000Z", draft: { title: "Om oss – endret" } });
    clearDraftBackup("side:page-om");
    expect(readDraftBackup("side:page-om")).toBeNull();
  });

  test("noe ødelagt i lageret gir ingenting, ikke en feil", () => {
    window.localStorage.setItem("menighetsplan:utkast:side:x", "{ikke json");
    expect(readDraftBackup("side:x")).toBeNull();
  });

  test("tiden sies i norsk tid", () => {
    expect(draftTimeLabel("2026-10-21T12:05:00Z")).toBe("21. oktober kl. 14:05");
  });
});

describe("10. Sjekk nettsiden", () => {
  const now = Date.parse("2026-10-21T10:00:00Z");
  const page = (fields: Partial<CmsPage>): CmsPage => ({ ...initialCmsPages[1], id: "p-test", slug: "test", title: "Test", linkUrl: undefined, isPublished: true, ...fields });

  test("demosidene er i orden", () => {
    expect(siteCheck({ pages: initialCmsPages, news: [], gatherings: [], media: [], now })).toEqual([]);
  });

  test("en side uten beskrivelse, et bilde uten tekst og en lenke til en side som ikke finnes", () => {
    const pages = [
      page({ metaDescription: "", summary: "", content: ":::media-left[https://example.org/a.jpg]\n### Bilde\nTekst\n:::\n\n[Les mer](page:finnes-ikke)" }),
    ];
    const kinds = siteCheck({ pages, news: [], gatherings: [], media: [], now }).map((finding) => finding.kind);
    expect(kinds).toContain("noDescription");
    expect(kinds).toContain("imageWithoutAlt");
  });

  test("en kladd sjekkes ikke", () => {
    expect(siteCheck({ pages: [page({ isPublished: false, metaDescription: "", summary: "" })], news: [], gatherings: [], media: [], now })).toEqual([]);
  });

  test("nyheter som har stått lenge, og arrangementer de neste ukene uten bilde og tekst", () => {
    const news = [{ id: "n1", title: "Alpha Youth", publishedAt: "2026-10-01T10:00:00Z", isPublished: true } as CmsNewsArticle];
    const gatherings = [
      { id: "g1", title: "Kirkelunsj", startsAt: "2026-11-01T10:00:00Z", visibility: "offentlig", isPublic: true, type: "gudstjeneste" } as unknown as Gathering,
      { id: "g2", title: "Langt fram", startsAt: "2027-06-01T10:00:00Z", visibility: "offentlig", isPublic: true, type: "gudstjeneste" } as unknown as Gathering,
    ];
    const findings = siteCheck({ pages: [], news, gatherings, media: [], now });
    expect(findings.map((finding) => [finding.kind, finding.tab])).toEqual([
      ["newsStanding", "cms-nyheter"],
      ["eventMissing", "cms-overstyringer"],
    ]);
    expect(findings[1].where).toMatch(/^Kirkelunsj · /);
  });
});

describe("13. Hva som er endret i Historikk", () => {
  test("sier hvilke deler som er annerledes, og hvor mange ord teksten har mer eller mindre", () => {
    const version = { title: "Om oss", content: "En to tre fire", summary: "Kort", heroVeil: "dark", updatedAt: "a" };
    expect(versionChanges(version, { ...version, updatedAt: "b" })).toEqual([]);
    expect(versionChanges(version, { ...version, title: "Om menigheten", content: "En to" })).toEqual(["tittel", "teksten (2 ord flere)"]);
    expect(versionChanges(version, { ...version, content: "En to tre fire fem seks", heroVeil: "light" })).toEqual(["teksten (2 ord færre)", "andre innstillinger"]);
  });
});

describe("11. Fokuspunkt", () => {
  test("et punkt leses, skrives og regnes ut fra der det ble trykket", () => {
    expect(parseFocusPoint("30% 20%")).toEqual({ x: 30, y: 20 });
    expect(parseFocusPoint("midt")).toBeNull();
    expect(parseFocusPoint("150% 20%")).toBeNull();
    expect(formatFocusPoint({ x: 33.4, y: 66.6 })).toBe("33% 67%");
    expect(focusPointFromPress(150, 50, { left: 100, top: 0, width: 200, height: 100 })).toEqual({ x: 25, y: 50 });
  });

  test("midten, eller ingenting valgt, gir bildet som før", () => {
    expect(objectPositionOf(undefined)).toBeUndefined();
    expect(objectPositionOf("50% 50%")).toBeUndefined();
    expect(objectPositionOf("30% 20%")).toBe("30% 20%");
  });

  test("sidens og arrangementets punkt lagres, og faller bort uten bilde", () => {
    const withImage = buildPageRecord({ title: "Forside", heroImage: "https://example.org/a.jpg", heroFocus: "30% 20%" }, new Date(0), () => "id");
    expect(withImage.heroFocus).toBe("30% 20%");
    expect(buildPageRecord({ title: "Forside", heroFocus: "30% 20%" }, new Date(0), () => "id").heroFocus).toBeUndefined();

    const form = { ...formOfGathering({ id: "g", title: "Fest", startsAt: "2026-11-01T10:00:00Z" } as Gathering), imageUrl: "https://example.org/b.jpg", imageFocus: "40% 10%" };
    expect(gatheringUpdatesOf(form, true).imageFocus).toBe("40% 10%");
    expect(gatheringUpdatesOf({ ...form, imageUrl: "" }, true).imageFocus).toBeUndefined();
  });
});
