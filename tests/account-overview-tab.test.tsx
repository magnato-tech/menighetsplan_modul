// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within, fireEvent } from "@testing-library/react";
import type { AccountListAnswer, AccountRow } from "../src/utils/accountOverview";
import type { Group, Person } from "../src/types";
import type { StudioData } from "../src/pages/admin/studio";

// The Innlogging tab with made-up people and accounts. The server call is replaced here.

const { requestAccountList } = vi.hoisted(() => ({ requestAccountList: vi.fn<() => Promise<AccountListAnswer>>() }));
vi.mock("../src/services/accountList", () => ({ requestAccountList }));

import { AccountsTab } from "../src/pages/admin/tabs/AccountsTab";

const person = (id: string, name: string, email?: string): Person => ({ id, name, email, globalRole: "member" });
const persons = [person("ada", "Ada Admin", "ada@example.org"), person("bjorn", "Bjørn Leder", "bjorn@example.org"), person("uten", "Ulf Uten")];
const groups: Group[] = [{ id: "lyd", name: "Lyd", leaderIds: ["bjorn"], memberIds: [] }];
const studio = {
  adminPersons: persons.map((row) => ({ person: row })),
  adminGroups: groups.map((row) => ({ group: row })),
} as unknown as Pick<StudioData, "adminPersons" | "adminGroups">;

const ok = (accounts: AccountRow[]): AccountListAnswer => ({ ok: true, accounts, fetchedAt: "2026-11-24T10:00:00.000Z" });

afterEach(() => {
  cleanup();
  requestAccountList.mockReset();
});

describe("Innlogging-fanen", () => {
  test("viser listene med det som mangler, og merker gruppelederen som aldri har logget inn", async () => {
    requestAccountList.mockResolvedValue(
      ok([
        { email: "ada@example.org", emailVerified: true, disabled: false, provider: "google", createdAt: null, lastLoginAt: "2026-11-20T08:00:00.000Z" },
        { email: "gjest@example.org", emailVerified: false, disabled: false, provider: "e-postlenke", createdAt: null, lastLoginAt: null },
      ])
    );
    render(<AccountsTab studio={studio} />);

    expect(await screen.findByText("Ble stoppet – feil e-post?")).toBeTruthy();
    const notInRegister = screen.getByText("gjest@example.org").closest("li") as HTMLElement;
    expect(within(notInRegister).getByText("Ikke bekreftet")).toBeTruthy();

    const neverSignedIn = screen.getByText("Står i registeret, men har aldri logget inn").closest("section") as HTMLElement;
    expect(within(neverSignedIn).getByText("Bjørn Leder")).toBeTruthy();
    expect(within(neverSignedIn).getByText("Gruppeleder")).toBeTruthy();
    expect(within(screen.getByRole("heading", { name: "Kan ikke logge inn" }).closest("section") as HTMLElement).getByText("Mangler gyldig e-post")).toBeTruthy();
  });

  test("listen over dem som har logget inn er lukket til man åpner den", async () => {
    requestAccountList.mockResolvedValue(ok([{ email: "ada@example.org", emailVerified: true, disabled: false, provider: "google", createdAt: null, lastLoginAt: null }]));
    render(<AccountsTab studio={studio} />);

    const toggle = await screen.findByRole("button", { name: /Har logget inn \(1\)/ });
    expect(screen.queryByText("Ada Admin")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText("Ada Admin")).toBeTruthy();
  });

  test("ingen konfigurert tjenestenøkkel gir en rolig melding, og ingen lister", async () => {
    requestAccountList.mockResolvedValue({
      ok: false,
      reason: "no-service-account",
      message: "Tjenestenøkkelen FIREBASE_SERVICE_ACCOUNT mangler hos Vercel. Uten den kan oversikten ikke hente kontoene.",
    });
    render(<AccountsTab studio={studio} />);

    const message = await screen.findByRole("status");
    expect(message.textContent).toContain("Tjenestenøkkelen");
    expect(screen.queryByText("Ble stoppet – feil e-post?")).toBeNull();
  });
});
