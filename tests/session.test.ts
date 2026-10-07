import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { Group, Person } from "../src/types";
import { isMinSidePath, isPublicPath, isSignInPath } from "../src/utils/routes";
import {
  ROLE_LABELS,
  destinationAfterSignIn,
  isAdministrator,
  personsWithEmail,
  roleOf,
  sessionOf,
  signInUrl,
  standInSession,
  type Account,
  type AccountState,
} from "../src/utils/session";

const kari: Person = { id: "kari", name: "Kari Nordmann", email: "kari@menigheten.no", globalRole: "admin" };
const ola: Person = { id: "ola", name: "Ola Hansen", email: "Ola.Hansen@Eksempel.no", globalRole: "member" };
const per: Person = { id: "per", name: "Per Olsen", globalRole: "member" };
// A couple who share one address
const anne: Person = { id: "anne", name: "Anne Berg", email: "familien@berg.no", globalRole: "member" };
const jon: Person = { id: "jon", name: "Jon Berg", email: "familien@berg.no", globalRole: "member" };
const register = [kari, ola, per, anne, jon];

const account = (email: string | null, more: Partial<Account> = {}): Account => ({ uid: `uid:${email}`, email, emailVerified: true, ...more });
const signedIn = (email: string | null, more: Partial<Account> = {}): AccountState => ({ status: "signedIn", account: account(email, more) });

describe("Hvem en konto er i personregisteret", () => {
  test("den som ikke er logget inn, er ingen, og det som ikke er kjent ennå, avgjøres ikke", () => {
    expect(sessionOf({ status: "signedOut" }, register, true)).toEqual({ status: "signedOut" });
    expect(sessionOf({ status: "loading" }, register, true)).toEqual({ status: "loading" });
    // Signed in, but the register has not arrived: nobody can be said to be missing from it yet
    expect(sessionOf(signedIn("kari@menigheten.no"), [], false)).toEqual({ status: "loading" });
  });

  test("kontoens bekreftede e-postadresse peker ut personen, uansett store bokstaver og mellomrom", () => {
    expect(sessionOf(signedIn("kari@menigheten.no"), register, true)).toMatchObject({ status: "member", person: kari });
    expect(sessionOf(signedIn("  OLA.hansen@eksempel.NO "), register, true)).toMatchObject({ status: "member", person: ola });

    const session = sessionOf(signedIn("kari@menigheten.no"), register, true);
    expect(session.status === "member" && session.account?.uid).toBe("uid:kari@menigheten.no");
  });

  test("en adresse ingen i registeret har, gir ingen person", () => {
    expect(sessionOf(signedIn("fremmed@eksempel.no"), register, true)).toMatchObject({ status: "notInRegister", reason: "noMatch" });
    // A person without an address cannot be reached by an account without one
    expect(sessionOf(signedIn(null), register, true)).toMatchObject({ status: "notInRegister", reason: "unverified" });
    expect(sessionOf(signedIn(""), register, true)).toMatchObject({ status: "notInRegister", reason: "unverified" });
    expect(personsWithEmail("", register)).toEqual([]);
    expect(personsWithEmail(undefined, register)).toEqual([]);
  });

  test("en adresse som ikke er bekreftet, beviser ingenting, også når den står i registeret", () => {
    expect(sessionOf(signedIn("kari@menigheten.no", { emailVerified: false }), register, true)).toMatchObject({
      status: "notInRegister",
      reason: "unverified",
    });
  });

  test("deler flere personer én adresse, sier den ikke hvem av dem dette er", () => {
    expect(personsWithEmail("familien@berg.no", register).map((person) => person.id)).toEqual(["anne", "jon"]);
    expect(sessionOf(signedIn("familien@berg.no"), register, true)).toMatchObject({ status: "notInRegister", reason: "severalMatches" });
  });
});

describe("Rollen følger av personen, ikke av kontoen", () => {
  const groups = [
    { id: "lyd", leaderIds: ["ola"], deputyLeaderIds: ["per"], memberIds: ["anne"] },
    { id: "husgruppe", leaderIds: ["kari"], memberIds: ["jon"] },
  ] as Group[];

  test("administrator står på personen, gruppeleder følger av gruppene, og resten er medlemmer", () => {
    expect(roleOf(kari, groups)).toBe("administrator");
    expect(roleOf(ola, groups)).toBe("gruppeleder");
    // A deputy leads the group too
    expect(roleOf(per, groups)).toBe("gruppeleder");
    expect(roleOf(anne, groups)).toBe("medlem");
    expect(roleOf(ola, [])).toBe("medlem");

    expect(isAdministrator(kari)).toBe(true);
    expect(isAdministrator(ola)).toBe(false);
    expect(Object.values(ROLE_LABELS)).toEqual(["Administrator", "Gruppeleder", "Medlem"]);
  });
});

describe("Veien inn og tilbake", () => {
  test("etter innlogging går en dit en ville, når det er en adresse i appen", () => {
    expect(destinationAfterSignIn("/admin?tab=moduler")).toBe("/admin?tab=moduler");
    expect(destinationAfterSignIn("/oppgave/lyd")).toBe("/oppgave/lyd");
    expect(signInUrl("/admin?tab=moduler")).toBe("/logg-inn?neste=%2Fadmin%3Ftab%3Dmoduler");
  });

  test("alt annet enn en adresse i appen besvares med Min side", () => {
    for (const elsewhere of [null, undefined, "", "minside", "https://annet.example/", "//annet.example/", "/\\annet.example", "/logg-inn", "/logg-inn?neste=/admin"]) {
      expect(destinationAfterSignIn(elsewhere)).toBe("/minside");
    }
  });

  test("innloggingssiden er verken en del av nettsiden eller bak innlogging", () => {
    expect(isSignInPath("/logg-inn")).toBe(true);
    expect(isSignInPath("/logg-inn-na")).toBe(false);
    expect(isPublicPath("/logg-inn")).toBe(false);
    expect(isMinSidePath("/logg-inn")).toBe(false);
    // The pages around it are what they were
    expect(isPublicPath("/om-oss")).toBe(true);
    expect(isMinSidePath("/minside")).toBe(true);
  });
});

describe("På egen maskin kan en utvikler gå inn som en person", () => {
  test("personen må finnes i registeret, og registeret må ha kommet", () => {
    expect(standInSession("ola", register, true)).toEqual({ status: "member", person: ola, account: null });
    expect(standInSession("ola", [], false)).toEqual({ status: "loading" });
    expect(standInSession("finnes-ikke", register, true)).toEqual({ status: "signedOut" });
  });
});

describe("Testbryteren er borte", () => {
  const root = path.resolve(__dirname, "..");
  const filesUnder = (folder: string): string[] =>
    readdirSync(path.join(root, folder)).flatMap((name) => {
      const relative = `${folder}/${name}`;
      if (statSync(path.join(root, relative)).isDirectory()) return filesUnder(relative);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [relative] : [];
    });

  test("ingen fil i appen bytter aktiv bruker, og ingen person står inn når registeret er tomt", () => {
    const left = filesUnder("src").filter((file) => /UserSwitcher|UserQuickSwitcherBar|setCurrentUserId|currentUserId/.test(readFileSync(path.join(root, file), "utf8")));
    expect(left).toEqual([]);

    const provider = readFileSync(path.join(root, "src/context/FirebaseDataContext.tsx"), "utf8");
    expect(provider).not.toMatch(/initialPersons/);
  });
});
