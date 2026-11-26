import { beforeEach, describe, expect, test, vi } from "vitest";
import { GIVING_ACCESS_COLLECTION, GIVING_LOG_COLLECTION, LOGINS_COLLECTION } from "../src/data/collections";
import type { GivingAccess } from "../src/utils/giving/access";

// What the access service writes and reads, with Firestore mocked: the document and its log entry in one batch.
// Everything here is made up.

const firestore = vi.hoisted(() => ({
  batches: [] as { set: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> }[],
  logins: {} as Record<string, { personId: string }>,
}));

vi.mock("../src/firebase", () => ({ db: { name: "test-db" } }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ collection: name }),
  doc: (_db: unknown, collection: string, id: string) => ({ collection, id }),
  serverTimestamp: () => "SERVER_TIME",
  writeBatch: () => {
    const batch = { set: vi.fn(), commit: vi.fn(async () => undefined) };
    firestore.batches.push(batch);
    return batch;
  },
  getDoc: vi.fn(async (ref: { collection: string; id: string }) => {
    const login = firestore.logins[ref.id];
    return { exists: () => login !== undefined, data: () => login };
  }),
  onSnapshot: vi.fn(),
}));

import { lookupLoginPersonId, saveAccess } from "../src/services/giving/access";

const ola: GivingAccess = {
  address: "Ola@Eksempel.no",
  personId: "ola",
  name: "Ola Hansen",
  overview: true,
  budget: false,
  individual: true,
  manage: false,
  googleId: "google-ola",
  version: 3,
  updatedAt: "2026-11-20T10:00:00.000Z",
  updatedBy: "kari",
};

beforeEach(() => {
  firestore.batches = [];
  firestore.logins = { "ola@eksempel.no": { personId: "ola" } };
});

describe("Lagringen av en tilgang", () => {
  test("dokumentet settes uten adressen inni, og loggen får nøyaktig det samme dokumentet", async () => {
    await saveAccess(ola, "change", "kari");

    expect(firestore.batches).toHaveLength(1);
    const [batch] = firestore.batches;
    expect(batch.commit).toHaveBeenCalledTimes(1);
    const [documentCall, logCall] = batch.set.mock.calls;

    const [documentRef, document] = documentCall;
    expect(documentRef).toEqual({ collection: GIVING_ACCESS_COLLECTION, id: "ola@eksempel.no" });
    expect(Object.keys(document).sort()).toEqual(
      ["googleId", "individual", "manage", "name", "overview", "budget", "personId", "updatedAt", "updatedBy", "version"].sort()
    );
    expect("address" in document).toBe(false);

    const [logRef, entry] = logCall;
    expect(logRef).toEqual({ collection: GIVING_LOG_COLLECTION, id: "access_ola@eksempel.no_3" });
    expect(entry).toEqual({
      action: "change",
      target: "ola@eksempel.no",
      version: 3,
      at: "SERVER_TIME",
      by: "kari",
      access: document,
    });
  });

  test("en tilgang uten Google-konto får ingen googleId i dokumentet", async () => {
    await saveAccess({ ...ola, googleId: undefined }, "grant", "kari");

    const document = firestore.batches[0].set.mock.calls[0][1];
    expect("googleId" in document).toBe(false);
  });

  test("en tilgang uten tidspunkt sendes ikke", async () => {
    await expect(saveAccess({ ...ola, updatedAt: undefined }, "change", "kari")).rejects.toThrow();
    expect(firestore.batches).toHaveLength(0);
  });
});

describe("Innloggingen til en adresse", () => {
  test("finner personen som adressen logger inn som", async () => {
    expect(await lookupLoginPersonId("Ola@Eksempel.no ")).toBe("ola");
    expect(LOGINS_COLLECTION).toBe("logins");
  });

  test("en adresse uten innlogging gir ingen person", async () => {
    expect(await lookupLoginPersonId("ukjent@eksempel.no")).toBeNull();
  });
});
