// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { MembershipClerkTask, Person } from "../src/types";
import {
  closedTaskPatch,
  loginProblemInstruction,
  openBoardCount,
  openLoginTaskFor,
  taskOwnerLabel,
} from "../src/utils/membershipClerkTasks";

// The login task on the board, the dashboard line and the report from the sign-in page. The save
// paths, the register and the sign-in state are replaced with made-up ones.

const { updateClerkTask, updatePerson, reportWriteError } = vi.hoisted(() => ({
  updateClerkTask: vi.fn(async () => undefined),
  updatePerson: vi.fn(() => ({ success: true })),
  reportWriteError: vi.fn(),
}));
vi.mock("../src/services/membershipClerkTasks", () => ({ updateClerkTask }));
vi.mock("../src/services/writeErrors", () => ({ reportWriteError }));
vi.mock("../src/context/FirebaseDataContext", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFirebase: () => ({ updatePerson }),
}));

import { LoginProblemTaskCard } from "../src/pages/admin/membership/LoginProblemTaskCard";
import { LoginProblemNotice } from "../src/pages/admin/tabs/dashboard/LoginProblemNotice";

const person = (id: string, name: string): Person => ({ id, name, email: `${id}@eksempel.no`, globalRole: "member" } as Person);
const persons = [person("ola", "Ola Nordmann"), person("kari", "Kari Nordmann")];

const loginTask = (extra: Partial<MembershipClerkTask> = {}): MembershipClerkTask => ({
  id: "loginproblem-1",
  kind: "loginUnknownEmail",
  status: "open",
  createdAt: "2026-11-24T09:00:00.000Z",
  lastAttemptAt: "2026-11-24T09:30:00.000Z",
  attempts: 2,
  loginAddress: "ukjent@eksempel.no",
  loginReason: "noMatch",
  personId: "",
  personName: "",
  instruction: loginProblemInstruction("ukjent@eksempel.no", "noMatch"),
  ...extra,
});

afterEach(() => {
  cleanup();
  updateClerkTask.mockClear();
  updatePerson.mockClear();
});

const renderCard = (task: MembershipClerkTask, onCompleted = vi.fn()) =>
  render(
    <MemoryRouter>
      <LoginProblemTaskCard
        task={task}
        persons={persons}
        clerkName="Magnar Totland"
        mayAddAddress={true}
        busy={false}
        setBusy={() => undefined}
        onSaved={() => undefined}
        onError={() => undefined}
        onCompleted={onCompleted}
      />
    </MemoryRouter>
  );

describe("Oppgaven for en innlogging som ble stoppet", () => {
  test("viser instruks, siste forsøk, antall forsøk, eierbrikken og begge knappene", () => {
    renderCard(loginTask());
    expect(screen.getByText("Protokollansvarlig")).toBeTruthy();
    expect(screen.getByText("ukjent@eksempel.no prøvde å logge inn, men adressen står ikke i registeret. Finn ut hvem det er, og legg til adressen på personen.")).toBeTruthy();
    expect(screen.getByText(/Siste forsøk/)).toBeTruthy();
    expect(screen.getByText(/\(2 forsøk\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Legg til på person …" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ikke en av oss" })).toBeTruthy();
  });

  test("«Ikke en av oss» lukker oppgaven med kommentaren «Ikke en av oss.»", async () => {
    const onCompleted = vi.fn();
    renderCard(loginTask(), onCompleted);
    fireEvent.click(screen.getByRole("button", { name: "Ikke en av oss" }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(updateClerkTask).toHaveBeenCalledWith(
      "loginproblem-1",
      expect.objectContaining({ status: "done", doneBy: "Magnar Totland", comment: "Ikke en av oss." })
    );
    const [, patch] = updateClerkTask.mock.calls[0] as unknown as [string, { doneAt: string }];
    expect(typeof patch.doneAt).toBe("string");
  });

  test("«Legg til på person» legger adressen til den valgte personen, og lukker oppgaven med navnet", async () => {
    const onCompleted = vi.fn();
    renderCard(loginTask(), onCompleted);
    fireEvent.click(screen.getByRole("button", { name: "Legg til på person …" }));
    fireEvent.click(screen.getByRole("button", { name: "Kari Nordmann" }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(updatePerson).toHaveBeenCalledWith("kari", { extraEmails: [{ address: "ukjent@eksempel.no", copy: false, login: true }] });
    expect(updateClerkTask).toHaveBeenCalledWith(
      "loginproblem-1",
      expect.objectContaining({ status: "done", doneBy: "Magnar Totland", comment: "Lagt til på Kari Nordmann." })
    );
  });

  test("for en delt adresse vises «Åpne personene» og «Ordnet», ikke knappen for å legge til", async () => {
    const onCompleted = vi.fn();
    renderCard(loginTask({ loginReason: "shared", instruction: loginProblemInstruction("ukjent@eksempel.no", "shared") }), onCompleted);
    expect(screen.queryByRole("button", { name: "Legg til på person …" })).toBeNull();
    expect(screen.getByRole("link", { name: "Åpne personene" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ordnet" }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(updateClerkTask).toHaveBeenCalledWith("loginproblem-1", expect.objectContaining({ status: "done" }));
  });
});

describe("Oversikt og oppgavene", () => {
  test("Oversikt viser antallet med knappen til Oppgaver, og ingenting uten oppgaver", () => {
    const { unmount } = render(
      <MemoryRouter>
        <LoginProblemNotice count={3} />
      </MemoryRouter>
    );
    expect(screen.getByText("3 prøvde å logge inn med en ukjent e-postadresse")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Gå til Oppgaver" });
    expect(link.getAttribute("href")).toBe("/admin?tab=planlegger-medlemskap");
    unmount();

    const { container } = render(
      <MemoryRouter>
        <LoginProblemNotice count={0} />
      </MemoryRouter>
    );
    expect(container.textContent).toBe("");
  });

  test("eieren er Protokollansvarlig for alle slags oppgaver, og åpne innloggingsoppgaver finnes per adresse", () => {
    expect(taskOwnerLabel("application")).toBe("Protokollansvarlig");
    expect(taskOwnerLabel("loginUnknownEmail")).toBe("Protokollansvarlig");
    const open = loginTask();
    expect(openLoginTaskFor([open], "Ukjent@Eksempel.no")).toBe(open);
    expect(openLoginTaskFor([loginTask({ status: "done" })], "ukjent@eksempel.no")).toBeUndefined();
  });

  test("antallet på menyen teller åpne oppgaver, og en søknad med sin egen oppgave telles én gang", () => {
    const app = { id: "s1", kind: "congregationApply", status: "submitted", submittedAt: "2026-11-24T09:00:00.000Z" } as never;
    const withTask: MembershipClerkTask = { ...loginTask({ id: "app-task-s1", kind: "application", applicationId: "s1", loginAddress: undefined, loginReason: undefined }) };
    const loneApp = { id: "s2", kind: "congregationApply", status: "submitted", submittedAt: "2026-11-24T09:10:00.000Z" } as never;
    expect(openBoardCount([withTask], [app])).toBe(1);
    expect(openBoardCount([withTask], [app, loneApp])).toBe(2);
    expect(openBoardCount([loginTask(), loginTask({ id: "x", loginAddress: "b@eksempel.no" })], [])).toBe(2);
  });

  test("utførelsen skriver status, tid, hvem og kommentaren, og legger til på det som er der", () => {
    const patch = closedTaskPatch({ comment: "Ringt." }, "Magnar", "2026-11-24T10:00:00.000Z", "Ikke en av oss.");
    expect(patch).toEqual({ status: "done", doneAt: "2026-11-24T10:00:00.000Z", doneBy: "Magnar", comment: "Ringt. Ikke en av oss." });
    expect(closedTaskPatch({}, "Magnar", "t").comment).toBeUndefined();
  });
});
