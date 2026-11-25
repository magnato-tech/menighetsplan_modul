// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { Person } from "../src/types";
import { EPOST_HANDOVER_KEY } from "../src/utils/emailLists";

// The person card in admin: a fixed header and five tabs. The fields are the same as before, only where they sit
// has changed. The tab in the address (?fane=) decides which fields are shown.

type Detail = {
  isAdmin: boolean;
  isFullAdmin: boolean;
  clerkOnly: boolean;
  currentUser: Partial<Person> & { id: string };
  person: Person | undefined;
  personGroups: unknown[];
  updatePerson: ReturnType<typeof vi.fn>;
};

const kari: Person = {
  id: "p1",
  name: "Kari Nordmann",
  email: "kari@eksempel.no",
  phone: "912 34 567",
  globalRole: "admin",
  congregationMember: true,
} as Person;

let detail: Detail;

const fullAdmin = (): Detail => ({
  isAdmin: true,
  isFullAdmin: true,
  clerkOnly: false,
  currentUser: { id: "admin", globalRole: "admin" },
  person: kari,
  personGroups: [],
  updatePerson: vi.fn(() => ({ success: true })),
});

vi.mock("../src/utils/adminStudioRoutes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/utils/adminStudioRoutes")>()),
  useAdminDetailRoute: () => ({ kind: "person", id: "p1" }),
}));

vi.mock("../src/hooks/useAppHooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/hooks/useAppHooks")>()),
  useAdminPersonDetail: () => detail,
}));

vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({
    groups: [],
    gatherings: [],
    tasks: [],
    assignments: [],
    volunteerRoles: [],
    allPersons: [kari],
    currentUser: { id: "admin", globalRole: "admin" },
    addGroupMember: vi.fn(),
    removeGroupMember: vi.fn(),
  }),
}));

vi.mock("../src/components/admin/PersonMembershipLogSection", () => ({
  PersonMembershipLogSection: () => <div>Medlemskap – arkiv og logg</div>,
}));

vi.mock("../src/components/admin/ExtraEmailsEditor", () => ({
  ExtraEmailsEditor: () => <div>Andre e-postadresser</div>,
}));

import { AdminPersonDetailPage } from "../src/pages/AdminPersonDetailPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderCard(path = "/admin/person/p1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminPersonDetailPage />
      <LocationProbe />
    </MemoryRouter>
  );
}

const tabNames = () => screen.queryAllByRole("tab").map((tab) => tab.textContent);
const selectedTab = () => screen.getByRole("tab", { selected: true }).textContent;
const clickTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  detail = fullAdmin();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Personkortet har en fast del og fem faner", () => {
  test("fanene står i rekkefølgen Profil, Grupper og tjeneste, Medlemskap, Tilgang, Nettside", () => {
    renderCard();
    expect(tabNames()).toEqual(["Profil", "Grupper og tjeneste", "Medlemskap", "Tilgang", "Nettside"]);
    expect(selectedTab()).toBe("Profil");
  });

  test("hver fane viser sine felter, og de andre vises ikke", () => {
    renderCard();
    expect(document.getElementById("input-edit-person-name")).toBeTruthy();
    expect(document.getElementById("input-edit-person-birthdate")).toBeTruthy();
    expect(document.getElementById("check-edit-congregation")).toBeNull();

    clickTab("Grupper og tjeneste");
    expect(document.getElementById("person-groups-section")).toBeTruthy();
    expect(document.getElementById("input-edit-person-police")).toBeTruthy();
    expect(document.getElementById("input-edit-person-name")).toBeNull();

    clickTab("Medlemskap");
    expect(document.getElementById("check-edit-congregation")).toBeTruthy();
    expect(document.getElementById("input-edit-person-police")).toBeNull();

    clickTab("Tilgang");
    expect(document.getElementById("check-edit-membership-clerk")).toBeTruthy();
    expect(document.getElementById("select-edit-person-role")).toBeTruthy();
    expect(document.getElementById("check-edit-congregation")).toBeNull();

    clickTab("Nettside");
    expect(document.getElementById("input-edit-person-is-staff")).toBeTruthy();
    expect(document.getElementById("input-edit-person-public")).toBeTruthy();
    expect(document.getElementById("select-edit-person-role")).toBeNull();
  });

  test("valget av fane står i adressen, og erstatter den i stedet for å legge til", () => {
    renderCard();
    clickTab("Tilgang");
    expect(screen.getByTestId("location").textContent).toBe("/admin/person/p1?fane=tilgang");
  });

  test("piltastene flytter mellom fanene", () => {
    renderCard();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Profil" }), { key: "ArrowRight" });
    expect(selectedTab()).toBe("Grupper og tjeneste");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Grupper og tjeneste" }), { key: "End" });
    expect(selectedTab()).toBe("Nettside");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Nettside" }), { key: "ArrowRight" });
    expect(selectedTab()).toBe("Profil");
  });
});

describe("Adressen og fanene", () => {
  test("?fane=medlemskap åpner medlemskapsfanen", () => {
    renderCard("/admin/person/p1?fane=medlemskap");
    expect(selectedTab()).toBe("Medlemskap");
    expect(document.getElementById("check-edit-congregation")).toBeTruthy();
    expect(document.getElementById("input-edit-person-name")).toBeNull();
  });

  test("en ukjent verdi i adressen gir Profil", () => {
    renderCard("/admin/person/p1?fane=finnes-ikke");
    expect(selectedTab()).toBe("Profil");
  });
});

describe("Endringer på tvers av faner", () => {
  test("et felt skrevet i Profil er der igjen etter at man har vært i Tilgang", () => {
    renderCard();
    const nameField = document.getElementById("input-edit-person-name") as HTMLInputElement;
    fireEvent.change(nameField, { target: { value: "Kari Halvorsen" } });

    clickTab("Tilgang");
    clickTab("Profil");

    expect((document.getElementById("input-edit-person-name") as HTMLInputElement).value).toBe("Kari Halvorsen");
  });

  test("«Lagre» på en fane lagrer og viser «Lagret»", () => {
    renderCard();
    fireEvent.change(document.getElementById("input-edit-person-name") as HTMLInputElement, { target: { value: "Kari Halvorsen" } });
    clickTab("Tilgang");

    fireEvent.click(screen.getByRole("button", { name: "Lagre" }));

    expect(detail.updatePerson).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "Kari Halvorsen" }));
    expect(screen.getByRole("button", { name: "Lagret" })).toBeTruthy();
  });
});

describe("Send e-post fra kortet", () => {
  test("skriver overleveringen med bare denne personen og går til e-post", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Send e-post" }));

    expect(JSON.parse(sessionStorage.getItem(EPOST_HANDOVER_KEY) ?? "null")).toEqual({ personIds: ["p1"], label: "Kari Nordmann" });
    expect(screen.getByTestId("location").textContent).toBe("/admin?tab=epost");
  });
});

describe("Hvem som ser hva", () => {
  test("en protokollansvarlig uten admin-rolle ser bare medlemskap, ikke Tilgang og Nettside", () => {
    detail = {
      ...fullAdmin(),
      isAdmin: true,
      isFullAdmin: false,
      clerkOnly: true,
      currentUser: { id: "clerk", globalRole: "member", membershipClerk: true },
    };
    renderCard("/admin/person/p1?fane=nettside");

    expect(screen.queryByRole("tab", { name: "Tilgang" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Nettside" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Profil" })).toBeNull();
    expect(document.getElementById("check-edit-congregation")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send e-post" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Slett kontakt" })).toBeNull();
  });
});
