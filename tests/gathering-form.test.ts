import { describe, expect, test } from "vitest";
import { buildGathering } from "../src/data/newDocuments";
import type { Gathering } from "../src/types";
import { combineDateAndTimeToIso } from "../src/utils/dates";
import { defaultGroupId, formOfGathering, gatheringFormError, gatheringUpdatesOf, hasPresentation, newGatheringForm, newGatheringOf } from "../src/utils/gatheringForm";

// The form an event is made and changed in: one set of fields, whichever way the event is reached.

const filled = (changes = {}) =>
  newGatheringForm({ title: "Høstfest", date: "2026-10-18", time: "17:00", groupId: "g1", ...changes });

describe("Et nytt arrangement fra skjemaet", () => {
  test("starter åpent for alle, som gudstjeneste kl. 11, og ellers tomt", () => {
    expect(newGatheringForm()).toMatchObject({ title: "", time: "11:00", endTime: "", visibility: "offentlig", isGudstjeneste: true, cancelled: false });
  });

  test("får med alt skjemaet har: slutt, sted, tema, bibeltekst og synlighet", () => {
    const values = filled({ endTime: "20:00", location: " Storsalen ", theme: "Takk", bibleText: "Sal 100", visibility: "fremhevet", isGudstjeneste: false });
    const gathering = buildGathering(newGatheringOf(values));

    expect(gathering).toMatchObject({
      title: "Høstfest",
      groupId: "g1",
      startsAt: combineDateAndTimeToIso("2026-10-18", "17:00"),
      endsAt: combineDateAndTimeToIso("2026-10-18", "20:00"),
      location: "Storsalen",
      theme: "Takk",
      bibleText: "Sal 100",
      visibility: "fremhevet",
      isPublic: true,
      isGudstjeneste: false,
      type: "arrangement",
    });
  });

  test("et arrangement kan slutte en annen dag enn det starter", () => {
    const camp = newGatheringOf(filled({ endDate: "2026-10-20", endTime: "14:00" }));
    expect(camp.endsAt).toBe(combineDateAndTimeToIso("2026-10-20", "14:00"));
  });

  test("felt som står tomme, lagres ikke som tom tekst", () => {
    const plain = newGatheringOf(filled());
    expect(plain.endsAt).toBeUndefined();
    expect(plain.location).toBeUndefined();
    expect(plain.theme).toBeUndefined();
    expect(plain.bibleText).toBeUndefined();
  });
});

describe("Når skjemaet ikke kan lagres", () => {
  test("sier det hva som mangler, med ord", () => {
    expect(gatheringFormError(filled())).toBeNull();
    expect(gatheringFormError(filled({ title: "  " }))).toBe("Arrangementet må ha en tittel.");
    expect(gatheringFormError(filled({ date: "" }))).toBe("Arrangementet må ha en dato.");
    expect(gatheringFormError(filled({ groupId: "" }))).toBe("Opprett en gruppe først. Et arrangement må ha en ansvarlig gruppe.");
  });

  test("slutten må være etter starten", () => {
    expect(gatheringFormError(filled({ endTime: "16:00" }))).toBe("Slutten må være etter starten.");
    expect(gatheringFormError(filled({ endTime: "17:00" }))).toBe("Slutten må være etter starten.");
    expect(gatheringFormError(filled({ endTime: "17:30" }))).toBeNull();
    // Past midnight, said with the day it ends
    expect(gatheringFormError(filled({ time: "21:00", endTime: "01:00" }))).toBe("Slutten må være etter starten.");
    expect(gatheringFormError(filled({ time: "21:00", endDate: "2026-10-19", endTime: "01:00" }))).toBeNull();
  });

  test("en sluttdato uten klokkeslett sier ikke når det slutter", () => {
    expect(gatheringFormError(filled({ endDate: "2026-10-20" }))).toBe("Sett et klokkeslett for slutten, eller ta bort sluttdatoen.");
  });
});

describe("Et arrangement som finnes, i skjemaet", () => {
  const stored: Gathering = {
    id: "gathering-1",
    groupId: "g1",
    title: "Gudstjeneste & dåp",
    startsAt: combineDateAndTimeToIso("2026-10-18", "11:00"),
    endsAt: combineDateAndTimeToIso("2026-10-18", "12:30"),
    location: "Kirkesalen",
    type: "arrangement",
    theme: "Nåde",
    bibleText: "Ef 2,8",
    visibility: "fremhevet",
    isGudstjeneste: true,
    cancelled: false,
  };

  test("fylles ut med det som er lagret", () => {
    expect(formOfGathering(stored)).toEqual({
      title: "Gudstjeneste & dåp",
      date: "2026-10-18",
      time: "11:00",
      endDate: "",
      endTime: "12:30",
      location: "Kirkesalen",
      groupId: "g1",
      isGudstjeneste: true,
      theme: "Nåde",
      bibleText: "Ef 2,8",
      visibility: "fremhevet",
      cancelled: false,
      imageUrl: "",
      imageAlt: "",
      summary: "",
      content: "",
      linkUrl: "",
      linkLabel: "",
    });
  });

  test("som slutter en annen dag, viser den dagen", () => {
    const camp = { ...stored, endsAt: combineDateAndTimeToIso("2026-10-20", "14:00") };
    expect(formOfGathering(camp)).toMatchObject({ endDate: "2026-10-20", endTime: "14:00" });
  });

  test("lagret uendret gir det samme tilbake", () => {
    expect(gatheringUpdatesOf(formOfGathering(stored), true)).toEqual({
      title: stored.title,
      startsAt: stored.startsAt,
      endsAt: stored.endsAt,
      location: "Kirkesalen",
      theme: "Nåde",
      bibleText: "Ef 2,8",
      visibility: "fremhevet",
      isPublic: true,
      isGudstjeneste: true,
      cancelled: false,
      groupId: "g1",
    });
  });

  test("et felt som tømmes, tas bort, og ikke lagret som tom tekst", () => {
    const updates = gatheringUpdatesOf({ ...formOfGathering(stored), endTime: "", location: "", theme: "", bibleText: "" }, true);
    for (const key of ["endsAt", "location", "theme", "bibleText"] as const) {
      expect(key in updates).toBe(true);
      expect(updates[key]).toBeUndefined();
    }
  });

  test("kan avlyses og gjøres intern", () => {
    const updates = gatheringUpdatesOf({ ...formOfGathering(stored), cancelled: true, visibility: "intern" }, true);
    expect(updates).toMatchObject({ cancelled: true, visibility: "intern", isPublic: false });
  });

  test("gruppen røres ikke når skjemaet ikke spør etter den", () => {
    expect(gatheringUpdatesOf(formOfGathering(stored), false)).not.toHaveProperty("groupId");
  });

  test("uten merke for gudstjeneste leses det av tittelen, som ellers i løsningen", () => {
    const { isGudstjeneste: _mark, ...old } = stored;
    expect(formOfGathering(old as Gathering).isGudstjeneste).toBe(true);
    expect(formOfGathering({ ...old, title: "Dugnad" } as Gathering).isGudstjeneste).toBe(false);
  });
});

describe("Slik arrangementet presenteres på nettsiden", () => {
  const presented = { imageUrl: "media:m1", imageAlt: "Plakat for høstfesten", summary: "Mat, sang og lek.", content: "## Program\n\nVi starter kl. 17.", linkUrl: "https://pamelding.example/host", linkLabel: "Meld deg på" };

  test("lagres på et nytt arrangement, og på et som finnes", () => {
    expect(buildGathering(newGatheringOf(filled(presented)))).toMatchObject(presented);
    expect(gatheringUpdatesOf(filled(presented), false)).toMatchObject(presented);
  });

  test("leses tilbake i skjemaet", () => {
    const stored = buildGathering(newGatheringOf(filled(presented)));
    expect(formOfGathering(stored)).toMatchObject(presented);
  });

  test("det som tømmes, tas bort på arrangementet", () => {
    const updates = gatheringUpdatesOf(filled(), false);
    for (const key of ["imageUrl", "imageAlt", "summary", "content", "linkUrl", "linkLabel"] as const) {
      expect(key in updates).toBe(true);
      expect(updates[key]).toBeUndefined();
    }
  });

  test("en bildetekst uten bilde, og en knappetekst uten lenke, lagres ikke", () => {
    const updates = gatheringUpdatesOf(filled({ imageAlt: "Plakat", linkLabel: "Meld deg på" }), false);
    expect(updates.imageAlt).toBeUndefined();
    expect(updates.linkLabel).toBeUndefined();
  });

  test("lenken må være en adresse", () => {
    expect(gatheringFormError(filled({ linkUrl: "https://pamelding.example/host" }))).toBeNull();
    expect(gatheringFormError(filled({ linkUrl: "/bli-med" }))).toBeNull();
    expect(gatheringFormError(filled({ linkUrl: "pamelding.example" }))).toBe("Lenken må starte med https:// eller /.");
    expect(gatheringFormError(filled({ linkUrl: "javascript:alert(1)" }))).toBe("Lenken må starte med https:// eller /.");
  });

  test("skjemaet vet om noe er fylt ut", () => {
    expect(hasPresentation(filled())).toBe(false);
    expect(hasPresentation(filled({ summary: "  " }))).toBe(false);
    expect(hasPresentation(filled({ summary: "Mat, sang og lek." }))).toBe(true);
    expect(hasPresentation(filled({ imageUrl: "media:m1" }))).toBe(true);
  });
});

describe("Gruppen et nytt arrangement hører til før noen har valgt", () => {
  const groups = [
    { id: "lovsang", memberIds: ["p1"], leaderIds: ["p2"] },
    { id: "kalender", memberIds: [], leaderIds: [] },
  ];

  test("med planleggeren er det den første gruppen", () => {
    expect(defaultGroupId(groups, true)).toBe("lovsang");
  });

  test("uten planleggeren er det gruppen som bare holder kalenderen, og ellers den første", () => {
    expect(defaultGroupId(groups, false)).toBe("kalender");
    expect(defaultGroupId([groups[0]], false)).toBe("lovsang");
  });

  test("uten grupper er det ingen", () => {
    expect(defaultGroupId([], true)).toBe("");
    expect(defaultGroupId([], false)).toBe("");
  });
});
