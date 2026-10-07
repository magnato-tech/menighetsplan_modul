// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Group, Person } from "../src/types";
import type { Session } from "../src/utils/session";

const kari: Person = { id: "kari", name: "Kari Nordmann", email: "kari@menigheten.no", globalRole: "admin" };
const ola: Person = { id: "ola", name: "Ola Hansen", email: "ola@eksempel.no", globalRole: "member" };
const account = (email: string) => ({ uid: `uid:${email}`, email, emailVerified: true });
const member = (person: Person): Session => ({ status: "member", person, account: account(person.email!) });

const { app } = vi.hoisted(() => ({
  app: {
    session: { status: "signedOut" } as Session,
    currentUser: { id: "", name: "", globalRole: "member" } as Person,
    groups: [] as Group[],
    signOut: vi.fn(async () => {}),
  },
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => app }));

import { AccountMenu } from "../src/components/AccountMenu";
import { SessionGate } from "../src/components/SessionGate";

/** Sets who is using the app, the way the provider would. */
const use = (session: Session) => {
  app.session = session;
  app.currentUser = session.status === "member" ? session.person : ({ id: "", name: "", globalRole: "member" } as Person);
};

const Where: React.FC = () => {
  const location = useLocation();
  return <p>Innloggingssiden: {location.pathname + location.search}</p>;
};
/** Opens an address behind the gate, with the sign-in page beside it to be sent to. */
const open = (address: string, requireAdmin = false) =>
  render(
    <MemoryRouter initialEntries={[address]}>
      <Routes>
        <Route path="/logg-inn" element={<Where />} />
        <Route
          path="*"
          element={
            <SessionGate requireAdmin={requireAdmin}>
              <p>Innholdet bak innlogging</p>
            </SessionGate>
          }
        />
      </Routes>
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  app.groups = [];
  use({ status: "signedOut" });
});

describe("Min side og admin ligger bak innlogging", () => {
  test("den som ikke er logget inn, sendes til innloggingssiden, som fører tilbake dit en ville", () => {
    use({ status: "signedOut" });
    open("/oppgave/lyd?fra=varsel");

    expect(screen.queryByText("Innholdet bak innlogging")).toBeNull();
    expect(screen.getByText("Innloggingssiden: /logg-inn?neste=%2Foppgave%2Flyd%3Ffra%3Dvarsel")).toBeTruthy();
  });

  test("den som er logget inn uten å stå i registeret, kommer heller ikke inn", () => {
    use({ status: "notInRegister", account: account("fremmed@eksempel.no"), reason: "noMatch" });
    open("/minside");

    expect(screen.queryByText("Innholdet bak innlogging")).toBeNull();
    expect(screen.getByText("Innloggingssiden: /logg-inn?neste=%2Fminside")).toBeTruthy();
  });

  test("før det er kjent hvem som spør, vises verken innholdet eller innloggingssiden", () => {
    use({ status: "loading" });
    open("/minside");

    expect(screen.getByText("Laster …")).toBeTruthy();
    expect(screen.queryByText("Innholdet bak innlogging")).toBeNull();
    expect(screen.queryByText(/Innloggingssiden/)).toBeNull();
  });

  test("et medlem kommer inn på Min side", () => {
    use(member(ola));
    open("/minside");
    expect(screen.getByText("Innholdet bak innlogging")).toBeTruthy();
  });
});

describe("Admin er for administratorer", () => {
  test("et medlem som åpner admin, får vite at det kreves administrator, og kommer ikke inn", () => {
    use(member(ola));
    open("/admin?tab=moduler", true);

    expect(screen.queryByText("Innholdet bak innlogging")).toBeNull();
    expect(screen.getByText("Admin-tilgang kreves")).toBeTruthy();
    expect(screen.getByText(/Ola Hansen er ikke administrator og har ikke tilgang til administrasjonen/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Tilbake til Min side/ }).getAttribute("href")).toBe("/minside");
  });

  test("en gruppeleder er ikke administrator", () => {
    app.groups = [{ id: "lyd", name: "Lyd", leaderIds: ["ola"], memberIds: [] } as unknown as Group];
    use(member(ola));
    open("/admin", true);
    expect(screen.queryByText("Innholdet bak innlogging")).toBeNull();
  });

  test("en administrator kommer inn", () => {
    use(member(kari));
    open("/admin?tab=moduler", true);
    expect(screen.getByText("Innholdet bak innlogging")).toBeTruthy();
  });

  test("den som ikke er logget inn, sendes til innloggingssiden også fra admin", () => {
    use({ status: "signedOut" });
    open("/admin?tab=moduler", true);
    expect(screen.getByText("Innloggingssiden: /logg-inn?neste=%2Fadmin%3Ftab%3Dmoduler")).toBeTruthy();
  });
});

describe("Hvem som er logget inn, står øverst på Min side", () => {
  test("navnet, rollen og veien ut", () => {
    app.groups = [{ id: "lyd", name: "Lyd", leaderIds: ["ola"], memberIds: [] } as unknown as Group];
    use(member(ola));
    render(<AccountMenu />);

    expect(screen.getByText("Ola Hansen")).toBeTruthy();
    expect(screen.getByText("Gruppeleder")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Logg ut" }));
    expect(app.signOut).toHaveBeenCalledTimes(1);
  });

  test("en administrator står som administrator, og uten innlogging vises ingenting", () => {
    use(member(kari));
    const { unmount } = render(<AccountMenu />);
    expect(screen.getByText("Administrator")).toBeTruthy();
    unmount();

    use({ status: "signedOut" });
    const { container } = render(<AccountMenu />);
    expect(container.textContent).toBe("");
  });
});
