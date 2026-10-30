import { describe, expect, test } from "vitest";
import { SURFACES_RECORD } from "../src/data/settingsRecords";
import { defaultSurfaces, icalFeedUrl, icalImportOn, parseSurfaces, validHttpsUrl } from "../src/utils/surfaces";

describe("surfaces", () => {
  test("default er begge flater på", () => {
    const d = defaultSurfaces();
    expect(d.minSide).toBe(true);
    expect(d.ownWebsite).toBe(true);
  });

  test("parseSurfaces leser av/på og url-er", () => {
    const parsed = parseSurfaces({
      recordType: SURFACES_RECORD,
      minSide: false,
      ownWebsite: false,
      externalSiteUrl: "https://example.org/",
      externalCalendarUrl: "webcal://example.org/cal.ics",
      dismissedUids: ["uid-1"],
      keptUids: ["uid-2"],
    });
    expect(parsed.minSide).toBe(false);
    expect(parsed.ownWebsite).toBe(false);
    expect(parsed.externalSiteUrl).toBe("https://example.org/");
    expect(validHttpsUrl(parsed.externalCalendarUrl)).toBe("https://example.org/cal.ics");
    expect(parsed.dismissedUids).toEqual(["uid-1"]);
  });

  test("icalImportOn bare uten vår nettside og med feed", () => {
    expect(icalImportOn(defaultSurfaces())).toBe(false);
    expect(
      icalImportOn({
        ...defaultSurfaces(),
        ownWebsite: false,
        externalCalendarUrl: "https://example.org/cal.ics",
      })
    ).toBe(true);
    expect(
      icalImportOn({
        ...defaultSurfaces(),
        ownWebsite: true,
        externalCalendarUrl: "https://example.org/cal.ics",
      })
    ).toBe(false);
  });

  test("validHttpsUrl avviser ugyldige adresser", () => {
    expect(validHttpsUrl("")).toBe("");
    expect(validHttpsUrl("ftp://x")).toBe("");
    expect(validHttpsUrl("https://menighet.example/kalender.ics")).toBe("https://menighet.example/kalender.ics");
  });

  test("icalFeedUrl returnerer null uten gyldig feed", () => {
    expect(icalFeedUrl({ ...defaultSurfaces(), externalCalendarUrl: "ikke-en-url" })).toBe(null);
  });
});
