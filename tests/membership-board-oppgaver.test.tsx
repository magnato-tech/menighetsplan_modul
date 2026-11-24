// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { MembershipClerkTask, Person } from "../src/types";

// The board «Oppgaver» with one open sign-in task, made-up people and no database.

const { tasks } = vi.hoisted(() => ({ tasks: { current: [] as MembershipClerkTask[] } }));
vi.mock("../src/demo", () => ({ DEMO: null }));
vi.mock("../src/hooks/useMembershipClerkTasks", () => ({ useMembershipClerkTasks: () => tasks.current }));
vi.mock("../src/hooks/useMembershipApplications", () => ({ useMembershipApplications: () => [] }));
vi.mock("../src/services/membershipClerkTasks", () => ({
  updateClerkTask: vi.fn(async () => undefined),
  ensureDemoMembershipClerkBoard: vi.fn(async () => undefined),
  ensureEnrollmentDateCorrectionTasks: vi.fn(async () => undefined),
}));
vi.mock("../src/services/writeErrors", () => ({ reportWriteError: vi.fn() }));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ settings: { churchName: "Lillesand Misjonskirke" } }) }));

const clerk = { id: "kari", name: "Kari Nordmann", email: "kari@eksempel.no", membershipClerk: true, globalRole: "member" } as unknown as Person;
vi.mock("../src/context/FirebaseDataContext", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFirebase: () => ({ currentUser: clerk, allPersons: [clerk], updatePerson: () => ({ success: true }) }),
}));

import { MembershipApplicationsTab } from "../src/pages/admin/tabs/MembershipApplicationsTab";

afterEach(() => {
  cleanup();
  tasks.current = [];
});

describe("Oppgaver-fanen for protokollansvarlig", () => {
  test("heading, linjen om hvem som gjør oppgavene, og et kort med eierbrikke og knappene", () => {
    tasks.current = [
      {
        id: "loginproblem-1",
        kind: "loginUnknownEmail",
        status: "open",
        createdAt: "2026-11-24T09:00:00.000Z",
        lastAttemptAt: "2026-11-24T09:00:00.000Z",
        attempts: 1,
        loginAddress: "ukjent@eksempel.no",
        loginReason: "noMatch",
        personId: "",
        personName: "",
        instruction: "ukjent@eksempel.no prøvde å logge inn, men adressen står ikke i registeret. Finn ut hvem det er, og legg til adressen på personen.",
      },
    ];
    render(
      <MemoryRouter>
        <MembershipApplicationsTab showFeedback={() => undefined} />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Oppgaver" })).toBeTruthy();
    expect(
      screen.getByText("Oppgaver merket Protokollansvarlig gjøres av protokollansvarlig, eller av en administrator når menigheten ikke har en.")
    ).toBeTruthy();
    expect(screen.getAllByText("Protokollansvarlig").length).toBeGreaterThan(0);
    // The protokollansvarlig is not an administrator here: the register lets only administrators add an address
    expect(screen.queryByRole("button", { name: "Legg til på person …" })).toBeNull();
    expect(screen.getByText(/Bare en administrator kan legge adressen til på en person/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ikke en av oss" })).toBeTruthy();
  });
});
