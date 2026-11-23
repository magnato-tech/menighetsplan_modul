// @vitest-environment jsdom
/**
 * PC (lg): the group room and the house group show activities, chat and members side by side.
 * On mobile and tablet they keep the tabs. The popup from «Bemanning» keeps the tabs everywhere.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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
  useHusfellesskap: () => ({
    group: { id: "hus", name: "Husgruppe" },
    isLeader: true,
    isDeputyLeader: false,
    leaders: [],
    deputyLeaders: [],
    members: [],
    activeMeeting: null,
    messages: [],
  }),
}));
vi.mock("../src/components/GroupChat", async () => {
  const { createElement } = await import("react");
  return { GroupChat: () => createElement("div", { "data-testid": "group-chat" }) };
});
vi.mock("../src/components/HusfellesskapChat", async () => {
  const { createElement } = await import("react");
  return { HusfellesskapChat: () => createElement("div", { "data-testid": "hus-chat" }) };
});
vi.mock("../src/components/husfellesskap/MeetingTab", async () => {
  const { createElement } = await import("react");
  return { MeetingTab: () => createElement("div", { "data-testid": "hus-meeting" }) };
});
vi.mock("../src/components/husfellesskap/MembersTab", async () => {
  const { createElement } = await import("react");
  return { MembersTab: () => createElement("div", { "data-testid": "hus-members" }) };
});
vi.mock("../src/components/husfellesskap/CreateMeetingDialog", () => ({ CreateMeetingDialog: () => null }));
vi.mock("../src/components/husfellesskap/EditMeetingDialog", () => ({ EditMeetingDialog: () => null }));
vi.mock("../src/hooks/useMinSideModules", () => ({ useMinSideModules: () => ({ isOn: () => true }) }));
vi.mock("../src/pages/leaderGroup/GroupRoleBar", () => ({
  GroupRoleBar: () => null,
  GroupRoleBadge: () => null,
}));
vi.mock("../src/pages/leaderGroup/GroupScheduleCard", () => ({ GroupScheduleCard: () => null }));
vi.mock("../src/pages/leaderGroup/GroupActivities", () => ({ GroupActivities: () => null }));
vi.mock("../src/pages/leaderGroup/GroupMembers", () => ({ GroupMembers: () => null }));
vi.mock("../src/pages/leaderGroup/GroupMetaForm", () => ({ GroupMetaForm: () => null }));

import { LeaderGroupCard } from "../src/pages/leaderGroup/LeaderGroupCard";
import { HusfellesskapView } from "../src/components/HusfellesskapView";

afterEach(cleanup);

/** Shown below lg (mobile and tablet): neither the hidden attribute nor the `hidden` class is set. */
const shownBelowLg = (el: HTMLElement) => !el.hidden && !el.classList.contains("hidden");
const byId = (id: string) => document.getElementById(id) as HTMLElement;

describe("Grupperommet på siden (PC: kolonner)", () => {
  test("alle tre seksjonene ligger i DOM-en, og fanene skjules på PC", () => {
    render(
      <MemoryRouter>
        <LeaderGroupCard groupId="lovsang" />
      </MemoryRouter>
    );

    const activities = byId("section-group-aktiviteter-tab");
    const chat = byId("section-group-chat-tab");
    const members = byId("section-group-medlemmer-tab");

    expect(activities.hidden).toBe(false);
    expect(activities.className).not.toContain("hidden");
    expect(chat.className).toContain("hidden lg:block");
    expect(members.className).toContain("hidden lg:block");
    expect(chat.hidden).toBe(false);
    expect(members.hidden).toBe(false);

    expect(byId("tab-btn-group-aktiviteter").parentElement!.className).toContain("lg:hidden");
  });

  test("gruppechat og deltakere har overskrifter som vises bare på PC", () => {
    render(
      <MemoryRouter>
        <LeaderGroupCard groupId="lovsang" />
      </MemoryRouter>
    );

    expect(byId("section-group-chat-tab").querySelector("h2")!.className).toContain("lg:block");
    expect(byId("section-group-medlemmer-tab").querySelector("h2")!.textContent).toBe("Deltakere (0)");
  });

  test("på mobil og nettbrett vises bare den aktive fanen", () => {
    render(
      <MemoryRouter>
        <LeaderGroupCard groupId="lovsang" />
      </MemoryRouter>
    );

    expect(shownBelowLg(byId("section-group-aktiviteter-tab"))).toBe(true);
    expect(shownBelowLg(byId("section-group-chat-tab"))).toBe(false);
    expect(shownBelowLg(byId("section-group-medlemmer-tab"))).toBe(false);
  });
});

describe("Gruppekortet i popup (fanene som før)", () => {
  test("inaktive seksjoner har hidden-attributtet, og fanene skjules ikke på PC", () => {
    render(
      <MemoryRouter>
        <LeaderGroupCard groupId="lovsang" inPopup />
      </MemoryRouter>
    );

    expect(byId("section-group-aktiviteter-tab").hidden).toBe(false);
    expect(byId("section-group-medlemmer-tab").hidden).toBe(true);
    expect(byId("section-group-medlemmer-tab").className).not.toContain("lg:block");
    expect(document.querySelector('[data-testid="group-chat"]')).toBeNull();
    expect(byId("tab-btn-group-aktiviteter").parentElement!.className).not.toContain("lg:hidden");
  });
});

describe("Husgruppen (PC: kolonner)", () => {
  test("på siden: møte, chat og medlemmer er i DOM-en, og fanene skjules på PC", () => {
    const { container } = render(
      <MemoryRouter>
        <HusfellesskapView groupId="hus" columns />
      </MemoryRouter>
    );

    expect(container.querySelector('[data-testid="hus-meeting"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="hus-chat"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="hus-members"]')).not.toBeNull();

    expect(byId("tab-btn-samling").parentElement!.className).toContain("lg:hidden");
    // The meeting tab is the active one, so the chat and members wrappers are hidden below lg
    expect(byId("section-husfellesskap-chat").className).toContain("hidden lg:block");
    expect(shownBelowLg(byId("section-husfellesskap-chat"))).toBe(false);
  });

  test("uten kolonner: bare den aktive fanen, og fanene vises som før", () => {
    const { container } = render(
      <MemoryRouter>
        <HusfellesskapView groupId="hus" />
      </MemoryRouter>
    );

    expect(container.querySelector('[data-testid="hus-meeting"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="hus-chat"]')).toBeNull();
    expect(container.querySelector('[data-testid="hus-members"]')).toBeNull();
    expect(byId("tab-btn-samling").parentElement!.className).not.toContain("lg:hidden");
  });
});
