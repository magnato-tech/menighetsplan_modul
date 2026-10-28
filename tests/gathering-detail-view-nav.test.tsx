// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import type { Gathering, Group, Task } from "../src/types";
import { combineDateAndTimeToIso } from "../src/utils/dates";

// The gathering page's arrows in the real view: next keeps the tab, and a leader's list holds only the
// gatherings the leader can open.

const { store } = vi.hoisted(() => ({
  store: {
    currentUser: { id: "lars", globalRole: "member" },
    gatherings: [] as Gathering[],
    groups: [] as Group[],
    tasks: [] as Task[],
  },
}));

vi.mock("../src/context/FirebaseDataContext", () => {
  const api = () => ({
    ...store,
    assignments: [],
    allPersons: [],
    hasFullRegister: false,
    volunteerRoles: [],
    getGatheringById: (id: string) => store.gatherings.find((g) => g.id === id),
    getGroupById: (id: string) => store.groups.find((g) => g.id === id),
    getPersonById: () => undefined,
    watchGatheringAssignments: () => () => undefined,
    updateGathering: () => ({ success: true }),
  });
  return { useFirebase: api };
});
vi.mock("../src/hooks/useLevel", () => ({ useLevel: () => "planner" }));
vi.mock("../src/hooks/useGatheringTemplates", () => ({ useGatheringTemplates: () => ({ templates: [], ready: true }) }));

import { useLeaderGatheringDetail } from "../src/hooks/leaderHooks";
import { GatheringDetailView } from "../src/components/GatheringDetailView";

const t = (day: string) => combineDateAndTimeToIso(day, "11:00");
const gathering = (id: string, day: string, groupId: string, fields: Partial<Gathering> = {}): Gathering =>
  ({ id, groupId, title: "Gudstjeneste", startsAt: t(day), visibility: "offentlig", isGudstjeneste: true, ...fields }) as Gathering;
const group = (id: string, leaderIds: string[], category = "tjenestegruppe"): Group =>
  ({ id, name: id, memberIds: [], leaderIds, deputyLeaderIds: [], category }) as unknown as Group;

function setup() {
  // Lars leads «lyd» only. Gudstjeneste 2 has a task for «lyd», so he can open it although it is «kor»'s.
  store.groups = [group("lyd", ["lars"]), group("kor", ["kari"])];
  store.gatherings = [
    gathering("a", "2026-11-01", "kor"),
    gathering("b", "2026-11-08", "kor"),
    gathering("c", "2026-11-15", "lyd"),
    gathering("d", "2026-11-22", "kor"),
  ];
  store.tasks = [{ id: "t", gatheringId: "b", groupId: "lyd", title: "Lyd", status: "open", neededCount: 1 } as unknown as Task];
}

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

afterEach(() => cleanup());

describe("leaderHooks: openableGatherings", () => {
  test("en leder kan åpne sine egne grupper og oppgavene sine, ingen andre", () => {
    setup();
    const { result } = renderHook(() => useLeaderGatheringDetail("b"));
    expect(result.current.openableGatherings.map((g) => g.id)).toEqual(["b", "c"]);
  });

  test("en administrator kan åpne alle", () => {
    setup();
    store.currentUser = { id: "admin", globalRole: "admin" } as never;
    const { result } = renderHook(() => useLeaderGatheringDetail("b"));
    expect(result.current.openableGatherings).toHaveLength(4);
  });
});

describe("GatheringDetailView: neste går til neste samling, med samme fane", () => {
  function Page() {
    const { gatheringId = "" } = useParams();
    return <GatheringDetailView key={gatheringId} gatheringId={gatheringId} mode="admin" />;
  }

  const renderAt = (url: string) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/admin/samling/:gatheringId" element={<Page />} />
        </Routes>
        <Where />
      </MemoryRouter>
    );

  test("på «Bemanning» fører Neste til ?vis=bemanning", () => {
    setup();
    store.currentUser = { id: "admin", globalRole: "admin" } as never;
    renderAt("/admin/samling/b?vis=bemanning");
    fireEvent.click(screen.getByRole("button", { name: /^Neste: / }));
    expect(screen.getByTestId("where").textContent).toBe("/admin/samling/c?vis=bemanning");
  });

  test("på «Program» beholdes programfanen", () => {
    setup();
    store.currentUser = { id: "admin", globalRole: "admin" } as never;
    renderAt("/admin/samling/b?vis=program");
    fireEvent.click(screen.getByRole("button", { name: /^Neste: / }));
    expect(screen.getByTestId("where").textContent).toBe("/admin/samling/c?vis=program");
  });
});
