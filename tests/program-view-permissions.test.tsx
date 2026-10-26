// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ProgramItem } from "../src/types";

const { detail, firebase } = vi.hoisted(() => ({
  detail: {} as Record<string, unknown>,
  firebase: {} as Record<string, unknown>,
}));

vi.mock("../src/hooks/leaderHooks", () => ({
  useLeaderGatheringDetail: () => detail,
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => firebase,
}));

import { ProgramView } from "../src/components/gathering/ProgramView";
import { ProgramPostDialog } from "../src/components/gathering/ProgramPostDialog";
import { GatheringRunSheetPage } from "../src/pages/GatheringRunSheetPage";
import { buildRunSheet } from "../src/utils/runSheet";
import { canDeleteProgramItem } from "../src/utils/programEditor";

afterEach(() => cleanup());

// Local time, as the clock times are read in the browser
const STARTS_AT = new Date(2099, 0, 4, 10, 0).toISOString();

const POSTS: ProgramItem[] = [
  { id: "p1", time: "10:00", title: "Velkommen" },
  { id: "p2", time: "10:15", title: "Sang", description: "Tre sanger", taskId: "t-sang" },
  { id: "p3", time: "10:45", title: "Preken" },
];

function renderProgram({ edit = true, reorder = true, onChange = vi.fn() } = {}) {
  render(
    <ProgramView
      rows={buildRunSheet(POSTS, [], [])}
      items={POSTS}
      startsAt={STARTS_AT}
      canAdminister
      permissions={{ reorder, edit, deleteItem: canDeleteProgramItem }}
      onChangeProgram={onChange}
      emptyHint=""
    />
  );
  return onChange;
}

const rowOf = (title: string) => screen.getByText(title).closest("[id^='schedule-row-']") as HTMLElement;

describe("ProgramView", () => {
  test("viser blyant på hver post bare når man kan endre", () => {
    renderProgram({ edit: true });
    expect(screen.getAllByRole("button", { name: "Endre posten" })).toHaveLength(3);
    cleanup();

    renderProgram({ edit: false });
    expect(screen.queryAllByRole("button", { name: "Endre posten" })).toHaveLength(0);
  });

  test("blyanten åpner dialogen med posten", () => {
    renderProgram();
    fireEvent.click(within(rowOf("Velkommen")).getByRole("button", { name: "Endre posten" }));
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByLabelText("Tittel") as HTMLInputElement).value).toBe("Velkommen");
  });

  test("ny varighet gir nye klokkeslett for de andre postene", async () => {
    const onChange = renderProgram();
    fireEvent.click(within(rowOf("Velkommen")).getByRole("button", { name: "Endre posten" }));
    fireEvent.change(screen.getByLabelText("Varighet (min)"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const [saved, what] = onChange.mock.calls[0] as [ProgramItem[], string];
    expect(what).toBe("Endret «Velkommen»");
    expect(saved.map((item) => [item.title, item.time, item.durationMinutes])).toEqual([
      ["Velkommen", "10:00", 20],
      ["Sang", "10:20", 30],
      ["Preken", "10:50", 10],
    ]);
  });

  test("oppgavepost kan ikke slettes, ubundet post kan slettes etter bekreftelse", async () => {
    const onChange = renderProgram();

    fireEvent.click(within(rowOf("Sang")).getByRole("button", { name: "Endre posten" }));
    expect(screen.getByText("Koblet til en oppgave. Kan endres og flyttes, men ikke slettes.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Slett posten" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lukk" }));

    fireEvent.click(within(rowOf("Preken")).getByRole("button", { name: "Endre posten" }));
    fireEvent.click(screen.getByRole("button", { name: "Slett posten" }));
    expect(screen.getByText("Slette «Preken» fra programmet?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Slett" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const [saved, what] = onChange.mock.calls[0] as [ProgramItem[], string];
    expect(what).toBe("Slettet «Preken»");
    expect(saved.map((item) => item.title)).toEqual(["Velkommen", "Sang"]);
  });

  test("Alt og piltast flytter en post, og klokkeslettene følger med", () => {
    const onChange = renderProgram();
    const handle = screen.getByRole("button", { name: "Flytt programposten Velkommen" });
    fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [saved, what] = onChange.mock.calls[0] as [ProgramItem[], string];
    expect(what).toBe("Flyttet «Velkommen»");
    expect(saved.map((item) => [item.title, item.time])).toEqual([
      ["Sang", "10:00"],
      ["Velkommen", "10:30"],
      ["Preken", "10:45"],
    ]);
  });

  test("uten rett til å flytte finnes ikke håndtaket", () => {
    renderProgram({ reorder: false });
    expect(screen.queryByRole("button", { name: "Flytt programposten Velkommen" })).toBeNull();
  });
});

describe("ProgramPostDialog", () => {
  test("krever en tittel før posten lagres", () => {
    const onSave = vi.fn();
    render(<ProgramPostDialog canDelete onSave={onSave} onClose={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Skriv en tittel for posten.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Tittel"), { target: { value: "  Nattverd " } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: "Nattverd", durationMinutes: 10 });
  });
});

describe("GatheringRunSheetPage for møteleder", () => {
  const gathering = {
    id: "g1",
    title: "Søndagsgudstjeneste",
    startsAt: STARTS_AT,
    visibility: "intern",
    isPublic: false,
    programSchedule: POSTS,
  };
  const me = { id: "me", name: "Kari Nordmann", globalRole: "member" };
  const leaderTask = { id: "t-leder", gatheringId: "g1", title: "Møteleder", volunteerRoleId: "r-leder", status: "open" };

  function setUp(response: "confirmed" | "pending") {
    const updateGathering = vi.fn(() => ({ success: true }));
    Object.assign(detail, {
      hasAccess: true,
      isAdmin: false,
      currentUser: me,
      gathering,
      tasksWithDetails: [],
      programSchedule: POSTS,
      volunteerRoles: [{ id: "r-leder", name: "Møteleder" }],
      gatheringTasks: [leaderTask],
      updateGathering,
    });
    Object.assign(firebase, {
      watchGatheringAssignments: () => undefined,
      getGroupById: () => null,
      assignments: [{ id: "a1", taskId: "t-leder", personId: "me", response }],
    });
    render(
      <MemoryRouter>
        <GatheringRunSheetPage />
      </MemoryRouter>
    );
    return updateGathering;
  }

  test("møteleder ser programvisningen med «Ny programpost» og «Skriv ut», men ikke planleggingsknappene", () => {
    setUp("confirmed");
    expect(screen.getByRole("button", { name: "Ny programpost" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skriv ut" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hent fra mal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lag mal" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Endre posten" })).toHaveLength(3);
  });

  test("ny programpost lagres med bare de tre feltene, og kan angres", async () => {
    const updateGathering = setUp("confirmed");
    fireEvent.click(screen.getByRole("button", { name: "Ny programpost" }));
    fireEvent.change(screen.getByLabelText("Tittel"), { target: { value: "Nattverd" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));

    await waitFor(() => expect(updateGathering).toHaveBeenCalledTimes(1));
    const [id, updates] = updateGathering.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(id).toBe("g1");
    expect(Object.keys(updates).sort()).toEqual(["programEditedAt", "programEditedBy", "programSchedule"]);
    expect((updates.programSchedule as ProgramItem[]).map((item) => item.title)).toEqual(["Velkommen", "Sang", "Preken", "Nattverd"]);
    expect(updates.programEditedBy).toEqual({ assignmentId: "a1", personId: "me", personName: "Kari Nordmann" });

    expect(screen.getByRole("status").textContent).toContain("Lagret · La til «Nattverd»");
    fireEvent.click(screen.getByRole("button", { name: "Angre" }));
    await waitFor(() => expect(updateGathering).toHaveBeenCalledTimes(2));
    const undone = (updateGathering.mock.calls[1] as unknown as [string, Record<string, unknown>])[1];
    expect((undone.programSchedule as ProgramItem[]).map((item) => item.title)).toEqual(["Velkommen", "Sang", "Preken"]);
  });

  test("en som venter på svar ser ingen blyant", () => {
    setUp("pending");
    expect(screen.queryAllByRole("button", { name: "Endre posten" })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Ny programpost" })).toBeNull();
  });
});
