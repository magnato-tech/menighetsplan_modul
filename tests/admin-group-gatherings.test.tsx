// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Gathering, Group } from "../src/types";

// The admin page of a group lists its meetings. A house-group meeting is listed too, and each card opens the
// same admin page as in Kalender, where it can be changed. The page names no developer words.

const group: Group = {
  id: "hus",
  name: "Husfellesskap Borkedalen",
  category: "husgruppe",
  memberIds: ["ellen"],
  leaderIds: ["ellen"],
};
const meeting: Gathering = {
  id: "m1",
  groupId: "hus",
  title: "Husfellesskap, 26. november",
  startsAt: "2026-11-26T18:00:00.000Z",
  location: "Hos Ellen Fossli",
  type: "gruppesamling",
  visibility: "intern",
  isGudstjeneste: false,
} as Gathering;

vi.mock("../src/utils/adminStudioRoutes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/utils/adminStudioRoutes")>()),
  useAdminDetailRoute: () => ({ kind: "group", id: "hus" }),
}));

vi.mock("../src/hooks/useAppHooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/hooks/useAppHooks")>()),
  useAdminGroupDetail: () => ({
    isAdmin: true,
    currentUser: { id: "admin", name: "Administrator", globalRole: "admin" },
    group,
    members: [],
    availablePersonsToAdd: [],
    allPersons: [],
    groupGatherings: [
      {
        gathering: meeting,
        tasks: [],
        staffing: { color: "green", badgeText: "Ingen oppgaver", coveredCount: 0, totalTasks: 0 },
      },
    ],
    updateGroup: vi.fn(),
    addGroupMember: vi.fn(),
    removeGroupMember: vi.fn(),
  }),
}));

vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ gatherings: [meeting], tasks: [], volunteerRoles: [] }),
}));

vi.mock("../src/hooks/useGatheringTemplates", () => ({
  useGatheringTemplates: () => ({ templates: [], ready: true }),
}));

vi.mock("../src/hooks/useMemberProposals", () => ({
  useGroupProposals: () => [],
}));

import { AdminGroupDetailPage } from "../src/pages/AdminGroupDetailPage";

afterEach(cleanup);

describe("Samlingene på gruppesiden i admin", () => {
  test("«Eksisterende Gathering» står ikke på siden", () => {
    const { container } = render(
      <MemoryRouter>
        <AdminGroupDetailPage />
      </MemoryRouter>
    );
    expect(screen.queryByText("Eksisterende Gathering")).toBeNull();
    expect(container.textContent).not.toContain("Gathering");
  });

  test("et møte i husgruppen åpnes og endres på /admin/samling/<id>", () => {
    render(
      <MemoryRouter>
        <AdminGroupDetailPage />
      </MemoryRouter>
    );
    const card = document.getElementById("group-gathering-card-m1") as HTMLElement;
    expect(card).toBeTruthy();
    expect(within(card).getByText("Husfellesskap, 26. november").closest("a")?.getAttribute("href")).toBe("/admin/samling/m1");
    expect(within(card).getByRole("link", { name: "Endre" }).getAttribute("href")).toBe("/admin/samling/m1");
  });
});
