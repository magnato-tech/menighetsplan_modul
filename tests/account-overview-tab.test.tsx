// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, within, fireEvent } from "@testing-library/react";
import type { AccountListAnswer, AccountRow } from "../src/utils/accountOverview";
import type { Group, Person } from "../src/types";
import type { StudioData } from "../src/pages/admin/studio";

// The Innlogging tab with made-up people and accounts. The server call is replaced here.

const { requestAccountList } = vi.hoisted(() => ({ requestAccountList: vi.fn<() => Promise<AccountListAnswer>>() }));
vi.mock("../src/services/accountList", () => ({ requestAccountList }));

// The counts of sign-ins and Min side openings are followed live; here they are handed over as made-up days
const { subscribeSiteTraffic } = vi.hoisted(() => ({ subscribeSiteTraffic: vi.fn() }));
vi.mock("../src/services/siteTraffic", () => ({ subscribeSiteTraffic }));

// The log of the requests for a sign-in link is followed live as well; here it is handed over as made-up requests
const { subscribeLoginRequests } = vi.hoisted(() => ({ subscribeLoginRequests: vi.fn() }));
vi.mock("../src/services/loginRequests", () => ({ subscribeLoginRequests }));

import { AccountsTab } from "../src/pages/admin/tabs/AccountsTab";
import { emptyTrafficDay, osloDayAndHour, addDays, type TrafficDay } from "../src/utils/siteTraffic";

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
  subscribeSiteTraffic.mockReset();
  subscribeLoginRequests.mockReset();
});

/** Hands the days over to the section as soon as it subscribes, and stops nothing. */
const sendDays = (days: TrafficDay[]) =>
  subscribeSiteTraffic.mockImplementation((_from: string, _to: string, onChange: (days: TrafficDay[]) => void) => {
    onChange(days);
    return () => {};
  });
const today = osloDayAndHour(new Date()).date;
const yesterday = addDays(today, -1);

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

describe("Innlogginger per dag", () => {
  test("viser summene for perioden, fordelt på måte, og stolpene per dag", async () => {
    requestAccountList.mockResolvedValue(ok([]));
    sendDays([
      { ...emptyTrafficDay(yesterday), actions: { "innlogging-google": 2, "innlogging-lenke": 1, "minside-aapnet": 3 } },
      { ...emptyTrafficDay(today), actions: { "innlogging-epostlenke": 1 } },
    ]);
    render(<AccountsTab studio={studio} />);

    expect(await screen.findByText("Google 2 · E-postlenke 1 · Lenke fra e-post 1")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("(høyst én gang per nettleser per dag)")).toBeTruthy();
    expect(screen.getByRole("img", { name: /3 innlogginger, 3 åpnet Min side/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /1 innlogging, 0 åpnet Min side/ })).toBeTruthy();
  });

  test("viser teksten for når tellingen startet, og en rolig melding uten tellinger", async () => {
    requestAccountList.mockResolvedValue(ok([]));
    sendDays([]);
    render(<AccountsTab studio={studio} />);

    expect(await screen.findByText("Ingen innlogginger telt ennå. Tellingen startet da denne versjonen ble tatt i bruk.")).toBeTruthy();
    expect(screen.getByText("Telles fra og med i dag. Bare summer per dag, uten navn.")).toBeTruthy();
  });
});

describe("Lenkene som er bedt om", () => {
  test("viser de to listene: den som ikke har logget inn etter lenken, og adresser som ikke står i registeret", async () => {
    requestAccountList.mockResolvedValue(ok([]));
    subscribeLoginRequests.mockImplementation((_since: string, onChange: (requests: unknown[]) => void) => {
      onChange([
        { email: "ada@example.org", at: "2026-11-22T08:00:00.000Z", inRegister: true, result: "sent" },
        { email: "ada@example.org", at: "2026-11-23T08:00:00.000Z", inRegister: true, result: "sent" },
        { email: "bjorn@example.org", at: "2026-11-21T08:00:00.000Z", inRegister: true, result: "sent" },
        { email: "fremmed@example.org", at: "2026-11-20T08:00:00.000Z", inRegister: false, result: "limited" },
      ]);
      return () => {};
    });
    sendDays([]);
    render(<AccountsTab studio={studio} />);

    const notSignedIn = (await screen.findByRole("heading", { name: /Ba om lenke, men har ikke logget inn/ })).closest("section") as HTMLElement;
    const rows = within(notSignedIn).getAllByRole("listitem");
    // The leader first, then the others
    expect(rows[0].textContent).toContain("Bjørn Leder");
    expect(rows[0].textContent).toContain("Gruppeleder");
    expect(rows[1].textContent).toContain("Ada Admin");
    expect(rows[1].textContent).toContain("(2 ganger)");

    const notInRegister = screen.getByRole("heading", { name: /Ba om lenke med en adresse som ikke er i registeret/ }).closest("section") as HTMLElement;
    expect(within(notInRegister).getByText("fremmed@example.org")).toBeTruthy();
    expect(await screen.findByText("Ba om lenke: 4 (sendt 3, stoppet av sperren 1, feilet 0)")).toBeTruthy();
  });

  test("kan loggen ikke leses ennå, sies det rolig, og resten av fanen virker", async () => {
    requestAccountList.mockResolvedValue(ok([]));
    subscribeLoginRequests.mockImplementation((_since: string, _onChange: unknown, onError: (error: unknown) => void) => {
      onError({ code: "permission-denied", message: "Missing or insufficient permissions." });
      return () => {};
    });
    sendDays([]);
    render(<AccountsTab studio={studio} />);

    expect(await screen.findByText("Loggen kan ikke leses ennå. Databasereglene må publiseres på nytt i Firebase.")).toBeTruthy();
    expect(screen.getByText("Står i registeret, men har aldri logget inn")).toBeTruthy();
    expect(screen.queryByText(/Ba om lenke: /)).toBeNull();
  });
});
