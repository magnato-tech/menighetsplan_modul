import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, type Firestore } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadString, type FirebaseStorage } from "firebase/storage";

// The rules in ../storage.rules, run against Firebase's local emulators. Who is an administrator
// is looked up in the database, so both emulators are running.

let env: RulesTestEnvironment;

const signedIn = (email: string, verified = true): FirebaseStorage =>
  env.authenticatedContext(`uid-${email}`, { email, email_verified: verified }).storage() as unknown as FirebaseStorage;
const visitor = (): FirebaseStorage => env.unauthenticatedContext().storage() as unknown as FirebaseStorage;

const PICTURE = "media/bilde-1/stor.webp";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-menighetsplan-regler",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
    storage: { rules: readFileSync(new URL("../storage.rules", import.meta.url), "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, "logins/kari@menigheten.no"), { personId: "kari", role: "admin" });
    await setDoc(doc(db, "logins/hakon@eksempel.no"), { personId: "hakon", role: "member" });
    await uploadString(ref(context.storage() as unknown as FirebaseStorage, PICTURE), "bilde");
  });
});

describe("Bildene og filene i mediebiblioteket", () => {
  test("kan ses av alle", async () => {
    await assertSucceeds(getBytes(ref(visitor(), PICTURE)));
    await assertSucceeds(getBytes(ref(signedIn("hakon@eksempel.no"), PICTURE)));
  });

  test("kan bare lastes opp og slettes av en administrator", async () => {
    await assertFails(uploadString(ref(visitor(), "media/ny/stor.webp"), "bilde"));
    await assertFails(deleteObject(ref(visitor(), PICTURE)));
    await assertFails(uploadString(ref(signedIn("fremmed@eksempel.no"), "media/ny/stor.webp"), "bilde"));
    await assertFails(uploadString(ref(signedIn("hakon@eksempel.no"), "media/ny/stor.webp"), "bilde"));
    await assertFails(uploadString(ref(signedIn("hakon@eksempel.no"), PICTURE), "byttet"));
    await assertFails(deleteObject(ref(signedIn("hakon@eksempel.no"), PICTURE)));
    await assertFails(uploadString(ref(signedIn("kari@menigheten.no", false), "media/ny/stor.webp"), "bilde"));

    await assertSucceeds(uploadString(ref(signedIn("Kari@Menigheten.no"), "media/ny/stor.webp"), "bilde"));
    await assertSucceeds(deleteObject(ref(signedIn("kari@menigheten.no"), PICTURE)));
  });

  test("ingenting kan legges utenfor mediebiblioteket", async () => {
    await assertFails(uploadString(ref(signedIn("kari@menigheten.no"), "annet/fil.txt"), "tekst"));
    await assertFails(getBytes(ref(visitor(), "annet/fil.txt")));
  });
});
