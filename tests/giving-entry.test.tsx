// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Person } from "../src/types";
import type { Session } from "../src/utils/session";
import type { GivingAccess } from "../src/utils/giving/access";

// Who gets into the admin with a right in givertjeneste, and who does not. Everything here is made up.

const { app, giving } = vi.hoisted(() => ({
  app: {
    session: { status: "signedOut" } as Record<string, unknown>,
    currentUser: { id: "", name: "", globalRole: "member" } as Record<string, unknown>,
  },
  giving: {
    loading: false,
    access: null as GivingAccess | null,
  },
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => app }));
vi.mock("../src/hooks/useGivingAccess", () => ({
  useGivingAccess: () => ({ loading: giving.loading, access: giving.access, state: "active", reload: () => {} }),
}));

import { SessionGate } from "../src/components/SessionGate";

const ola: Person = { id: "ola", name: "Ola Hansen", email: "ola@eksempel.no", globalRole: "member" };
const kari: Person = { id: "kari", name: "Kari Nordmann", email: "kari@eksempel.no", globalRole: "admin" };
const member = (person: Person): Session =>
  ({ status: "member", person, account: { uid: `uid:${person.email}`, email: person.email, emailVerified: true } }) as Session;

const use = (session: Session) => {
  app.session = session as unknown as Record<string, unknown>;
  app.currentUser = session.status === "member" ? (session.person as unknown as Record<string, unknown>) : { id: "", name: "", globalRole: "member" };
};

const open = () =>
  render(
    <MemoryRouter initialEntries={["/admin?tab=giver-innstillinger"]}>
      <Routes>
        <Route
          path="*"
          element={
            <SessionGate requireAdmin>
              <p>Innholdet bak innlogging</p>
            </SessionGate>
          }
        />
      </Routes>
    </MemoryRouter>
  );

const oneRight = (person: Person): GivingAccess => ({
  address: person.email ?? "",
  personId: person.id,
  name: person.name,
  overview: true,
  budget: false,
  individual: false,
  manage: false,
  version: 1,
});

afterEach(() => {
  cleanup();
  giving.loading = false;
  giving.access = null;
  use({ status: "signedOut" });
});

describe("Admin for den som har en rettighet i givertjeneste", () => {
  test("en som bare har en rettighet kommer inn i admin", () => {
    use(member(ola));
    giving.access = oneRight(ola);
    open();

    expect(screen.getByText("Innholdet bak innlogging")).toBeTruthy();
  });

  test("et vanlig medlem uten rettighet blir stoppet, og får vite at det kreves administrator", () => {
    use(member(ola));
    giving.access = null;
    open();

    expect(screen.queryByText("Innholdet bak innlogging")).toBeNull();
    expect(screen.getByText("Admin-tilgang kreves")).toBeTruthy();
  });

  test("mens rettighetene leses, sies det ingenting om tilgangen", () => {
    use(member(ola));
    giving.loading = true;
    open();

    expect(screen.getByText("Laster …")).toBeTruthy();
    expect(screen.queryByText("Admin-tilgang kreves")).toBeNull();
    expect(screen.queryByText("Innholdet bak innlogging")).toBeNull();
  });

  test("en administrator kommer inn uten å lese rettighetene", () => {
    use(member(kari));
    giving.loading = true;
    open();

    expect(screen.getByText("Innholdet bak innlogging")).toBeTruthy();
  });
});
