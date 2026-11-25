// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import type { Gathering, Group, Task } from "../src/types";
import { combineDateAndTimeToIso } from "../src/utils/dates";
import { ConfirmProvider } from "../src/components/ConfirmProvider";
import { answerConfirm } from "./support/confirmDialog";

// Deleting an event from its own page, as the Kalender list does it (the «Rediger» dialog).

const { store } = vi.hoisted(() => ({
  store: {
    currentUser: { id: "admin", globalRole: "admin" },
    gatherings: [] as Gathering[],
    groups: [] as Group[],
    tasks: [] as Task[],
    assignments: [] as unknown[],
    deleteWithStaffing: vi.fn((_id: string) => ({ success: true })),
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
vi.mock("../src/hooks/useLevel", () => ({ useLevel: () => "planner" }));
vi.mock("../src/hooks/useGatheringTemplates", () => ({ useGatheringTemplates: () => ({ templates: [], ready: true }) }));

import { GatheringDetailView } from "../src/components/GatheringDetailView";
import { studioTabUrl as studioUrl } from "../src/pages/admin/studio";

const startsAt = combineDateAndTimeToIso("2026-11-08", "11:00");

function setup(extra: Partial<Gathering> = {}) {
  store.groups = [{ id: "lyd", name: "Lyd", memberIds: [], leaderIds: ["admin"], deputyLeaderIds: [], category: "tjenestegruppe" } as unknown as Group];
  store.gatherings = [{ id: "e", groupId: "lyd", title: "Gudstjeneste", startsAt, visibility: "offentlig", isGudstjeneste: true, ...extra } as Gathering];
  store.tasks = [{ id: "t1", gatheringId: "e", groupId: "lyd", title: "Lyd", status: "open", neededCount: 1 } as unknown as Task];
  store.assignments = [];
  store.deleteWithStaffing.mockClear();
}

/** Shows where the app has gone, with the query, and the message it was sent with. */
function Where() {
  const { pathname, search, state } = useLocation();
  return <p data-testid="where" data-state={JSON.stringify(state ?? null)}>{`${pathname}${search}`}</p>;
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
      <Where />
    </MemoryRouter>
  );
}

function openEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Rediger" }));
  return screen.getByRole("dialog");
}

afterEach(() => cleanup());

describe("Slett arrangementet på arrangementets egen side", () => {
  test("uten folk på oppgavene spør én gang med antall, og sletter og går tilbake til kalenderen", async () => {
    setup();
    renderPage();
    const form = openEditor();
    const area = within(form).getByRole("region", { name: "Slett arrangementet" });
    expect(area.textContent).toContain("Program og oppgaver slettes sammen med arrangementet.");
    expect(area.textContent).not.toContain("resten av serien");

    fireEvent.click(within(area).getByRole("button", { name: "Slett arrangementet …" }));
    const question = screen.getByRole("alertdialog");
    expect(question.textContent).toContain("Vil du slette «Gudstjeneste» (");
    expect(question.textContent).toContain("1 oppgave slettes også. Dette kan ikke angres.");
    expect(within(question).getByRole("button", { name: "Slett arrangementet" }).className).toContain("bg-red-700");
    await answerConfirm(/^Vil du slette «Gudstjeneste»/);

    await waitFor(() => expect(store.deleteWithStaffing).toHaveBeenCalledWith("e"));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe(studioUrl("planlegger-samlinger")));
    expect(screen.getByTestId("where").getAttribute("data-state")).toContain("Arrangementet ble slettet");
  });

  test("«Avbryt» i spørsmålet sletter ingenting", async () => {
    setup();
    renderPage();
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Slett arrangementet …" }));
    await answerConfirm(/^Vil du slette/, false);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(store.deleteWithStaffing).not.toHaveBeenCalled();
    expect(screen.getByTestId("where").textContent).toBe("/admin/samling/e");
  });

  test("står det folk på oppgavene, kommer listen over dem, og den sier at det ikke kan angres", async () => {
    setup();
    store.assignments = [{ id: "a1", taskId: "t1", personId: "p1", personName: "Astri Berg", response: "confirmed" }];
    renderPage();
    openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Slett arrangementet …" }));

    const warning = screen.getByRole("alertdialog", { name: "Slette arrangement med folk på oppgavene?" });
    expect(warning.textContent).toContain("Astri Berg");
    expect(warning.textContent).toContain("Dette kan ikke angres.");
    expect(store.deleteWithStaffing).not.toHaveBeenCalled();

    fireEvent.click(within(warning).getByRole("button", { name: "Fjern alle og slett arrangementet" }));
    expect(store.deleteWithStaffing).toHaveBeenCalledWith("e");
    await waitFor(() => expect(screen.getByTestId("where").getAttribute("data-state")).toContain("Arrangementet ble slettet"));
  });

  test("er arrangementet del av en serie, står det at bare dette slettes", () => {
    setup({ seriesId: "serie-1" });
    renderPage();
    const form = openEditor();
    const area = within(form).getByRole("region", { name: "Slett arrangementet" });
    expect(area.textContent).toContain("Bare dette arrangementet slettes, ikke resten av serien.");
    fireEvent.click(within(area).getByRole("button", { name: "Slett arrangementet …" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("Bare dette arrangementet slettes, ikke resten av serien.");
  });
});
