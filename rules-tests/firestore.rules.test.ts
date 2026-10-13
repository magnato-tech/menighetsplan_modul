import { readFileSync } from "node:fs";
import { buildAssignment, buildAttendance, buildMemberProposal } from "../src/data/newDocuments";
import { documentFields, sanitizeForFirestore } from "../src/utils/firestoreData";
import {
  assignmentAccessPatches,
  gatheringReadersOf,
  groupDirectoryOf,
  groupLeaderEmailsOf,
  publicGroupCardsOf,
} from "../src/utils/groupAccess";
import { absenceFields } from "../src/utils/staffing";
import type { Assignment, Gathering, Group, Person, Task } from "../src/types";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  FieldPath,
  arrayRemove,
  arrayUnion,
  deleteField,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

// The rules in ../firestore.rules, run against Firebase's local emulator: what each kind of
// visitor is let to read and write, asked the way the app asks (see src/services/).
//
//   npm test        (in this folder; starts the emulators, runs this, stops them)

let env: RulesTestEnvironment;

const signedIn = (email: string, verified = true): Firestore =>
  env.authenticatedContext(`uid-${email}`, { email, email_verified: verified }).firestore() as unknown as Firestore;

/** Someone who is not signed in */
const visitor = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;
/** Signed in with a confirmed address that nobody in the register has */
const stranger = () => signedIn("fremmed@eksempel.no");
/** A member who leads nothing */
const hakon = () => signedIn("hakon@eksempel.no");
/** Leader of group-lyd */
const ola = () => signedIn("ola@eksempel.no");
/** Administrator */
const kari = () => signedIn("kari@menigheten.no");

const TODAY = "2026-10-12";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-menighetsplan-regler",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    const put = (path: string, data: object) => setDoc(doc(db, path), data);
    await Promise.all([
      put("persons/kari", { name: "Kari Nordmann", email: "kari@menigheten.no", phone: "99 00 11 22", globalRole: "admin" }),
      put("persons/ola", { name: "Ola Hansen", email: "ola@eksempel.no", globalRole: "member" }),
      put("persons/hakon", { name: "Håkon Tveit", email: "hakon@eksempel.no", globalRole: "member" }),
      put("persons/liv", { name: "Liv Pastor", email: "liv.privat@eksempel.no", globalRole: "member", isPublicProfile: true }),
      put("logins/kari@menigheten.no", { personId: "kari", role: "admin" }),
      put("logins/ola@eksempel.no", { personId: "ola", role: "member" }),
      put("logins/hakon@eksempel.no", { personId: "hakon", role: "member" }),
      put("publicProfiles/liv", { name: "Liv Pastor", globalRole: "member", isPublicProfile: true, publicTitle: "Pastor" }),
      put("groups/group-lyd", { name: "Lyd og bilde", isPublic: true, leaderIds: ["ola"], memberIds: ["hakon"] }),
      put("groups/group-intern", { name: "Sjelesorg", isPublic: false, leaderIds: ["kari"], deputyLeaderIds: [], memberIds: [] }),
      put("groups/group-umerket", { name: "Gammel gruppe", leaderIds: [], memberIds: [] }),
      put("gatherings/g-apen", { groupId: "group-lyd", title: "Gudstjeneste", visibility: "offentlig", isPublic: true }),
      put("gatherings/g-intern", { groupId: "group-intern", title: "Ledermøte", visibility: "intern", isPublic: false }),
      put("tasks/task-1", { gatheringId: "g-apen", groupId: "group-lyd", title: "Lydtekniker", status: "open" }),
      put("tasks/task-2", { gatheringId: "g-intern", groupId: "group-intern", title: "Referent", status: "open" }),
      put("assignments/a1", {
        taskId: "task-1", personId: "hakon", response: "pending", personName: "Håkon Tveit",
        gatheringId: "g-apen", gatheringGroupId: "group-lyd", gatheringPublic: true,
      }),
      put("assignments/a-intern", {
        taskId: "task-2", personId: "kari", response: "pending", personName: "Kari Nordmann",
        gatheringId: "g-intern", gatheringGroupId: "group-intern", gatheringPublic: false,
      }),
      put("groupDirectory/group-lyd_hakon", { groupId: "group-lyd", personId: "hakon", name: "Håkon Tveit" }),
      put("groupDirectory/group-lyd_ola", { groupId: "group-lyd", personId: "ola", name: "Ola Hansen", phone: "22 00 00 00" }),
      put("groupLeaderEmails/group-lyd_hakon", { groupId: "group-lyd", personId: "hakon", email: "hakon@eksempel.no" }),
      put("groupLeaderEmails/group-lyd_ola", { groupId: "group-lyd", personId: "ola", email: "ola@eksempel.no" }),
      put("publicGroupCards/group-lyd", { name: "Lyd og bilde", isPublic: true, memberCount: 2, leaderIds: [], deputyLeaderIds: [], memberIds: [] }),
      put("gatheringReaders/g-apen_hakon", { gatheringId: "g-apen", personId: "hakon" }),
      put("gatheringReaders/g-apen_ola", { gatheringId: "g-apen", personId: "ola" }),
      put("groupMessages/m1", { groupId: "group-lyd", senderPersonId: "hakon", senderName: "Håkon Tveit", content: "Hei!" }),
      put("groupMessages/m2", { groupId: "group-intern", senderPersonId: "kari", senderName: "Kari Nordmann", content: "Møte" }),
      put("gatheringAttendances/att-g-apen-hakon", { gatheringId: "g-apen", personId: "hakon", status: "attending" }),
      put("cms_pages/p-pub", { title: "Om oss", isPublished: true }),
      put("cms_pages/p-kladd", { title: "Kladd", isPublished: false }),
      put("cms_news/n1", { title: "Nyhet" }),
      put("cms_sermons/s1", { title: "Tale" }),
      put("cms_staff/st1", { name: "Stab" }),
      put("cms_media/md1", { name: "Bilde" }),
      put("cms_settings/global", { siteName: "Fjordvik menighet" }),
      put("cms_settings/addons", { recordType: "addons", on: { visits: true } }),
      put("cms_settings/operating-mode", { recordType: "operatingMode", mode: "production" }),
      put("cms_settings/role-1", { recordType: "volunteerRole", name: "Møtevert" }),
      put("cms_settings/template-1", { recordType: "gatheringTemplate", name: "Gudstjeneste" }),
      put("cms_settings/headcount-g-apen", { recordType: "gatheringHeadcount", gatheringId: "g-apen", adults: 80, children: 20 }),
      put("cms_settings/traffic-2026-10-11", { recordType: "siteTraffic", date: "2026-10-11", visits: 12 }),
    ]);
  });
});

const all = (db: Firestore, name: string) => getDocs(collection(db, name));
const marked = (db: Firestore, mark: string) => getDocs(query(collection(db, "cms_settings"), where("recordType", "==", mark)));
/** The groups or events that are marked public: the question the website asks (subscribePublicPart) */
const publicPart = (db: Firestore, name: string) => getDocs(query(collection(db, name), where("isPublic", "==", true)));
/** One visit, counted the way src/services/siteTraffic.ts counts it */
const countVisit = (db: Firestore, date: string, more: object = {}) =>
  setDoc(
    doc(db, `cms_settings/traffic-${date}`),
    { recordType: "siteTraffic", date, views: { "/": increment(1) }, hours: { "10": increment(1) }, visits: increment(1), ...more },
    { merge: true }
  );

describe("En besøkende som ikke er logget inn", () => {
  test("leser nettsiden: innstillingene, publiserte sider, nyheter, taler, stab og bilder", async () => {
    const db = visitor();
    await assertSucceeds(getDoc(doc(db, "test/connection")));
    await assertSucceeds(getDoc(doc(db, "cms_settings/global")));
    await assertSucceeds(getDoc(doc(db, "cms_settings/addons")));
    await assertSucceeds(getDoc(doc(db, "cms_settings/operating-mode")));
    await assertSucceeds(getDocs(query(collection(db, "cms_pages"), where("isPublished", "==", true))));
    await assertSucceeds(getDoc(doc(db, "cms_pages/p-pub")));
    for (const name of ["cms_news", "cms_sermons", "cms_staff", "cms_media", "publicProfiles"]) await assertSucceeds(all(db, name));
  });

  test("leser de offentlige gruppekortene og arrangementene som er merket offentlige, og ikke gruppedokumentene", async () => {
    const db = visitor();
    await assertSucceeds(all(db, "publicGroupCards"));
    await assertSucceeds(getDoc(doc(db, "publicGroupCards/group-lyd")));
    await assertFails(publicPart(db, "groups"));
    await assertFails(getDoc(doc(db, "groups/group-lyd")));
    await assertSucceeds(publicPart(db, "gatherings"));
    await assertSucceeds(getDoc(doc(db, "gatherings/g-apen")));
    await assertFails(all(db, "groups"));
    await assertFails(all(db, "gatherings"));
    await assertFails(getDoc(doc(db, "groups/group-intern")));
    await assertFails(getDoc(doc(db, "groups/group-umerket")));
    await assertFails(getDoc(doc(db, "gatherings/g-intern")));
    await assertFails(getDocs(query(collection(db, "gatherings"), where("isPublic", "==", false))));
    await assertFails(all(db, "groupDirectory"));
    await assertFails(all(db, "groupLeaderEmails"));
  });

  test("leser ikke registeret, planleggingen, kladder eller innloggingene", async () => {
    const db = visitor();
    for (const name of ["persons", "tasks", "assignments", "groupMessages", "gatheringAttendances", "memberProposals", "logins", "cms_pages", "cms_settings"]) {
      await assertFails(all(db, name));
    }
    await assertFails(getDoc(doc(db, "persons/kari")));
    await assertFails(getDoc(doc(db, "persons/liv")));
    await assertFails(getDocs(query(collection(db, "persons"), where("isPublicProfile", "==", true))));
    await assertFails(getDoc(doc(db, "logins/kari@menigheten.no")));
    await assertFails(getDoc(doc(db, "cms_pages/p-kladd")));
    for (const id of ["role-1", "template-1", "headcount-g-apen", "traffic-2026-10-11"]) await assertFails(getDoc(doc(db, `cms_settings/${id}`)));
    for (const mark of ["volunteerRole", "gatheringHeadcount", "siteTraffic", "gatheringTemplate"]) await assertFails(marked(db, mark));
  });

  test("skriver ingenting", async () => {
    const db = visitor();
    const places = [
      "persons/ny", "persons/kari", "groups/ny", "groups/group-lyd", "gatherings/ny", "gatherings/g-apen", "tasks/ny", "tasks/task-1",
      "assignments/ny", "assignments/a1", "groupMessages/ny", "memberProposals/ny", "gatheringAttendances/ny", "gatheringHeadcounts/ny", "volunteer_roles/ny",
      "cms_pages/ny", "cms_pages/p-pub", "cms_news/ny", "cms_sermons/ny", "cms_staff/ny", "cms_media/ny",
      "cms_settings/global", "cms_settings/addons", "cms_settings/operating-mode", "cms_settings/role-1", "cms_settings/ny",
      "logins/fremmed@eksempel.no", "logins/kari@menigheten.no", "publicProfiles/liv", "test/connection", "annet/ny",
      "groupDirectory/group-lyd_hakon", "groupLeaderEmails/group-lyd_ola", "publicGroupCards/group-lyd", "gatheringReaders/g-apen_hakon",
    ];
    for (const place of places) {
      await assertFails(setDoc(doc(db, place), { name: "Innbrudd", role: "admin", personId: "kari", isPublic: true, isPublished: true }));
      await assertFails(deleteDoc(doc(db, place)));
    }
    await assertFails(updateDoc(doc(db, "persons/kari"), { globalRole: "member" }));
    await assertFails(updateDoc(doc(db, "tasks/task-1"), { status: "confirmed" }));
    await assertFails(setDoc(doc(db, "cms_settings/headcount-ny"), { recordType: "gatheringHeadcount", adults: 1, children: 1 }));
  });

  test("kan legge til i besøkstallene for en dag, og ikke noe annet der", async () => {
    const db = visitor();
    // A new day, and a day that has counts already
    await assertSucceeds(countVisit(db, TODAY));
    await assertSucceeds(countVisit(db, TODAY, { entries: { "/": increment(1) }, deepVisits: increment(1) }));
    await assertSucceeds(countVisit(db, "2026-10-11", { seconds: { "/": increment(30) }, missing: { "/x": increment(1) }, actions: { play: increment(1) }, sermons: { s1: increment(1) } }));

    await assertFails(countVisit(db, TODAY, { simulated: true }));
    await assertFails(countVisit(db, TODAY, { role: "admin" }));
    await assertFails(deleteDoc(doc(db, "cms_settings/traffic-2026-10-11")));
    await assertFails(getDoc(doc(db, `cms_settings/traffic-${TODAY}`)));
    // Not under another name, and not over a document that is something else
    await assertFails(setDoc(doc(db, "cms_settings/traffic-i-dag"), { recordType: "siteTraffic", date: TODAY, visits: increment(1) }, { merge: true }));
    await assertFails(setDoc(doc(db, "cms_settings/global"), { recordType: "siteTraffic", date: TODAY, visits: increment(1) }));
    await assertFails(setDoc(doc(db, "cms_settings/global"), { recordType: "siteTraffic", date: TODAY, visits: increment(1) }, { merge: true }));
    await assertFails(setDoc(doc(db, "cms_settings/role-1"), { recordType: "siteTraffic", date: TODAY }));
  });
});

describe("Den som logger inn uten å stå i registeret", () => {
  test("får vite at adressen ikke har noen innlogging, og får ikke mer enn en besøkende", async () => {
    const db = stranger();
    await assertSucceeds(getDoc(doc(db, "logins/fremmed@eksempel.no")));
    await assertFails(getDoc(doc(db, "logins/kari@menigheten.no")));
    await assertFails(all(db, "logins"));
    await assertFails(all(db, "persons"));
    await assertFails(getDoc(doc(db, "persons/kari")));
    await assertFails(all(db, "tasks"));
    await assertFails(all(db, "cms_pages"));
    await assertSucceeds(publicPart(db, "gatherings"));
  });

  test("kan ikke gi seg selv en innlogging", async () => {
    const db = stranger();
    await assertFails(setDoc(doc(db, "logins/fremmed@eksempel.no"), { personId: "kari", role: "admin" }));
    await assertFails(setDoc(doc(db, "logins/fremmed@eksempel.no"), { personId: "ny", role: "member" }));
    await assertFails(setDoc(doc(db, "persons/ny"), { name: "Fremmed", email: "fremmed@eksempel.no", globalRole: "admin" }));
    await assertFails(setDoc(doc(db, "persons/kari"), { name: "Kari", email: "fremmed@eksempel.no", globalRole: "admin" }));
  });

  test("en adresse som ikke er bekreftet, gir ingen adgang, selv om den står i registeret", async () => {
    const db = signedIn("kari@menigheten.no", false);
    await assertFails(all(db, "persons"));
    await assertFails(getDoc(doc(db, "logins/kari@menigheten.no")));
    await assertFails(setDoc(doc(db, "cms_news/ny"), { title: "Nyhet" }));
  });

  test("store og små bokstaver i kontoens adresse spiller ingen rolle", async () => {
    const db = signedIn("Ola@Eksempel.NO");
    await assertFails(all(db, "persons"));
    await assertSucceeds(getDoc(doc(db, "persons/ola")));
    await assertFails(getDoc(doc(db, "persons/kari")));
    await assertSucceeds(getDoc(doc(db, "logins/ola@eksempel.no")));
  });
});

describe("Et medlem", () => {
  test("leser sitt eget kort, sin egen gruppe og den gruppens navn, og ikke registeret", async () => {
    const db = hakon();
    await assertFails(all(db, "persons"));
    await assertSucceeds(getDoc(doc(db, "persons/hakon")));
    await assertFails(getDoc(doc(db, "persons/kari")));
    await assertFails(getDoc(doc(db, "persons/ola")));
    await assertFails(all(db, "groups"));
    await assertSucceeds(getDoc(doc(db, "groups/group-lyd")));
    await assertFails(getDoc(doc(db, "groups/group-intern")));
    await assertSucceeds(getDocs(query(collection(db, "groups"), where("memberIds", "array-contains", "hakon"))));
    await assertSucceeds(getDocs(query(collection(db, "groupDirectory"), where("groupId", "==", "group-lyd"))));
    await assertFails(getDocs(query(collection(db, "groupDirectory"), where("groupId", "==", "group-intern"))));
    await assertFails(all(db, "groupDirectory"));
    await assertFails(getDoc(doc(db, "groupLeaderEmails/group-lyd_ola")));
    await assertFails(all(db, "groupLeaderEmails"));
    await assertSucceeds(getDocs(query(collection(db, "assignments"), where("personId", "==", "hakon"))));
    await assertSucceeds(getDocs(query(collection(db, "assignments"), where("gatheringGroupId", "==", "group-lyd"))));
    await assertFails(getDoc(doc(db, "assignments/a-intern")));
    await assertFails(all(db, "assignments"));
    await assertSucceeds(getDocs(query(collection(db, "groupMessages"), where("groupId", "==", "group-lyd"))));
    await assertFails(getDoc(doc(db, "groupMessages/m2")));
    await assertFails(all(db, "groupMessages"));
    for (const name of ["gatherings", "tasks", "cms_pages", "cms_settings"]) {
      await assertSucceeds(all(db, name));
    }
    await assertFails(all(db, "gatheringAttendances"));
    await assertSucceeds(getDocs(query(collection(db, "gatheringAttendances"), where("gatheringId", "==", "g-apen"))));
    await assertSucceeds(getDocs(query(collection(db, "gatheringAttendances"), where("personId", "==", "hakon"))));
    await assertFails(getDocs(query(collection(db, "gatheringAttendances"), where("gatheringId", "==", "g-intern"))));
    for (const mark of ["volunteerRole", "gatheringHeadcount"]) await assertSucceeds(marked(db, mark));
    await assertSucceeds(getDoc(doc(db, "logins/hakon@eksempel.no")));
    await assertFails(getDoc(doc(db, "logins/kari@menigheten.no")));
    await assertFails(all(db, "logins"));
    await assertFails(setDoc(doc(db, "groupDirectory/group-lyd_hakon"), { groupId: "group-lyd", personId: "hakon", name: "Håkon", birthDate: "1990-01-01" }));
  });

  test("en som er tatt ut av gruppen, leser ikke katalogen selv om kortet ligger igjen", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await updateDoc(doc(db, "groups/group-lyd"), { memberIds: [] });
    });
    const db = hakon();
    await assertFails(getDocs(query(collection(db, "groupDirectory"), where("groupId", "==", "group-lyd"))));
    await assertFails(getDoc(doc(db, "groupDirectory/group-lyd_ola")));
    await assertFails(getDocs(query(collection(db, "groupMessages"), where("groupId", "==", "group-lyd"))));
    await assertFails(getDocs(query(collection(db, "assignments"), where("gatheringGroupId", "==", "group-lyd"))));
    await assertSucceeds(getDocs(query(collection(db, "assignments"), where("personId", "==", "hakon"))));
  });

  test("svarer på en forespørsel, og oppgavens status skrives sammen med svaret", async () => {
    const db = hakon();
    const batch = writeBatch(db);
    batch.update(doc(db, "assignments/a1"), { response: "confirmed", respondedAt: "2026-10-12T10:00:00.000Z" });
    batch.update(doc(db, "tasks/task-1"), { status: "confirmed" });
    await assertSucceeds(batch.commit());
  });

  test("melder seg på en oppgave, og sier om de kommer", async () => {
    const db = hakon();
    const built = buildAssignment("task-2", "hakon", "confirmed", {
      personName: "Håkon Tveit",
      gatheringId: "g-intern",
      gatheringGroupId: "group-intern",
      gatheringPublic: false,
    });
    // The id is the document's place. Stored inside the document, the field list rejects the write.
    await assertFails(setDoc(doc(db, `assignments/${built.id}`), sanitizeForFirestore(built)));
    const batch = writeBatch(db);
    batch.set(doc(db, `assignments/${built.id}`), sanitizeForFirestore(documentFields(built)));
    batch.set(doc(db, "gatheringReaders/g-intern_hakon"), { gatheringId: "g-intern", personId: "hakon" });
    batch.update(doc(db, "tasks/task-2"), { status: "confirmed" });
    await assertSucceeds(batch.commit());
    await assertSucceeds(setDoc(doc(db, "gatheringAttendances/att-g-intern-hakon"), { gatheringId: "g-intern", personId: "hakon", status: "declined" }));
    await assertSucceeds(setDoc(doc(db, "gatheringAttendances/att-g-apen-hakon"), { gatheringId: "g-apen", personId: "hakon", status: "declined" }));
    // Not for someone else
    await assertFails(setDoc(doc(db, "gatheringAttendances/att-g-apen-ola"), { gatheringId: "g-apen", personId: "ola", status: "attending" }));
  });

  test("skriver meldinger i eget navn, og sletter bare sine egne", async () => {
    const db = hakon();
    await assertSucceeds(setDoc(doc(db, "groupMessages/m-ny"), { groupId: "group-lyd", senderPersonId: "hakon", senderName: "Håkon Tveit", content: "Ok" }));
    await assertFails(setDoc(doc(db, "groupMessages/m-falsk"), { groupId: "group-lyd", senderPersonId: "kari", senderName: "Kari Nordmann", content: "Falsk" }));
    await assertFails(updateDoc(doc(db, "groupMessages/m2"), { content: "Endret" }));
    await assertFails(deleteDoc(doc(db, "groupMessages/m2")));
    await assertSucceeds(deleteDoc(doc(db, "groupMessages/m1")));
    await assertFails(setDoc(doc(db, "assignments/a-falsk"), {
      taskId: "task-1", personId: "ola", personName: "Noen andre", response: "pending",
      gatheringId: "g-apen", gatheringGroupId: "group-lyd", gatheringPublic: true,
    }));
  });

  test("slår egne varsler fra en gruppe av og på, og endrer ellers ingenting i gruppen", async () => {
    const db = hakon();
    await assertSucceeds(updateDoc(doc(db, "groups/group-lyd"), new FieldPath("notificationPreferences", "hakon"), false));
    await assertSucceeds(updateDoc(doc(db, "groups/group-lyd"), new FieldPath("notificationPreferences", "hakon"), true));
    await assertFails(updateDoc(doc(db, "groups/group-lyd"), new FieldPath("notificationPreferences", "ola"), false));
    await assertFails(updateDoc(doc(db, "groups/group-lyd"), { leaderIds: arrayUnion("hakon") }));
    await assertFails(updateDoc(doc(db, "groups/group-lyd"), { name: "Nytt navn" }));
    await assertFails(updateDoc(doc(db, "groups/group-lyd"), { isPublic: false }));
    await assertFails(setDoc(doc(db, "groups/ny"), { name: "Ny", isPublic: true, leaderIds: ["hakon"], memberIds: [] }));
    await assertFails(deleteDoc(doc(db, "groups/group-lyd")));
  });

  test("kan ikke gjøre seg selv til administrator, eller endre registeret", async () => {
    const db = hakon();
    await assertFails(updateDoc(doc(db, "persons/hakon"), { globalRole: "admin" }));
    await assertFails(updateDoc(doc(db, "persons/hakon"), { email: "kari@menigheten.no" }));
    await assertFails(updateDoc(doc(db, "persons/hakon"), { isPublicProfile: true }));
    await assertFails(updateDoc(doc(db, "persons/kari"), { globalRole: "member" }));
    await assertFails(setDoc(doc(db, "persons/ny"), { name: "Ny", globalRole: "admin" }));
    await assertFails(deleteDoc(doc(db, "persons/ola")));
    await assertFails(setDoc(doc(db, "logins/hakon@eksempel.no"), { personId: "hakon", role: "admin" }));
    await assertFails(setDoc(doc(db, "logins/ny@eksempel.no"), { personId: "hakon", role: "admin" }));
    await assertFails(deleteDoc(doc(db, "logins/kari@menigheten.no")));
    await assertFails(setDoc(doc(db, "publicProfiles/hakon"), { name: "Håkon" }));
    // The layout of their own analysis board is theirs
    await assertSucceeds(updateDoc(doc(db, "persons/hakon"), "analyticsHiddenModules", arrayUnion("besok")));
    await assertFails(updateDoc(doc(db, "persons/ola"), "analyticsHiddenModules", arrayUnion("besok")));
    // And the key to their own calendar subscription
    await assertSucceeds(updateDoc(doc(db, "persons/hakon"), { calendarFeedToken: "kal-123" }));
    await assertFails(updateDoc(doc(db, "persons/ola"), { calendarFeedToken: "kal-123" }));
    await assertFails(updateDoc(doc(db, "persons/hakon"), { calendarFeedToken: "kal-456", globalRole: "admin" }));
  });

  test("endrer ikke arrangementer eller oppgaver ut over statusen, og ikke nettsiden", async () => {
    const db = hakon();
    await assertFails(setDoc(doc(db, "gatherings/ny"), { groupId: "group-lyd", title: "Ny", isPublic: true }));
    await assertFails(updateDoc(doc(db, "gatherings/g-apen"), { title: "Endret" }));
    await assertFails(deleteDoc(doc(db, "gatherings/g-apen")));
    await assertFails(setDoc(doc(db, "tasks/ny"), { gatheringId: "g-apen", groupId: "group-lyd", title: "Ny", status: "open" }));
    await assertFails(updateDoc(doc(db, "tasks/task-1"), { title: "Endret" }));
    await assertFails(updateDoc(doc(db, "tasks/task-1"), { status: "confirmed", neededCount: 5 }));
    await assertFails(deleteDoc(doc(db, "tasks/task-1")));
    for (const place of ["cms_pages/p-pub", "cms_news/n1", "cms_sermons/s1", "cms_staff/st1", "cms_media/md1", "cms_settings/global", "cms_settings/addons", "cms_settings/operating-mode", "cms_settings/role-1", "cms_settings/template-1"]) {
      await assertFails(setDoc(doc(db, place), { title: "Endret" }));
      await assertFails(deleteDoc(doc(db, place)));
    }
  });

  test("kan registrere oppmøtetall, men ikke skrive over noe annet med det", async () => {
    const db = hakon();
    await assertSucceeds(setDoc(doc(db, "cms_settings/headcount-g-intern"), { recordType: "gatheringHeadcount", gatheringId: "g-intern", adults: 9, children: 0 }));
    await assertSucceeds(setDoc(doc(db, "cms_settings/headcount-g-apen"), { recordType: "gatheringHeadcount", gatheringId: "g-apen", adults: 85, children: 22 }));
    await assertFails(setDoc(doc(db, "cms_settings/global"), { recordType: "gatheringHeadcount", gatheringId: "x", adults: 1, children: 1 }));
    await assertFails(setDoc(doc(db, "cms_settings/operating-mode"), { recordType: "gatheringHeadcount", adults: 1, children: 1 }));
    await assertFails(deleteDoc(doc(db, "cms_settings/headcount-g-apen")));
  });
});

describe("En gruppeleder", () => {
  test("endrer sin egen gruppe, og ingen andres", async () => {
    const db = ola();
    await assertSucceeds(updateDoc(doc(db, "groups/group-lyd"), { name: "Lyd, lys og bilde" }));
    // A leader cannot appoint a new deputy or leader. Someone from outside may not be added.
    await assertFails(updateDoc(doc(db, "groups/group-lyd"), { deputyLeaderIds: ["hakon"] }));
    await assertFails(updateDoc(doc(db, "groups/group-lyd"), { leaderIds: ["hakon"] }));
    await assertFails(updateDoc(doc(db, "groups/group-lyd"), "memberIds", arrayUnion("liv"), new FieldPath("memberJoinedAt", "liv"), "2026-10-12T10:00:00.000Z"));
    await assertSucceeds(updateDoc(doc(db, "groups/group-lyd"), { memberIds: arrayRemove("hakon") }));
    await assertFails(updateDoc(doc(db, "groups/group-intern"), { name: "Overtatt" }));
    await assertFails(updateDoc(doc(db, "groups/group-intern"), { leaderIds: arrayUnion("ola") }));
    await assertFails(setDoc(doc(db, "groups/ny"), { name: "Ny", isPublic: true, leaderIds: ["ola"], memberIds: [] }));
    await assertFails(deleteDoc(doc(db, "groups/group-lyd")));
  });

  test("lager og endrer arrangementer og oppgaver for sin egen gruppe", async () => {
    const db = ola();
    await assertSucceeds(setDoc(doc(db, "gatherings/g-ny"), { groupId: "group-lyd", title: "Øvelse", visibility: "intern", isPublic: false }));
    await assertSucceeds(updateDoc(doc(db, "gatherings/g-apen"), { title: "Gudstjeneste med dåp" }));
    await assertSucceeds(setDoc(doc(db, "tasks/t-ny"), { gatheringId: "g-apen", groupId: "group-lyd", title: "Lys", status: "open" }));
    await assertSucceeds(updateDoc(doc(db, "tasks/task-1"), { title: "Lyd", neededCount: 2 }));
    await assertSucceeds(deleteDoc(doc(db, "tasks/task-1")));
    await assertSucceeds(deleteDoc(doc(db, "groupMessages/m1")));
    await assertSucceeds(deleteDoc(doc(db, "gatherings/g-ny")));
    await assertSucceeds(getDoc(doc(db, "groupLeaderEmails/group-lyd_hakon")));
    await assertSucceeds(getDocs(query(collection(db, "groupLeaderEmails"), where("groupId", "==", "group-lyd"))));
    await assertFails(getDocs(query(collection(db, "groupLeaderEmails"), where("groupId", "==", "group-intern"))));
  });

  test("rører ikke arrangementer og oppgaver i grupper de ikke leder", async () => {
    const db = ola();
    await assertFails(setDoc(doc(db, "gatherings/g-ny"), { groupId: "group-intern", title: "Ny", isPublic: true }));
    await assertFails(updateDoc(doc(db, "gatherings/g-intern"), { title: "Endret" }));
    await assertFails(deleteDoc(doc(db, "gatherings/g-intern")));
    // Their own event cannot be moved to a group they do not lead
    await assertFails(updateDoc(doc(db, "gatherings/g-apen"), { groupId: "group-intern" }));
    await assertFails(setDoc(doc(db, "tasks/t-ny"), { gatheringId: "g-intern", groupId: "group-intern", title: "Ny", status: "open" }));
    await assertFails(updateDoc(doc(db, "tasks/task-2"), { title: "Endret" }));
    await assertFails(deleteDoc(doc(db, "tasks/task-2")));
    await assertFails(deleteDoc(doc(db, "groupMessages/m2")));
    await assertFails(updateDoc(doc(db, "persons/ola"), { globalRole: "admin" }));
  });
});

describe("En administrator", () => {
  test("leser og skriver registeret, innloggingene og de offentlige kopiene", async () => {
    const db = kari();
    await assertSucceeds(all(db, "logins"));
    await assertSucceeds(setDoc(doc(db, "persons/ny"), { name: "Ny Frivillig", email: "ny@eksempel.no", globalRole: "member" }));
    await assertSucceeds(setDoc(doc(db, "logins/ny@eksempel.no"), { personId: "ny", role: "member" }));
    await assertSucceeds(updateDoc(doc(db, "persons/ola"), { globalRole: "admin", isPublicProfile: true }));
    await assertSucceeds(setDoc(doc(db, "logins/ola@eksempel.no"), { personId: "ola", role: "admin" }));
    await assertSucceeds(setDoc(doc(db, "publicProfiles/ola"), { name: "Ola Hansen", globalRole: "member", isPublicProfile: true }));
    await assertSucceeds(deleteDoc(doc(db, "publicProfiles/liv")));
    await assertSucceeds(deleteDoc(doc(db, "persons/hakon")));
    await assertSucceeds(deleteDoc(doc(db, "logins/hakon@eksempel.no")));
  });

  test("den som nettopp har fått en innlogging, slipper inn, og den som har mistet den, slipper ikke inn", async () => {
    await assertSucceeds(setDoc(doc(kari(), "logins/fremmed@eksempel.no"), { personId: "ny", role: "member" }));
    await assertFails(all(stranger(), "persons"));
    await assertSucceeds(getDoc(doc(stranger(), "persons/ny")));
    await assertFails(getDoc(doc(stranger(), "persons/kari")));
    await assertSucceeds(deleteDoc(doc(kari(), "logins/hakon@eksempel.no")));
    await assertFails(all(hakon(), "persons"));
    await assertFails(getDoc(doc(hakon(), "persons/hakon")));
    // Made an administrator: the role in the login is what counts
    await assertFails(setDoc(doc(ola(), "cms_news/ny"), { title: "Nyhet" }));
    await assertSucceeds(setDoc(doc(kari(), "logins/ola@eksempel.no"), { personId: "ola", role: "admin" }));
    await assertSucceeds(setDoc(doc(ola(), "cms_news/ny"), { title: "Nyhet" }));
  });

  test("endrer planleggingen og nettsiden", async () => {
    const db = kari();
    await assertSucceeds(setDoc(doc(db, "groups/ny"), { name: "Ny gruppe", isPublic: true, leaderIds: [], memberIds: [] }));
    await assertSucceeds(deleteDoc(doc(db, "groups/group-umerket")));
    await assertSucceeds(setDoc(doc(db, "gatherings/g-ny"), { groupId: "group-lyd", title: "Julekonsert", visibility: "fremhevet", isPublic: true }));
    await assertSucceeds(updateDoc(doc(db, "gatherings/g-intern"), { groupId: "group-lyd" }));
    await assertSucceeds(setDoc(doc(db, "tasks/t-ny"), { gatheringId: "g-ny", title: "Vert", status: "open" }));
    await assertSucceeds(updateDoc(doc(db, "groupMessages/m1"), { content: "Rettet" }));
    await assertSucceeds(setDoc(doc(db, "gatheringAttendances/att-g-apen-ola"), { gatheringId: "g-apen", personId: "ola", status: "attending" }));
    for (const place of ["cms_pages/ny", "cms_news/ny", "cms_sermons/ny", "cms_staff/ny", "cms_media/ny", "cms_settings/global", "cms_settings/addons", "cms_settings/operating-mode", "cms_settings/role-ny", "cms_settings/template-ny"]) {
      await assertSucceeds(setDoc(doc(db, place), { title: "Endret", recordType: "volunteerRole" }));
    }
    await assertSucceeds(deleteDoc(doc(db, "cms_pages/p-kladd")));
    await assertSucceeds(deleteDoc(doc(db, "cms_settings/traffic-2026-10-11")));
    await assertSucceeds(deleteDoc(doc(db, "cms_settings/headcount-g-apen")));
  });

  test("sletter et arrangement med oppgavene og alle som står på dem i én sending, og det kan ingen frivillig", async () => {
    // The sending the app makes (deleteGatheringAndStaffing in src/services/firestore.ts)
    const sending = (db: Firestore) => {
      const batch = writeBatch(db);
      batch.delete(doc(db, "assignments/a1"));
      batch.delete(doc(db, "tasks/task-1"));
      batch.delete(doc(db, "gatherings/g-apen"));
      return batch.commit();
    };
    await assertFails(sending(hakon()));
    await assertSucceeds(sending(kari()));

    const db = kari();
    expect((await getDoc(doc(db, "gatherings/g-apen"))).exists()).toBe(false);
    expect((await getDoc(doc(db, "tasks/task-1"))).exists()).toBe(false);
    expect((await getDoc(doc(db, "assignments/a1"))).exists()).toBe(false);
    // The other event stands, with its task and the one asked
    expect((await getDoc(doc(db, "assignments/a-intern"))).exists()).toBe(true);
    expect((await getDoc(doc(db, "tasks/task-2"))).exists()).toBe(true);
  });

  test("kan skrive mange dokumenter i én sending: et helt register, og alle innloggingene", async () => {
    const db = kari();
    // The size the app sends in one go (BATCH_SIZE in src/services/)
    const persons = writeBatch(db);
    for (let n = 0; n < 400; n += 1) persons.set(doc(db, `persons/p-${n}`), { name: `Person ${n}`, email: `p${n}@eksempel.no`, globalRole: "member" });
    await assertSucceeds(persons.commit());

    const logins = writeBatch(db);
    for (let n = 0; n < 400; n += 1) logins.set(doc(db, `logins/p${n}@eksempel.no`), { personId: `p-${n}`, role: "member" });
    await assertSucceeds(logins.commit());

    // A series: events and tasks together
    const series = writeBatch(db);
    for (let n = 0; n < 60; n += 1) {
      series.set(doc(db, `gatherings/serie-${n}`), { groupId: "group-lyd", title: "Gudstjeneste", visibility: "offentlig", isPublic: true, seriesId: "serie" });
      for (let t = 0; t < 5; t += 1) series.set(doc(db, `tasks/serie-${n}-${t}`), { gatheringId: `serie-${n}`, title: "Oppgave", status: "open" });
    }
    await assertSucceeds(series.commit());
  });
});

// What the administrator's browser writes the first time the mirror runs (registerMirror.store and
// patchAssignmentAccess): the id is the document's place, and the fields are what the app builds.
const mirrorPersons: Person[] = [
  { id: "kari", name: "Kari Nordmann", email: "kari@menigheten.no", globalRole: "admin" },
  { id: "ola", name: "Ola Hansen", email: "ola@eksempel.no", phone: "22 00 00 00", globalRole: "member" },
  { id: "hakon", name: "Håkon Tveit", email: "hakon@eksempel.no", globalRole: "member" },
  { id: "liv", name: "Liv Pastor", email: "liv.privat@eksempel.no", globalRole: "member", isPublicProfile: true },
];
const mirrorGroups: Group[] = [
  { id: "group-lyd", name: "Lyd og bilde", isPublic: true, leaderIds: ["ola"], memberIds: ["hakon"] },
  { id: "group-intern", name: "Sjelesorg", isPublic: false, leaderIds: ["kari"], memberIds: [] },
];
const mirrorGatherings: Pick<Gathering, "id" | "groupId" | "isPublic">[] = [
  { id: "g-apen", groupId: "group-lyd", isPublic: true },
  { id: "g-intern", groupId: "group-intern", isPublic: false },
];
const mirrorTasks: Task[] = [
  { id: "task-1", gatheringId: "g-apen", groupId: "group-lyd", title: "Lydtekniker", status: "open" },
  { id: "task-2", gatheringId: "g-intern", groupId: "group-intern", title: "Referent", status: "open" },
];
const mirrorAssignments: Assignment[] = [
  { id: "a1", taskId: "task-1", personId: "hakon", response: "pending", personName: "Håkon Tveit", gatheringId: "g-apen", gatheringGroupId: "group-lyd", gatheringPublic: true },
  { id: "a-intern", taskId: "task-2", personId: "kari", response: "pending", personName: "Kari Nordmann", gatheringId: "g-intern", gatheringGroupId: "group-intern", gatheringPublic: false },
];

/** The same body registerMirror.store sends: id only in the path, undefined fields gone. */
function storedBody<T extends { id: string }>(item: T): object {
  return sanitizeForFirestore(documentFields(item));
}

function writeMirror<T extends { id: string }>(db: Firestore, name: string, items: readonly T[]) {
  const batch = writeBatch(db);
  for (const item of items) batch.set(doc(db, name, item.id), storedBody(item));
  return batch.commit();
}

describe("Den første speilingen", () => {
  const clearDerived = async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      const paths = [
        "groupDirectory/group-lyd_hakon", "groupDirectory/group-lyd_ola",
        "groupLeaderEmails/group-lyd_hakon", "groupLeaderEmails/group-lyd_ola",
        "publicGroupCards/group-lyd",
        "gatheringReaders/g-apen_hakon", "gatheringReaders/g-apen_ola",
      ];
      await Promise.all(paths.map((path) => deleteDoc(doc(db, path))));
    });
  };

  test("administrator skriver katalogen, e-postkortene, gruppekortene og lesemerkene, og kan skrive dem om igjen", async () => {
    await clearDerived();
    const directory = groupDirectoryOf(mirrorPersons, mirrorGroups);
    const emails = groupLeaderEmailsOf(mirrorPersons, mirrorGroups);
    const cards = publicGroupCardsOf(mirrorGroups, mirrorPersons);
    const readers = gatheringReadersOf(mirrorGatherings, mirrorGroups, mirrorTasks, mirrorAssignments);
    expect(directory.map((card) => card.id).sort()).toEqual(["group-intern_kari", "group-lyd_hakon", "group-lyd_ola"]);
    expect(storedBody(directory.find((card) => card.id === "group-lyd_ola")!)).toEqual({
      groupId: "group-lyd", personId: "ola", name: "Ola Hansen", phone: "22 00 00 00",
    });
    expect(cards.map((card) => card.id)).toEqual(["group-lyd"]);
    expect(readers.map((mark) => mark.id).sort()).toEqual(["g-apen_hakon", "g-apen_ola", "g-intern_kari"]);

    const db = kari();
    // The id belongs in the path. Stored in the document, the field list rejects the write.
    const olaCard = directory.find((card) => card.id === "group-lyd_ola")!;
    await assertFails(setDoc(doc(db, `groupDirectory/${olaCard.id}`), sanitizeForFirestore(olaCard)));

    await assertSucceeds(writeMirror(db, "groupDirectory", directory));
    await assertSucceeds(writeMirror(db, "groupLeaderEmails", emails));
    await assertSucceeds(writeMirror(db, "publicGroupCards", cards));
    await assertSucceeds(writeMirror(db, "gatheringReaders", readers));

    const renamed = mirrorPersons.map((person) => (person.id === "ola" ? { ...person, phone: "11 22 33 44" } : person));
    const again = groupDirectoryOf(renamed, mirrorGroups);
    await assertSucceeds(writeMirror(db, "groupDirectory", again));
    await assertSucceeds(writeMirror(db, "groupLeaderEmails", emails));
    await assertSucceeds(writeMirror(db, "publicGroupCards", [{ ...cards[0], name: "Lyd" }]));
    await assertSucceeds(writeMirror(db, "gatheringReaders", readers));

    await assertSucceeds(deleteDoc(doc(db, "groupDirectory/group-lyd_hakon")));
    await assertSucceeds(deleteDoc(doc(db, "groupLeaderEmails/group-lyd_hakon")));
    await assertSucceeds(deleteDoc(doc(db, "publicGroupCards/group-lyd")));
    await assertSucceeds(deleteDoc(doc(db, "gatheringReaders/g-apen_hakon")));

    await assertFails(writeMirror(hakon(), "groupDirectory", directory));
    await assertFails(writeMirror(hakon(), "groupLeaderEmails", emails));
    await assertFails(writeMirror(hakon(), "publicGroupCards", cards));
    await assertFails(setDoc(doc(hakon(), "gatheringReaders/g-intern_kari"), { gatheringId: "g-intern", personId: "kari" }));
  });

  test("oppdaterer en gammel tildeling som mangler navn, også når id ligger lagret i dokumentet", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, "assignments/a-gammel"), {
        id: "a-gammel",
        taskId: "task-1",
        personId: "ola",
        response: "pending",
      });
    });
    const old: Assignment = { id: "a-gammel", taskId: "task-1", personId: "ola", response: "pending" };
    const patches = assignmentAccessPatches([old], mirrorTasks, mirrorGatherings, mirrorPersons);
    expect(patches).toEqual([
      { id: "a-gammel", personName: "Ola Hansen", gatheringId: "g-apen", gatheringGroupId: "group-lyd", gatheringPublic: true },
    ]);

    const db = kari();
    const batch = writeBatch(db);
    for (const patch of patches) {
      const { id, ...fields } = patch;
      batch.update(doc(db, "assignments", id), fields);
    }
    await assertSucceeds(batch.commit());

    const stored = (await getDoc(doc(db, "assignments/a-gammel"))).data();
    expect(stored).toMatchObject({
      id: "a-gammel",
      personName: "Ola Hansen",
      gatheringId: "g-apen",
      gatheringGroupId: "group-lyd",
      gatheringPublic: true,
      response: "pending",
    });

    await assertFails(updateDoc(doc(hakon(), "assignments/a-gammel"), {
      personName: "Noen andre", gatheringId: "g-apen", gatheringGroupId: "group-lyd", gatheringPublic: true,
    }));
  });
});

describe("Forslag om nye medlemmer", () => {
  const storedProposal = (groupId: string, proposedBy: string, name: string) => {
    const built = buildMemberProposal({ groupId, proposedBy, name });
    if (!built) throw new Error("navnet kan ikke lagres");
    return { built, fields: sanitizeForFirestore(documentFields(built)) };
  };

  test("leder og nestleder sender et navn, og bare administrator behandler det", async () => {
    const db = ola();
    const { built, fields } = storedProposal("group-lyd", "ola", "  Anne  Berg ");
    expect(fields).not.toHaveProperty("id");
    expect(Object.keys(fields).sort()).toEqual(["groupId", "name", "proposedAt", "proposedBy", "status"]);
    expect(fields).toMatchObject({ groupId: "group-lyd", name: "Anne Berg", proposedBy: "ola", status: "pending" });

    await assertFails(setDoc(doc(db, `memberProposals/${built.id}`), sanitizeForFirestore(built)));
    await assertFails(setDoc(doc(db, `memberProposals/${built.id}`), { ...fields, phone: "99000000" }));
    await assertFails(setDoc(doc(db, "memberProposals/annens"), { ...fields, proposedBy: "hakon" }));
    await assertSucceeds(setDoc(doc(db, `memberProposals/${built.id}`), fields));

    await assertFails(getDocs(query(collection(hakon(), "memberProposals"), where("groupId", "==", "group-lyd"))));
    await assertFails(getDoc(doc(hakon(), `memberProposals/${built.id}`)));
    await assertFails(all(hakon(), "memberProposals"));
    await assertSucceeds(getDocs(query(collection(db, "memberProposals"), where("groupId", "==", "group-lyd"))));
    await assertFails(all(db, "memberProposals"));
    await assertFails(setDoc(doc(db, "memberProposals/intern"), { ...fields, groupId: "group-intern" }));

    await assertSucceeds(getDocs(query(collection(kari(), "memberProposals"), where("status", "==", "pending"))));
    await assertFails(updateDoc(doc(db, `memberProposals/${built.id}`), { status: "added" }));
    await assertFails(updateDoc(doc(kari(), `memberProposals/${built.id}`), { status: "added" }));
    await assertSucceeds(updateDoc(doc(kari(), `memberProposals/${built.id}`), { status: "added", decidedAt: "2026-10-12T12:00:00.000Z" }));
    await assertFails(updateDoc(doc(kari(), `memberProposals/${built.id}`), { status: "dismissed" }));
    await assertFails(deleteDoc(doc(db, `memberProposals/${built.id}`)));

    const second = storedProposal("group-lyd", "ola", "Per");
    await assertSucceeds(setDoc(doc(db, `memberProposals/${second.built.id}`), second.fields));
    await assertFails(deleteDoc(doc(hakon(), `memberProposals/${second.built.id}`)));
    await assertSucceeds(deleteDoc(doc(db, `memberProposals/${second.built.id}`)));

    await env.withSecurityRulesDisabled(async (context) => {
      const open = context.firestore() as unknown as Firestore;
      await updateDoc(doc(open, "groups/group-lyd"), { deputyLeaderIds: ["hakon"] });
    });
    const asDeputy = storedProposal("group-lyd", "hakon", "Liv");
    await assertSucceeds(setDoc(doc(hakon(), `memberProposals/${asDeputy.built.id}`), asDeputy.fields));
    await assertSucceeds(getDocs(query(collection(hakon(), "memberProposals"), where("groupId", "==", "group-lyd"), where("status", "==", "pending"))));
  });
});

describe("Svar på tildelinger", () => {
  test("forfall skrives som flere svar i én sending, uten grunn", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, "assignments/a-extra"), {
        taskId: "task-1", personId: "hakon", response: "pending", personName: "Håkon Tveit",
        gatheringId: "g-apen", gatheringGroupId: "group-lyd", gatheringPublic: true,
      });
    });
    const at = "2026-10-12T12:00:00.000Z";
    const db = hakon();
    const batch = writeBatch(db);
    batch.update(doc(db, "assignments/a1"), absenceFields("confirmed", at));
    batch.update(doc(db, "assignments/a-extra"), absenceFields("pending", at));
    batch.update(doc(db, "tasks/task-1"), { status: "open" });
    await assertSucceeds(batch.commit());

    await assertFails(updateDoc(doc(hakon(), "assignments/a-intern"), { response: "declined", respondedAt: at }));
    await assertFails(deleteDoc(doc(hakon(), "assignments/a1")));
    await assertSucceeds(updateDoc(doc(ola(), "assignments/a1"), absenceFields("withdrawn", at)));
    await assertSucceeds(deleteDoc(doc(ola(), "assignments/a-extra")));
    await assertFails(updateDoc(doc(ola(), "assignments/a-intern"), { response: "declined", respondedAt: at }));
  });

  test("en tildeling kan ikke lagres med withdrawalReason", async () => {
    const built = buildAssignment("task-1", "hakon", "pending", {
      personName: "Håkon Tveit",
      gatheringId: "g-apen",
      gatheringGroupId: "group-lyd",
      gatheringPublic: true,
    });
    const fields = sanitizeForFirestore(documentFields(built));
    await assertFails(setDoc(doc(hakon(), `assignments/${built.id}`), { ...fields, withdrawalReason: "Syk" }));
    await assertFails(setDoc(doc(kari(), "assignments/med-grunn"), { ...fields, withdrawalReason: "Syk" }));
    await assertFails(updateDoc(doc(hakon(), "assignments/a1"), { response: "withdrawn", respondedAt: "2026-10-12T12:00:00.000Z", withdrawalReason: "Syk" }));
    await assertFails(updateDoc(doc(kari(), "assignments/a1"), { withdrawalReason: "Syk" }));
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await updateDoc(doc(db, "assignments/a1"), { withdrawalReason: "Syk" });
    });
    await assertSucceeds(updateDoc(doc(kari(), "assignments/a1"), { withdrawalReason: deleteField() }));
  });

  test("en frivillig kan ikke avlyse en oppgave", async () => {
    await assertFails(updateDoc(doc(hakon(), "tasks/task-1"), { status: "cancelled" }));
    await assertSucceeds(updateDoc(doc(ola(), "tasks/task-1"), { status: "cancelled" }));
    await assertFails(updateDoc(doc(hakon(), "tasks/task-1"), { status: "open" }));
    await assertSucceeds(updateDoc(doc(kari(), "tasks/task-1"), { status: "open" }));
  });

  test("hvem som kommer, spørres for arrangementet, ikke for hele samlingen", async () => {
    const coming = buildAttendance("g-apen", "ola", "attending");
    await assertSucceeds(setDoc(doc(ola(), `gatheringAttendances/${coming.id}`), sanitizeForFirestore(coming)));
    const db = hakon();
    await assertSucceeds(getDocs(query(collection(db, "gatheringAttendances"), where("gatheringId", "==", "g-apen"))));
    await assertFails(all(db, "gatheringAttendances"));
    await assertFails(getDocs(query(collection(db, "gatheringAttendances"), where("gatheringId", "==", "g-intern"))));
    await assertSucceeds(getDocs(query(collection(db, "gatheringAttendances"), where("personId", "==", "hakon"))));
  });
});
