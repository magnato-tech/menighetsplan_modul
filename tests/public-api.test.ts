import { describe } from "vitest";
import { assert } from "./assert";
import {
  type GatheringDoc,
  type GroupDoc,
  toOsloIso,
  toPublicGatherings,
  toContractV1,
  toV11,
  toPublicGroups,
  toRecurringEvents,
} from "../server/publicApi";
import { isWorshipService } from "../src/utils/gatherings";
import { isGroupPublic, isPubliclyVisible, visibilityOf, visibilityFields, visibilityAfterToggle } from "../src/utils/visibility";

describe("Det offentlige API-et", () => {
  const base: GatheringDoc = {
    id: "g-1",
    groupId: "group-1",
    title: "Gudstjeneste & kirkekaffe",
    startsAt: "2026-11-01T10:00:00.000Z",
    endsAt: "2026-11-01T11:30:00.000Z",
    type: "arrangement",
    visibility: "offentlig",
    isPublic: true,
    isGudstjeneste: true,
    cancelled: false,
  };

  // 1. Time zone: the offset must follow Oslo, not the server's own time zone
  const instants: [string, string][] = [
    ["2026-07-05T09:00:00Z", "2026-07-05T11:00:00+02:00"], // sommertid
    ["2026-11-01T10:00:00Z", "2026-11-01T11:00:00+01:00"], // vintertid
    ["2026-12-24T15:00:00Z", "2026-12-24T16:00:00+01:00"],
    ["2026-10-25T00:30:00Z", "2026-10-25T02:30:00+02:00"], // siste halvtime med sommertid
    ["2026-10-25T01:30:00Z", "2026-10-25T02:30:00+01:00"], // samme klokkeslett, nå vintertid
    ["2026-03-29T00:59:59Z", "2026-03-29T01:59:59+01:00"], // sekundet før sommertid
    ["2026-03-29T01:00:00Z", "2026-03-29T03:00:00+02:00"],
    ["2026-12-31T23:30:00Z", "2027-01-01T00:30:00+01:00"], // over årsskiftet
  ];
  for (const [input, expected] of instants) {
    const output = toOsloIso(new Date(input));
    assert(output === expected, `toOsloIso(${input}) gir ${expected} (fikk ${output})`);
    assert(new Date(output).getTime() === new Date(input).getTime(), `toOsloIso(${input}) peker på samme tidspunkt`);
  }
  assert(
    toOsloIso(new Date("2026-12-24T15:00:00.500Z")) === "2026-12-24T16:00:00+01:00",
    "toOsloIso tåler millisekunder"
  );

  // 2. Visibility: `visibility` decides, `isPublic` only when `visibility` is missing
  assert(isPubliclyVisible({ visibility: "offentlig" }), "visibility 'offentlig' er offentlig");
  assert(isPubliclyVisible({ visibility: "fremhevet" }), "visibility 'fremhevet' er offentlig");
  assert(!isPubliclyVisible({ visibility: "intern", isPublic: true }), "visibility 'intern' vinner over isPublic: true");
  assert(isPubliclyVisible({ visibility: "offentlig", isPublic: false }), "visibility 'offentlig' vinner over isPublic: false");
  assert(isPubliclyVisible({ isPublic: true }), "Uten visibility brukes isPublic: true");
  assert(!isPubliclyVisible({ isPublic: false }), "Uten visibility brukes isPublic: false");
  assert(
    !isPubliclyVisible({ visibility: "hemmelig" as GatheringDoc["visibility"] }),
    "Ukjent visibility-verdi regnes ikke som offentlig"
  );
  assert(
    visibilityOf({ visibility: "fremhevet" }) === "fremhevet" && visibilityOf({ visibility: "intern", isPublic: true }) === "intern",
    "visibilityOf gir den lagrede verdien"
  );
  assert(
    visibilityOf({ isPublic: false }) === "intern" && visibilityOf({ isPublic: true }) === "offentlig" && visibilityOf({}) === "offentlig",
    "visibilityOf leser isPublic på en samling fra før visibility fantes"
  );
  assert(
    visibilityOf({ visibility: "hemmelig" as GatheringDoc["visibility"] }) === "intern",
    "visibilityOf regner en ukjent verdi som intern"
  );

  // Writing: the two fields are always stored together, and a public/internal switch keeps "fremhevet"
  assert(
    visibilityFields("intern").isPublic === false && visibilityFields("offentlig").isPublic && visibilityFields("fremhevet").isPublic,
    "visibilityFields gir isPublic som følger visibility"
  );
  assert(visibilityAfterToggle("offentlig", false) === "intern", "Å skru av offentlig gir 'intern'");
  assert(visibilityAfterToggle("fremhevet", false) === "intern", "Å skru av offentlig på en fremhevet samling gir 'intern'");
  assert(visibilityAfterToggle("intern", true) === "offentlig", "Å skru på offentlig gir 'offentlig'");
  assert(visibilityAfterToggle(undefined, true) === "offentlig", "Samling uten visibility blir 'offentlig' når den skrus på");
  assert(visibilityAfterToggle("fremhevet", true) === "fremhevet", "En fremhevet samling forblir fremhevet så lenge den er offentlig");
  assert(
    !isPubliclyVisible(visibilityFields(visibilityAfterToggle("offentlig", false))),
    "En samling som skrus av er ikke lenger offentlig, heller ikke i API-et"
  );

  // 3. Worship service: the explicit flag wins over the title
  assert(isWorshipService({ title: "Høsttakkefest", isGudstjeneste: true }), "isGudstjeneste: true gir gudstjeneste uansett tittel");
  assert(!isWorshipService({ title: "Planlegging av gudstjeneste", isGudstjeneste: false }), "isGudstjeneste: false vinner over tittelen");
  assert(isWorshipService({ title: "Gudstjeneste" }), "Uten flagg brukes tittelen");

  // 4. Filtering, validation and sorting
  const docs: GatheringDoc[] = [
    { ...base, id: "late", startsAt: "2026-12-06T10:00:00.000Z" },
    { ...base, id: "early", startsAt: "2026-09-06T09:00:00.000Z" },
    { ...base, id: "internal", visibility: "intern", isPublic: false },
    { ...base, id: "group", type: "gruppesamling", title: "Lydteknisk opplæring", isGudstjeneste: false },
    { ...base, id: "no-date", startsAt: "" },
    { ...base, id: "no-title", title: "" },
  ];
  const originalWarn = console.warn;
  let warnings = 0;
  console.warn = () => {
    warnings++;
  };
  const all = toPublicGatherings(docs);
  const v1 = toPublicGatherings(docs, { excludeGroupGatherings: true });
  const ranged = toPublicGatherings(docs, {
    from: new Date("2026-10-01").getTime(),
    to: new Date("2026-11-30").getTime(),
  });
  console.warn = originalWarn;

  assert(all.map((i) => i.gathering.id).join() === "early,group,late","Interne og ugyldige arrangementer utelates, resten sorteres på start");
  assert(v1.map((i) => i.gathering.id).join() === "early,late", "Kontrakt v1 utelater gruppesamlinger");
  assert(ranged.map((i) => i.gathering.id).join() === "group", "fra/til avgrenser på starttidspunkt");
  assert(warnings === 6, `Ugyldige arrangementer logges (2 per kall, fikk ${warnings} totalt)`);

  // 5. Contract v1 shape
  const [item] = toPublicGatherings([base]);
  const now = new Date("2026-10-01T12:00:00.000Z");
  const contract = toContractV1(item, now);
  assert(
    Object.keys(contract).join() ===
      "id,type,tittel,tema,bibeltekst,beskrivelse,start,slutt,heldag,sted,status,tagger,sistEndret",
    "Kontrakt v1 har nøyaktig de avtalte feltene"
  );
  assert(contract.type === "gudstjeneste" && contract.status === "planlagt", "Kontrakt v1: type og status");
  assert(contract.start === "2026-11-01T11:00:00+01:00" && contract.slutt === "2026-11-01T12:30:00+01:00", "Kontrakt v1: start og slutt i norsk tid");
  assert(contract.tagger.join() === "gudstjeneste,fellesskap", "Kontrakt v1: tagger fra flagg og tittel");
  assert(contract.sted === "Kirken", "Kontrakt v1: standard sted når location mangler");
  assert(contract.sistEndret === now.toISOString(), "Kontrakt v1: sistEndret faller tilbake til genereringstidspunktet");

  const [noEnd] = toPublicGatherings([{ ...base, endsAt: undefined }]);
  assert(toContractV1(noEnd, now).slutt === "2026-11-01T12:30:00+01:00", "Kontrakt v1: slutt er start + 90 minutter når endsAt mangler");

  const [cancelled] = toPublicGatherings([{ ...base, cancelled: true, isGudstjeneste: false, title: "Ungdomskveld" }]);
  const cancelledContract = toContractV1(cancelled, now);
  assert(cancelledContract.status === "avlyst" && cancelledContract.type === "arrangement", "Kontrakt v1: avlyst arrangement");

  // 6. v1.1 shape uses the same classification
  const legacy = toV11(item);
  assert(legacy.erGudstjeneste === (contract.type === "gudstjeneste"), "v1.1 og v1 er enige om hva som er gudstjeneste");
  assert(legacy.kategorier.join() === "gudstjeneste,arrangement,fellesskap", "v1.1: kategorier = gudstjeneste, type, nøkkelord");
  assert(legacy.start === base.startsAt && legacy.slutt === base.endsAt, "v1.1: start og slutt er uendret fra databasen");
  assert(legacy.uid === legacy.id && legacy.tittel === legacy.title && legacy.sted === legacy.location, "v1.1: norske og engelske nøkler har samme verdi");
  assert(toV11(cancelled).kategorier.join() === "arrangement,ungdom", "v1.1: kategorier uten gudstjeneste");
  const [featured] = toPublicGatherings([{ ...base, visibility: "fremhevet" }]);
  assert(toV11(featured).fremhevet === true && legacy.fremhevet === false, "v1.1: sier fra hvilke samlinger som er fremhevet");
  assert(!("fremhevet" in toContractV1(featured, now)), "Kontrakt v1 er uendret: ingen nye felt");

  // 7. Groups and recurring events
  const groups: GroupDoc[] = [
    {
      id: "group-hus-1",
      name: "Husfellesskap Sentrum",
      category: "husgruppe",
      memberIds: ["p1", "p2", "p3"],
      leaderIds: ["p1"],
      meetingSchedule: { weekday: "Onsdag", time: "19:30", frequency: "annenhver uke" },
    },
    { id: "group-lyd", name: "Lyd og bilde", category: "tjenestegruppe", memberIds: ["p4"], leaderIds: [] },
  ];
  const publicGroups = toPublicGroups(groups);
  assert(publicGroups.length === 2 && publicGroups[0].antallMedlemmer === 3, "Grupper: antall medlemmer telles");
  assert(!JSON.stringify(publicGroups).includes("p1"), "Grupper: medlems-ID-er eksponeres ikke");

  const recurring = toRecurringEvents(groups);
  assert(recurring.length === 1, "Faste aktiviteter: kun grupper med møteplan er med");
  assert(toRecurringEvents([]).length === 0, "Faste aktiviteter: ingen grupper gir tom liste");
  const fromGroup = recurring[0];
  assert(
    fromGroup.id === "recurring-group-group-hus-1" && fromGroup.sted === "Hjemmene" && fromGroup.klokkeslett === "19:30",
    "Faste aktiviteter: husgruppe får sted 'Hjemmene' og tid fra møteplanen"
  );

  // 8. A group an admin has hidden leaves the API altogether
  assert(isGroupPublic({}) && isGroupPublic({ isPublic: true }) && !isGroupPublic({ isPublic: false }), "En gruppe er offentlig til noen skjuler den");
  const withHidden: GroupDoc[] = [...groups, { ...groups[0], id: "group-sorg", name: "Sorggruppe", isPublic: false }];
  assert(
    toPublicGroups(withHidden).map((g) => g.id).join() === "group-hus-1,group-lyd",
    "Grupper: en skjult gruppe er ikke med"
  );
  assert(
    toRecurringEvents(withHidden).map((e) => e.groupId).join() === "group-hus-1",
    "Faste aktiviteter: møtetiden til en skjult gruppe er ikke med"
  );
  assert(!JSON.stringify([toPublicGroups(withHidden), toRecurringEvents(withHidden)]).includes("Sorggruppe"), "Navnet på en skjult gruppe lekker ikke");
});
