// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import type { Gathering, Group, Task } from "../src/types";
import { combineDateAndTimeToIso } from "../src/utils/dates";
import { ConfirmProvider } from "../src/components/ConfirmProvider";
import { answerConfirm } from "./support/confirmDialog";

// An event that came from kirkens kalender: the tag on its page, and what deleting it remembers.

const { store, surfaceServices } = vi.hoisted(() => ({
  store: {
    currentUser: { id: "admin", globalRole: "admin" },
    gatherings: [] as Gathering[],
    groups: [] as Group[],
    tasks: [] as Task[],
    assignments: [] as unknown[],
    deleteWithStaffing: vi.fn((_id: string) => ({ success: true })),
  },
  surfaceServices: {
    dismissExternalEvent: vi.fn(async (_uid: string, _note: unknown) => {}),
  },
}));

vi.mock("../src/context/FirebaseDataContext", () => {
  const api = () => ({
    ...store,
    allPersons: [],
    hasFullRegister: false,
    volunteerRoles: [],
    getGatheringById: (id: string) => store.gatherings.find((g) => g.id === id),
    getGroupById: (id: string) => store.groups.find((g) => g.id === id),
    getPersonById: () => undefined,
    watchGatheringAssignments: () => () => undefined,
    updateGathering: () => ({ success: true }),
    deleteGatheringWithStaffing: store.deleteWithStaffing,
  });
  return { useFirebase: api };
});
vi.mock("../src/services/surfaces", () => surfaceServices);
vi.mock("../src/hooks/useLevel", () => ({ useLevel: () => "planner" }));
vi.mock("../src/hooks/useGatheringTemplates", () => ({ useGatheringTemplates: () => ({ templates: [], ready: true }) }));

import { GatheringDetailView } from "../src/components/GatheringDetailView";

const startsAt = combineDateAndTimeToIso("2026-11-08", "11:00");

function setup(extra: Partial<Gathering> = {}) {
  store.groups = [{ id: "lyd", name: "Lyd", memberIds: [], leaderIds: ["admin"], deputyLeaderIds: [], category: "tjenestegruppe" } as unknown as Group];
  store.gatherings = [{ id: "e", groupId: "lyd", title: "Gudstjeneste", startsAt, visibility: "offentlig", isGudstjeneste: true, ...extra } as Gathering];
  store.tasks = [{ id: "t1", gatheringId: "e", groupId: "lyd", title: "Lyd", status: "open", neededCount: 1 } as unknown as Task];
  store.assignments = [];
  store.deleteWithStaffing.mockClear();
  surfaceServices.dismissExternalEvent.mockClear();
}

function Page() {
  const { gatheringId = "" } = useParams();
  return <GatheringDetailView key={gatheringId} gatheringId={gatheringId} mode="admin" />;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/samling/e"]}>
      <ConfirmProvider>
        <Routes>
          <Route path="/admin/samling/:gatheringId" element={<Page />} />
          <Route path="*" element={<p>Kalender</p>} />
        </Routes>
      </ConfirmProvider>
    </MemoryRouter>
  );
}

function openEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Rediger" }));
  return screen.getByRole("dialog");
}

afterEach(() => cleanup());

describe("Arrangement fra kirkens kalender", () => {
  test("siden viser merkelappen «Fra kirkens kalender»", () => {
    setup({ externalCalendarUid: "uid-gud@example.org" });
    renderPage();
    expect(screen.getByText("Fra kirkens kalender")).toBeTruthy();
  });

  test("uten kalender-ID finnes ingen merkelapp", () => {
    setup();
    renderPage();
    expect(screen.queryByText("Fra kirkens kalender")).toBeNull();
  });

  test("sletting spør med linjen om kalenderen, og husker det etter at det er slettet", async () => {
    setup({ externalCalendarUid: "uid-gud@example.org" });
    renderPage();
    const form = openEditor();
    fireEvent.click(within(form).getByRole("button", { name: "Slett arrangementet …" }));

    const question = screen.getByRole("alertdialog");
    expect(question.textContent).toContain("Arrangementet kom fra kirkens kalender.");
    expect(question.textContent).toContain("«Avvist og slettet»");
    await answerConfirm(/^Vil du slette «Gudstjeneste»/);

    await waitFor(() => expect(store.deleteWithStaffing).toHaveBeenCalledWith("e"));
    expect(surfaceServices.dismissExternalEvent).toHaveBeenCalledWith(
      "uid-gud@example.org",
      expect.objectContaining({ reason: "slettet", title: "Gudstjeneste", startsAt })
    );
  });

  test("sletting av et arrangement uten kalender-ID husker ingenting", async () => {
    setup();
    renderPage();
    const form = openEditor();
    fireEvent.click(within(form).getByRole("button", { name: "Slett arrangementet …" }));
    expect(screen.getByRole("alertdialog").textContent).not.toContain("kirkens kalender");
    await answerConfirm(/^Vil du slette «Gudstjeneste»/);

    await waitFor(() => expect(store.deleteWithStaffing).toHaveBeenCalledWith("e"));
    expect(surfaceServices.dismissExternalEvent).not.toHaveBeenCalled();
  });
});
