// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import type { Gathering, Group } from "../src/types";

// A house-group meeting is in the admin calendar under «Husgrupper», but the dashboard, the menu count and the
// other lists still leave it out (adminGatherings). The two lists are built by the same mapping.

const groups: Group[] = [
  { id: "tjeneste", name: "Lyd", category: "tjenestegruppe", memberIds: [], leaderIds: [] },
  { id: "hus", name: "Husfellesskap Borkedalen", category: "husgruppe", memberIds: ["ellen"], leaderIds: ["ellen"] },
];
const gathering = (id: string, groupId: string): Gathering =>
  ({
    id,
    groupId,
    title: `Samling ${id}`,
    startsAt: "2026-11-26T18:00:00.000Z",
    type: "gruppesamling",
    visibility: "intern",
    isGudstjeneste: false,
  }) as Gathering;
const gatherings = [gathering("lyd-1", "tjeneste"), gathering("hus-1", "hus")];

vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    currentUser: { id: "admin", name: "Administrator", globalRole: "admin" },
    allPersons: [],
    groups,
    gatherings,
    tasks: [],
    assignments: [],
    volunteerRoles: [],
    getGroupById: (id: string) => groups.find((group) => group.id === id),
    getGatheringById: (id: string) => gatherings.find((g) => g.id === id),
    getPersonById: () => undefined,
  }),
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({}) }));

import { useAdminDashboard } from "../src/hooks/adminHooks";

afterEach(cleanup);

describe("Husgruppemøter i admin", () => {
  test("adminGatherings leaves husgruppemøter out, som før", () => {
    const { result } = renderHook(() => useAdminDashboard());
    expect(result.current.adminGatherings.map((item) => item.gathering.id)).toEqual(["lyd-1"]);
  });

  test("adminHouseGroupGatherings har dem, bygget likt, med gruppen og tomme oppgaver", () => {
    const { result } = renderHook(() => useAdminDashboard());
    const [house] = result.current.adminHouseGroupGatherings;
    expect(result.current.adminHouseGroupGatherings.map((item) => item.gathering.id)).toEqual(["hus-1"]);
    expect(house.group?.category).toBe("husgruppe");
    expect(house.totalTasks).toBe(0);
    expect(house.tasks).toEqual([]);
  });
});
