// @vitest-environment jsdom
/**
 * The group card at /gruppe/:groupId: the group from the address, and the tab from `?tab=`.
 * The page and the popup from «Bemanning» show the same card.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const roleState = vi.hoisted(() => ({
  roles: [
    { id: "role-taler", name: "Taler", groupId: "lovsang" },
    { id: "role-lyd", name: "Lyd", groupId: "lyd" },
    { id: "role-vertskap", name: "Vertskap", groupId: "lovsang" },
  ] as { id: string; name: string; groupId?: string }[],
}));

vi.mock("../src/hooks/useAppHooks", () => ({
  useLeaderGroupDetail: (groupId: string) => ({
    hasAccess: true,
    hasLeaderAccess: true,
    isLeader: true,
    isDeputy: false,
    isAdmin: false,
    currentUser: { id: "gunnar", name: "Gunnar", globalRole: "member" },
    group: { id: groupId, name: "Lovsang", category: "tjenestegruppe", memberIds: [], leaderIds: ["gunnar"] },
    members: [],
    messages: [],
    volunteerRoles: roleState.roles,
  }),
}));
vi.mock("../src/components/GroupChat", async () => {
  const { createElement } = await import("react");
  return { GroupChat: (props: { groupId: string }) => createElement("div", { "data-testid": "group-chat" }, props.groupId) };
});
vi.mock("../src/hooks/useMinSideModules", () => ({ useMinSideModules: () => ({ isOn: () => true }) }));
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
        <Route path="/gruppe/:groupId" element={<LeaderGroupDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// Below lg (mobile and tablet) a tab is shown when it is not hidden by the attribute or by the class
const shown = (id: string) => {
  const el = document.getElementById(id)!;
  return !el.hidden && !el.classList.contains("hidden");
};

afterEach(cleanup);

describe("Gruppekortet på siden", () => {
  test("viser gruppen fra adressen, med aktiviteter som første fane", () => {
    renderAt("/gruppe/lovsang");

    expect(screen.getByRole("heading", { name: "Lovsang" })).toBeTruthy();
    expect(shown("section-group-aktiviteter-tab")).toBe(true);
    // The chat is mounted on the page (it shows beside the activities on PC) but hidden below lg
    expect(shown("section-group-chat-tab")).toBe(false);
  });

  test("?tab=chat åpner gruppechatten for den gruppen", () => {
    renderAt("/gruppe/lovsang?tab=chat");

    expect(screen.getByTestId("group-chat").textContent).toBe("lovsang");
    expect(shown("section-group-aktiviteter-tab")).toBe(false);
  });

  test("fanene bytter på siden som før", () => {
    renderAt("/gruppe/lovsang");

    fireEvent.click(document.getElementById("tab-btn-group-medlemmer")!);
    expect(shown("section-group-medlemmer-tab")).toBe(true);
    expect(shown("section-group-aktiviteter-tab")).toBe(false);

    fireEvent.click(document.getElementById("tab-btn-group-chat")!);
    expect(screen.getByTestId("group-chat")).toBeTruthy();
  });

  test("viser rollene som hører til gruppen, og ikke rollene til andre grupper", () => {
    renderAt("/gruppe/lovsang");

    expect(document.getElementById("group-card-roles")!.textContent).toBe("Roller i gruppen: Taler, Vertskap");
  });

  test("uten roller på gruppen sies det i samme linje", () => {
    const saved = roleState.roles;
    roleState.roles = [{ id: "role-lyd", name: "Lyd", groupId: "lyd" }];
    try {
      renderAt("/gruppe/lovsang");
      expect(document.getElementById("group-card-roles")!.textContent).toBe("Ingen roller er knyttet til gruppen ennå.");
    } finally {
      roleState.roles = saved;
    }
  });

  test("siden har tilbakelenken og rammen som før", () => {
    renderAt("/gruppe/lovsang");

    expect(document.getElementById("btn-back-to-leader-nav")).not.toBeNull();
    expect(document.querySelector(".min-h-screen")).not.toBeNull();
  });
});
