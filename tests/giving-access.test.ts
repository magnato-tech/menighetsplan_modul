import { describe, expect, test } from "vitest";
import {
  accessStatusLabel,
  activatedAccess,
  canEditRow,
  changedAccess,
  GIVING_RIGHTS,
  grantFormError,
  hasAnyRight,
  newAccess,
  ownAccessState,
  rightLabelsOf,
  storedAccessFields,
  type GivingAccess,
  type GivingRights,
} from "../src/utils/giving/access";

// Givertjeneste: who holds which right. Everything here is made up.

const NOW = new Date("2026-11-20T10:00:00.000Z");
const LATER = new Date("2026-11-21T10:00:00.000Z");

const ALL: GivingRights = { overview: true, budget: true, individual: true, manage: true };
const NONE: GivingRights = { overview: false, budget: false, individual: false, manage: false };

/** A right as the database holds it, made by the app: with the stamp, and a Google account when one is given. */
const stored = (overrides: Partial<GivingAccess> = {}): GivingAccess => ({
  address: "ola@eksempel.no",
  personId: "ola",
  name: "Ola Hansen",
  ...ALL,
  version: 2,
  updatedAt: "2026-11-19T09:00:00.000Z",
  updatedBy: "kari",
  ...overrides,
});

const SIGNED_IN_WITH_GOOGLE = { withGoogle: true, googleId: "google-ola" };

describe("Rettighetene og navnene på dem", () => {
  test("de fire rettighetene står i rekkefølge, med navn og forklaring", () => {
    expect(GIVING_RIGHTS.map((right) => right.id)).toEqual(["overview", "budget", "individual", "manage"]);
    expect(GIVING_RIGHTS.map((right) => right.label)).toEqual(["Oversikt", "Budsjett", "Givere", "Tilganger"]);
    expect(GIVING_RIGHTS.find((right) => right.id === "manage")?.description).toBe("Gi og fjerne tilgang for andre, ikke for seg selv.");
  });

  test("hasAnyRight: ingen dokument og ingen rettighet gir nei", () => {
    expect(hasAnyRight(null)).toBe(false);
    expect(hasAnyRight(undefined)).toBe(false);
    expect(hasAnyRight(NONE)).toBe(false);
    expect(hasAnyRight({ budget: true })).toBe(true);
  });

  test("rightLabelsOf gir navnene på de rettighetene som er gitt", () => {
    expect(rightLabelsOf({ overview: true, individual: true, budget: false, manage: false })).toEqual(["Oversikt", "Givere"]);
    expect(rightLabelsOf(null)).toEqual([]);
  });
});

describe("Hvor den innloggede står med sine rettigheter", () => {
  test("ingen rettighet, eller ikke noe dokument: ingen tilgang", () => {
    expect(ownAccessState({ access: null, personId: "ola", googleSignIn: SIGNED_IN_WITH_GOOGLE })).toBe("none");
    expect(ownAccessState({ access: stored({ ...NONE }), personId: "ola", googleSignIn: SIGNED_IN_WITH_GOOGLE })).toBe("none");
  });

  test("rettighetene gjelder en annen person", () => {
    expect(ownAccessState({ access: stored({ personId: "kari" }), personId: "ola", googleSignIn: SIGNED_IN_WITH_GOOGLE })).toBe("other-person");
  });

  test("uten Google-innlogging, og før det kommer ikke noe Google-konto", () => {
    const access = stored({ googleId: "google-ola" });
    expect(ownAccessState({ access, personId: "ola", googleSignIn: { withGoogle: false, googleId: null } })).toBe("needs-google");
    expect(ownAccessState({ access: stored(), personId: "ola", googleSignIn: { withGoogle: false, googleId: null } })).toBe("needs-google");
  });

  test("med Google, men uten Google-konto i dokumentet: må tas i bruk", () => {
    expect(ownAccessState({ access: stored(), personId: "ola", googleSignIn: SIGNED_IN_WITH_GOOGLE })).toBe("needs-activation");
  });

  test("med en annen Google-konto enn den tilgangen ble tatt i bruk med", () => {
    const access = stored({ googleId: "google-kari" });
    expect(ownAccessState({ access, personId: "ola", googleSignIn: SIGNED_IN_WITH_GOOGLE })).toBe("wrong-google");
  });

  test("riktig person, riktig Google-konto: i bruk", () => {
    const access = stored({ googleId: "google-ola" });
    expect(ownAccessState({ access, personId: "ola", googleSignIn: SIGNED_IN_WITH_GOOGLE })).toBe("active");
  });

  test("sjekkes i rekkefølgen: rettighet, person, Google, så tatt i bruk, så Google-konto", () => {
    const withGoogleId = stored({ googleId: "google-kari" });
    // Another person comes before Google is asked about
    expect(ownAccessState({ access: stored({ personId: "kari" }), personId: "ola", googleSignIn: { withGoogle: false, googleId: null } })).toBe(
      "other-person"
    );
    // Not signed in with Google comes before a wrong Google account
    expect(ownAccessState({ access: withGoogleId, personId: "ola", googleSignIn: { withGoogle: false, googleId: null } })).toBe("needs-google");
  });

  test("statusen i listen sier om en rettighet er i bruk", () => {
    expect(accessStatusLabel(stored({ ...NONE, googleId: "g" }))).toBe("Ingen tilgang");
    expect(accessStatusLabel(null)).toBe("Ingen tilgang");
    expect(accessStatusLabel(stored())).toBe("Venter på at personen tar den i bruk");
    expect(accessStatusLabel(stored({ googleId: "google-ola" }))).toBe("I bruk");
  });
});

describe("Skjemaet for å gi tilgang", () => {
  const base = {
    address: "ny@eksempel.no",
    name: "Ny Person",
    rights: { overview: true } as Partial<GivingRights>,
    ownAddress: "kari@eksempel.no",
    ownPersonId: "kari",
    foundPersonId: "ny",
    existing: null,
  };

  test("gyldig skjema gir ingen feil", () => {
    expect(grantFormError(base)).toBeNull();
  });

  test("tom eller ugyldig e-post", () => {
    expect(grantFormError({ ...base, address: "   " })).toBe("Skriv e-postadressen.");
    expect(grantFormError({ ...base, address: "ikke-en-adresse" })).toBe("Skriv e-postadressen.");
    expect(grantFormError({ ...base, address: "a b@eksempel.no" })).toBe("Skriv e-postadressen.");
  });

  test("tomt navn, og navn over 120 tegn", () => {
    expect(grantFormError({ ...base, name: "  " })).toBe("Skriv navnet.");
    expect(grantFormError({ ...base, name: "a".repeat(121) })).toBe("Navnet kan ha høyst 120 tegn.");
    expect(grantFormError({ ...base, name: "a".repeat(120) })).toBeNull();
  });

  test("ingen rettighet valgt", () => {
    expect(grantFormError({ ...base, rights: {} })).toBe("Velg minst én tilgang.");
    expect(grantFormError({ ...base, rights: NONE })).toBe("Velg minst én tilgang.");
  });

  test("ens egen adresse, uansett store og små bokstaver", () => {
    expect(grantFormError({ ...base, address: "  KARI@eksempel.no " })).toBe("Du kan ikke gi tilgang til deg selv.");
  });

  test("adressen har allerede en rettighet", () => {
    expect(grantFormError({ ...base, existing: stored({ address: "ny@eksempel.no" }) })).toBe(
      "Adressen står allerede i listen. Endre den der."
    );
  });

  test("adressen står ikke som innlogging for noen", () => {
    expect(grantFormError({ ...base, foundPersonId: null })).toBe("Adressen står ikke som innlogging for noen i personregisteret.");
  });

  test("personen er den innloggede selv, under en annen adresse", () => {
    expect(grantFormError({ ...base, foundPersonId: "kari" })).toBe("Du kan ikke gi tilgang til deg selv.");
  });

  test("uten oppslag er bare sjekkene før det sagt", () => {
    expect(grantFormError({ ...base, foundPersonId: undefined })).toBeNull();
    expect(grantFormError({ ...base, foundPersonId: undefined, name: "" })).toBe("Skriv navnet.");
  });

  test("feilene kommer i rekkefølgen de sjekkes", () => {
    expect(grantFormError({ ...base, address: "", name: "", rights: {} })).toBe("Skriv e-postadressen.");
    expect(grantFormError({ ...base, name: "", rights: {} })).toBe("Skriv navnet.");
    expect(grantFormError({ ...base, rights: {}, address: "kari@eksempel.no" })).toBe("Velg minst én tilgang.");
    expect(grantFormError({ ...base, address: "kari@eksempel.no", existing: stored(), foundPersonId: null })).toBe(
      "Du kan ikke gi tilgang til deg selv."
    );
  });
});

describe("Dokumentene som lagres", () => {
  const allowed = [
    "personId",
    "name",
    "overview",
    "budget",
    "individual",
    "manage",
    "googleId",
    "version",
    "updatedAt",
    "updatedBy",
  ];

  test("en ny tilgang: versjon 1, ingen Google-konto, og bare de tillatte feltene", () => {
    const access = newAccess({ address: "  Ny@Eksempel.no ", personId: "ny", name: " Ny Person ", rights: { individual: true } }, "kari", NOW);
    expect(access).toEqual({
      address: "ny@eksempel.no",
      personId: "ny",
      name: "Ny Person",
      overview: false,
      budget: false,
      individual: true,
      manage: false,
      version: 1,
      updatedAt: NOW.toISOString(),
      updatedBy: "kari",
    });
    const document = storedAccessFields(access);
    expect(Object.keys(document).sort()).toEqual(["budget", "individual", "manage", "name", "overview", "personId", "updatedAt", "updatedBy", "version"]);
    expect(Object.keys(document).every((key) => allowed.includes(key))).toBe(true);
    expect("address" in document).toBe(false);
  });

  test("en endring: versjonen går opp, Google-kontoen beholdes, og navn og person står", () => {
    const next = changedAccess(stored({ googleId: "google-ola" }), { rights: { manage: false } }, "kari", LATER);
    expect(next.version).toBe(3);
    expect(next.manage).toBe(false);
    expect(next.overview).toBe(true);
    expect(next.googleId).toBe("google-ola");
    expect(next.name).toBe("Ola Hansen");
    expect(next.personId).toBe("ola");
    expect(next.updatedAt).toBe(LATER.toISOString());
    expect(next.updatedBy).toBe("kari");
    expect(Object.keys(storedAccessFields(next)).every((key) => allowed.includes(key))).toBe(true);
  });

  test("å nullstille Google-kontoen fjerner feltet helt, ikke som tom verdi", () => {
    const next = changedAccess(stored({ googleId: "google-ola" }), { resetGoogle: true }, "kari", LATER);
    expect("googleId" in next).toBe(false);
    expect("googleId" in storedAccessFields(next)).toBe(false);
  });

  test("en endring av et hånd-laget dokument uten tidspunkt og avsender får begge", () => {
    const handMade: GivingAccess = { address: "ola@eksempel.no", personId: "ola", name: "Ola", overview: true, budget: false, individual: false, manage: false, version: 1 };
    const next = changedAccess(handMade, { rights: { budget: true } }, "kari", LATER);
    expect(next).toMatchObject({ version: 2, budget: true, overview: true, updatedAt: LATER.toISOString(), updatedBy: "kari" });
    expect(Object.keys(storedAccessFields(next)).every((key) => allowed.includes(key))).toBe(true);
  });

  test("uten rettighetene som endres, beholder endringen dem som de var", () => {
    const next = changedAccess(stored({ budget: false }), {}, "kari", LATER);
    expect(next.budget).toBe(false);
    expect(next.overview).toBe(true);
  });

  test("å ta i bruk: Google-kontoen og navnet fra registeret, og ellers ingenting", () => {
    const before = stored({ name: "Ola H." });
    const next = activatedAccess(before, "google-ola", "Ola Hansen", LATER, "ola");
    expect(next).toMatchObject({ googleId: "google-ola", name: "Ola Hansen", version: 3, personId: "ola", overview: true, manage: true });
    expect(next.updatedBy).toBe("ola");
    expect(Object.keys(storedAccessFields(next)).every((key) => allowed.includes(key))).toBe(true);
  });

  test("et dokument uten tidspunkt eller avsender kan ikke lagres", () => {
    expect(() => storedAccessFields(stored({ updatedAt: undefined }))).toThrow();
    expect(() => storedAccessFields(stored({ updatedBy: undefined }))).toThrow();
  });
});

describe("Hvilke rader kan endres", () => {
  test("den innloggedes egen adresse, og den innloggedes egen person, kan ikke endres", () => {
    expect(canEditRow({ address: "kari@eksempel.no", personId: "kari" }, "kari@eksempel.no", "kari")).toBe(false);
    expect(canEditRow({ address: "KARI@eksempel.no", personId: "kari" }, " kari@eksempel.no", "kari")).toBe(false);
    expect(canEditRow({ address: "ola@eksempel.no", personId: "kari" }, "kari@eksempel.no", "kari")).toBe(false);
  });

  test("andre rader kan endres", () => {
    expect(canEditRow({ address: "ola@eksempel.no", personId: "ola" }, "kari@eksempel.no", "kari")).toBe(true);
  });
});
