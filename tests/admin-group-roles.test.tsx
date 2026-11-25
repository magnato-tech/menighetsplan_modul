// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Group, Task, VolunteerRole } from "../src/types";
import { ConfirmProvider } from "../src/components/ConfirmProvider";
import { answerConfirm } from "./support/confirmDialog";

// The service group's card in admin: the roles whose team is the group, and the change of them from here.

const { patchVolunteerRole, moveRoleTasksToTeam } = vi.hoisted(() => ({
  patchVolunteerRole: vi.fn(async () => undefined),
  moveRoleTasksToTeam: vi.fn(async () => undefined),
}));

const data = vi.hoisted(() => ({
  group: {
    id: "group-rigging",
    name: "Rigging",
    category: "tjenestegruppe",
    memberIds: [],
    leaderIds: [],
  } as Group,
  groups: [] as Group[],
  roles: [] as VolunteerRole[],
  tasks: [] as Task[],
}));

vi.mock("../src/services/volunteerRoles", () => ({
  patchVolunteerRole,
  moveRoleTasksToTeam,
}));

vi.mock("../src/utils/adminStudioRoutes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/utils/adminStudioRoutes")>()),
  useAdminDetailRoute: () => ({ kind: "group", id: "group-rigging" }),
}));

vi.mock("../src/hooks/useAppHooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/hooks/useAppHooks")>()),
  useAdminGroupDetail: () => ({
    isAdmin: true,
    currentUser: { id: "admin", name: "Administrator", globalRole: "admin" },
    group: data.group,
    members: [],
    availablePersonsToAdd: [],
    allPersons: [],
    groupGatherings: [],
    updateGroup: vi.fn(),
    addGroupMember: vi.fn(),
    removeGroupMember: vi.fn(),
  }),
}));

vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    gatherings: [],
    tasks: data.tasks,
    volunteerRoles: data.roles,
    groups: data.groups,
  }),
}));

vi.mock("../src/hooks/useGatheringTemplates", () => ({
  useGatheringTemplates: () => ({ templates: [], ready: true }),
}));

vi.mock("../src/hooks/useMemberProposals", () => ({
  useGroupProposals: () => [],
}));

vi.mock("../src/hooks/useHusfellesskap", () => ({ useHusfellesskap: (groupId?: string) => ({ group: { id: groupId } }) }));
vi.mock("../src/components/husfellesskap/CreateMeetingDialog", () => ({
  CreateMeetingDialog: () => <div role="dialog">Planlegg møter</div>,
}));

import { AdminGroupDetailPage } from "../src/pages/AdminGroupDetailPage";

const role = (id: string, name: string, groupId?: string): VolunteerRole =>
  ({ id, name, instruction: "", sortOrder: 0, ...(groupId ? { groupId } : {}) }) as VolunteerRole;

const task = (id: string, volunteerRoleId: string, groupId?: string) =>
  ({ id, gatheringId: "g1", title: id, status: "open", volunteerRoleId, ...(groupId ? { groupId } : {}) }) as Task;

const renderPage = () =>
  render(
    <MemoryRouter>
      <ConfirmProvider>
        <AdminGroupDetailPage />
      </ConfirmProvider>
    </MemoryRouter>
  );

const roleSection = () => document.getElementById("admin-group-roles-section") as HTMLElement;

beforeEach(() => {
  data.group = { id: "group-rigging", name: "Rigging", category: "tjenestegruppe", memberIds: [], leaderIds: [] };
  data.groups = [
    data.group,
    { id: "group-lyd", name: "Lyd og bilde", memberIds: [], leaderIds: [] },
  ];
  data.roles = [
    role("role-taler", "Taler", "group-rigging"),
    role("role-lovsang", "Lovsang", "group-rigging"),
    role("role-lyd", "Lyd", "group-lyd"),
    role("role-kjokken", "Kjøkken"),
  ];
  data.tasks = [
    task("t-taler", "role-taler", "group-rigging"),
    task("t-lyd", "role-lyd", "group-lyd"),
    task("t-lyd-2", "role-lyd"),
    task("t-kjokken", "role-kjokken"),
  ];
});

afterEach(() => {
  cleanup();
  patchVolunteerRole.mockClear();
  moveRoleTasksToTeam.mockClear();
});

describe("Roller i gruppen på gruppekortet i admin", () => {
  test("viser en brikke for hver rolle som hører til gruppen, og ingen andre", () => {
    renderPage();

    const section = within(roleSection());
    expect(section.getByText("Roller i gruppen (2)")).toBeTruthy();
    expect(section.getByText("Taler")).toBeTruthy();
    expect(section.getByText("Lovsang")).toBeTruthy();
    expect(section.queryByText("Lyd")).toBeNull();
    expect(section.getByRole("button", { name: "Ta Taler ut av gruppen" })).toBeTruthy();
  });

  test("uten roller står det en forklaring", () => {
    data.roles = [role("role-lyd", "Lyd", "group-lyd")];
    renderPage();

    expect(
      within(roleSection()).getByText("Ingen roller er knyttet til gruppen ennå. Legg til en rolle, så kommer oppgavene med rollen hit.")
    ).toBeTruthy();
  });

  test("en rolle uten team legges til gruppen uten å spørre, og oppgavene følger med", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "+ Legg til rolle" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Velg rolle" }), { target: { value: "role-kjokken" } });

    await waitFor(() => expect(patchVolunteerRole).toHaveBeenCalledWith("role-kjokken", { groupId: "group-rigging" }));
    expect(moveRoleTasksToTeam).toHaveBeenCalledWith("group-rigging", ["t-kjokken"]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(screen.getByText("Kjøkken er knyttet til Rigging. 1 oppgave ble flyttet til gruppen.")).toBeTruthy());
  });

  test("rollene i listen står sortert, med team i parentes, uten dem gruppen alt har", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "+ Legg til rolle" }));
    const options = within(screen.getByRole("combobox", { name: "Velg rolle" }))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["Velg en rolle", "Kjøkken", "Lyd (Lyd og bilde)"]);
  });

  test("en rolle fra et annet team viser valg under listen, og «Flytt hit» flytter den", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "+ Legg til rolle" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Velg rolle" }), { target: { value: "role-lyd" } });

    const choice = document.getElementById("add-role-choice") as HTMLElement;
    expect(within(choice).getByText("Lyd hører til Lyd og bilde.")).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(patchVolunteerRole).not.toHaveBeenCalled();

    fireEvent.click(within(choice).getByRole("button", { name: "Flytt hit" }));

    await waitFor(() => expect(patchVolunteerRole).toHaveBeenCalledWith("role-lyd", { groupId: "group-rigging" }));
    expect(moveRoleTasksToTeam).toHaveBeenCalledWith("group-rigging", ["t-lyd", "t-lyd-2"]);
    expect(document.getElementById("add-role-choice")).toBeNull();
  });

  test("«Avbryt» i valget endrer ingenting", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "+ Legg til rolle" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Velg rolle" }), { target: { value: "role-lyd" } });
    fireEvent.click(within(document.getElementById("add-role-choice") as HTMLElement).getByRole("button", { name: "Avbryt" }));

    expect(document.getElementById("add-role-choice")).toBeNull();
    expect(patchVolunteerRole).not.toHaveBeenCalled();
    expect(moveRoleTasksToTeam).not.toHaveBeenCalled();
  });

  test("«Del rollen» legger gruppen til ved siden av det andre teamet, og oppgavene beholder sitt team", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "+ Legg til rolle" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Velg rolle" }), { target: { value: "role-lyd" } });
    fireEvent.click(within(document.getElementById("add-role-choice") as HTMLElement).getByRole("button", { name: "Del rollen" }));

    await waitFor(() =>
      expect(patchVolunteerRole).toHaveBeenCalledWith("role-lyd", { groupId: "group-lyd", groupIds: ["group-lyd", "group-rigging"] })
    );
    expect(moveRoleTasksToTeam).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("Lyd deles nå av Lyd og bilde og Rigging. Nye gudstjenester får oppgaven som «Ikke fordelt», og lederne fordeler den.")).toBeTruthy()
    );
  });

  test("en delt rolle viser at den er delt, og × spør om hva som skjer med oppgavene", async () => {
    data.roles = [
      role("role-taler", "Taler", "group-rigging"),
      { ...role("role-lovsang", "Lovsang", "group-lyd"), groupIds: ["group-lyd", "group-rigging"] } as VolunteerRole,
    ];
    renderPage();

    const section = within(roleSection());
    expect(section.getByText("delt med Lyd og bilde")).toBeTruthy();

    fireEvent.click(section.getByRole("button", { name: "Ta Lovsang ut av gruppen" }));
    await answerConfirm(/Ta «Lovsang» ut av Rigging\? Oppgavene gruppen har med rollen går til Lyd og bilde\./, true);
    await waitFor(() =>
      expect(patchVolunteerRole).toHaveBeenCalledWith("role-lovsang", { groupId: "group-lyd" })
    );
  });

  test("× spør først, og fjerner rollen fra gruppen når man sier ja", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Ta Taler ut av gruppen" }));

    await answerConfirm(/Ta «Taler» ut av Rigging\? Oppgavene med rollen blir uten team, og lederen ser dem ikke lenger\./, true);

    await waitFor(() => expect(patchVolunteerRole).toHaveBeenCalledWith("role-taler", { groupId: undefined }));
    expect(moveRoleTasksToTeam).toHaveBeenCalledWith(undefined, ["t-taler"]);
    await waitFor(() => expect(screen.getByText("Taler er ikke lenger knyttet til et team. 1 oppgave er uten team nå.")).toBeTruthy());
  });

  test("gruppen som ikke er en tjenestegruppe, får ingen seksjon for roller", () => {
    data.group = { ...data.group, category: "husgruppe" };
    renderPage();

    expect(document.getElementById("admin-group-roles-section")).toBeNull();
  });
});
