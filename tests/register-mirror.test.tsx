// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Person } from "../src/types";
import type { Login } from "../src/utils/logins";
import type { MirrorChanges } from "../src/utils/mirror";

// The database is stood in for: what it holds is what the test says, and what is written to it
// is kept for the test to look at.
const database = vi.hoisted(() => ({
  loginFollowers: new Set<(logins: unknown[], settled: boolean) => void>(),
  copyFollowers: new Set<(persons: unknown[], settled: boolean) => void>(),
  storeLogins: vi.fn(async (_changes: unknown) => {}),
  storeCopies: vi.fn(async (_changes: unknown) => {}),
}));

vi.mock("../src/services/registerMirror", () => ({
  subscribeLogins: (onChange: (logins: unknown[], settled: boolean) => void) => {
    database.loginFollowers.add(onChange);
    return () => database.loginFollowers.delete(onChange);
  },
  subscribePublicProfiles: (onChange: (persons: unknown[], settled: boolean) => void) => {
    database.copyFollowers.add(onChange);
    return () => database.copyFollowers.delete(onChange);
  },
  storeLoginChanges: database.storeLogins,
  storePublicProfileChanges: database.storeCopies,
}));

import { useRegisterMirror } from "../src/hooks/useRegisterMirror";

const holdsLogins = (logins: Login[], settled = true) => act(() => database.loginFollowers.forEach((follower) => follower(logins, settled)));
const holdsCopies = (copies: Person[], settled = true) => act(() => database.copyFollowers.forEach((follower) => follower(copies, settled)));
const writtenLogins = () => database.storeLogins.mock.calls.map(([changes]) => changes as MirrorChanges<Login>);
const writtenCopies = () => database.storeCopies.mock.calls.map(([changes]) => changes as MirrorChanges<Person>);

const kari: Person = { id: "kari", name: "Kari Nordmann", email: "kari@menigheten.no", globalRole: "admin" };
const ola: Person = { id: "ola", name: "Ola Hansen", email: "ola@eksempel.no", globalRole: "member" };
const liv: Person = {
  id: "liv",
  name: "Liv Pastor",
  email: "liv.privat@eksempel.no",
  globalRole: "member",
  isPublicProfile: true,
  consentToPublishGivenAt: "2026-09-01T10:00:00.000Z",
  publicTitle: "Pastor",
};
const karisLogin: Login = { id: "kari@menigheten.no", personId: "kari", role: "admin" };

const show = (persons: Person[], active = true) =>
  renderHook(({ register, on }) => useRegisterMirror(register, on, "kari@menigheten.no"), { initialProps: { register: persons, on: active } });

beforeEach(() => {
  database.loginFollowers.clear();
  database.copyFollowers.clear();
  database.storeLogins.mockReset().mockResolvedValue(undefined);
  database.storeCopies.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Innloggingene og de offentlige kopiene følger registeret", () => {
  test("første gang en administrator har appen åpen, skrives innloggingene til alle i registeret", async () => {
    show([kari, ola, liv]);
    holdsLogins([karisLogin]);
    holdsCopies([]);

    await waitFor(() => expect(writtenLogins()).toHaveLength(1));
    expect(writtenLogins()[0]).toEqual({
      set: [
        { id: "liv.privat@eksempel.no", personId: "liv", role: "member" },
        { id: "ola@eksempel.no", personId: "ola", role: "member" },
      ],
      remove: [],
    });
    expect(writtenCopies()).toHaveLength(1);
    expect(writtenCopies()[0].set.map((copy) => copy.id)).toEqual(["liv"]);
    expect(writtenCopies()[0].set[0].email).toBeUndefined();
  });

  test("når registeret endres, skrives det som følger av endringen", async () => {
    const { rerender } = show([kari, ola]);
    holdsLogins([karisLogin, { id: "ola@eksempel.no", personId: "ola", role: "member" }]);
    holdsCopies([]);
    expect(writtenLogins()).toEqual([]);
    expect(writtenCopies()).toEqual([]);

    // Ola is made an administrator, and gets a new address
    rerender({ register: [kari, { ...ola, email: "ola.ny@eksempel.no", globalRole: "admin" }], on: true });
    await waitFor(() => expect(writtenLogins()).toHaveLength(1));
    expect(writtenLogins()[0]).toEqual({
      set: [{ id: "ola.ny@eksempel.no", personId: "ola", role: "admin" }],
      remove: ["ola@eksempel.no"],
    });
  });

  test("den som ikke lenger vises på nettsiden, mister den offentlige kopien", async () => {
    show([kari, { ...liv, isPublicProfile: false }]);
    holdsLogins([karisLogin, { id: "liv.privat@eksempel.no", personId: "liv", role: "member" }]);
    holdsCopies([{ id: "liv", name: "Liv Pastor", globalRole: "member", isPublicProfile: true, consentToPublishGivenAt: "2026-09-01T10:00:00.000Z" }]);

    await waitFor(() => expect(writtenCopies()).toHaveLength(1));
    expect(writtenCopies()[0]).toEqual({ set: [], remove: ["liv"] });
    expect(writtenLogins()).toEqual([]);
  });

  test("ingenting skrives før databasen selv har sagt hva den holder", () => {
    show([kari, ola, liv]);
    // A copy in the browser, or a write of our own on its way
    holdsLogins([], false);
    holdsCopies([], false);

    expect(writtenLogins()).toEqual([]);
    expect(writtenCopies()).toEqual([]);
  });

  test("ingenting skrives for den som ikke er administrator, eller før hele registeret er kommet", () => {
    show([kari, ola, liv], false);

    expect(database.loginFollowers.size).toBe(0);
    expect(database.copyFollowers.size).toBe(0);
    expect(writtenLogins()).toEqual([]);
  });

  test("administratorens egen innlogging tas aldri bort", async () => {
    // Kari's address is put on a second person
    show([kari, { id: "tvilling", name: "Kari to", email: "kari@menigheten.no", globalRole: "member" }]);
    holdsLogins([karisLogin, { id: "sluttet@eksempel.no", personId: "gammel", role: "member" }]);
    holdsCopies([]);

    await waitFor(() => expect(writtenLogins()).toHaveLength(1));
    expect(writtenLogins()[0]).toEqual({ set: [], remove: ["sluttet@eksempel.no"] });
  });

  test("en skriving som blir avvist, prøves ikke om og om igjen", async () => {
    database.storeLogins.mockRejectedValue(new Error("Missing or insufficient permissions."));
    const { rerender } = show([kari, ola]);
    holdsLogins([karisLogin]);
    holdsCopies([]);
    await waitFor(() => expect(database.storeLogins).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(console.warn).toHaveBeenCalled());

    // The database says the same again, and the register changes: still nothing more is tried
    holdsLogins([karisLogin]);
    rerender({ register: [kari, ola, liv], on: true });
    holdsLogins([karisLogin]);
    expect(database.storeLogins).toHaveBeenCalledTimes(1);
  });
});
