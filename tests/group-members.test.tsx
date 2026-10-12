// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { COLLECTIONS } from "../src/data/collections";
import type { Group, Person } from "../src/types";
import { leadersMissingAsMembers, withLeaders } from "../src/utils/groups";
import { clearCollections, offline, seed } from "./support/offlineFirestore";
import { resetSession, startAsPerson } from "./support/session";

// Who is in a group, as the admin and the leader see it. The data is the real Firestore client,
// kept offline (see data-provider.test.tsx).
vi.mock("../src/firebase", async () => (await import("./support/offlineFirestore")).firebaseModuleMock);
vi.mock("../src/services/auth", async () => (await import("./support/session")).authModuleMock);
vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ settings: { churchName: "Sentrumskirken" }, addons: {}, addonsState: "ready" }) }));

import { FirebaseDataProvider } from "../src/context/FirebaseDataContext";
import { useAdminGroupDetail, useAdminPersonDetail } from "../src/hooks/adminHooks";
import { useLeaderGroupDetail } from "../src/hooks/leaderHooks";

const persons: Person[] = [
  { id: "admin", name: "Kari Nordmann", globalRole: "admin" },
  { id: "gunnar", name: "Gunnar Leder", globalRole: "member" },
  { id: "magnar", name: "Magnar Nestleder", globalRole: "member" },
  { id: "randi", name: "Randi Medlem", globalRole: "member" },
  { id: "utenfor", name: "Ulla Utenfor", globalRole: "member" },
];
// A group as a dataset can hold it: the leader and the deputy are named, but stand in no list of members
const houseGroup: Group = { id: "husgruppe", name: "Husgruppe 1", category: "husgruppe", memberIds: ["randi"], leaderIds: ["gunnar"], deputyLeaderIds: ["magnar"] };

const wrapper = ({ children }: { children: React.ReactNode }) => <FirebaseDataProvider>{children}</FirebaseDataProvider>;
const names = (list: Person[]) => list.map((person) => person.name).sort();

beforeEach(async () => {
  await offline;
  await clearCollections(Object.values(COLLECTIONS));
  resetSession();
  startAsPerson("admin");
  seed(COLLECTIONS.PERSONS, persons);
  seed(COLLECTIONS.GROUPS, [houseGroup]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Hvem som er med i en gruppe der lederen ikke står i medlemslisten", () => {
  test("gruppesiden i admin regner lederen og nestlederen som medlemmer", async () => {
    const { result } = renderHook(() => useAdminGroupDetail("husgruppe"), { wrapper });
    await waitFor(() => expect(result.current.members.length).toBe(3));

    expect(names(result.current.members)).toEqual(["Gunnar Leder", "Magnar Nestleder", "Randi Medlem"]);
    // Only those who are not in the group at all can be added
    expect(names(result.current.availablePersonsToAdd)).toEqual(["Kari Nordmann", "Ulla Utenfor"]);
  });

  test("gruppelederens egen side viser de samme", async () => {
    startAsPerson("gunnar");
    const { result } = renderHook(() => useLeaderGroupDetail("husgruppe"), { wrapper });
    await waitFor(() => expect(result.current.members.length).toBe(3));

    expect(names(result.current.members)).toEqual(["Gunnar Leder", "Magnar Nestleder", "Randi Medlem"]);
    expect(result.current.availablePersonsToAdd).toEqual([]);
  });

  test("personsiden i admin viser gruppen på den som leder den", async () => {
    const { result } = renderHook(() => useAdminPersonDetail("gunnar"), { wrapper });
    await waitFor(() => expect(result.current.personGroups.length).toBe(1));
    expect(result.current.personGroups[0].name).toBe("Husgruppe 1");
  });
});

describe("Medlemslisten når en gruppe lagres", () => {
  test("den som er leder eller nestleder, står også blant medlemmene", () => {
    expect(withLeaders(["randi"], ["gunnar", "magnar"])).toEqual(["randi", "gunnar", "magnar"]);
    expect(withLeaders([], ["gunnar", ""])).toEqual(["gunnar"]);
    expect(withLeaders(["randi"], [undefined, ""])).toEqual(["randi"]);
  });

  test("ledere som mangler i medlemslisten til gruppen sin, finnes, så de kan skrives inn", () => {
    const whole: Group = { id: "hel", name: "Hel", memberIds: ["a", "b"], leaderIds: ["a"], deputyLeaderIds: ["b"] };
    const both: Group = { id: "begge", name: "Begge", memberIds: ["a"], leaderIds: ["a"], deputyLeaderIds: ["a"] };
    expect(leadersMissingAsMembers([houseGroup, whole, both])).toEqual([
      { groupId: "husgruppe", personId: "gunnar" },
      { groupId: "husgruppe", personId: "magnar" },
    ]);
    expect(leadersMissingAsMembers([{ id: "tom", memberIds: [], leaderIds: [] }])).toEqual([]);
    // The same person as leader and deputy is written once
    expect(leadersMissingAsMembers([{ id: "g", memberIds: [], leaderIds: ["x"], deputyLeaderIds: ["x"] }])).toEqual([{ groupId: "g", personId: "x" }]);
  });

  test("ingen står to ganger", () => {
    expect(withLeaders(["gunnar", "randi"], ["gunnar", "randi"])).toEqual(["gunnar", "randi"]);
  });
});
