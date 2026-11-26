import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";

// Givertjeneste in ../firestore.rules, run against Firebase's local emulator: who may read and write
// givers, gift agreements, gifts, the history of them, the purposes, and who may hold the rights
// (givingAccess) and the log of them (givingLog). Everyone here is made up.
//
// A change is written the way the app writes it: one batch with the document and its history entry
// (givingEvents) for givers, agreements and gifts, and one batch with the access document and its log
// entry (givingLog) for the rights.
//
//   npm run test:rules   (fra rotmappa; starter emulatorene, kjører alle *.rules.test.ts, stopper dem)

type Db = Firestore;
type Kind = "giver" | "agreement" | "gift";
type Provider = "google.com" | "password" | "custom";
type Op = (db: Db, by: string) => Promise<unknown>;

let env: RulesTestEnvironment;

const NOW = "2026-11-26T10:00:00.000Z";
const LATER = "2026-11-27T09:00:00.000Z";
const PURPOSE = "purpose-1";

const ANNA = "anna@menigheten.no";
const MONA = "mona@eksempel.no";
const LARS = "lars@eksempel.no";
const ROLF = "rolf@eksempel.no";
const MARIT = "marit@eksempel.no";
const STYRET = "styret@eksempel.no";
const STYRET_2 = "styret2@eksempel.no";
const KARI = "kari@eksempel.no";
const ODA = "oda@eksempel.no";
const NILS = "nils@eksempel.no";
const OLA = "ola@eksempel.no";

const GOOGLE_ID: Record<string, string> = {
  [ANNA]: "google-anna",
  [MONA]: "google-mona",
  [LARS]: "google-lars",
  [ROLF]: "google-rolf",
  [MARIT]: "google-marit",
  [STYRET]: "google-styret",
  [KARI]: "google-kari",
  [ODA]: "google-oda",
  [NILS]: "google-nils",
  [OLA]: "google-ola",
};

// ---------- Who is asking ----------

/** Signed in with an address, by one way of signing in. The Google id is in the token only when given. */
function session(email: string, provider: Provider = "password", googleId?: string, verified = true): Db {
  const identities: Record<string, string[]> = { email: [email] };
  if (googleId !== undefined) identities["google.com"] = [googleId];
  return env.authenticatedContext(`uid-${email}`, {
    email,
    email_verified: verified,
    firebase: { sign_in_provider: provider, identities },
  }).firestore() as unknown as Db;
}

/** Signed in with Google, with the Google account the address has in the seed */
const google = (email: string): Db => session(email, "google.com", GOOGLE_ID[email]);
const visitor = (): Db => env.unauthenticatedContext().firestore() as unknown as Db;
const stranger = (): Db => session("fremmed@eksempel.no");
const admin = (): Db => google(ANNA);
const treasurer = (): Db => google(KARI);
const manager = (): Db => google(STYRET);

/** Runs with the rules switched off, for seeding a state the app cannot reach by itself. */
async function withoutRules(fn: (db: Db) => Promise<unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    await fn(context.firestore() as unknown as Db);
  });
}

/** The call must be refused. The name says which one, when it is not. */
async function refused(navn: string, forsok: Promise<unknown>): Promise<void> {
  await assertFails(forsok).catch(() => {
    throw new Error(`Skal avvises: ${navn}`);
  });
}

/** The call must go through. */
async function allowed(navn: string, forsok: Promise<unknown>): Promise<void> {
  await assertSucceeds(forsok).catch((feil: unknown) => {
    throw new Error(`Skal godtas: ${navn}: ${feil instanceof Error ? feil.message : String(feil)}`);
  });
}

// ---------- The documents as the app writes them ----------

const withoutKey = (obj: Record<string, unknown>, key: string): Record<string, unknown> => {
  const copy = { ...obj };
  delete copy[key];
  return copy;
};

/** A new record, stamped by the one who writes it */
function newFields(by: string, fields: Record<string, unknown>): Record<string, unknown> {
  return { ...fields, version: 1, createdAt: NOW, createdBy: by, updatedAt: NOW, updatedBy: by };
}

/**
 * A later version of a record. Created stays as it was. Fields in `drop` are left out, which the
 * app does by writing the whole document without them.
 */
function nextFields(
  seed: Record<string, unknown>,
  by: string,
  changes: Record<string, unknown> = {},
  drop: string[] = [],
): Record<string, unknown> {
  let base = { ...seed };
  for (const key of drop) base = withoutKey(base, key);
  return { ...base, ...changes, version: (seed.version as number) + 1, updatedAt: LATER, updatedBy: by };
}

/** A full access document, as the rules expect it. Without `googleId` when none is given. */
function accessDoc(f: {
  personId: string;
  name: string;
  rights?: Partial<Record<"overview" | "budget" | "individual" | "manage", boolean>>;
  version: number;
  by: string;
  googleId?: string;
  at?: string;
}): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    personId: f.personId,
    name: f.name,
    overview: false,
    budget: false,
    individual: false,
    manage: false,
    ...f.rights,
    version: f.version,
    updatedAt: f.at ?? NOW,
    updatedBy: f.by,
  };
  if (f.googleId !== undefined) fields.googleId = f.googleId;
  return fields;
}

const gift = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  date: "2026-11-05",
  year: 2026,
  amountOre: 1000,
  purposeId: PURPOSE,
  type: "enkeltgave",
  source: "vipps",
  identification: "anonym",
  status: "gyldig",
  ...over,
});

const AVTALE = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  giverId: "mona",
  purposeId: PURPOSE,
  amountOre: 10000,
  frequency: "ar",
  startDate: "2026-01-01",
  method: "bank",
  status: "aktiv",
  ...over,
});

// ---------- The writes: one batch each ----------

const RECORD_COLLECTION: Record<Kind, string> = { giver: "givers", agreement: "giftAgreements", gift: "gifts" };

interface RecordOptions {
  omitDoc?: boolean;
  omitEvent?: boolean;
  /** Replaces the history entry's data, which must equal the document for the write to go through */
  eventData?: Record<string, unknown>;
}

/** Adds a change of a giver, agreement or gift, and its history entry, to a batch */
function putRecord(
  db: Db,
  batch: WriteBatch,
  kind: Kind,
  id: string,
  fields: Record<string, unknown>,
  by: string,
  o: RecordOptions = {},
): void {
  const version = fields.version as number;
  if (!o.omitDoc) batch.set(doc(db, `${RECORD_COLLECTION[kind]}/${id}`), fields);
  if (!o.omitEvent) {
    batch.set(doc(db, `givingEvents/${kind}_${id}_${version}`), {
      kind,
      docId: id,
      version,
      at: serverTimestamp(),
      by,
      data: o.eventData ?? fields,
    });
  }
}

async function saveRecord(
  db: Db,
  kind: Kind,
  id: string,
  fields: Record<string, unknown>,
  by: string,
  o: RecordOptions = {},
): Promise<void> {
  const batch = writeBatch(db);
  putRecord(db, batch, kind, id, fields, by, o);
  await batch.commit();
}

interface AccessOptions {
  action: "grant" | "change" | "activate";
  omitDoc?: boolean;
  omitLog?: boolean;
}

/** Changes an access document and writes its log entry in one batch */
async function saveAccess(
  db: Db,
  address: string,
  fields: Record<string, unknown>,
  by: string,
  o: AccessOptions,
): Promise<void> {
  const version = fields.version as number;
  const batch = writeBatch(db);
  if (!o.omitDoc) batch.set(doc(db, `givingAccess/${address}`), fields);
  if (!o.omitLog) {
    batch.set(doc(db, `givingLog/access_${address}_${version}`), {
      action: o.action,
      target: address,
      version,
      at: serverTimestamp(),
      by,
      access: fields,
    });
  }
  await batch.commit();
}

const grantNils = (by: string): Record<string, unknown> =>
  accessDoc({ personId: "nils", name: "Nils Nordmann", rights: { overview: true }, version: 1, by });

// ---------- Seed ----------

const PERSONER: Record<string, Record<string, unknown>> = {
  anna: { name: "Anna Administrator", email: ANNA },
  mona: { name: "Mona Medlem", email: MONA },
  lars: { name: "Lars Leder", email: LARS },
  rolf: { name: "Rolf Redaktør", email: ROLF },
  marit: { name: "Marit Medlemsansvarlig", email: MARIT, membershipClerk: true },
  styret: { name: "Sigrid Styremedlem", email: STYRET },
  kari: { name: "Kari Kasserer", email: KARI },
  oda: { name: "Oda Oversikt", email: ODA },
  nils: { name: "Nils Nordmann", email: NILS },
  ola: { name: "Ola Bootstrap", email: OLA },
};

const LOGINS: Record<string, { personId: string; role: string }> = {
  [ANNA]: { personId: "anna", role: "admin" },
  [MONA]: { personId: "mona", role: "member" },
  [LARS]: { personId: "lars", role: "member" },
  [ROLF]: { personId: "rolf", role: "nettredaktor" },
  [MARIT]: { personId: "marit", role: "member" },
  [STYRET]: { personId: "styret", role: "member" },
  [STYRET_2]: { personId: "styret", role: "member" },
  [KARI]: { personId: "kari", role: "member" },
  [ODA]: { personId: "oda", role: "member" },
  [NILS]: { personId: "nils", role: "member" },
  [OLA]: { personId: "ola", role: "member" },
};

const SEED_STAMP = { createdAt: NOW, createdBy: "kari", updatedAt: NOW, updatedBy: "kari" };
const MONA_GIVER = { personId: "mona", name: "Mona Medlem", active: true, version: 1, ...SEED_STAMP };
const EKSTERN_GIVER = { name: "Ekstern Giver", email: "ekstern@eksempel.no", active: true, version: 1, ...SEED_STAMP };
const AVTALE_1 = {
  giverId: "ekstern-1",
  purposeId: PURPOSE,
  amountOre: 100000,
  frequency: "maned",
  startDate: "2026-01-01",
  method: "vipps",
  status: "aktiv",
  version: 1,
  ...SEED_STAMP,
};
const VIPPS_123 = {
  date: "2026-11-03",
  year: 2026,
  amountOre: 50000,
  purposeId: PURPOSE,
  type: "enkeltgave",
  source: "vipps",
  identification: "kjent",
  giverId: "mona",
  status: "gyldig",
  version: 1,
  ...SEED_STAMP,
};
const ANNULLERT_1 = {
  date: "2026-10-01",
  year: 2026,
  amountOre: 20000,
  purposeId: PURPOSE,
  type: "kollekt",
  source: "kontant",
  identification: "anonym",
  status: "gyldig",
  version: 1,
  ...SEED_STAMP,
};
const ANNULLERT_2 = { ...ANNULLERT_1, status: "annullert", voidReason: "Registrert to ganger", version: 2 };

// The rights as they stand in the seed. Seeded documents are also the history's data.
const STYRET_ACCESS = accessDoc({
  personId: "styret",
  name: "Sigrid Styremedlem",
  rights: { manage: true },
  version: 1,
  by: ANNA,
  googleId: "google-styret",
});
const KARI_ACCESS = accessDoc({
  personId: "kari",
  name: "Kari Kasserer",
  rights: { overview: true, budget: true, individual: true },
  version: 1,
  by: STYRET,
  googleId: "google-kari",
});
const ODA_ACCESS = accessDoc({
  personId: "oda",
  name: "Oda Oversikt",
  rights: { overview: true },
  version: 1,
  by: STYRET,
  googleId: "google-oda",
});
// The first rights holder, typed in by hand in the Firebase console: no updatedAt, updatedBy or googleId
const OLA_BOOTSTRAP = {
  personId: "ola",
  name: "Ola Bootstrap",
  overview: false,
  budget: false,
  individual: false,
  manage: true,
  version: 1,
};

const seedEvent = (kind: Kind, id: string, data: Record<string, unknown>) => ({
  kind,
  docId: id,
  version: data.version,
  at: NOW,
  by: "kari",
  data,
});

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
  await withoutRules(async (db) => {
    const put = (path: string, data: object) => setDoc(doc(db, path), data);
    await Promise.all([
      ...Object.entries(PERSONER).map(([id, person]) => put(`persons/${id}`, person)),
      ...Object.entries(LOGINS).map(([address, login]) => put(`logins/${address}`, login)),
      put("groups/gruppe-lyd", { name: "Lyd og bilde", isPublic: true, leaderIds: ["lars"], memberIds: ["mona"] }),
      put("cms_settings/addons", { recordType: "addons", on: { givertjeneste: true } }),
      put(`givingPurposes/${PURPOSE}`, {
        name: "Kirkens arbeid",
        usage: "drift",
        active: true,
        createdAt: NOW,
        updatedAt: NOW,
        updatedBy: "anna",
      }),
      put("givers/mona", MONA_GIVER),
      put("givers/ekstern-1", EKSTERN_GIVER),
      put("giftAgreements/avtale-1", AVTALE_1),
      put("gifts/vipps-123", VIPPS_123),
      put("gifts/gave-annullert", ANNULLERT_2),
      put("givingEvents/giver_mona_1", seedEvent("giver", "mona", MONA_GIVER)),
      put("givingEvents/giver_ekstern-1_1", seedEvent("giver", "ekstern-1", EKSTERN_GIVER)),
      put("givingEvents/agreement_avtale-1_1", seedEvent("agreement", "avtale-1", AVTALE_1)),
      put("givingEvents/gift_vipps-123_1", seedEvent("gift", "vipps-123", VIPPS_123)),
      put("givingEvents/gift_gave-annullert_1", seedEvent("gift", "gave-annullert", ANNULLERT_1)),
      put("givingEvents/gift_gave-annullert_2", seedEvent("gift", "gave-annullert", ANNULLERT_2)),
      put(`givingAccess/${STYRET}`, STYRET_ACCESS),
      put(`givingAccess/${KARI}`, KARI_ACCESS),
      put(`givingAccess/${ODA}`, ODA_ACCESS),
      put(`givingAccess/${OLA}`, OLA_BOOTSTRAP),
    ]);
  });
});

// ---------- Operations used by the table tests ----------

const OPS: Array<[string, Op]> = [
  ["givers: les én", (db) => getDoc(doc(db, "givers/mona"))],
  ["givers: les alle", (db) => getDocs(collection(db, "givers"))],
  ["givers: opprett", (db, by) => saveRecord(db, "giver", "ny-giver", newFields(by, { name: "Ny Giver", active: true }), by)],
  [
    "givers: endre",
    (db, by) => saveRecord(db, "giver", "ekstern-1", nextFields(EKSTERN_GIVER, by, { name: "Ekstern Giver to" }, ["email"]), by),
  ],
  ["givers: slett", (db) => deleteDoc(doc(db, "givers/ekstern-1"))],
  ["giftAgreements: les én", (db) => getDoc(doc(db, "giftAgreements/avtale-1"))],
  ["giftAgreements: les alle", (db) => getDocs(collection(db, "giftAgreements"))],
  [
    "giftAgreements: opprett",
    (db, by) => saveRecord(db, "agreement", "ny-avtale", newFields(by, AVTALE({ giverId: "ekstern-1" })), by),
  ],
  ["giftAgreements: endre", (db, by) => saveRecord(db, "agreement", "avtale-1", nextFields(AVTALE_1, by, { status: "pause" }), by)],
  ["giftAgreements: slett", (db) => deleteDoc(doc(db, "giftAgreements/avtale-1"))],
  ["gifts: les én", (db) => getDoc(doc(db, "gifts/vipps-123"))],
  ["gifts: les alle", (db) => getDocs(collection(db, "gifts"))],
  ["gifts: opprett", (db, by) => saveRecord(db, "gift", "ny-gave", newFields(by, gift()), by)],
  ["gifts: endre", (db, by) => saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, by, { amountOre: 51000 }), by)],
  ["gifts: slett", (db) => deleteDoc(doc(db, "gifts/vipps-123"))],
  ["givingEvents: les én", (db) => getDoc(doc(db, "givingEvents/giver_mona_1"))],
  ["givingEvents: les alle", (db) => getDocs(collection(db, "givingEvents"))],
  [
    "givingEvents: opprett",
    (db, by) =>
      setDoc(doc(db, "givingEvents/giver_ekstern-1_2"), {
        kind: "giver",
        docId: "ekstern-1",
        version: 2,
        at: serverTimestamp(),
        by,
        data: nextFields(EKSTERN_GIVER, by, {}, ["email"]),
      }),
  ],
  ["givingEvents: endre", (db) => updateDoc(doc(db, "givingEvents/giver_mona_1"), { by: "anna" })],
  ["givingEvents: slett", (db) => deleteDoc(doc(db, "givingEvents/giver_mona_1"))],
  ["givingLog: les én", (db) => getDoc(doc(db, `givingLog/access_${KARI}_1`))],
  ["givingLog: les alle", (db) => getDocs(collection(db, "givingLog"))],
  ["givingLog: opprett", (db, by) => saveAccess(db, NILS, grantNils(by), by, { action: "grant" })],
  ["givingLog: endre", (db) => updateDoc(doc(db, `givingLog/access_${KARI}_1`), { by: "anna" })],
  ["givingLog: slett", (db) => deleteDoc(doc(db, `givingLog/access_${KARI}_1`))],
  ["givingAccess: les andres", (db) => getDoc(doc(db, `givingAccess/${KARI}`))],
  ["givingAccess: les alle", (db) => getDocs(collection(db, "givingAccess"))],
  ["givingAccess: opprett", (db, by) => saveAccess(db, NILS, grantNils(by), by, { action: "grant" })],
  [
    "givingAccess: endre",
    (db, by) => saveAccess(db, KARI, nextFields(KARI_ACCESS, by, { budget: false }), by, { action: "change" }),
  ],
];

// The people who may not get anything: with a valid write and read in every case
const OUTSIDERS: Array<[string, () => Db, string]> = [
  ["en besøkende", visitor, "ukjent"],
  ["en innlogget som ikke står i registeret", stranger, "ukjent"],
  ["et medlem med ubekreftet e-post", () => session(MONA, "password", undefined, false), "mona"],
  ["et vanlig medlem med passord", () => session(MONA), "mona"],
  ["et vanlig medlem med Google", () => google(MONA), "mona"],
  ["en gruppeleder", () => google(LARS), "lars"],
  ["en nettredaktør", () => google(ROLF), "rolf"],
  ["en medlemsansvarlig", () => google(MARIT), "marit"],
  ["administratoren med Google", admin, "anna"],
  ["administratoren med passord", () => session(ANNA), "anna"],
];

// Reads and writes the treasurer may do, for the cases where the treasurer is refused
const INDIVIDUAL_OPS: Array<[string, Op]> = [
  ["giver", (db) => getDoc(doc(db, "givers/mona"))],
  ["givere", (db) => getDocs(collection(db, "givers"))],
  ["avtaler", (db) => getDocs(collection(db, "giftAgreements"))],
  ["gave", (db) => getDoc(doc(db, "gifts/vipps-123"))],
  ["gaver", (db) => getDocs(collection(db, "gifts"))],
  ["historikk", (db) => getDocs(collection(db, "givingEvents"))],
  ["personer", (db) => getDocs(collection(db, "persons"))],
  ["en annen person", (db) => getDoc(doc(db, "persons/oda"))],
  ["ny giver", (db, by) => saveRecord(db, "giver", "ny-giver", newFields(by, { name: "Ny Giver", active: true }), by)],
];

async function refusedForIndividual(db: Db, label: string): Promise<void> {
  for (const [navn, op] of INDIVIDUAL_OPS) {
    await refused(`${label}: ${navn}`, op(db, "kari"));
  }
}

// ---------- Tests ----------

describe("Givertjeneste: den som ikke har en rett", () => {
  test("ingen uten en rett får noe, verken å lese, opprette, endre eller slette", async () => {
    await allowed(
      "kontroll: kasserer oppretter en giver",
      saveRecord(treasurer(), "giver", "kontroll-giver", newFields("kari", { name: "Kontroll", active: true }), "kari"),
    );
    for (const [rad, lag, by] of OUTSIDERS) {
      const db = lag();
      for (const [navn, op] of OPS) {
        await refused(`${rad}: ${navn}`, op(db, by));
      }
    }
  });

  test("administratoren kan ikke gi seg selv en rett", async () => {
    await refused(
      "administrator gir seg selv en rett",
      saveAccess(admin(), ANNA, accessDoc({ personId: "anna", name: "Anna Administrator", rights: { manage: true }, version: 1, by: "anna" }), "anna", { action: "grant" }),
    );
    await allowed("styret gir nils en rett", saveAccess(manager(), NILS, grantNils("styret"), "styret", { action: "grant" }));
  });

  test("et vanlig medlem ser ikke personer, verken alle eller andre", async () => {
    const db = session(MONA);
    await allowed("medlemmet leser sin egen person", getDoc(doc(db, "persons/mona")));
    await refused("alle personer", getDocs(collection(db, "persons")));
    await refused("en annen person", getDoc(doc(db, "persons/lars")));
  });
});

describe("Givertjeneste: kassereren med Google", () => {
  test("kan lese givere, avtaler, gaver, historikk, personer og formål", async () => {
    const db = treasurer();
    await allowed("giver", getDoc(doc(db, "givers/mona")));
    await allowed("givere", getDocs(collection(db, "givers")));
    await allowed("avtale", getDoc(doc(db, "giftAgreements/avtale-1")));
    await allowed("avtaler", getDocs(collection(db, "giftAgreements")));
    await allowed("gave", getDoc(doc(db, "gifts/vipps-123")));
    await allowed("gaver", getDocs(collection(db, "gifts")));
    await allowed("historikk", getDocs(collection(db, "givingEvents")));
    await allowed("personer", getDocs(collection(db, "persons")));
    await allowed("formål", getDoc(doc(db, `givingPurposes/${PURPOSE}`)));
    await allowed("formål, alle", getDocs(collection(db, "givingPurposes")));
  });

  test("kan opprette en giver knyttet til en person, med personens id", async () => {
    await allowed(
      "giver rolf",
      saveRecord(treasurer(), "giver", "rolf", newFields("kari", { personId: "rolf", name: "Rolf Redaktør", active: true }), "kari"),
    );
  });

  test("kan opprette en ekstern giver", async () => {
    await allowed("ekstern giver", saveRecord(treasurer(), "giver", "ny-ekstern", newFields("kari", { name: "Ny Ekstern", active: true }), "kari"));
  });

  test("kan knytte en ekstern giver til en person, og da skrives e-posten bort", async () => {
    await allowed(
      "ekstern giver knyttes til lars",
      saveRecord(treasurer(), "giver", "ekstern-1", nextFields(EKSTERN_GIVER, "kari", { personId: "lars" }, ["email"]), "kari"),
    );
  });

  test("kan opprette en avtale", async () => {
    await allowed(
      "avtale",
      saveRecord(treasurer(), "agreement", "avtale-2", newFields("kari", AVTALE()), "kari"),
    );
  });

  test("kan registrere en anonym gave", async () => {
    await allowed("anonym gave", saveRecord(treasurer(), "gift", "anonym-1", newFields("kari", gift()), "kari"));
  });

  test("kan registrere en kjent gave", async () => {
    await allowed(
      "kjent gave",
      saveRecord(treasurer(), "gift", "vipps-124", newFields("kari", gift({ identification: "kjent", giverId: "mona" })), "kari"),
    );
  });

  test("kan registrere en giver og en gave i samme skriving", async () => {
    const db = treasurer();
    const batch = writeBatch(db);
    putRecord(db, batch, "giver", "rolf", newFields("kari", { personId: "rolf", name: "Rolf Redaktør", active: true }), "kari");
    putRecord(db, batch, "gift", "gave-rolf-1", newFields("kari", gift({ identification: "kjent", giverId: "rolf" })), "kari");
    await allowed("giver og gave i én batch", batch.commit());
  });

  test("kan rette en gave med versjon 2", async () => {
    await allowed(
      "gave versjon 2",
      saveRecord(treasurer(), "gift", "vipps-123", nextFields(VIPPS_123, "kari", { amountOre: 51000 }), "kari"),
    );
  });

  test("kan annullere en gave med en grunn", async () => {
    await allowed(
      "annullering med grunn",
      saveRecord(
        treasurer(),
        "gift",
        "vipps-123",
        nextFields(VIPPS_123, "kari", { status: "annullert", voidReason: "Dobbelregistrert" }),
        "kari",
      ),
    );
  });
});

describe("Givertjeneste: kassereren uten full tilgang", () => {
  test("med passord kommer kassereren ingen vei til det personlige", async () => {
    await allowed("kontroll: med Google", getDoc(doc(treasurer(), "givers/mona")));
    await refusedForIndividual(session(KARI), "med passord");
  });

  test("med e-postlenke (custom) kommer kassereren ingen vei til det personlige", async () => {
    await allowed("kontroll: med Google", getDoc(doc(treasurer(), "givers/mona")));
    await refusedForIndividual(session(KARI, "custom"), "med e-postlenke");
  });

  test("med en annen Google-konto kommer kassereren ingen vei til det personlige", async () => {
    await allowed("kontroll: med Google", getDoc(doc(treasurer(), "givers/mona")));
    await refusedForIndividual(session(KARI, "google.com", "google-annen"), "med annen Google-konto");
  });

  test("når modulen er av, kommer kassereren ingen vei, heller ikke til formål", async () => {
    await allowed("kontroll: modulen er på", getDoc(doc(treasurer(), "givers/mona")));
    await withoutRules((db) => setDoc(doc(db, "cms_settings/addons"), { recordType: "addons", on: { givertjeneste: false } }));
    await refusedForIndividual(treasurer(), "modulen av");
    await refused("formål", getDoc(doc(treasurer(), `givingPurposes/${PURPOSE}`)));
  });

  test("når cms_settings/addons ikke finnes, kommer kassereren ingen vei", async () => {
    await allowed("kontroll: modulen er på", getDoc(doc(treasurer(), "givers/mona")));
    await withoutRules((db) => deleteDoc(doc(db, "cms_settings/addons")));
    await refusedForIndividual(treasurer(), "ingen addons-innstilling");
  });

  test("med individual satt til false kommer kassereren ingen vei til det personlige", async () => {
    await allowed("kontroll: med Google", getDoc(doc(treasurer(), "givers/mona")));
    await withoutRules((db) =>
      setDoc(
        doc(db, `givingAccess/${KARI}`),
        accessDoc({
          personId: "kari",
          name: "Kari Kasserer",
          rights: { overview: true, budget: true },
          version: 1,
          by: STYRET,
          googleId: "google-kari",
        }),
      ),
    );
    await refusedForIndividual(treasurer(), "individual av");
    await allowed("formål med budsjett og oversikt", getDoc(doc(treasurer(), `givingPurposes/${PURPOSE}`)));
  });

  test("uten googleId i tilgangsdokumentet kommer kassereren ingen vei til det personlige", async () => {
    await allowed("kontroll: med Google", getDoc(doc(treasurer(), "givers/mona")));
    await withoutRules((db) =>
      setDoc(doc(db, `givingAccess/${KARI}`), withoutKey(KARI_ACCESS, "googleId")),
    );
    await refusedForIndividual(treasurer(), "uten googleId");
  });

  test("når logins peker på en annen person, kommer kassereren ingen vei", async () => {
    await allowed("kontroll: med Google", getDoc(doc(treasurer(), "givers/mona")));
    await withoutRules((db) => setDoc(doc(db, `logins/${KARI}`), { personId: "lars", role: "member" }));
    await refusedForIndividual(treasurer(), "login peker på lars");
  });

  test("når innloggingen er slettet, kommer kassereren ingen vei", async () => {
    await allowed("kontroll: med Google", getDoc(doc(treasurer(), "givers/mona")));
    await withoutRules((db) => deleteDoc(doc(db, `logins/${KARI}`)));
    await refusedForIndividual(treasurer(), "innlogging slettet");
  });
});

describe("Givertjeneste: bare oversikt", () => {
  test("kan lese formål", async () => {
    const db = google(ODA);
    await allowed("formål", getDoc(doc(db, `givingPurposes/${PURPOSE}`)));
    await allowed("formål, alle", getDocs(collection(db, "givingPurposes")));
  });

  test("kan ikke lese givere, gaver, avtaler, historikk, logg eller personer", async () => {
    const db = google(ODA);
    await allowed("formål, for å vise at innloggingen går", getDocs(collection(db, "givingPurposes")));
    await refused("giver", getDoc(doc(db, "givers/mona")));
    await refused("givere", getDocs(collection(db, "givers")));
    await refused("gave", getDoc(doc(db, "gifts/vipps-123")));
    await refused("gaver", getDocs(collection(db, "gifts")));
    await refused("avtaler", getDocs(collection(db, "giftAgreements")));
    await refused("historikk", getDocs(collection(db, "givingEvents")));
    await refused("logg", getDocs(collection(db, "givingLog")));
    await refused("personer", getDocs(collection(db, "persons")));
  });
});

describe("Givertjeneste: historikken", () => {
  test("en skriving uten historikkpost kommer ingen vei", async () => {
    const db = treasurer();
    const v2 = nextFields(VIPPS_123, "kari", { amountOre: 51000 });
    await refused("gave uten historikk", saveRecord(db, "gift", "vipps-123", v2, "kari", { omitEvent: true }));
    await allowed("samme gave med historikk", saveRecord(db, "gift", "vipps-123", v2, "kari"));
  });

  test("en historikkpost uten skriving kommer ingen vei", async () => {
    const db = treasurer();
    const v2 = nextFields(VIPPS_123, "kari", { amountOre: 51000 });
    await refused("historikk uten gave", saveRecord(db, "gift", "vipps-123", v2, "kari", { omitDoc: true }));
    await allowed("gave og historikk", saveRecord(db, "gift", "vipps-123", v2, "kari"));
  });

  test("historikkposten må ha de samme dataene som dokumentet", async () => {
    const db = treasurer();
    const v2 = nextFields(VIPPS_123, "kari", { amountOre: 51000 });
    await refused(
      "historikk med annet beløp",
      saveRecord(db, "gift", "vipps-123", v2, "kari", { eventData: { ...v2, amountOre: 50000 } }),
    );
    await allowed("historikk med samme data", saveRecord(db, "gift", "vipps-123", v2, "kari"));
  });

  test("et versjonshopp, fra 1 til 3, kommer ingen vei", async () => {
    const db = treasurer();
    const v3 = nextFields(nextFields(VIPPS_123, "kari"), "kari", { amountOre: 51000 });
    await refused("versjon 3 etter 1", saveRecord(db, "gift", "vipps-123", v3, "kari"));
    await allowed("versjon 2", saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { amountOre: 51000 }), "kari"));
  });

  test("en historikkpost som finnes fra før, kan ikke brukes igjen", async () => {
    const db = treasurer();
    await withoutRules((d) =>
      setDoc(doc(d, "givingEvents/gift_vipps-123_2"), {
        kind: "gift",
        docId: "vipps-123",
        version: 2,
        at: NOW,
        by: "kari",
        data: VIPPS_123,
      }),
    );
    const v2 = nextFields(VIPPS_123, "kari", { amountOre: 51000 });
    await refused("gjenbrukt historikkpost", saveRecord(db, "gift", "vipps-123", v2, "kari"));
    await withoutRules((d) => deleteDoc(doc(d, "givingEvents/gift_vipps-123_2")));
    await allowed("samme endring uten den gamle posten", saveRecord(db, "gift", "vipps-123", v2, "kari"));
  });

  test("historikken kan ikke endres eller slettes", async () => {
    const db = treasurer();
    await allowed(
      "ny versjon",
      saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { amountOre: 51000 }), "kari"),
    );
    await refused("historikk v1 endres", updateDoc(doc(db, "givingEvents/gift_vipps-123_1"), { by: "anna" }));
    await refused("historikk v1 slettes", deleteDoc(doc(db, "givingEvents/gift_vipps-123_1")));
    await refused("historikk v2 endres", updateDoc(doc(db, "givingEvents/gift_vipps-123_2"), { by: "anna" }));
    await refused("historikk v2 slettes", deleteDoc(doc(db, "givingEvents/gift_vipps-123_2")));
  });

  test("createdBy og createdAt kan ikke endres", async () => {
    const db = treasurer();
    await refused(
      "createdBy endres",
      saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { createdBy: "anna" }), "kari"),
    );
    await refused(
      "createdAt endres",
      saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { createdAt: LATER }), "kari"),
    );
    await allowed("uendret opprinnelse", saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { amountOre: 51000 }), "kari"));
  });

  test("updatedBy kan ikke være en annen person enn den som skriver", async () => {
    const db = treasurer();
    await refused(
      "updatedBy er anna",
      saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { updatedBy: "anna" }), "kari"),
    );
    await allowed("updatedBy er kari", saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { amountOre: 51000 }), "kari"));
  });
});

describe("Givertjeneste: kontroll av det som skrives", () => {
  test("beløpet må være et helt, positivt antall øre", async () => {
    const db = treasurer();
    for (const amountOre of [0, -100, 10.5, "1000"]) {
      await refused(`beløp ${JSON.stringify(amountOre)}`, saveRecord(db, "gift", "beløp-test", newFields("kari", gift({ amountOre })), "kari"));
    }
    await allowed("beløp 1000", saveRecord(db, "gift", "beløp-test", newFields("kari", gift()), "kari"));
  });

  test("en kjent gave har en giver, og en anonym gave har ingen", async () => {
    const db = treasurer();
    await refused("kjent uten giver", saveRecord(db, "gift", "kjent-test", newFields("kari", gift({ identification: "kjent" })), "kari"));
    await refused("anonym med giver", saveRecord(db, "gift", "anonym-test", newFields("kari", gift({ giverId: "mona" })), "kari"));
    await allowed(
      "kjent med giver",
      saveRecord(db, "gift", "kjent-test", newFields("kari", gift({ identification: "kjent", giverId: "mona" })), "kari"),
    );
    await allowed("anonym uten giver", saveRecord(db, "gift", "anonym-test", newFields("kari", gift()), "kari"));
  });

  test("datoen er ÅÅÅÅ-MM-DD, og året er datoens år", async () => {
    const db = treasurer();
    await refused("dato uten nuller", saveRecord(db, "gift", "dato-test", newFields("kari", gift({ date: "2026-1-3" })), "kari"));
    await refused("år som ikke passer med datoen", saveRecord(db, "gift", "dato-test", newFields("kari", gift({ year: 2025 })), "kari"));
    await allowed("riktig dato og år", saveRecord(db, "gift", "dato-test", newFields("kari", gift()), "kari"));
  });

  test("formålet må finnes", async () => {
    const db = treasurer();
    await refused("ukjent formål", saveRecord(db, "gift", "formål-test", newFields("kari", gift({ purposeId: "finnes-ikke" })), "kari"));
    await allowed("formål som finnes", saveRecord(db, "gift", "formål-test", newFields("kari", gift()), "kari"));
  });

  test("en avtale må høre til samme giver som gaven", async () => {
    const db = treasurer();
    await refused(
      "avtale som hører til en annen giver",
      saveRecord(db, "gift", "avtale-test", newFields("kari", gift({ identification: "kjent", giverId: "mona", agreementId: "avtale-1" })), "kari"),
    );
    await allowed(
      "avtale for samme giver",
      saveRecord(db, "gift", "avtale-test", newFields("kari", gift({ identification: "kjent", giverId: "ekstern-1", agreementId: "avtale-1" })), "kari"),
    );
  });

  test("en gave med en id som finnes fra før, kan ikke opprettes på nytt", async () => {
    const db = treasurer();
    await refused(
      "ny gave med id vipps-123",
      saveRecord(db, "gift", "vipps-123", newFields("kari", gift({ identification: "kjent", giverId: "mona" })), "kari"),
    );
    await allowed(
      "ny gave med ny id",
      saveRecord(db, "gift", "vipps-124", newFields("kari", gift({ identification: "kjent", giverId: "mona" })), "kari"),
    );
  });

  test("en annullert gave kan ikke endres", async () => {
    const db = treasurer();
    await allowed(
      "gave endres",
      saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { amountOre: 51000 }), "kari"),
    );
    await refused(
      "annullert gave endres",
      saveRecord(db, "gift", "gave-annullert", nextFields(ANNULLERT_2, "kari", { amountOre: 21000 }), "kari"),
    );
  });

  test("kilde, externalRef og importId kan ikke endres", async () => {
    const db = treasurer();
    const bank = newFields("kari", gift({ source: "bank", identification: "uidentifisert", externalRef: "EXT-1", importId: "IMP-1" }));
    await allowed("bankgave opprettes", saveRecord(db, "gift", "bank-1", bank, "kari"));
    await refused("kilde endres", saveRecord(db, "gift", "bank-1", nextFields(bank, "kari", { source: "vipps" }), "kari"));
    await refused("externalRef endres", saveRecord(db, "gift", "bank-1", nextFields(bank, "kari", { externalRef: "EXT-2" }), "kari"));
    await refused("importId endres", saveRecord(db, "gift", "bank-1", nextFields(bank, "kari", { importId: "IMP-2" }), "kari"));
    await allowed("notat endres", saveRecord(db, "gift", "bank-1", nextFields(bank, "kari", { payerText: "Gave" }), "kari"));
  });

  test("gaver, givere og avtaler kan ikke slettes", async () => {
    const db = treasurer();
    await allowed(
      "gave med ny versjon",
      saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { amountOre: 51000 }), "kari"),
    );
    await refused("gave slettes", deleteDoc(doc(db, "gifts/vipps-123")));
    await refused("giver slettes", deleteDoc(doc(db, "givers/ekstern-1")));
    await refused("avtale slettes", deleteDoc(doc(db, "giftAgreements/avtale-1")));
  });

  test("annullering krever en grunn", async () => {
    const db = treasurer();
    await refused(
      "annullert uten grunn",
      saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { status: "annullert" }), "kari"),
    );
    await allowed(
      "annullert med grunn",
      saveRecord(db, "gift", "vipps-123", nextFields(VIPPS_123, "kari", { status: "annullert", voidReason: "Dobbelregistrert" }), "kari"),
    );
  });

  test("en personknyttet giver har personens id, og ingen e-post eller telefon", async () => {
    const db = treasurer();
    await refused(
      "giver med annen dokument-id enn personen",
      saveRecord(db, "giver", "ny-kobling", newFields("kari", { personId: "lars", name: "Lars Leder", active: true }), "kari"),
    );
    await allowed(
      "giver med personens id",
      saveRecord(db, "giver", "lars", newFields("kari", { personId: "lars", name: "Lars Leder", active: true }), "kari"),
    );
  });

  test("en personknyttet giver kan ikke ha e-post", async () => {
    const db = treasurer();
    await refused(
      "personknyttet giver med e-post",
      saveRecord(db, "giver", "lars", newFields("kari", { personId: "lars", name: "Lars Leder", active: true, email: LARS }), "kari"),
    );
    await allowed(
      "personknyttet giver uten e-post",
      saveRecord(db, "giver", "lars", newFields("kari", { personId: "lars", name: "Lars Leder", active: true }), "kari"),
    );
  });

  test("en personknyttet giver kan ikke ha telefon", async () => {
    const db = treasurer();
    await refused(
      "personknyttet giver med telefon",
      saveRecord(db, "giver", "lars", newFields("kari", { personId: "lars", name: "Lars Leder", active: true, phone: "12345678" }), "kari"),
    );
    await allowed(
      "personknyttet giver uten telefon",
      saveRecord(db, "giver", "lars", newFields("kari", { personId: "lars", name: "Lars Leder", active: true }), "kari"),
    );
  });

  test("personen må finnes i registeret", async () => {
    const db = treasurer();
    await refused(
      "giver til en person som ikke finnes",
      saveRecord(db, "giver", "finnes-ikke", newFields("kari", { personId: "finnes-ikke", name: "Ingen", active: true }), "kari"),
    );
    await allowed(
      "giver til en person som finnes",
      saveRecord(db, "giver", "nils", newFields("kari", { personId: "nils", name: "Nils Nordmann", active: true }), "kari"),
    );
  });

  test("personknytningen til en giver kan ikke endres når den er satt", async () => {
    const db = treasurer();
    await refused(
      "giver mona knyttes til lars",
      saveRecord(db, "giver", "mona", nextFields(MONA_GIVER, "kari", { personId: "lars" }), "kari"),
    );
    await allowed(
      "giver mona med samme person",
      saveRecord(db, "giver", "mona", nextFields(MONA_GIVER, "kari", { name: "Mona Medlem" }), "kari"),
    );
  });

  test("datoene i en avtale: slutt kan ikke være før start", async () => {
    const db = treasurer();
    const base = { giverId: "mona", purposeId: PURPOSE, amountOre: 10000, frequency: "ar", startDate: "2026-06-01", method: "bank", status: "aktiv" };
    await refused(
      "slutt før start",
      saveRecord(db, "agreement", "avtale-3", newFields("kari", { ...base, endDate: "2026-03-01" }), "kari"),
    );
    await allowed(
      "slutt etter start",
      saveRecord(db, "agreement", "avtale-3", newFields("kari", { ...base, endDate: "2026-12-31" }), "kari"),
    );
  });

  test("giveren til en avtale kan ikke endres", async () => {
    const db = treasurer();
    await refused("avtale får ny giver", saveRecord(db, "agreement", "avtale-1", nextFields(AVTALE_1, "kari", { giverId: "mona" }), "kari"));
    await allowed("avtale med ny status", saveRecord(db, "agreement", "avtale-1", nextFields(AVTALE_1, "kari", { status: "pause" }), "kari"));
  });
});

describe("Givertjeneste: tilganger som styret gir", () => {
  test("styret kan gi nils en rett uten Google-id", async () => {
    await allowed("gi nils en rett", saveAccess(manager(), NILS, grantNils("styret"), "styret", { action: "grant" }));
  });

  test("styret kan ikke gi en rett under sin egen adresse, eller til sin egen person under en annen adresse", async () => {
    const db = manager();
    await refused(
      "egen adresse",
      saveAccess(db, STYRET, accessDoc({ personId: "styret", name: "Sigrid Styremedlem", rights: { overview: true }, version: 1, by: "styret" }), "styret", { action: "grant" }),
    );
    await refused(
      "egen person under en annen adresse",
      saveAccess(db, STYRET_2, accessDoc({ personId: "styret", name: "Sigrid Styremedlem", rights: { overview: true }, version: 1, by: "styret" }), "styret", { action: "grant" }),
    );
    await allowed("nils", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant" }));
  });

  test("personId må være den som adressen er innlogget som", async () => {
    const db = manager();
    await refused(
      "personId er mona, men innloggingen er nils",
      saveAccess(db, NILS, accessDoc({ personId: "mona", name: "Nils Nordmann", rights: { overview: true }, version: 1, by: "styret" }), "styret", { action: "grant" }),
    );
    await allowed("personId er nils", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant" }));
  });

  test("ved opprettelse kan googleId ikke være satt", async () => {
    const db = manager();
    await refused(
      "googleId satt",
      saveAccess(db, NILS, accessDoc({ personId: "nils", name: "Nils Nordmann", rights: { overview: true }, version: 1, by: "styret", googleId: "google-nils" }), "styret", { action: "grant" }),
    );
    await allowed("uten googleId", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant" }));
  });

  test("en rett gis ikke uten loggpost", async () => {
    const db = manager();
    await refused("uten logg", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant", omitLog: true }));
    await allowed("med logg", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant" }));
  });

  test("adressen må være med små bokstaver", async () => {
    const db = manager();
    // The login under the capital letters is in place, so that only the letters make the difference
    await withoutRules((d) => setDoc(doc(d, "logins/Nils@eksempel.no"), { personId: "nils", role: "member" }));
    await refused("store bokstaver i adressen", saveAccess(db, "Nils@eksempel.no", grantNils("styret"), "styret", { action: "grant" }));
    await allowed("små bokstaver i adressen", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant" }));
  });

  test("tilgangsdokumentet har nøyaktig feltene som skal være der, verken færre eller flere", async () => {
    const db = manager();
    await refused(
      "mangler budget",
      saveAccess(db, NILS, withoutKey(grantNils("styret"), "budget"), "styret", { action: "grant" }),
    );
    await refused(
      "har et ekstra felt",
      saveAccess(db, NILS, { ...grantNils("styret"), note: "Ekstra" }, "styret", { action: "grant" }),
    );
    await allowed("alle felt", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant" }));
  });

  test("endring av en rett gir versjon 2, og styret kan ikke sette googleId", async () => {
    const db = manager();
    await allowed("gi nils", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant" }));
    const v2 = nextFields(grantNils("styret"), "styret", { budget: true });
    await allowed("endre rettighetene", saveAccess(db, NILS, v2, "styret", { action: "change" }));
    await refused(
      "sette googleId",
      saveAccess(db, NILS, nextFields(v2, "styret", { googleId: "google-nils" }), "styret", { action: "change" }),
    );
    await allowed("samme endring uten googleId", saveAccess(db, NILS, nextFields(v2, "styret"), "styret", { action: "change" }));
  });

  test("googleId kan fjernes, slik at personen tar rettighetene i bruk på nytt", async () => {
    await allowed(
      "fjern googleId fra kari",
      saveAccess(manager(), KARI, nextFields(KARI_ACCESS, "styret", {}, ["googleId"]), "styret", { action: "change" }),
    );
  });

  test("alle rettigheter kan tas bort, også når innloggingen er slettet", async () => {
    await withoutRules((db) => deleteDoc(doc(db, `logins/${ODA}`)));
    await allowed(
      "ta alle rettighetene fra oda",
      saveAccess(manager(), ODA, nextFields(ODA_ACCESS, "styret", { overview: false }), "styret", { action: "change" }),
    );
  });

  test("en rett kan ikke gis når innloggingen er slettet", async () => {
    const db = manager();
    const v2 = nextFields(ODA_ACCESS, "styret", { budget: true });
    await allowed("oda får budsjett, innloggingen finnes", saveAccess(db, ODA, v2, "styret", { action: "change" }));
    await withoutRules((d) => deleteDoc(doc(d, `logins/${ODA}`)));
    await refused(
      "oda får individuell rett, innloggingen er slettet",
      saveAccess(db, ODA, nextFields(v2, "styret", { individual: true }), "styret", { action: "change" }),
    );
  });

  test("et tilgangsdokument kan ikke slettes", async () => {
    const db = manager();
    await allowed("gi nils", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant" }));
    await refused("slett nils", deleteDoc(doc(db, `givingAccess/${NILS}`)));
  });

  test("styret ser ikke givere eller gaver", async () => {
    const db = manager();
    await allowed("styret leser rettighetene", getDocs(collection(db, "givingAccess")));
    await refused("givere", getDocs(collection(db, "givers")));
    await refused("gave", getDoc(doc(db, "gifts/vipps-123")));
  });

  test("styret kan hente én innlogging, men ikke liste dem", async () => {
    const db = manager();
    await allowed("én innlogging", getDoc(doc(db, `logins/${MONA}`)));
    await refused("alle innlogginger", getDocs(collection(db, "logins")));
  });

  test("styret kan liste rettighetene og lese loggen; oda og kari kan ikke", async () => {
    await allowed("gi nils", saveAccess(manager(), NILS, grantNils("styret"), "styret", { action: "grant" }));
    await allowed("styret lister rettighetene", getDocs(collection(manager(), "givingAccess")));
    await allowed("styret leser loggen", getDocs(collection(manager(), "givingLog")));
    await refused("oda lister rettighetene", getDocs(collection(google(ODA), "givingAccess")));
    await refused("oda leser loggen", getDocs(collection(google(ODA), "givingLog")));
    await refused("kari lister rettighetene", getDocs(collection(treasurer(), "givingAccess")));
    await refused("kari leser loggen", getDocs(collection(treasurer(), "givingLog")));
  });
});

describe("Givertjeneste: å ta tilgangen i bruk", () => {
  /** The rights of nils as they stand after a grant by the manager, without a Google id */
  const nilsActivation = (fields: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...accessDoc({ personId: "nils", name: "Nils Nordmann", rights: { overview: true }, version: 2, by: "nils", googleId: "google-nils", at: LATER }),
    ...fields,
  });

  const grantedNils = () => saveAccess(manager(), NILS, grantNils("styret"), "styret", { action: "grant" });

  test("nils tar tilgangen i bruk med Google", async () => {
    await allowed("gi nils uten Google-id", grantedNils());
    await allowed(
      "nils tar i bruk",
      saveAccess(google(NILS), NILS, nilsActivation(), "nils", { action: "activate" }),
    );
  });

  test("tilgangen kan ikke tas i bruk med passord eller med e-postlenke", async () => {
    await grantedNils();
    // The Google id is in the token, so that only the way of signing in makes the difference
    await refused(
      "med passord",
      saveAccess(session(NILS, "password", "google-nils"), NILS, nilsActivation(), "nils", { action: "activate" }),
    );
    await refused(
      "med e-postlenke",
      saveAccess(session(NILS, "custom", "google-nils"), NILS, nilsActivation(), "nils", { action: "activate" }),
    );
    await allowed(
      "med Google",
      saveAccess(google(NILS), NILS, nilsActivation(), "nils", { action: "activate" }),
    );
  });

  test("googleId må være personens egen Google-konto", async () => {
    await grantedNils();
    await refused(
      "googleId som ikke er ens egen",
      saveAccess(google(NILS), NILS, nilsActivation({ googleId: "google-annen" }), "nils", { action: "activate" }),
    );
    await allowed("egen googleId", saveAccess(google(NILS), NILS, nilsActivation(), "nils", { action: "activate" }));
  });

  test("navnet må være det samme som på personkortet", async () => {
    await grantedNils();
    await refused(
      "navn som ikke er personkortets",
      saveAccess(google(NILS), NILS, nilsActivation({ name: "N. Nordmann" }), "nils", { action: "activate" }),
    );
    await allowed("navn som personkortet", saveAccess(google(NILS), NILS, nilsActivation(), "nils", { action: "activate" }));
  });

  test("en rett kan ikke endres i samme skriving som tilgangen tas i bruk", async () => {
    await grantedNils();
    await refused(
      "budsjett settes samtidig",
      saveAccess(google(NILS), NILS, nilsActivation({ budget: true }), "nils", { action: "activate" }),
    );
    await allowed("uten endring av rett", saveAccess(google(NILS), NILS, nilsActivation(), "nils", { action: "activate" }));
  });

  test("tilgangen kan bare tas i bruk én gang", async () => {
    await grantedNils();
    await allowed("første gang", saveAccess(google(NILS), NILS, nilsActivation(), "nils", { action: "activate" }));
    await refused(
      "andre gang",
      saveAccess(google(NILS), NILS, nextFields(nilsActivation(), "nils"), "nils", { action: "change" }),
    );
  });

  test("en annen person kan ikke ta tilgangen i bruk", async () => {
    await grantedNils();
    await refused(
      "kari tar nils sin tilgang i bruk",
      saveAccess(
        treasurer(),
        NILS,
        accessDoc({ personId: "nils", name: "Nils Nordmann", rights: { overview: true }, version: 2, by: "kari", googleId: "google-kari", at: LATER }),
        "kari",
        { action: "activate" },
      ),
    );
    await allowed("nils tar i bruk", saveAccess(google(NILS), NILS, nilsActivation(), "nils", { action: "activate" }));
  });

  test("når logins peker på en annen person, kan tilgangen ikke tas i bruk", async () => {
    await grantedNils();
    await withoutRules((db) => setDoc(doc(db, `logins/${NILS}`), { personId: "mona", role: "member" }));
    await refused("login peker på mona", saveAccess(google(NILS), NILS, nilsActivation(), "nils", { action: "activate" }));
    await withoutRules((db) => setDoc(doc(db, `logins/${NILS}`), { personId: "nils", role: "member" }));
    await allowed("login peker på nils igjen", saveAccess(google(NILS), NILS, nilsActivation(), "nils", { action: "activate" }));
  });

  test("den første rettighetshaveren, lagt inn for hånd, tar tilgangen i bruk med Google", async () => {
    const olaActivation = (fields: Record<string, unknown> = {}) => ({
      ...accessDoc({ personId: "ola", name: "Ola Bootstrap", rights: { manage: true }, version: 2, by: "ola", googleId: "google-ola", at: LATER }),
      ...fields,
    });
    await refused("med passord", saveAccess(session(OLA, "password", "google-ola"), OLA, olaActivation(), "ola", { action: "activate" }));
    await allowed("med Google", saveAccess(google(OLA), OLA, olaActivation(), "ola", { action: "activate" }));
  });

  test("hver adresse kan hente sitt eget tilgangsdokument med alle innloggingsmåter, men ikke et annet", async () => {
    const pairs: Array<[string, string]> = [
      [KARI, ODA],
      [ODA, KARI],
      [STYRET, KARI],
    ];
    for (const [own, other] of pairs) {
      for (const db of [session(own), session(own, "custom"), google(own)]) {
        await allowed(`${own} ser sitt eget`, getDoc(doc(db, `givingAccess/${own}`)));
        await refused(`${own} ser ${other}`, getDoc(doc(db, `givingAccess/${other}`)));
      }
    }
  });
});

describe("Givertjeneste: loggen over tilganger", () => {
  test("en loggpost uten en reell endring av tilgangsdokumentet kommer ingen vei", async () => {
    await refused(
      "logg for kari, uten at dokumentet endres",
      saveAccess(manager(), KARI, KARI_ACCESS, "styret", { action: "change", omitDoc: true }),
    );
    await allowed(
      "endring av kari med logg",
      saveAccess(manager(), KARI, nextFields(KARI_ACCESS, "styret", { budget: false }), "styret", { action: "change" }),
    );
  });

  test("loggen kan ikke endres eller slettes", async () => {
    const db = manager();
    await allowed("gi nils", saveAccess(db, NILS, grantNils("styret"), "styret", { action: "grant" }));
    await refused("endre loggen", updateDoc(doc(db, `givingLog/access_${NILS}_1`), { by: "anna" }));
    await refused("slette loggen", deleteDoc(doc(db, `givingLog/access_${NILS}_1`)));
  });
});
