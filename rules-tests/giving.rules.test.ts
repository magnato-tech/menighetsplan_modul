import { readFileSync } from "node:fs";
import { buildGivingPurpose } from "../src/data/newDocuments";
import type { GivingPurposeUsage } from "../src/utils/giving/purposes";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, type Firestore } from "firebase/firestore";

// The rules for gift purposes (givingPurposes) in ../firestore.rules, run against Firebase's local emulator, asked
// the way src/services/giving/purposes.ts asks. Everyone here is made up.
//
//   npm test        (in this folder; starts the emulators, runs this, stops them)

let env: RulesTestEnvironment;

const signedIn = (email: string, verified = true): Firestore =>
  env.authenticatedContext(`uid-${email}`, { email, email_verified: verified }).firestore() as unknown as Firestore;

/** Someone who is not signed in */
const visitor = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;
/** Signed in with a confirmed address that nobody in the register has */
const stranger = (): Firestore => signedIn("fremmed@eksempel.no");
/** Administrator, with an address that has not been confirmed */
const unconfirmedAdmin = (): Firestore => signedIn("anna@menigheten.no", false);
/** Administrator */
const admin = (): Firestore => signedIn("anna@menigheten.no");
/** A plain member */
const member = (): Firestore => signedIn("mona@eksempel.no");
/** Leader of group-lyd */
const leader = (): Firestore => signedIn("lars@eksempel.no");
/** Web editor (nettredaktør) */
const editor = (): Firestore => signedIn("rolf@eksempel.no");
/** Membership clerk (medlemsansvarlig) */
const clerk = (): Firestore => signedIn("kari@eksempel.no");

const NOW = "2026-11-26T10:00:00.000Z";
const PURPOSE = "purpose-1";

/** The fields a new purpose is stored with: the real builder, without the id, which is the document's place. */
const newPurpose = (name = "Misjon i Afrika", usage: GivingPurposeUsage = "oremerket") => {
  const { id, ...fields } = buildGivingPurpose({ name, usage }, "anna", new Date(NOW));
  return { path: `givingPurposes/${id}`, fields };
};

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
      put("persons/anna", { name: "Anna Administrator", email: "anna@menigheten.no", globalRole: "admin" }),
      put("logins/anna@menigheten.no", { personId: "anna", role: "admin" }),
      put("persons/mona", { name: "Mona Medlem", email: "mona@eksempel.no", globalRole: "member" }),
      put("logins/mona@eksempel.no", { personId: "mona", role: "member" }),
      put("persons/lars", { name: "Lars Leder", email: "lars@eksempel.no", globalRole: "member" }),
      put("logins/lars@eksempel.no", { personId: "lars", role: "member" }),
      put("groups/gruppe-lyd", { name: "Lyd og bilde", isPublic: true, leaderIds: ["lars"], memberIds: ["mona"] }),
      put("persons/rolf", { name: "Rolf Redaktør", email: "rolf@eksempel.no", globalRole: "nettredaktor" }),
      put("logins/rolf@eksempel.no", { personId: "rolf", role: "nettredaktor" }),
      put("persons/kari", { name: "Kari Kasserer", email: "kari@eksempel.no", globalRole: "member", membershipClerk: true }),
      put("logins/kari@eksempel.no", { personId: "kari", role: "member" }),
      put(`givingPurposes/${PURPOSE}`, {
        name: "Kirkens arbeid",
        usage: "drift",
        active: true,
        createdAt: NOW,
        updatedAt: NOW,
        updatedBy: "anna",
      }),
    ]);
  });
});

describe("Gaveformål: den som ikke er administrator", () => {
  test("en besøkende, en innlogget som ikke står i registeret, og en administrator med ubekreftet e-post kommer ingen vei", async () => {
    for (const db of [visitor(), stranger(), unconfirmedAdmin()]) {
      await assertFails(getDoc(doc(db, `givingPurposes/${PURPOSE}`)));
      await assertFails(getDocs(collection(db, "givingPurposes")));
      const fresh = newPurpose();
      await assertFails(setDoc(doc(db, fresh.path), fresh.fields));
      await assertFails(updateDoc(doc(db, `givingPurposes/${PURPOSE}`), { active: false, updatedAt: NOW, updatedBy: "anna" }));
      await assertFails(deleteDoc(doc(db, `givingPurposes/${PURPOSE}`)));
    }
  });

  test("et vanlig medlem, en gruppeleder, en nettredaktør og en medlemsansvarlig kommer ingen vei", async () => {
    for (const db of [member(), leader(), editor(), clerk()]) {
      await assertFails(getDoc(doc(db, `givingPurposes/${PURPOSE}`)));
      await assertFails(getDocs(collection(db, "givingPurposes")));
      const fresh = newPurpose();
      await assertFails(setDoc(doc(db, fresh.path), fresh.fields));
      await assertFails(updateDoc(doc(db, `givingPurposes/${PURPOSE}`), { name: "Annet navn", updatedAt: NOW, updatedBy: "mona" }));
      await assertFails(deleteDoc(doc(db, `givingPurposes/${PURPOSE}`)));
    }
  });
});

describe("Gaveformål: administratoren", () => {
  test("ser listen, legger inn et nytt formål, endrer navnet og deaktiverer et formål", async () => {
    await assertSucceeds(getDoc(doc(admin(), `givingPurposes/${PURPOSE}`)));
    await assertSucceeds(getDocs(collection(admin(), "givingPurposes")));
    const fresh = newPurpose();
    await assertSucceeds(setDoc(doc(admin(), fresh.path), fresh.fields));
    await assertSucceeds(updateDoc(doc(admin(), `givingPurposes/${PURPOSE}`), { name: "Kirkens arbeid i byen", updatedAt: NOW, updatedBy: "anna" }));
    await assertSucceeds(updateDoc(doc(admin(), `givingPurposes/${PURPOSE}`), { active: false, updatedAt: NOW, updatedBy: "anna" }));
  });

  test("et navn på 80 tegn er lov", async () => {
    const fresh = newPurpose("B".repeat(80));
    await assertSucceeds(setDoc(doc(admin(), fresh.path), fresh.fields));
  });

  test("kan ikke slette et formål", async () => {
    await assertFails(deleteDoc(doc(admin(), `givingPurposes/${PURPOSE}`)));
  });

  test("kan ikke endre hvilken bruk et formål har", async () => {
    await assertFails(updateDoc(doc(admin(), `givingPurposes/${PURPOSE}`), { usage: "oremerket", updatedAt: NOW, updatedBy: "anna" }));
  });

  test("kan ikke endre når et formål er opprettet", async () => {
    await assertFails(updateDoc(doc(admin(), `givingPurposes/${PURPOSE}`), { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: NOW, updatedBy: "anna" }));
  });

  test("kan ikke legge til et felt", async () => {
    const fresh = newPurpose();
    await assertFails(setDoc(doc(admin(), fresh.path), { ...fresh.fields, note: "Ekstra" }));
  });

  test("kan ikke lagre uten et felt", async () => {
    const fresh = newPurpose();
    const fields: Record<string, unknown> = { ...fresh.fields };
    delete fields.createdAt;
    await assertFails(setDoc(doc(admin(), fresh.path), fields));
  });

  test("kan ikke lagre et tomt navn", async () => {
    const fresh = newPurpose();
    await assertFails(setDoc(doc(admin(), fresh.path), { ...fresh.fields, name: "" }));
  });

  test("kan ikke lagre et navn på 81 tegn", async () => {
    const fresh = newPurpose();
    await assertFails(setDoc(doc(admin(), fresh.path), { ...fresh.fields, name: "C".repeat(81) }));
  });

  test("kan ikke lagre en bruk som ikke finnes, som «annet»", async () => {
    const fresh = newPurpose();
    await assertFails(setDoc(doc(admin(), fresh.path), { ...fresh.fields, usage: "annet" }));
  });

  test("kan ikke lagre «aktiv» som tekst", async () => {
    const fresh = newPurpose();
    await assertFails(setDoc(doc(admin(), fresh.path), { ...fresh.fields, active: "ja" }));
  });

  test("kan ikke sette en annen person som den som endret formålet", async () => {
    const fresh = newPurpose();
    await assertFails(setDoc(doc(admin(), fresh.path), { ...fresh.fields, updatedBy: "mona" }));
    await assertFails(updateDoc(doc(admin(), `givingPurposes/${PURPOSE}`), { name: "Annet navn", updatedAt: NOW, updatedBy: "mona" }));
  });
});
