import { describe, expect, test } from "vitest";
import { SURFACES_RECORD } from "../src/data/settingsRecords";
import {
  decidePublicEntry,
  defaultSurfaces,
  hasChurchSite,
  icalFeedUrl,
  icalImportOn,
  normalizeExternalCalendarUrl,
  parseSurfaces,
  validHttpsUrl,
} from "../src/utils/surfaces";

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

  test("normalizeExternalCalendarUrl gjør Google embed om til basic.ics", () => {
    const embed =
      "https://calendar.google.com/calendar/embed?src=bmn4covvsag4hdmt3qv9ekdah8hb3pdp%40import.calendar.google.com&ctz=Europe%2FOslo";
    expect(normalizeExternalCalendarUrl(embed)).toBe(
      "https://calendar.google.com/calendar/ical/bmn4covvsag4hdmt3qv9ekdah8hb3pdp%40import.calendar.google.com/public/basic.ics"
    );
    expect(
      icalFeedUrl({
        ...defaultSurfaces(),
        ownWebsite: false,
        externalCalendarUrl: embed,
      })
    ).toContain("/public/basic.ics");
  });
});

describe("Når vår nettside er av: hvor en offentlig adresse fører", () => {
  const combos = [true, false].flatMap((ownWebsite) => [true, false].map((minSide) => ({ ownWebsite, minSide })));

  test("vår nettside på: alltid den vanlige nettsiden", () => {
    for (const minSide of [true, false]) {
      expect(decidePublicEntry({ ownWebsite: true, minSide }, "/")).toBe("render");
      expect(decidePublicEntry({ ownWebsite: true, minSide }, "/hva-skjer")).toBe("render");
    }
  });

  test("vår nettside av og Min side på: offentlige adresser går til Min side", () => {
    for (const pathname of ["/", "/hva-skjer", "/arrangement/x"]) {
      expect(decidePublicEntry({ ownWebsite: false, minSide: true }, pathname)).toBe("minside");
    }
  });

  test("vår nettside av og Min side av: offentlige adresser går til admin", () => {
    for (const pathname of ["/", "/hva-skjer", "/arrangement/x"]) {
      expect(decidePublicEntry({ ownWebsite: false, minSide: false }, pathname)).toBe("admin");
    }
  });

  test("interne adresser, innlogging, avmelding og /api blir aldri sendt videre", () => {
    const paths = ["/admin", "/admin/x", "/minside", "/leder", "/logg-inn", "/avmelding/abc", "/api/offentlig/arrangementer"];
    for (const { ownWebsite, minSide } of combos) {
      for (const pathname of paths) {
        expect(decidePublicEntry({ ownWebsite, minSide }, pathname)).toBe("render");
      }
    }
  });

  test("hasChurchSite: en nettside finnes når vår er på, eller når adressen er lagt inn", () => {
    expect(hasChurchSite({ ...defaultSurfaces(), ownWebsite: true })).toBe(true);
    expect(hasChurchSite({ ...defaultSurfaces(), ownWebsite: false, externalSiteUrl: "" })).toBe(false);
    expect(hasChurchSite({ ...defaultSurfaces(), ownWebsite: false, externalSiteUrl: "https://kirken.example.org/" })).toBe(true);
  });
});
