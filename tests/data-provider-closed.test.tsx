// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { COLLECTIONS, LOGINS_COLLECTION, PUBLIC_PROFILES_COLLECTION } from "../src/data/collections";
import type { Gathering, Group, Person, Task } from "../src/types";
import { publicCopiesOf } from "../src/utils/publicProfile";
import { clearCollections, offline, seed } from "./support/offlineFirestore";
import { nobodySignedIn, resetSession, signInWith, startAsPerson } from "./support/session";

// A congregation's published installation: nobody can go in as a person without signing in, and
// the database gives the register only to those who are in it. The provider runs against the
// real Firestore client, kept offline (see data-provider.test.tsx).
vi.mock("../src/firebase", async () => (await import("./support/offlineFirestore")).firebaseModuleMock);
vi.mock("../src/services/auth", async () => (await import("./support/session")).authModuleMock);
vi.mock("../src/utils/session", async (original) => ({ ...(await original<typeof import("../src/utils/session")>()), mayStandIn: () => false }));

import { FirebaseDataProvider, useFirebase } from "../src/context/FirebaseDataContext";

const kari: Person = { id: "kari", name: "Kari Nordmann", email: "kari@menigheten.no", phone: "99 00 11 22", globalRole: "admin" };
const ola: Person = { id: "ola", name: "Ola Hansen", email: "ola@eksempel.no", globalRole: "member" };
const liv: Person = {
  id: "liv",
  name: "Liv Pastor",
  email: "liv.privat@eksempel.no",
  phone: "99 88 77 66",
  globalRole: "member",
  isPublicProfile: true,
  consentToPublishGivenAt: "2026-09-01T10:00:00.000Z",
  publicTitle: "Pastor",
  isStaff: true,
};
const register = [kari, ola, liv];

const groups: Group[] = [
  { id: "group-apen", name: "Lovsang", isPublic: true, memberIds: ["ola"], leaderIds: ["kari"] },
  { id: "group-lukket", name: "Sjelesorg", isPublic: false, memberIds: ["liv"], leaderIds: ["kari"] },
  // Stored before groups were marked: not given to a visitor
  { id: "group-umerket", name: "Gammel gruppe", memberIds: [], leaderIds: [] },
];
const gatherings: Gathering[] = [
  { id: "g-apen", groupId: "group-apen", title: "Gudstjeneste", startsAt: "2026-11-01T10:00:00.000Z", visibility: "offentlig", isPublic: true },
  { id: "g-fremhevet", groupId: "group-apen", title: "Julekonsert", startsAt: "2026-12-13T17:00:00.000Z", visibility: "fremhevet", isPublic: true },
  { id: "g-intern", groupId: "group-lukket", title: "Ledermøte", startsAt: "2026-11-03T18:00:00.000Z", visibility: "intern", isPublic: false },
];
const tasks: Task[] = [{ id: "task-1", gatheringId: "g-apen", groupId: "group-apen", title: "Lovsangsleder", status: "open", neededCount: 1 }];

const wrapper = ({ children }: { children: React.ReactNode }) => <FirebaseDataProvider>{children}</FirebaseDataProvider>;
const show = () => renderHook(() => useFirebase(), { wrapper });
const ids = (list: { id: string }[]) => list.map((item) => item.id).sort();

beforeEach(async () => {
  await offline;
  await clearCollections([...Object.values(COLLECTIONS), LOGINS_COLLECTION, PUBLIC_PROFILES_COLLECTION]);
  resetSession();
  seed(COLLECTIONS.PERSONS, register);
  seed(COLLECTIONS.GROUPS, groups);
  seed(COLLECTIONS.GATHERINGS, gatherings);
  seed(COLLECTIONS.TASKS, tasks);
  seed(PUBLIC_PROFILES_COLLECTION, publicCopiesOf(register));
  seed(LOGINS_COLLECTION, [
    { id: "kari@menigheten.no", personId: "kari", role: "admin" },
    { id: "ola@eksempel.no", personId: "ola", role: "member" },
  ]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("En besøkende som ikke er logget inn", () => {
  test("får de offentlige kopiene av personer, og ikke registeret", async () => {
    nobodySignedIn();
    const { result: data } = show();
    await waitFor(() => expect(data.current.registerReady).toBe(true));

    expect(ids(data.current.allPersons)).toEqual(["liv"]);
    const [copy] = data.current.allPersons;
    expect(copy.publicTitle).toBe("Pastor");
    expect(copy.email).toBeUndefined();
    expect(copy.phone).toBeUndefined();
    expect(data.current.session).toEqual({ status: "signedOut" });
  });

  test("får bare gruppene og arrangementene som er merket offentlige, og ingenting av planleggingen", async () => {
    nobodySignedIn();
    const { result: data } = show();
    await waitFor(() => expect(data.current.gatheringsReady).toBe(true));
    await waitFor(() => expect(data.current.groups.length).toBeGreaterThan(0));

    expect(ids(data.current.groups)).toEqual(["group-apen"]);
    expect(ids(data.current.gatherings)).toEqual(["g-apen", "g-fremhevet"]);
    expect(data.current.tasks).toEqual([]);
  });

  test("kan ikke gå inn som en person uten å logge inn", async () => {
    startAsPerson("kari");
    const { result: data } = show();
    await waitFor(() => expect(data.current.registerReady).toBe(true));

    expect(data.current.standInAs).toBeUndefined();
    expect(data.current.session).toEqual({ status: "signedOut" });
    expect(ids(data.current.allPersons)).toEqual(["liv"]);
  });
});

describe("Den som logger inn", () => {
  test("med en adresse som har en innlogging, er personen den peker på, og får hele registeret og planleggingen", async () => {
    signInWith("Ola@Eksempel.no");
    const { result: data } = show();
    await waitFor(() => expect(data.current.session.status).toBe("member"));

    expect(data.current.currentUser).toMatchObject({ id: "ola", name: "Ola Hansen" });
    expect(ids(data.current.allPersons)).toEqual(["kari", "liv", "ola"]);
    expect(data.current.allPersons.find((person) => person.id === "liv")?.phone).toBe("99 88 77 66");
    expect(ids(data.current.groups)).toEqual(["group-apen", "group-lukket", "group-umerket"]);
    expect(ids(data.current.gatherings)).toEqual(["g-apen", "g-fremhevet", "g-intern"]);
    await waitFor(() => expect(ids(data.current.tasks)).toEqual(["task-1"]));
  });

  test("er aldri et øyeblikk en annen enn seg selv mens registeret hentes", async () => {
    // Liv has a public copy. Signed in, she must be the person in the register, not the copy.
    seed(LOGINS_COLLECTION, [{ id: "liv.privat@eksempel.no", personId: "liv", role: "member" }]);
    signInWith("liv.privat@eksempel.no");
    const seen: string[] = [];
    const { result: data } = renderHook(
      () => {
        const value = useFirebase();
        if (value.session.status === "member") seen.push(value.session.person.email ?? "uten adresse");
        else seen.push(value.session.status);
        return value;
      },
      { wrapper }
    );
    await waitFor(() => expect(data.current.session.status).toBe("member"));

    expect(new Set(seen)).toEqual(new Set(["loading", "liv.privat@eksempel.no"]));
  });

  test("med en adresse uten innlogging, står ikke i registeret, og får ikke mer enn en besøkende", async () => {
    signInWith("fremmed@eksempel.no");
    const { result: data } = show();
    await waitFor(() => expect(data.current.session.status).toBe("notInRegister"));

    expect(data.current.session).toMatchObject({ status: "notInRegister", reason: "noMatch" });
    expect(ids(data.current.allPersons)).toEqual(["liv"]);
    expect(ids(data.current.groups)).toEqual(["group-apen"]);
    expect(data.current.tasks).toEqual([]);
  });

  test("med en adresse som ikke er bekreftet, slipper ikke inn, selv om adressen har en innlogging", async () => {
    signInWith("kari@menigheten.no", { emailVerified: false });
    const { result: data } = show();
    await waitFor(() => expect(data.current.session.status).toBe("notInRegister"));

    expect(data.current.session).toMatchObject({ status: "notInRegister", reason: "unverified" });
    await waitFor(() => expect(data.current.registerReady).toBe(true));
    expect(ids(data.current.allPersons)).toEqual(["liv"]);
  });

  test("og logger ut igjen, sitter ikke igjen med registeret", async () => {
    signInWith("kari@menigheten.no");
    const { result: data } = show();
    await waitFor(() => expect(data.current.session.status).toBe("member"));
    expect(ids(data.current.allPersons)).toEqual(["kari", "liv", "ola"]);

    await data.current.signOut();
    await waitFor(() => expect(data.current.session.status).toBe("signedOut"));
    await waitFor(() => expect(ids(data.current.allPersons)).toEqual(["liv"]));
    expect(ids(data.current.gatherings)).toEqual(["g-apen", "g-fremhevet"]);
  });
});
