// @vitest-environment jsdom
/**
 * The group card at /gruppe/:groupId: the group from the address, and the tab from `?tab=`.
 * The page and the popup from «Bemanning» show the same card.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const roleState = vi.hoisted(() => ({
  roles: [
    { id: "role-taler", name: "Taler", groupId: "lovsang" },
    { id: "role-lyd", name: "Lyd", groupId: "lyd" },
    { id: "role-vertskap", name: "Vertskap", groupId: "lovsang" },
  ] as { id: string; name: string; groupId?: string }[],
}));

const activityState = vi.hoisted(() => ({
  gatherings: [] as any[],
  members: [] as { id: string; name: string }[],
  dayLoads: new Map<string, any[]>(),
  assignTaskToPerson: vi.fn(() => ({ success: true, error: undefined as string | undefined })),
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
    members: activityState.members,
    messages: [],
    volunteerRoles: roleState.roles,
    groupGatherings: activityState.gatherings,
    dayLoads: activityState.dayLoads,
    undistributedTasks: [],
    assignTaskToPerson: activityState.assignTaskToPerson,
    takeTask: vi.fn(() => ({ success: true })),
    giveTaskBack: vi.fn(() => ({ success: true })),
    canGiveBack: () => false,
  }),
}));
vi.mock("../src/components/GroupChat", async () => {
  const { createElement } = await import("react");
  return { GroupChat: (props: { groupId: string }) => createElement("div", { "data-testid": "group-chat" }, props.groupId) };
});
vi.mock("../src/hooks/useMinSideModules", () => ({ useMinSideModules: () => ({ isOn: () => true }) }));
vi.mock("../src/components/HusfellesskapView", () => ({ HusfellesskapView: () => null }));
vi.mock("../src/pages/leaderGroup/GroupScheduleCard", () => ({ GroupScheduleCard: () => null }));
vi.mock("../src/pages/leaderGroup/GroupMembers", () => ({ GroupMembers: () => null }));
vi.mock("../src/pages/leaderGroup/GroupMetaForm", () => ({ GroupMetaForm: () => null }));

import { LeaderGroupDetailPage } from "../src/pages/LeaderGroupDetailPage";
import { buildDayLoads } from "../src/utils/sameDayLoads";

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

// One gathering with one unfilled task per id in taskIds
function gathering(id: string, taskIds: string[]) {
  const tasks = taskIds.map((taskId) => ({
    id: taskId,
    title: `Oppgave ${taskId}`,
    gatheringId: id,
    groupId: "lovsang",
    volunteerRoleId: "role-taler",
    status: "vacant",
  }));
  return {
    gathering: { id, title: `Samling ${id}`, type: "arrangement", startsAt: "2026-12-06T18:00:00", location: "Kirken" },
    tasks,
    taskItems: tasks.map((task) => ({
      task,
      assignedPersons: [],
      confirmedCount: 0,
      neededCount: 1,
      isFullyCovered: false,
      hasForfall: false,
    })),
    totalNeeded: tasks.length,
    totalConfirmed: 0,
    hasForfall: false,
    isFullyCovered: false,
    staffing: { color: "red", badgeText: "Mangler folk" },
  };
}

describe("Planlagte aktiviteter på gruppekortet", () => {
  beforeEach(() => {
    activityState.gatherings = [gathering("samling-a", ["oppg-a"]), gathering("samling-b", ["oppg-b"])];
    activityState.members = [{ id: "per-1", name: "Ola" }];
  });

  afterEach(() => {
    activityState.gatherings = [];
    activityState.members = [];
    activityState.assignTaskToPerson.mockClear();
  });

  test("to aktiviteter kan være åpne samtidig, og hver lukkes for seg", () => {
    renderAt("/gruppe/lovsang");

    fireEvent.click(document.getElementById("btn-toggle-tasks-samling-a")!);
    fireEvent.click(document.getElementById("btn-toggle-tasks-samling-b")!);
    expect(document.getElementById("group-gathering-task-oppg-a")).not.toBeNull();
    expect(document.getElementById("group-gathering-task-oppg-b")).not.toBeNull();

    fireEvent.click(document.getElementById("btn-toggle-tasks-samling-a")!);
    expect(document.getElementById("group-gathering-task-oppg-a")).toBeNull();
    expect(document.getElementById("group-gathering-task-oppg-b")).not.toBeNull();
  });

  test("«Fold ut alle» åpner alle, og «Fold sammen alle» lukker alle", () => {
    renderAt("/gruppe/lovsang");

    fireEvent.click(document.getElementById("btn-group-expand-all")!);
    expect(document.getElementById("group-gathering-task-oppg-a")).not.toBeNull();
    expect(document.getElementById("group-gathering-task-oppg-b")).not.toBeNull();

    fireEvent.click(document.getElementById("btn-group-collapse-all")!);
    expect(document.getElementById("group-gathering-task-oppg-a")).toBeNull();
    expect(document.getElementById("group-gathering-task-oppg-b")).toBeNull();
  });

  test("«Forespør» gir oppgaven som venter, og «Tildel» gir den bekreftet", () => {
    renderAt("/gruppe/lovsang");

    fireEvent.click(document.getElementById("btn-toggle-tasks-samling-a")!);
    fireEvent.click(document.getElementById("btn-quick-assign-oppg-a")!);
    fireEvent.click(document.getElementById("btn-do-quick-ask-oppg-a-per-1")!);
    expect(activityState.assignTaskToPerson).toHaveBeenLastCalledWith("oppg-a", "per-1", "pending");

    fireEvent.click(document.getElementById("btn-quick-assign-oppg-a")!);
    fireEvent.click(document.getElementById("btn-do-quick-assign-oppg-a-per-1")!);
    expect(activityState.assignTaskToPerson).toHaveBeenLastCalledWith("oppg-a", "per-1", "confirmed");
  });
});

describe("Dobbeltbooking på samme dag", () => {
  const OLA = { id: "per-1", name: "Ola" };
  const KARI = { id: "per-2", name: "Kari" };

  // Puts a person on the task of a gathering, the way the page reads an assignment
  function assign(item: any, taskId: string, person: { id: string; name: string }, response: "pending" | "confirmed") {
    const taskItem = item.taskItems.find((t: any) => t.task.id === taskId);
    taskItem.assignedPersons = [
      { assignment: { id: `as-${taskId}-${person.id}`, taskId, personId: person.id, response }, person, statusLabel: response, response },
    ];
    taskItem.confirmedCount = response === "confirmed" ? 1 : 0;
  }

  beforeEach(() => {
    // Ola is on two tasks the same day (a and b), Kari only on one (c, another day)
    const a = gathering("samling-a", ["oppg-a"]);
    const b = gathering("samling-b", ["oppg-b"]);
    const c = gathering("samling-c", ["oppg-c"]);
    c.gathering.startsAt = "2026-12-07T10:00:00";
    assign(a, "oppg-a", OLA, "confirmed");
    assign(b, "oppg-b", OLA, "pending");
    assign(c, "oppg-c", KARI, "confirmed");

    const all = [a, b, c];
    const assignments = all.flatMap((item: any) => item.taskItems.flatMap((t: any) => t.assignedPersons.map((p: any) => p.assignment)));
    activityState.gatherings = all;
    activityState.members = [OLA, KARI];
    activityState.dayLoads = buildDayLoads({
      assignments,
      tasks: all.flatMap((item) => item.tasks),
      gatherings: all.map((item) => item.gathering),
      groups: [{ id: "lovsang", name: "Lovsang" }],
    } as any);
  });

  afterEach(() => {
    activityState.gatherings = [];
    activityState.members = [];
    activityState.dayLoads = new Map();
    activityState.assignTaskToPerson.mockClear();
  });

  test("en person med en annen oppgave samme dag får varsel på brikken", () => {
    renderAt("/gruppe/lovsang");

    fireEvent.click(document.getElementById("btn-toggle-tasks-samling-a")!);
    const badge = document.getElementById("warn-double-oppg-a-per-1")!;
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("title")).toBe("Har også: Oppgave oppg-b kl. 18:00");
    expect(badge.getAttribute("aria-label")).toBe("Har også: Oppgave oppg-b kl. 18:00");
  });

  test("en person uten annen oppgave samme dag får ingen varsel", () => {
    renderAt("/gruppe/lovsang");

    fireEvent.click(document.getElementById("btn-toggle-tasks-samling-c")!);
    expect(document.getElementById("group-gathering-task-oppg-c")).not.toBeNull();
    expect(document.getElementById("warn-double-oppg-c-per-2")).toBeNull();
  });

  test("telleren viser antall mulige konflikter, og filteret skjuler aktiviteter uten varsel", () => {
    renderAt("/gruppe/lovsang");

    expect(document.getElementById("btn-group-filter-conflicts")!.textContent).toBe("2 mulige konflikter");
    expect(document.getElementById("group-gathering-card-samling-c")).not.toBeNull();

    fireEvent.click(document.getElementById("btn-group-filter-conflicts")!);
    expect(document.getElementById("btn-group-filter-conflicts")!.textContent).toBe("Vis alle");
    expect(document.getElementById("group-gathering-card-samling-c")).toBeNull();
    expect(document.getElementById("group-gathering-card-samling-a")).not.toBeNull();

    fireEvent.click(document.getElementById("btn-group-filter-conflicts")!);
    expect(document.getElementById("group-gathering-card-samling-c")).not.toBeNull();
  });

  test("under en medlem i tildelingsvalget står det hvilken oppgave hen har samme dag, og Tildel virker", () => {
    renderAt("/gruppe/lovsang");

    fireEvent.click(document.getElementById("btn-toggle-tasks-samling-a")!);
    fireEvent.click(document.getElementById("btn-quick-assign-oppg-a")!);
    expect(screen.getByText("har allerede Oppgave oppg-b denne dagen")).toBeTruthy();

    fireEvent.click(document.getElementById("btn-do-quick-assign-oppg-a-per-1")!);
    expect(activityState.assignTaskToPerson).toHaveBeenLastCalledWith("oppg-a", "per-1", "confirmed");
  });
});
