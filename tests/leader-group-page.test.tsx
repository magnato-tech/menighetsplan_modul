// @vitest-environment jsdom
/**
 * The group card at /leder/gruppe/:groupId: the group from the address, and the tab from `?tab=`.
 * The page and the popup from «Bemanning» show the same card.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../src/hooks/useAppHooks", () => ({
  useLeaderGroupDetail: (groupId: string) => ({
    hasAccess: true,
    hasLeaderAccess: true,
    isLeader: true,
    isDeputy: false,
    isAdmin: false,
    currentUser: { id: "gunnar", name: "Gunnar", globalRole: "member" },
    group: { id: groupId, name: "Lovsang", category: "tjeneste", memberIds: [], leaderIds: ["gunnar"] },
    members: [],
    messages: [],
  }),
}));
vi.mock("../src/components/GroupChat", async () => {
  const { createElement } = await import("react");
  return { GroupChat: (props: { groupId: string }) => createElement("div", { "data-testid": "group-chat" }, props.groupId) };
});
vi.mock("../src/components/HusfellesskapView", () => ({ HusfellesskapView: () => null }));
vi.mock("../src/pages/leaderGroup/GroupScheduleCard", () => ({ GroupScheduleCard: () => null }));
vi.mock("../src/pages/leaderGroup/GroupActivities", () => ({ GroupActivities: () => null }));
vi.mock("../src/pages/leaderGroup/GroupMembers", () => ({ GroupMembers: () => null }));
vi.mock("../src/pages/leaderGroup/GroupMetaForm", () => ({ GroupMetaForm: () => null }));

import { LeaderGroupDetailPage } from "../src/pages/LeaderGroupDetailPage";

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/leder/gruppe/:groupId" element={<LeaderGroupDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const shown = (id: string) => !document.getElementById(id)!.hidden;

afterEach(cleanup);

describe("Gruppekortet på siden", () => {
  test("viser gruppen fra adressen, med aktiviteter som første fane", () => {
    renderAt("/leder/gruppe/lovsang");

    expect(screen.getByRole("heading", { name: "Lovsang" })).toBeTruthy();
    expect(shown("section-group-aktiviteter-tab")).toBe(true);
    expect(screen.queryByTestId("group-chat")).toBeNull();
  });

  test("?tab=chat åpner gruppechatten for den gruppen", () => {
    renderAt("/leder/gruppe/lovsang?tab=chat");

    expect(screen.getByTestId("group-chat").textContent).toBe("lovsang");
    expect(shown("section-group-aktiviteter-tab")).toBe(false);
  });

  test("fanene bytter på siden som før", () => {
    renderAt("/leder/gruppe/lovsang");

    fireEvent.click(document.getElementById("tab-btn-group-medlemmer")!);
    expect(shown("section-group-medlemmer-tab")).toBe(true);
    expect(shown("section-group-aktiviteter-tab")).toBe(false);

    fireEvent.click(document.getElementById("tab-btn-group-chat")!);
    expect(screen.getByTestId("group-chat")).toBeTruthy();
  });

  test("siden har tilbakelenken og rammen som før", () => {
    renderAt("/leder/gruppe/lovsang");

    expect(document.getElementById("btn-back-to-leader-nav")).not.toBeNull();
    expect(document.querySelector(".min-h-screen")).not.toBeNull();
  });
});
