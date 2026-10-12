// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Group, Person } from "../src/types";
import { initialGroups, initialPersons } from "../src/data/mockData";
import { mayStandIn, type Session } from "../src/utils/session";
import { demoDoors, whereDoorLeads } from "../src/utils/demoDoor";

// A small register for predictable picks
const kari: Person = { id: "kari", name: "Kari Nordmann", globalRole: "admin" };
const admin2: Person = { id: "anne", name: "Anne Aas", globalRole: "admin" };
const ola: Person = { id: "ola", name: "Ola Hansen", globalRole: "member" };
const ingrid: Person = { id: "ingrid", name: "Ingrid Berg", globalRole: "member" };
const jonas: Person = { id: "jonas", name: "Jonas Lie", globalRole: "member" };
const silje: Person = { id: "silje", name: "Silje Moen", globalRole: "member" };
const ellen: Person = { id: "ellen", name: "Ellen Fossli", globalRole: "member" };
const hakon: Person = { id: "hakon", name: "Håkon Tveit", globalRole: "member" };

const group = (
  id: string,
  leaderIds: string[],
  memberIds: string[],
  deputyLeaderIds: string[] = [],
  category: Group["category"] = "tjenestegruppe"
) => ({ id, name: id, leaderIds, memberIds, deputyLeaderIds, category }) as unknown as Group;

const groups = [
  group("lyd", ["ola"], ["silje", "jonas"]),
  group("kjokken", ["ola"], ["silje"], ["ingrid"]),
  group("hus-a", ["ellen"], ["hakon"], [], "husgruppe"),
];
const everyone = [silje, jonas, ingrid, ola, admin2, kari, ellen, hakon];

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
  test("fem veier inn med ulike roller, og ingen deler person", () => {
    const doors = demoDoors(everyone, groups);
    expect(doors.map((door) => door.way)).toEqual([
      "administrator",
      "tjenestegruppeleder",
      "husgruppeleder",
      "tjenestegruppemedlem",
      "medlemUtenTjeneste",
    ]);
    expect(new Set(doors.map((door) => door.person.id)).size).toBe(5);
    expect(doors.every((door) => door.groupNames.length > 0 || door.way === "administrator")).toBe(true);
  });

  test("CMS-et er nevnt først i det administratoren gjør, så den som vil se det, finner veien", () => {
    const [administrator] = demoDoors(everyone, groups);
    expect(administrator.does).toMatch(/^Redigerer nettsiden \(CMS\)/);
  });

  test("hver vei starter på sitt sted", () => {
    const starts = Object.fromEntries(demoDoors(everyone, groups).map((door) => [door.way, door.start]));
    expect(starts).toEqual({
      administrator: "/admin",
      tjenestegruppeleder: "/leder",
      husgruppeleder: "/leder",
      tjenestegruppemedlem: "/minside",
      medlemUtenTjeneste: "/minside",
    });
  });

  test("adressen man var på vei til, beholdes når den ligger der veien inn fører", () => {
    const administrator = { start: "/admin" };
    expect(whereDoorLeads(administrator, "/admin?tab=demo-oppsett")).toBe("/admin?tab=demo-oppsett");
    expect(whereDoorLeads(administrator, "/admin/gruppe/g1")).toBe("/admin/gruppe/g1");
    expect(whereDoorLeads(administrator, "/admin")).toBe("/admin");
    expect(whereDoorLeads(administrator, "/minside")).toBe("/admin");
    expect(whereDoorLeads(administrator, "/administrasjon")).toBe("/admin");
    expect(whereDoorLeads({ start: "/minside" }, "/admin?tab=demo-oppsett")).toBe("/minside");
    expect(whereDoorLeads({ start: "/leder" }, "/lederskap")).toBe("/leder");
  });

  test("registeret velger forventede personer i små datasettet", () => {
    const doors = Object.fromEntries(demoDoors(everyone, groups).map((door) => [door.way, door.person.name]));
    expect(doors).toEqual({
      administrator: "Anne Aas",
      tjenestegruppeleder: "Ola Hansen",
      husgruppeleder: "Ellen Fossli",
      tjenestegruppemedlem: "Silje Moen",
      medlemUtenTjeneste: "Håkon Tveit",
    });
  });

  test("eksempelmenighetens register gir fem kjente testpersoner", () => {
    const byWay = Object.fromEntries(demoDoors(initialPersons, initialGroups).map((door) => [door.way, door]));
    expect(byWay.administrator?.person.name).toBe("Kari Nordmann");
    expect(byWay.tjenestegruppeleder?.person.name).toBe("Andreas Lind");
    expect(byWay.medlemUtenTjeneste?.person.name).toBe("Håkon Tveit");
    expect(byWay.husgruppeleder?.person.name).toBeTruthy();
    const volunteer = byWay.tjenestegruppemedlem?.person;
    expect(volunteer?.name).toBeTruthy();
    expect(
      initialGroups.some(
        (group) => (group.category ?? "tjenestegruppe") === "tjenestegruppe" && group.memberIds.includes(volunteer!.id)
      )
    ).toBe(true);
  });

  test("samme register gir samme personer, uansett rekkefølgen det kommer i", () => {
    const names = (persons: Person[]) => demoDoors(persons, groups).map((door) => door.person.id);
    expect(names([...everyone].reverse())).toEqual(names(everyone));
  });

  test("manglende roller gir færre veier, og et tomt register gir ingen", () => {
    expect(demoDoors([kari, jonas], []).map((door) => door.way)).toEqual(["administrator", "medlemUtenTjeneste"]);
    expect(demoDoors([jonas], []).map((door) => door.way)).toEqual(["medlemUtenTjeneste"]);
    expect(demoDoors([], groups)).toEqual([]);
  });

  test("uten innlogging kommer man bare inn på en utviklers maskin og i demoen", () => {
    expect(mayStandIn({ developerMachine: false, demo: false })).toBe(false);
    expect(mayStandIn({ developerMachine: true, demo: false })).toBe(true);
    expect(mayStandIn({ developerMachine: false, demo: true })).toBe(true);
  });
});

describe("Veien inn i demoen", () => {
  test("siden ber ikke om innlogging: fem valg, administratoren med CMS-et står først", () => {
    open();

    expect(screen.getByRole("heading", { name: "Gå inn i demoen" })).toBeTruthy();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    expect(buttons[0].textContent).toContain("Anne Aas");
    expect(buttons[0].textContent).toContain("Administrator");
    expect(buttons[0].textContent).toContain("Redigerer nettsiden (CMS), planlegger arrangementer og holder personregisteret");
    expect(screen.queryByRole("button", { name: /Rediger nettsiden/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Håkon Tveit/ }).textContent).toContain("Medlem uten tjenestegruppe");
    expect(screen.getByRole("button", { name: /Silje Moen/ }).textContent).toContain("Frivillig i tjenestegruppe");
    expect(screen.queryByRole("button", { name: "Fortsett med Google" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send meg en lenke" })).toBeNull();
    expect(document.querySelector("input")).toBeNull();
    expect(document.querySelector("select")).toBeNull();
  });

  test("hver vei inn fører til sitt sted", () => {
    for (const [button, start] of [
      [/Håkon Tveit/, "/minside"],
      [/Silje Moen/, "/minside"],
      [/Ola Hansen/, "/leder"],
      [/Anne Aas/, "/admin"],
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
    fireEvent.click(screen.getByRole("button", { name: /Anne Aas/ }));
    expect(screen.getByText("Kom til: /admin")).toBeTruthy();
  });

  test("en lenke til en fane i admin åpner fanen for den som går inn som administrator, og ikke for en frivillig", () => {
    open("/logg-inn?neste=%2Fadmin%3Ftab%3Ddemo-oppsett");
    fireEvent.click(screen.getByRole("button", { name: /Anne Aas/ }));
    expect(screen.getByText("Kom til: /admin?tab=demo-oppsett")).toBeTruthy();
    cleanup();

    app.session = { status: "signedOut" };
    open("/logg-inn?neste=%2Fadmin%3Ftab%3Ddemo-oppsett");
    fireEvent.click(screen.getByRole("button", { name: /Silje Moen/ }));
    expect(screen.getByText("Kom til: /minside")).toBeTruthy();
  });

  test("den som er inne, kan velge på nytt: siden blir stående til noe er valgt", () => {
    app.session = { status: "member", person: silje, account: null } satisfies Session;
    open();
    expect(screen.getByRole("heading", { name: "Gå inn i demoen" })).toBeTruthy();
    expect(screen.queryByText(/Kom til/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Anne Aas/ }));
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
    expect(screen.getByRole("heading", { name: "Logg inn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fortsett med Google" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Håkon Tveit|Silje Moen|Anne Aas/ })).toBeNull();
  });
});
