import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  generateTestdata,
  generate32TestPersons,
  clearTestdata,
  deletePersonsTestdata,
  deleteGroupsTestdata,
  deleteRolesTestdata,
  clearPlannerTestData,
} from "../services/testdataService";
import { COLLECTIONS, CMS_COLLECTIONS } from "../data/collections";

// Mock firebase/firestore
vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<any>("firebase/firestore");
  return {
    ...actual,
    collection: vi.fn((_db, name) => ({ id: name, path: name })),
    doc: vi.fn((_db, coll, id) => ({ id, path: `${coll}/${id}` })),
    getDocs: vi.fn(async (collRef) => {
      const makeDoc = (suffix: string, data: Record<string, unknown> = {}) => ({
        id: `${collRef.id}-${suffix}`,
        ref: { path: `${collRef.id}/${collRef.id}-${suffix}` },
        data: () => data,
      });
      const docs =
        collRef.id === "cms_settings"
          ? [
              makeDoc("1", { recordType: "volunteerRole", name: "Lydtekniker" }),
              makeDoc("2", { recordType: "volunteerRole", name: "Kjøkken" }),
            ]
          : [makeDoc("1"), makeDoc("2")];
      return {
        empty: false,
        size: docs.length,
        docs,
      };
    }),
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("testdataService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generateTestdata genererer testdata og skriver til Firestore med referanseintegritet", async () => {
    const result = await generateTestdata({
      personCount: 32,
      groupCount: 14,
      roleCount: 15,
      clearExisting: false,
    });

    expect(result.success).toBe(true);
    expect(result.counts[COLLECTIONS.PERSONS]).toBe(32);
    expect(result.counts[COLLECTIONS.GROUPS]).toBe(14);
    expect(result.failures).toHaveLength(0);
    expect(result.counts[COLLECTIONS.VOLUNTEER_ROLES]).toBe(12);
    expect(result.total).toBeGreaterThan(44);
  });

  test("generate32TestPersons genererer nøyaktig 32 testpersoner", async () => {
    const result = await generate32TestPersons({ clearExisting: false });

    expect(result.success).toBe(true);
    expect(result.counts[COLLECTIONS.PERSONS]).toBe(32);
    expect(result.counts[COLLECTIONS.GROUPS]).toBe(14);
  });

  test("clearTestdata sletter kun planlegger-samlinger og bevarer CMS-innhold", async () => {
    const result = await clearTestdata();

    expect(result.success).toBe(true);
    expect(result.failures).toHaveLength(0);

    // Verifiser at CMS-samlinger IKKE er berørt i slettingen
    const deletedCollections = Object.keys(result.counts);
    for (const cmsColl of Object.values(CMS_COLLECTIONS)) {
      expect(deletedCollections).not.toContain(cmsColl);
    }

    // Verifiser at planlegger-samlinger ble slettet
    expect(deletedCollections).toContain(COLLECTIONS.PERSONS);
    expect(deletedCollections).toContain(COLLECTIONS.GROUPS);
    expect(deletedCollections).toContain(COLLECTIONS.ASSIGNMENTS);
    expect(deletedCollections).toContain(COLLECTIONS.VOLUNTEER_ROLES);
  });

  test("deleteRolesTestdata sletter også rollebiblioteket", async () => {
    const result = await deleteRolesTestdata();
    expect(result.success).toBe(true);
    expect(Object.keys(result.counts)).toContain(COLLECTIONS.VOLUNTEER_ROLES);
  });

  test("clearPlannerTestData fungerer som alias for total planleggertømming", async () => {
    const result = await clearPlannerTestData();
    expect(result.success).toBe(true);
    expect(result.counts[COLLECTIONS.PERSONS]).toBeDefined();
    expect(result.counts[COLLECTIONS.GROUPS]).toBeDefined();
  });

  test("deletePersonsTestdata sletter kun personer og tildelinger", async () => {
    const result = await deletePersonsTestdata();
    expect(result.success).toBe(true);
    const deleted = Object.keys(result.counts);
    expect(deleted).toContain(COLLECTIONS.PERSONS);
    expect(deleted).toContain(COLLECTIONS.ASSIGNMENTS);
    expect(deleted).not.toContain(COLLECTIONS.GROUPS);
    expect(deleted).not.toContain(COLLECTIONS.GATHERINGS);
  });

  test("deleteGroupsTestdata sletter kun grupper, samlinger og oppgaver", async () => {
    const result = await deleteGroupsTestdata();
    expect(result.success).toBe(true);
    const deleted = Object.keys(result.counts);
    expect(deleted).toContain(COLLECTIONS.GROUPS);
    expect(deleted).toContain(COLLECTIONS.GATHERINGS);
    expect(deleted).toContain(COLLECTIONS.TASKS);
    expect(deleted).not.toContain(COLLECTIONS.PERSONS);
  });

  test("deleteRolesTestdata sletter kun roller og tildelinger", async () => {
    const result = await deleteRolesTestdata();
    expect(result.success).toBe(true);
    const deleted = Object.keys(result.counts);
    expect(deleted).toContain(COLLECTIONS.ASSIGNMENTS);
    expect(deleted).not.toContain(COLLECTIONS.PERSONS);
    expect(deleted).not.toContain(COLLECTIONS.GROUPS);
  });
});
