// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { Group, Person } from "../src/types";
import { isInGroup } from "../src/utils/groups";
import type { PersonDirectoryRow } from "../src/utils/personDirectory";

// The filter on the Personer tab: role, group type and group, the handover to «Send e-post», and the lists
// saved from it. Everyone here is made up.

vi.mock("../src/firebase", async () => (await import("./support/offlineFirestore")).firebaseModuleMock);
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => ({}) }));
const operating = vi.hoisted(() => ({ mode: "production" as "demo" | "production" | null }));
vi.mock("../src/hooks/useOperatingMode", () => ({ useOperatingMode: () => operating.mode }));
const service = vi.hoisted(() => ({ save: vi.fn(async (_list: unknown) => undefined), lists: [] as unknown[] }));
vi.mock("../src/services/emailLists", () => ({
  subscribeEmailLists: (onChange: (lists: unknown[]) => void) => {
    onChange(service.lists);
    return () => undefined;
  },
  saveEmailList: service.save,
  renameEmailList: vi.fn(async () => undefined),
  setListPersons: vi.fn(async () => undefined),
  deleteEmailList: vi.fn(async () => undefined),
}));

import { PersonsTab } from "../src/pages/admin/tabs/PersonsTab";
import type { StudioData } from "../src/pages/admin/studio";
import { EPOST_HANDOVER_KEY } from "../src/utils/emailLists";

const person = (id: string, name: string, more: Partial<Person> = {}): Person => ({ id, name, globalRole: "member", ...more });
const group = (id: string, name: string, category: Group["category"], leaderIds: string[], memberIds: string[]): Group => ({ id, name, category, leaderIds, memberIds });

const hanne = person("hanne", "Hanne Husleder", { email: "hanne@example.org", congregationMember: true });
const lars = person("lars", "Lars Leder");
const nora = person("nora", "Nora Nestleder");
const ulf = person("ulf", "Ulf Uten");
const allPersons = [hanne, lars, nora, ulf];
const hus = group("hus", "Husgruppe øst", "husgruppe", ["hanne"], ["hanne", "nora"]);
const lyd = group("lyd", "Lyd og bilde", "tjenestegruppe", ["lars"], ["lars", "ulf"]);
const allGroups = [hus, lyd];

// The rows the administration builds from the groups, as useAdminDashboard does
const rowOf = (one: Person): PersonDirectoryRow => ({
  person: one,
  groups: allGroups.filter((g) => isInGroup(g, one.id)),
  leaderInGroups: allGroups.filter((g) => g.leaderIds.includes(one.id)),
  deputyInGroups: [],
});

const studio = {
  adminPersons: allPersons.map(rowOf),
  adminGroups: allGroups.map((g) => ({ group: g })),
  addPerson: vi.fn(),
  currentUser: person("kari", "Kari Nordmann", { globalRole: "admin" }),
} as unknown as StudioData;

const showFeedback = vi.fn();
const Where = () => <span data-testid="adresse">{useLocation().search}</span>;

const show = () =>
  render(
    <MemoryRouter initialEntries={["/admin?tab=planlegger-personer"]}>
      <PersonsTab studio={studio} showFeedback={showFeedback} />
      <Where />
    </MemoryRouter>
  );

/** Chooses one role and one type in the menus, as the administrator does. */
const chooseRole = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name: /^Rolle/ }));
  fireEvent.click(within(screen.getByRole("group", { name: "Rolle" })).getByLabelText(name));
};
const chooseType = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name: /^Gruppetype/ }));
  fireEvent.click(within(screen.getByRole("group", { name: "Gruppetype" })).getByLabelText(name));
};
const rowNames = () => screen.getAllByRole("row").slice(1).map((line) => line.textContent ?? "");

beforeEach(() => {
  window.sessionStorage.clear();
  service.lists = [{ id: "liste-ledere", name: "Ledere", kind: "fixed", personIds: [], createdAt: "2026-11-01", updatedAt: "2026-11-01", createdBy: "kari" }];
  service.save.mockClear();
  showFeedback.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Personer: filteret", () => {
  test("husgruppeledere gir én person, med oppsummeringen og de to knappene", () => {
    show();
    chooseRole("Leder");
    chooseType("Husgruppe");
    expect(rowNames()).toHaveLength(1);
    expect(screen.getByText("Hanne Husleder")).toBeTruthy();
    expect(screen.queryByText("Lars Leder")).toBeNull();
    expect(document.getElementById("filter-summary")?.textContent).toBe("1 person: Leder · Husgruppe");
    expect(screen.getByRole("button", { name: "Send e-post til utvalget (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lagre som liste (1)" })).toBeTruthy();
  });

  test("uten filter, og uten søk, vises ingen oppsummering og ingen knapper", () => {
    show();
    expect(rowNames()).toHaveLength(allPersons.length);
    expect(document.getElementById("filter-summary")).toBeNull();
    expect(screen.queryByRole("button", { name: /Lagre som liste/ })).toBeNull();
  });

  test("gruppevalget viser bare den gruppen", () => {
    show();
    fireEvent.change(screen.getByLabelText("Gruppe"), { target: { value: "lyd" } });
    expect(rowNames().map((line) => line.includes("Lars Leder") || line.includes("Ulf Uten"))).toEqual([true, true]);
    expect(document.getElementById("filter-summary")?.textContent).toBe("2 personer: Gruppe: Lyd og bilde");
  });
});

describe("Personer: å lagre og å sende utvalget", () => {
  test("«Lagre som liste» lagrer et filter, og listen får navnet", async () => {
    show();
    chooseRole("Leder");
    chooseType("Husgruppe");
    fireEvent.click(screen.getByRole("button", { name: "Lagre som liste (1)" }));
    fireEvent.change(screen.getByLabelText("Navn på listen"), { target: { value: "Husgrupper" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre liste" }));
    await waitFor(() => expect(service.save).toHaveBeenCalledTimes(1));
    expect(service.save.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: "Husgrupper", kind: "filter", filter: { roles: ["leader"], categories: ["husgruppe"] }, createdBy: "kari" })
    );
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("Listen «Husgrupper» er lagret."));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("med et søk er bare «Fast utvalg» tilbudt, og personene som vises, lagres", async () => {
    show();
    fireEvent.change(screen.getByPlaceholderText(/Søk etter navn/), { target: { value: "Lars" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre som liste (1)" }));
    expect(screen.queryByRole("radio", { name: /Oppdateres av seg selv/ })).toBeNull();
    expect((screen.getByRole("radio", { name: /Fast utvalg/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText("Navn på listen"), { target: { value: "Lars-listen" } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre liste" }));
    await waitFor(() => expect(service.save).toHaveBeenCalledTimes(1));
    const saved = service.save.mock.calls[0][0] as Record<string, unknown>;
    expect(saved).toEqual(expect.objectContaining({ name: "Lars-listen", kind: "fixed", personIds: ["lars"] }));
    expect(saved).not.toHaveProperty("filter");
  });

  test("«Lagre som liste» sier fra når navnet er tatt, og lagrer ikke", () => {
    show();
    chooseRole("Leder");
    fireEvent.click(screen.getByRole("button", { name: "Lagre som liste (2)" }));
    fireEvent.change(screen.getByLabelText("Navn på listen"), { target: { value: " ledere " } });
    fireEvent.click(screen.getByRole("button", { name: "Lagre liste" }));
    expect(screen.getByRole("alert").textContent).toBe("Det finnes allerede en liste med dette navnet.");
    expect(service.save).not.toHaveBeenCalled();
  });

  test("«Send e-post til utvalget» legger utvalget i overføringen og åpner Send e-post", () => {
    show();
    chooseRole("Leder");
    fireEvent.click(screen.getByRole("button", { name: "Send e-post til utvalget (2)" }));
    expect(JSON.parse(window.sessionStorage.getItem(EPOST_HANDOVER_KEY) ?? "null")).toEqual({ personIds: ["hanne", "lars"], label: "Utvalg: Leder" });
    expect(screen.getByTestId("adresse").textContent).toBe("?tab=epost");
  });

  test("med et søk heter utvalget «Utvalg fra Personer»", () => {
    show();
    fireEvent.change(screen.getByPlaceholderText(/Søk etter navn/), { target: { value: "Ulf" } });
    fireEvent.click(screen.getByRole("button", { name: "Send e-post til utvalget (1)" }));
    expect(JSON.parse(window.sessionStorage.getItem(EPOST_HANDOVER_KEY) ?? "null")).toEqual({ personIds: ["ulf"], label: "Utvalg fra Personer" });
  });
});
