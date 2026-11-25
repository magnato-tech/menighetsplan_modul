import { describe } from "vitest";
import { assert } from "./assert";
import {
  analyticsPeriod,
  buildChurchAnalytics,
  headcountCsv,
  summarizeFullStaffing,
  summarizeTasksTaken,
  highLoadThreshold,
  type ChurchData,
} from "../src/utils/churchAnalytics";
import type {
  Assignment,
  Gathering,
  GatheringAttendance,
  GatheringHeadcount,
  Group,
  GroupMessage,
  Person,
  Task,
} from "../src/types";
import type { CmsNewsArticle, CmsPage, CmsSermon } from "../src/data/cmsData";

describe("Analysebord", () => {
  const now = new Date("2026-10-05T12:00:00.000Z").getTime();
  const DAY = 24 * 60 * 60 * 1000;

  // 1. The period and the one before it
  const fourWeeks = analyticsPeriod("4w", now);
  assert(fourWeeks.from === now - 28 * DAY && fourWeeks.to === now, "Siste 4 uker går 28 dager tilbake fra nå");
  assert(fourWeeks.previousFrom === now - 56 * DAY, "Forrige periode er like lang og ligger rett før");
  assert(analyticsPeriod("12m", now).weeks === 52, "Siste 12 måneder er 52 hele uker, så begge perioder har like mange søndager");
  assert(highLoadThreshold(fourWeeks) === 3, "På fire uker regnes tre ganger eller mer som høy belastning");
  assert(highLoadThreshold(analyticsPeriod("12m", now)) === 26, "På et år er grensen oftere enn annenhver uke");

  // 2. A small congregation
  const persons: Person[] = [
    { id: "p1", name: "Anne Admin", globalRole: "admin", isStaff: true, isPublicProfile: true, consentToPublishGivenAt: "2026-01-01T10:00:00.000Z" },
    { id: "p2", name: "Bjørn Bærer", globalRole: "member", policeCertificateValidUntil: "2026-11-01" },
    { id: "p3", name: "Cecilie Kaffe", globalRole: "member", policeCertificateValidUntil: "2026-09-01" },
    { id: "p4", name: "Dag Husvert", globalRole: "member", policeCertificateValidUntil: "2027-06-01", isPublicProfile: true },
    { id: "p5", name: "Eva Borte", globalRole: "member", unavailablePeriods: [{ from: "2026-10-01", to: "2026-10-10" }] },
    { id: "p6", name: "Frode Utenfor", globalRole: "member" },
  ];
  const groups: Group[] = [
    { id: "g-team", name: "Søndagsteam", category: "tjenestegruppe", memberIds: ["p2", "p3"], leaderIds: ["p1"] },
    {
      id: "g-hus",
      name: "Husfellesskap Vest",
      category: "husgruppe",
      memberIds: ["p4", "p5"],
      leaderIds: ["p2"],
      // p6 joined in the period but has left again; the join date stays in the document
      memberJoinedAt: { p4: "2026-01-01T10:00:00.000Z", p5: "2026-09-20T10:00:00.000Z", p6: "2026-09-21T10:00:00.000Z" },
    },
    { id: "g-stille", name: "Turgruppa", category: "interessegruppe", memberIds: ["p3"], leaderIds: [] },
  ];
  const service = (id: string, startsAt: string, extra: Partial<Gathering> = {}): Gathering => ({
    id,
    groupId: "g-team",
    title: "Gudstjeneste",
    startsAt,
    type: "arrangement",
    visibility: "offentlig",
    isGudstjeneste: true,
    ...extra,
  });
  const gatherings: Gathering[] = [
    service("w-prev", "2026-08-30T09:00:00.000Z"),
    service("w1", "2026-09-13T09:00:00.000Z"),
    service("w2", "2026-09-20T09:00:00.000Z"),
    service("w3", "2026-09-27T09:00:00.000Z"),
    service("w4", "2026-10-04T09:00:00.000Z", { cancelled: true }),
    service("e1", "2026-09-25T17:00:00.000Z", { title: "Konsert; høst", isGudstjeneste: false }),
    service("h1", "2026-09-23T17:30:00.000Z", { groupId: "g-hus", title: "Husfellesskap", type: "gruppesamling", visibility: "intern", isGudstjeneste: false }),
    service("w-future", "2026-10-11T09:00:00.000Z"),
  ];
  const headcounts: GatheringHeadcount[] = [
    { id: "headcount-w-prev", gatheringId: "w-prev", adults: 60, children: 15, registeredAt: "2026-08-30T12:00:00.000Z" },
    { id: "headcount-w1", gatheringId: "w1", adults: 80, children: 20, registeredAt: "2026-09-13T12:00:00.000Z" },
    { id: "headcount-w3", gatheringId: "w3", adults: 70, children: 10, note: "Regn", registeredAt: "2026-09-27T12:00:00.000Z" },
    { id: "headcount-e1", gatheringId: "e1", adults: 40, children: 0, registeredAt: "2026-09-25T20:00:00.000Z" },
    { id: "headcount-slettet", gatheringId: "slettet", adults: 999, children: 0, registeredAt: "2026-09-25T20:00:00.000Z" },
  ];
  const tasks: Task[] = [
    { id: "t1", gatheringId: "w1", title: "Lyd", volunteerRoleId: "role-lyd", status: "confirmed", neededCount: 1 },
    { id: "t2", gatheringId: "w1", title: "Kirkekaffe", status: "open", neededCount: 2 },
    { id: "t3", gatheringId: "w3", title: "Lyd", volunteerRoleId: "role-lyd", status: "confirmed", neededCount: 1 },
    { id: "t4", gatheringId: "w2", title: "Kirkekaffe", status: "confirmed", neededCount: 1 },
    { id: "t-avlyst", gatheringId: "w2", title: "Kirkekaffe", status: "cancelled", neededCount: 3 },
    { id: "t-prev", gatheringId: "w-prev", title: "Lyd", status: "confirmed", neededCount: 1 },
    { id: "t-future", gatheringId: "w-future", title: "Lyd", status: "open", neededCount: 2 },
  ];
  const assignments: Assignment[] = [
    { id: "a1", taskId: "t1", personId: "p2", response: "confirmed", assignedAt: "2026-09-01T10:00:00.000Z", respondedAt: "2026-09-01T14:00:00.000Z" },
    { id: "a2", taskId: "t2", personId: "p3", response: "confirmed", assignedAt: "2026-09-02T00:00:00.000Z", respondedAt: "2026-09-03T00:00:00.000Z" },
    { id: "a3", taskId: "t2", personId: "p6", response: "declined", assignedAt: "2026-09-02T00:00:00.000Z", respondedAt: "2026-09-02T02:00:00.000Z" },
    { id: "a4", taskId: "t3", personId: "p2", response: "confirmed" },
    { id: "a5", taskId: "t3", personId: "p3", response: "withdrawn", respondedAt: "2026-09-26T12:00:00.000Z" },
    { id: "a6", taskId: "t4", personId: "p2", response: "confirmed" },
    { id: "a-prev", taskId: "t-prev", personId: "p4", response: "confirmed" },
    { id: "a-future", taskId: "t-future", personId: "p3", response: "confirmed" },
  ];
  const attendances: GatheringAttendance[] = [
    { id: "att-1", gatheringId: "h1", personId: "p4", status: "attending" },
    { id: "att-2", gatheringId: "h1", personId: "p5", status: "declined" },
    { id: "att-3", gatheringId: "h1", personId: "p6", status: "attending" },
  ];
  const messages: GroupMessage[] = [
    { id: "m1", groupId: "g-team", senderPersonId: "p1", senderName: "Anne Admin", content: "Hei", createdAt: "2026-09-15T08:00:00.000Z" },
    { id: "m2", groupId: "g-hus", senderPersonId: "p2", senderName: "Bjørn Bærer", content: "Velkommen", createdAt: "2026-10-01T08:00:00.000Z" },
    { id: "m3", groupId: "g-team", senderPersonId: "p1", senderName: "Anne Admin", content: "Gammel", createdAt: "2026-08-20T08:00:00.000Z" },
  ];
  const page = (id: string, extra: Partial<CmsPage>): CmsPage => ({
    id,
    slug: id,
    title: id,
    summary: "",
    content: "",
    isPublished: true,
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...extra,
  });
  const article = (id: string, publishedAt: string, isPublished: boolean): CmsNewsArticle => ({
    id,
    title: id,
    slug: id,
    summary: "",
    content: "",
    category: "aktuelt",
    author: "Anne Admin",
    publishedAt,
    isPublished,
  });
  const sermons: CmsSermon[] = [
    { id: "s1", title: "Nåde", speaker: "Anne Admin", date: "2026-09-13", audioUrl: "https://example.org/s1.mp3" },
    { id: "s2", title: "Håp", speaker: "Anne Admin", date: "2026-09-27" },
    { id: "s3", title: "Tro", speaker: "Anne Admin", date: "2026-08-30" },
  ];
  const data: ChurchData = {
    persons,
    groups,
    gatherings,
    tasks,
    assignments,
    attendances,
    headcounts,
    messages,
    volunteerRoles: [{ id: "role-lyd", name: "Lydtekniker", sortOrder: 0 }],
    pages: [
      page("forside", {}),
      page("kladd", { isPublished: false, status: "draft" }),
      page("senere", { status: "scheduled", publishAt: "2026-11-01T08:00:00.000Z" }),
    ],
    news: [
      article("n1", "2026-09-20T10:00:00.000Z", true),
      article("n2", "2026-08-20T10:00:00.000Z", true),
      article("n3", "2026-09-21T10:00:00.000Z", false),
    ],
    sermons,
  };
  const result = buildChurchAnalytics(data, "4w", now);
  const { attendance, gatherings: held, volunteers, groups: groupSummary, people, content, coverage } = result;
  const ids = (list: { gathering: Gathering }[]) => list.map((row) => row.gathering.id).join(",");

  // 3. Attendance
  assert(ids(attendance.worship) === "w1,w2,w3", "Gudstjenestene i perioden, eldste først; avlyste og fremtidige er ikke med");
  assert(ids(attendance.gatherings) === "w1,w2,e1,w3", "Gruppesamlinger telles ikke som oppmøte; et arrangement gjør det");
  assert(attendance.worshipCounted === 2, "To av tre gudstjenester har oppmøtetall");
  assert(attendance.averageWorship === 90, "Snittet regnes bare av gudstjenestene som er talt (100 og 80)");
  assert(attendance.averageAll === 73, "Snittet for alle arrangementer tar med konserten (100, 40 og 80)");
  assert(attendance.averageWorshipChildren === 15, "Snittet for barn regnes på samme måte");
  assert(attendance.previousAverageWorship === 75 && attendance.previousWorshipCounted === 1, "Forrige periode sammenlignes for seg");
  assert(attendance.highestWorship?.gathering.id === "w1", "Den best besøkte gudstjenesten finnes");
  assert(attendance.totalCounted === 220, "Alle som er talt på samlinger for hele menigheten i perioden");
  assert(ids(attendance.missing) === "w2", "Samlinger uten oppmøtetall listes, nyeste først");
  assert(!attendance.gatherings.some((row) => row.total === 999), "En telling for en slettet samling regnes ikke med");

  // 4. Gatherings
  assert(held.held === 5 && held.worship === 3 && held.otherEvents === 1 && held.groupMeetings === 1, "Holdte samlinger fordelt på type");
  assert(held.cancelled === 1 && held.previousHeld === 1 && held.upcoming === 1, "Avlyste, forrige periode og de neste fire ukene");

  // 5. Volunteers
  assert(volunteers.slotsNeeded === 5 && volunteers.slotsFilled === 4, "Plasser og bekreftede plasser; avlyste oppgaver regnes ikke");
  assert(volunteers.fillRate === 0.8 && volunteers.previousFillRate === 1, "Bemanningsgrad nå og forrige periode");
  assert(volunteers.activeVolunteers === 2 && volunteers.previousActiveVolunteers === 1, "Aktive frivillige er de som sa ja");
  assert(volunteers.shareOfRegister === 2 / 6, "Andelen av personregisteret som har tjenestegjort");
  assert(volunteers.withdrawals === 1 && volunteers.acuteWithdrawals === 1, "Et forfall under 48 timer før er akutt");
  assert(volunteers.declines === 1, "Avslag telles for seg");
  assert(volunteers.medianResponseHours === 4, "Svartiden er medianen av besvarte forespørsler (2, 4 og 24 timer)");
  assert(
    volunteers.load.map((b) => b.people).join(",") === "1,1,0,0",
    "Belastning: én person har tjenestegjort én gang, én person tre ganger"
  );
  assert(
    volunteers.highLoad.length === 1 && volunteers.highLoad[0].person.id === "p2" && volunteers.highLoad[0].gatherings === 3,
    "Den som står på oftest i perioden løftes fram"
  );
  assert(
    volunteers.roles.map((r) => `${r.name}:${r.filled}/${r.needed}`).join(",") === "Kirkekaffe:2/3,Lydtekniker:2/2",
    "Rollene med flest ubesatte plasser står først, og navnet hentes fra rollebiblioteket"
  );
  assert(volunteers.unused.map((p) => p.id).join(",") === "p1", "Medlemmer av tjenestegrupper som ikke har tjenestegjort");
  assert(
    volunteers.upcoming.slotsNeeded === 2 && volunteers.upcoming.slotsFilled === 1 && volunteers.upcoming.openSlots === 1,
    "Bemanningen de neste fire ukene"
  );

  // 6. Groups
  const team = groupSummary.groups.find((g) => g.group.id === "g-team")!;
  const hus = groupSummary.groups.find((g) => g.group.id === "g-hus")!;
  const stille = groupSummary.groups.find((g) => g.group.id === "g-stille")!;
  assert(team.members === 3 && !team.quiet && team.lastActivityAt === "2026-09-27T09:00:00.000Z", "Ledere telles som medlemmer; siste samling er aktivitet");
  assert(
    hus.meetings === 1 && hus.responses.attending === 1 && hus.responses.declined === 1 && hus.responses.possible === 3,
    "Svar på gruppens samlinger telles, men ikke fra en som har gått ut av gruppen"
  );
  assert(hus.newMembers === 1 && hus.messages === 1, "Nye medlemmer og meldinger i perioden; en som har gått ut, telles ikke som ny");
  assert(stille.quiet && stille.lastActivityAt === null, "En gruppe uten samlinger og meldinger er stille");
  assert(groupSummary.personsInGroups === 5 && groupSummary.belongingRate === 5 / 6, "Tilhørighet: fem av seks er med i en gruppe");
  assert(groupSummary.withoutGroup.map((p) => p.id).join(",") === "p6", "Personer uten gruppe listes");
  assert(groupSummary.messages === 2 && groupSummary.previousMessages === 1, "Meldinger nå og i forrige periode");
  assert(groupSummary.quietGroups === 1 && groupSummary.newMembers === 1, "Stille grupper og nye medlemskap");
  assert(
    groupSummary.byCategory.map((c) => `${c.category}:${c.groups}/${c.people}`).join(",") === "tjenestegruppe:1/3,husgruppe:1/3,interessegruppe:1/1",
    "Grupper og personer per kategori, i fast rekkefølge"
  );

  // 7. The person register
  assert(people.total === 6 && people.admins === 1 && people.staff === 1, "Personregisteret telles");
  assert(people.publicProfiles === 1, "Bare offentlige profiler med registrert samtykke telles");
  assert(
    people.policeCertificates.expiringSoon.map((p) => p.id).join(",") === "p2" &&
      people.policeCertificates.expired.map((p) => p.id).join(",") === "p3" &&
      people.policeCertificates.valid === 1,
    "Politiattester: gyldig, går ut innen 60 dager, og utløpt"
  );
  assert(people.unavailableNow === 1, "Personer som er borte i dag");

  // 8. The website
  assert(content.newsPublished === 1 && content.previousNewsPublished === 1, "Bare publiserte nyheter telles");
  assert(content.sermons === 2 && content.previousSermons === 1 && content.sermonsWithRecording === 1, "Taler i perioden, og hvor mange som har opptak");
  assert(
    content.pages.published === 1 && content.pages.scheduled === 1 && content.pages.drafts === 1,
    "Sider: publisert, planlagt og kladd"
  );

  // 9. What the numbers rest on
  const note = (id: string) => coverage.find((c) => c.id === id)!;
  assert(note("oppmote").status === "partial" && note("oppmote").text.includes("2 av 3"), "Datagrunnlaget sier hvor mange gudstjenester som er talt");
  assert(note("svar").text.includes("ikke hvem som kom"), "Svar på samlinger skilles fra oppmøte");
  assert(
    note("nettside").status === "missing" && note("nettside").text.includes("slås på under Moduler"),
    "Uten modulen telles ikke besøk, og bordet sier hvor den slås på"
  );
  const visitsNote = (websiteVisits: "counted" | "paused") =>
    buildChurchAnalytics({ ...data, websiteVisits }, "4w", now).coverage.find((c) => c.id === "nettside")!;
  assert(
    visitsNote("counted").status === "ok" && visitsNote("counted").text.includes("telles anonymt"),
    "Med modulen på telles besøk på nettsiden, på sitt eget bord"
  );
  assert(
    visitsNote("paused").status === "missing" && visitsNote("paused").text.includes("slått av"),
    "En telling som er satt på vent, sies som det"
  );

  // 10. Nothing is made up when the database is empty
  const empty = buildChurchAnalytics(
    { persons: [], groups: [], gatherings: [], tasks: [], assignments: [], attendances: [], headcounts: [], messages: [], volunteerRoles: [], pages: [], news: [], sermons: [] },
    "3m",
    now
  );
  assert(
    empty.attendance.averageWorship === null &&
      empty.attendance.averageAll === null &&
      empty.volunteers.fillRate === null &&
      empty.volunteers.activeVolunteers === null &&
      empty.volunteers.withdrawals === null &&
      empty.volunteers.declines === null &&
      empty.volunteers.medianResponseHours === null &&
      empty.groups.belongingRate === null &&
      empty.volunteers.shareOfRegister === null,
    "Uten data er tallene tomme, ikke null eller beregnet"
  );
  assert(empty.coverage.find((c) => c.id === "oppmote")?.status === "missing", "Uten gudstjenester sier datagrunnlaget fra");

  // 11. Export
  const csv = headcountCsv(attendance.gatherings).split("\r\n");
  assert(csv[0] === "Dato;Klokkeslett;Samling;Type;Voksne;Barn;Totalt;Merknad", "Eksporten har norske kolonnenavn");
  assert(csv.length === 5, "Én linje per samling");
  assert(csv.some((line) => line.includes(';"Konsert; høst";Arrangement;40;0;40;')), "En tittel med semikolon settes i anførselstegn");
  assert(csv.some((line) => /;Gudstjeneste;;;;$/.test(line)), "En samling uten telling har tomme tall, ikke null");
  const formula = headcountCsv([
    {
      gathering: { ...gatherings[1], title: "=HYPERLINK(\"x\")" },
      isWorship: true,
      headcount: { id: "h", gatheringId: "w1", adults: 1, children: 0, note: "+47 999", registeredAt: "2026-09-13T12:00:00.000Z" },
      total: 1,
    },
  ]);
  assert(
    formula.includes(`;"'=HYPERLINK(""x"")";`) && formula.endsWith(";'+47 999"),
    "Tekst som ser ut som en formel, åpnes som tekst i regnearket"
  );
});

describe("Oppgaver tatt", () => {
  const now = new Date("2026-10-05T12:00:00.000Z").getTime();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const at = (ms: number) => new Date(now - ms).toISOString();

  // One task on one gathering, and one assignment on it: what each case changes
  const takenBy = (assignment: Partial<Assignment>, task: Partial<Task> = {}) =>
    summarizeTasksTaken(
      {
        gatherings: [],
        tasks: [{ id: "t", gatheringId: "g", title: "Lyd", status: "open", neededCount: 1, ...task }],
        assignments: [{ id: "a", taskId: "t", personId: "p", response: "confirmed", ...assignment }],
      },
      now
    );
  const counts = (s: { lastDay: number; lastWeek: number; lastMonth: number }) => `${s.lastDay},${s.lastWeek},${s.lastMonth}`;

  assert(counts(takenBy({ assignedAt: at(2 * HOUR) })) === "1,1,1", "En bekreftet tildeling 2 timer før telles i alle tre");
  assert(counts(takenBy({ assignedAt: at(3 * DAY) })) === "0,1,1", "3 dager før telles i 7 og 30 dager, ikke i siste døgn");
  assert(counts(takenBy({ assignedAt: at(20 * DAY) })) === "0,0,1", "20 dager før telles bare i 30 dager");
  assert(counts(takenBy({ assignedAt: at(40 * DAY) })) === "0,0,0", "40 dager før telles ikke");
  assert(
    counts(takenBy({ assignedAt: at(40 * DAY), respondedAt: at(2 * HOUR) })) === "1,1,1",
    "Det som gjelder er den seneste datoen: svaret, når det er senere enn tildelingen"
  );
  assert(
    counts(takenBy({ response: "withdrawn", assignedAt: at(2 * HOUR), respondedAt: at(HOUR) })) === "0,0,0",
    "Et forfall telles ikke"
  );
  assert(counts(takenBy({ response: "declined", assignedAt: at(2 * HOUR) })) === "0,0,0", "Et avslag telles ikke");
  assert(counts(takenBy({ response: "pending", assignedAt: at(2 * HOUR) })) === "0,0,0", "En forespørsel som venter på svar telles ikke");
  assert(counts(takenBy({ assignedAt: at(2 * HOUR) }, { status: "cancelled" })) === "0,0,0", "En oppgave som er avlyst, telles ikke");
  assert(counts(takenBy({ assignedAt: new Date(now + 2 * HOUR).toISOString() })) === "0,0,0", "En dato etter nå telles ikke");
  assert(counts(takenBy({})) === "0,0,0", "En tildeling uten dato telles ikke");
  assert(
    counts(
      summarizeTasksTaken(
        {
          gatherings: [],
          tasks: [{ id: "t", gatheringId: "g", title: "Lyd", status: "confirmed", neededCount: 1 }],
          assignments: [
            { id: "a-eldst", taskId: "t", personId: "p", response: "confirmed", assignedAt: at(3 * HOUR) },
            { id: "a-nyest", taskId: "t", personId: "p", response: "confirmed", assignedAt: at(HOUR) },
          ],
        },
        now
      )
    ) === "1,1,1",
    "To tildelinger for samme person og oppgave telles én gang"
  );

  // The open slots are the same figure as «Bemanning per arrangement» for the next four weeks
  const upcoming = {
    gatherings: [{ id: "g", groupId: "g-team", title: "Gudstjeneste", startsAt: new Date(now + 3 * DAY).toISOString(), type: "arrangement" as const, visibility: "offentlig" as const, isGudstjeneste: true }],
    tasks: [
      { id: "t1", gatheringId: "g", title: "Lyd", status: "open" as const, neededCount: 2 },
      { id: "t2", gatheringId: "g", title: "Kirkekaffe", status: "open" as const, neededCount: 1 },
    ],
    assignments: [{ id: "a1", taskId: "t1", personId: "p", response: "confirmed" as const, assignedAt: at(2 * HOUR) }],
  };
  const openSlots = summarizeTasksTaken(upcoming, now).openSlotsNext4Weeks;
  assert(openSlots === 2, "Ledige plasser: én av to på første oppgave og en på den andre");
  assert(
    openSlots === summarizeFullStaffing(upcoming, analyticsPeriod("next4w", now)).missingSlots,
    "Ledige plasser neste 4 uker er samme tall som bemanningen for neste 4 uker"
  );
  assert(
    buildChurchAnalytics(
      { persons: [], groups: [], attendances: [], headcounts: [], messages: [], volunteerRoles: [], pages: [], news: [], sermons: [], ...upcoming },
      "4w",
      now
    ).tasksTaken.lastDay === 1,
    "Analysen har tallene med seg, og de telles fra nå uansett periode"
  );
});
