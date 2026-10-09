// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Group, Person } from "../src/types";
import { mayStandIn, type Session } from "../src/utils/session";
import { demoDoors } from "../src/utils/demoDoor";

// The register of a made-up congregation
const kari: Person = { id: "kari", name: "Kari Nordmann", globalRole: "admin" };
const admin2: Person = { id: "anne", name: "Anne Aas", globalRole: "admin" };
const ola: Person = { id: "ola", name: "Ola Hansen", globalRole: "member" };
const ingrid: Person = { id: "ingrid", name: "Ingrid Berg", globalRole: "member" };
const jonas: Person = { id: "jonas", name: "Jonas Lie", globalRole: "member" };
const silje: Person = { id: "silje", name: "Silje Moen", globalRole: "member" };

const group = (id: string, leaderIds: string[], memberIds: string[], deputyLeaderIds: string[] = []) =>
  ({ id, name: id, leaderIds, memberIds, deputyLeaderIds }) as unknown as Group;
// Ola leads two groups and Ingrid one, as deputy. Silje is in two groups and Jonas in one.
const groups = [
  group("lyd", ["ola"], ["silje", "jonas"]),
  group("kjokken", ["ola"], ["silje"], ["ingrid"]),
];
const everyone = [silje, jonas, ingrid, ola, admin2, kari];

const { app, installation } = vi.hoisted(() => ({
  app: {
    session: { status: "signedOut" } as unknown,
    signOut: vi.fn(async () => {}),
    standInAs: undefined as undefined | ((personId: string) => void),
    allPersons: [] as unknown[],
    groups: [] as unknown[],
    registerReady: true,
  },
  installation: { demo: null as null | Record<string, string> },
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => app }));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ settings: { churchName: "Sentrumskirken" } }) }));
vi.mock("../src/services/auth", () => ({
  signInWithGoogle: vi.fn(),
  sendSignInLink: vi.fn(),
  isSignInLink: () => false,
  completeSignInLink: vi.fn(),
  describeSignInError: () => "Feil",
}));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));

import { SignInPage } from "../src/pages/SignInPage";

const Arrived: React.FC = () => {
  const location = useLocation();
  return <p>Kom til: {location.pathname + location.search}</p>;
};
/** The page as the app shows it. Going in makes the visitor that person, as the app does. */
const Page: React.FC = () => {
  const [, redraw] = React.useState(0);
  app.standInAs = (personId: string) => {
    const person = everyone.find((candidate) => candidate.id === personId)!;
    app.session = { status: "member", person, account: null } satisfies Session;
    redraw((n) => n + 1);
  };
  return <SignInPage />;
};
const open = (address = "/logg-inn") =>
  render(
    <MemoryRouter initialEntries={[address]}>
      <Routes>
        <Route path="/logg-inn" element={<Page />} />
        <Route path="*" element={<Arrived />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  app.session = { status: "signedOut" };
  app.allPersons = everyone;
  app.groups = groups;
  app.registerReady = true;
  installation.demo = {};
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  installation.demo = null;
});

describe("Hvem man går inn som i demoen", () => {
  test("tre veier inn, én for hver rolle, og redigeringen av nettsiden er ikke en egen", () => {
    const doors = demoDoors(everyone, groups);
    expect(doors.map((door) => door.way)).toEqual(["administrator", "gruppeleder", "medlem"]);
    expect(doors.map((door) => door.name)).toEqual(["Administrator", "Gruppeleder", "Frivillig"]);
    // No two ways in lead to the same role
    expect(new Set(doors.map((door) => door.person.id)).size).toBe(doors.length);
  });

  test("CMS-et er nevnt først i det administratoren gjør, så den som vil se det, finner veien", () => {
    const [administrator] = demoDoors(everyone, groups);
    expect(administrator.does).toMatch(/^Redigerer nettsiden \(CMS\)/);
  });

  test("hver vei starter på sitt sted", () => {
    const starts = Object.fromEntries(demoDoors(everyone, groups).map((door) => [door.way, door.start]));
    expect(starts).toEqual({ administrator: "/admin", gruppeleder: "/leder", medlem: "/minside" });
  });

  test("av dem med rollen velges den som er med i flest grupper, og navnet avgjør når det står likt", () => {
    const doors = Object.fromEntries(demoDoors(everyone, groups).map((door) => [door.way, door.person.name]));
    // Silje is in two groups, Jonas in one. Ola leads two, Ingrid one. The administrators are in none.
    expect(doors).toEqual({ administrator: "Anne Aas", gruppeleder: "Ola Hansen", medlem: "Silje Moen" });
  });

  test("samme register gir samme personer, uansett rekkefølgen det kommer i", () => {
    const names = (persons: Person[]) => demoDoors(persons, groups).map((door) => door.person.id);
    expect(names([...everyone].reverse())).toEqual(names(everyone));
  });

  test("en rolle ingen har, får ingen vei inn, og et tomt register gir ingen", () => {
    expect(demoDoors([kari, jonas], []).map((door) => door.way)).toEqual(["administrator", "medlem"]);
    expect(demoDoors([jonas], []).map((door) => door.way)).toEqual(["medlem"]);
    expect(demoDoors([], groups)).toEqual([]);
  });

  test("uten innlogging kommer man bare inn på en utviklers maskin og i demoen", () => {
    expect(mayStandIn({ developerMachine: false, demo: false })).toBe(false);
    expect(mayStandIn({ developerMachine: true, demo: false })).toBe(true);
    expect(mayStandIn({ developerMachine: false, demo: true })).toBe(true);
  });
});

describe("Veien inn i demoen", () => {
  test("siden ber ikke om innlogging: den har én knapp for hver vei inn, og administratoren med CMS-et står først", () => {
    open();

    expect(screen.getByRole("heading", { name: "Gå inn i demoen" })).toBeTruthy();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].textContent).toContain("Administrator");
    expect(buttons[0].textContent).toContain("Redigerer nettsiden (CMS), planlegger arrangementer og holder personregisteret");
    expect(screen.queryByRole("button", { name: /Rediger nettsiden/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Frivillig/ }).textContent).toContain("Du går inn som Silje Moen");
    expect(screen.getByRole("button", { name: /Gruppeleder/ }).textContent).toContain("Du går inn som Ola Hansen");
    expect(screen.getByRole("button", { name: /Administrator/ }).textContent).toContain("Du går inn som Anne Aas");
    expect(screen.queryByRole("button", { name: "Fortsett med Google" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send meg en lenke" })).toBeNull();
    expect(document.querySelector("input")).toBeNull();
    // Nor the list a developer chooses from on their own machine
    expect(document.querySelector("select")).toBeNull();
  });

  test("hver vei inn fører til sitt sted", () => {
    for (const [button, start] of [
      [/Frivillig/, "/minside"],
      [/Gruppeleder/, "/leder"],
      [/Administrator/, "/admin"],
    ] as const) {
      app.session = { status: "signedOut" };
      open();
      fireEvent.click(screen.getByRole("button", { name: button }));
      expect(screen.getByText(`Kom til: ${start}`)).toBeTruthy();
      cleanup();
    }
  });

  test("valget bestemmer hvor man kommer, også for den som trykket «Min Side» på nettsiden først", () => {
    open("/logg-inn?neste=%2Fminside");
    fireEvent.click(screen.getByRole("button", { name: /Administrator/ }));
    expect(screen.getByText("Kom til: /admin")).toBeTruthy();
  });

  test("den som er inne, kan velge på nytt: siden blir stående til noe er valgt", () => {
    app.session = { status: "member", person: silje, account: null } satisfies Session;
    open();
    expect(screen.getByRole("heading", { name: "Gå inn i demoen" })).toBeTruthy();
    expect(screen.queryByText(/Kom til/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Administrator/ }));
    expect(screen.getByText("Kom til: /admin")).toBeTruthy();
    expect((app.session as Session & { status: "member" }).person.name).toBe("Anne Aas");
  });

  test("til registeret har kommet, sier siden at den laster, og ikke at noen mangler", () => {
    app.registerReady = false;
    app.allPersons = [];
    open();
    expect(screen.getByText("Laster …")).toBeTruthy();
    expect(screen.queryByText(/ingen personer/)).toBeNull();
  });

  test("en demo uten personer sier det", () => {
    app.allPersons = [];
    open();
    expect(screen.getByText("Demoen har ingen personer å gå inn som ennå.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("hos en menighet er siden innloggingen, uten noen vei inn utenom", () => {
    installation.demo = null;
    render(
      <MemoryRouter initialEntries={["/logg-inn"]}>
        <SignInPage />
      </MemoryRouter>
    );
    // What a congregation's published app has: no stand-in at all
    expect(screen.getByRole("heading", { name: "Logg inn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fortsett med Google" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Frivillig|Gruppeleder|Administrator/ })).toBeNull();
  });
});
