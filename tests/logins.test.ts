import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ALL_COLLECTIONS, LOGINS_COLLECTION, PLAIN_COLLECTIONS, PUBLIC_PROFILES_COLLECTION } from "../src/data/collections";
import type { Person } from "../src/types";
import { keepingOwnLogin, loginIdOf, loginsOf, sharedAddresses, type Login } from "../src/utils/logins";
import { hasChanges, mirrorChanges } from "../src/utils/mirror";
import { publicCopiesOf, publicCopyOf, toPublicProfile } from "../src/utils/publicProfile";
import { sessionOfLogin, type Account, type AccountState, type LoginState } from "../src/utils/session";

const kari: Person = { id: "kari", name: "Kari Nordmann", email: "kari@menigheten.no", globalRole: "admin" };
const ola: Person = { id: "ola", name: "Ola Hansen", email: " Ola.Hansen@Eksempel.no ", globalRole: "member" };
const per: Person = { id: "per", name: "Per Olsen", globalRole: "member" };
// A couple who share one address
const anne: Person = { id: "anne", name: "Anne Berg", email: "familien@berg.no", globalRole: "member" };
const jon: Person = { id: "jon", name: "Jon Berg", email: "Familien@Berg.no", globalRole: "member" };
const register = [kari, ola, per, anne, jon];

describe("Innloggingene et register gir", () => {
  test("én for hver adresse som står på nøyaktig én person, med små bokstaver og uten mellomrom", () => {
    expect(loginsOf(register)).toEqual<Login[]>([
      { id: "kari@menigheten.no", personId: "kari", role: "admin" },
      { id: "ola.hansen@eksempel.no", personId: "ola", role: "member" },
    ]);
  });

  test("en adresse to personer deler, gir ingen innlogging, og den sies fra om", () => {
    expect(loginsOf([anne, jon])).toEqual([]);
    expect(sharedAddresses(register)).toEqual(["familien@berg.no"]);
    expect(sharedAddresses([kari, ola, per])).toEqual([]);
  });

  test("det som ikke er en adresse, eller som ikke kan være navnet på et dokument, gir ingen innlogging", () => {
    const odd: Person[] = [
      { id: "a", name: "A", email: "", globalRole: "member" },
      { id: "b", name: "B", email: "ikke en adresse", globalRole: "member" },
      { id: "c", name: "C", email: "c/d@eksempel.no", globalRole: "admin" },
      { id: "d", name: "D", email: "d@eksempel", globalRole: "member" },
    ];
    expect(loginsOf(odd)).toEqual([]);
    expect(loginIdOf(null)).toBe("");
    expect(loginIdOf("  Kari@Menigheten.NO ")).toBe("kari@menigheten.no");
  });
});

describe("Hva som må skrives for at det lagrede skal følge registeret", () => {
  const stored: Login[] = [
    { id: "kari@menigheten.no", personId: "kari", role: "admin" },
    { id: "ola.hansen@eksempel.no", personId: "ola", role: "admin" },
    { id: "sluttet@eksempel.no", personId: "gammel", role: "member" },
  ];

  test("nye og endrede skrives, de registeret ikke lenger gir, tas bort, og like røres ikke", () => {
    const changes = mirrorChanges(loginsOf([kari, ola, { id: "ny", name: "Ny", email: "ny@eksempel.no", globalRole: "member" }]), stored);
    expect(changes.set).toEqual([
      { id: "ny@eksempel.no", personId: "ny", role: "member" },
      { id: "ola.hansen@eksempel.no", personId: "ola", role: "member" },
    ]);
    expect(changes.remove).toEqual(["sluttet@eksempel.no"]);
    expect(hasChanges(changes)).toBe(true);
  });

  test("når det lagrede er det registeret gir, er det ingenting å skrive, uansett rekkefølgen feltene står i", () => {
    const sameInAnotherOrder = [{ role: "admin", personId: "kari", id: "kari@menigheten.no" } as Login];
    const changes = mirrorChanges(loginsOf([kari]), sameInAnotherOrder);
    expect(changes).toEqual({ set: [], remove: [] });
    expect(hasChanges(changes)).toBe(false);
  });

  test("administratoren som gjør endringen, mister aldri sin egen innlogging", () => {
    // Kari's address is put on a second person: the register no longer gives her a login
    const twin: Person = { id: "tvilling", name: "Kari to", email: "kari@menigheten.no", globalRole: "member" };
    const changes = mirrorChanges(loginsOf([kari, twin, ola]), stored);
    expect(changes.remove).toContain("kari@menigheten.no");
    expect(keepingOwnLogin(changes, " Kari@Menigheten.no ").remove).toEqual(["sluttet@eksempel.no"]);
    // Someone else's login is taken away as the register says
    expect(keepingOwnLogin(changes, "ola.hansen@eksempel.no").remove).toContain("kari@menigheten.no");
    expect(keepingOwnLogin(changes, null)).toEqual(changes);
  });
});

describe("Den offentlige kopien av en person", () => {
  const pastor: Person = {
    id: "pastor",
    name: "Liv Pastor",
    email: "liv.privat@eksempel.no",
    phone: "99 88 77 66",
    birthDate: "1975-04-23",
    globalRole: "admin",
    policeCertificateValidUntil: "2027-01-01",
    unavailablePeriods: [{ id: "u1", from: "2026-07-01", to: "2026-07-20" } as never],
    isPublicProfile: true,
    consentToPublishGivenAt: "2026-09-01T10:00:00.000Z",
    consentGivenBy: "kari",
    publicTitle: "Pastor",
    publicPhone: "37 00 00 00",
    publicEmail: "pastor@menigheten.no",
    avatarUrl: "https://eksempel.no/liv.jpg",
    isStaff: true,
    staffRole: "Hovedpastor",
    staffCategory: "pastor",
    staffBio: "Pastor siden 2019.",
    staffOrder: 1,
    analyticsHiddenModules: ["besok"],
    updatedBy: "kari",
  };

  test("holder det nettsiden viser, og ingenting av det private", () => {
    const copy = publicCopyOf(pastor)!;
    expect(copy).toEqual({
      id: "pastor",
      name: "Liv Pastor",
      globalRole: "member",
      isPublicProfile: true,
      consentToPublishGivenAt: "2026-09-01T10:00:00.000Z",
      publicTitle: "Pastor",
      publicPhone: "37 00 00 00",
      publicEmail: "pastor@menigheten.no",
      avatarUrl: "https://eksempel.no/liv.jpg",
      isStaff: true,
      staffRole: "Hovedpastor",
      staffCategory: "pastor",
      staffBio: "Pastor siden 2019.",
      staffOrder: 1,
    });
    const text = JSON.stringify(copy);
    for (const secret of ["liv.privat@eksempel.no", "99 88 77 66", "1975-04-23", "2027-01-01", "2026-07-01", "besok", "admin"]) {
      expect(text).not.toContain(secret);
    }
  });

  test("nettsiden viser det samme fra kopien som fra personen selv", () => {
    expect(toPublicProfile(publicCopyOf(pastor)!)).toEqual(toPublicProfile(pastor));
  });

  test("den som ikke har samtykket, har ingen kopi", () => {
    expect(publicCopyOf(kari)).toBeNull();
    expect(publicCopyOf({ ...pastor, consentToPublishGivenAt: undefined })).toBeNull();
    expect(publicCopyOf({ ...pastor, isPublicProfile: false })).toBeNull();
    expect(publicCopiesOf([kari, pastor, ola]).map((person) => person.id)).toEqual(["pastor"]);
  });

  test("et felt uten innhold er ikke med, så en lik kopi ikke skrives på nytt", () => {
    const copy = publicCopyOf({ ...pastor, publicPhone: "", staffBio: undefined })!;
    expect("publicPhone" in copy).toBe(false);
    expect("staffBio" in copy).toBe(false);
    expect(mirrorChanges(publicCopiesOf([pastor]), [publicCopyOf(pastor)!])).toEqual({ set: [], remove: [] });
  });
});

describe("Hvem en konto er, når registeret er lukket", () => {
  const account = (email: string | null, more: Partial<Account> = {}): Account => ({ uid: `uid:${email}`, email, emailVerified: true, ...more });
  const signedIn = (email: string | null, more: Partial<Account> = {}): AccountState => ({ status: "signedIn", account: account(email, more) });
  const found = (personId: string, role: "admin" | "member" = "member"): LoginState => ({ status: "found", personId, role });

  test("den som ikke er logget inn, er ingen, og det som ikke er kjent ennå, avgjøres ikke", () => {
    expect(sessionOfLogin({ status: "signedOut" }, { status: "none" }, [], false)).toEqual({ status: "signedOut" });
    expect(sessionOfLogin({ status: "loading" }, { status: "none" }, [], false)).toEqual({ status: "loading" });
    expect(sessionOfLogin(signedIn("kari@menigheten.no"), { status: "none" }, [], false)).toEqual({ status: "loading" });
    expect(sessionOfLogin(signedIn("kari@menigheten.no"), { status: "loading" }, [], false)).toEqual({ status: "loading" });
    // The login is found, but the register has not arrived
    expect(sessionOfLogin(signedIn("kari@menigheten.no"), found("kari"), [], false)).toEqual({ status: "loading" });
  });

  test("innloggingen peker ut personen i registeret", () => {
    expect(sessionOfLogin(signedIn("kari@menigheten.no"), found("kari"), register, true)).toMatchObject({ status: "member", person: kari });
  });

  test("en adresse uten innlogging er ikke i registeret", () => {
    expect(sessionOfLogin(signedIn("fremmed@eksempel.no"), { status: "missing" }, [], false)).toMatchObject({ status: "notInRegister", reason: "noMatch" });
    // A login that points at someone who has been taken out of the register
    expect(sessionOfLogin(signedIn("kari@menigheten.no"), found("slettet"), register, true)).toMatchObject({ status: "notInRegister", reason: "noMatch" });
  });

  test("en adresse som ikke er bekreftet, slipper ingen inn, selv med en innlogging", () => {
    expect(sessionOfLogin(signedIn("kari@menigheten.no", { emailVerified: false }), found("kari"), register, true)).toMatchObject({
      status: "notInRegister",
      reason: "unverified",
    });
    expect(sessionOfLogin(signedIn(null), found("kari"), register, true)).toMatchObject({ status: "notInRegister", reason: "unverified" });
  });
});

describe("Reglene i databasen", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const blockOf = (name: string): string => rules.match(new RegExp(`match /${name}/\\{[^}]+\\} \\{[\\s\\S]*?\\n    \\}`))?.[0] ?? "";

  test("innloggingene og de offentlige kopiene har hver sin regel, og er ikke innhold", () => {
    expect(blockOf(LOGINS_COLLECTION)).toContain("allow write: if isAdmin();");
    expect(blockOf(PUBLIC_PROFILES_COLLECTION)).toContain("allow write: if isAdmin();");
    for (const name of [LOGINS_COLLECTION, PUBLIC_PROFILES_COLLECTION]) {
      expect(ALL_COLLECTIONS).not.toContain(name);
      expect(PLAIN_COLLECTIONS).not.toContain(name);
    }
  });

  test("ingen samling kan skrives i av alle", () => {
    expect(rules).not.toMatch(/allow (read, )?(write|create|update|delete)[^:]*: if true/);
    expect(rules).not.toContain("request.auth == null");
  });

  test("registeret og planleggingen leses bare av dem som står i registeret", () => {
    expect(blockOf("persons")).toContain("allow get: if isAdmin() || (isMember() && personId == me());");
    expect(blockOf("persons")).toContain("allow list: if isAdmin();");
    expect(blockOf("persons")).not.toContain("if true");
    for (const name of ["tasks", "assignments", "groupMessages", "gatheringAttendances"]) {
      expect(blockOf(name)).toContain("allow read");
      expect(blockOf(name)).not.toContain("if true");
    }
    expect(blockOf("groups")).toContain("allow read: if isAdmin() || (isMember() && inGroupData(resource.data));");
    expect(blockOf("groups")).not.toContain("isPublic == true");
    expect(blockOf("gatherings")).toContain("allow read: if resource.data.isPublic == true || isMember();");
    for (const name of ["groupDirectory", "groupLeaderEmails", "publicGroupCards", "gatheringReaders"]) {
      expect(blockOf(name).length).toBeGreaterThan(0);
      expect(ALL_COLLECTIONS).not.toContain(name);
    }
  });

  test("lagringen av filer kan bare skrives i av en administrator eller en nettredaktør", () => {
    const storage = readFileSync(new URL("../storage.rules", import.meta.url), "utf8");
    expect(storage).not.toContain("allow write: if true");
    expect(storage).toContain(".data.role in ['admin', 'nettredaktor']");
  });

  test("demoens regler er åpne, og er en annen fil", () => {
    const demo = readFileSync(new URL("../firestore.demo.rules", import.meta.url), "utf8");
    expect(demo).toContain("if true");
    expect(demo).not.toContain("isMember()");
  });
});
