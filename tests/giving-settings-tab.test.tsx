// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { GivingAccess, GoogleSignIn } from "../src/utils/giving/access";
import type { Person } from "../src/types";

// Gaveinnstillinger, with the database and the sign-in mocked: nothing is sent anywhere. Everything here is made up.

const { app, cms, state, installation, confirmMock } = vi.hoisted(() => ({
  app: {
    session: { status: "member", person: null, account: null } as unknown as Record<string, unknown>,
    currentUser: { id: "kari", name: "Kari Nordmann", globalRole: "admin" } as Record<string, unknown>,
    allPersons: [] as Record<string, unknown>[],
  },
  cms: {
    addons: { givertjeneste: true } as Record<string, boolean>,
    addonsState: "ready" as const,
    settings: { vippsNumber: "", vippsDescription: "", bankAccount: "", orgNumber: "" },
  },
  state: {
    own: null as GivingAccess | null,
    list: [] as GivingAccess[],
    listError: null as unknown,
    google: { withGoogle: true, googleId: "g-kari" } as GoogleSignIn,
    lookup: null as string | null,
  },
  installation: { demo: null as null | object },
  confirmMock: vi.fn(async (_text: string, _options?: unknown) => true),
}));

vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => app }));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
vi.mock("../src/components/ConfirmProvider", () => ({ useConfirm: () => confirmMock }));
vi.mock("../src/services/writeErrors", () => ({ reportWriteError: vi.fn() }));
vi.mock("../src/services/auth", () => ({
  readGoogleSignIn: vi.fn(async () => state.google),
}));
vi.mock("../src/services/giving/access", () => ({
  subscribeOwnAccess: (_address: string, onChange: (access: GivingAccess | null) => void) => {
    onChange(state.own);
    return () => undefined;
  },
  subscribeAllAccess: (onChange: (list: GivingAccess[]) => void, onError: (error: unknown) => void) => {
    if (state.listError) onError(state.listError);
    else onChange(state.list);
    return () => undefined;
  },
  lookupLoginPersonId: vi.fn(async (_address: string) => state.lookup),
  saveAccess: vi.fn(async (_access: GivingAccess, _action: string, _byPersonId: string) => undefined),
}));

import { GivingSettingsTab } from "../src/pages/admin/tabs/GivingSettingsTab";
import { lookupLoginPersonId, saveAccess } from "../src/services/giving/access";
import { reportWriteError } from "../src/services/writeErrors";

const showFeedback = vi.fn();
const renderTab = async () => {
  render(<GivingSettingsTab showFeedback={showFeedback} />);
  // The sign-in is read before the rights are known, and the list after that: wait until the page has its answers
  await waitFor(() => expect(screen.queryByText(/^Henter/)).toBeNull());
};

const kari = { id: "kari", name: "Kari Nordmann", email: "kari@eksempel.no", globalRole: "admin" } as Person;
const ola = { id: "ola", name: "Ola Hansen", email: "ola@eksempel.no", globalRole: "member" } as Person;

/** Who is signed in, with a confirmed account address. */
const signIn = (person: Person) => {
  app.session = { status: "member", person, account: { uid: `uid:${person.email}`, email: person.email, emailVerified: true } };
  app.currentUser = person as unknown as Record<string, unknown>;
};

const right = (address: string, personId: string, name: string, more: Partial<GivingAccess> = {}): GivingAccess => ({
  address,
  personId,
  name,
  overview: true,
  budget: false,
  individual: false,
  manage: false,
  version: 1,
  updatedAt: "2026-11-01T10:00:00.000Z",
  updatedBy: "kari",
  ...more,
});

/** Kari holds every right and is signed in with Google: the active state, which shows the list and the form. */
const kariActive = () => {
  signIn(kari);
  state.own = right("kari@eksempel.no", "kari", "Kari Nordmann", { overview: true, budget: true, individual: true, manage: true, googleId: "g-kari" });
  state.google = { withGoogle: true, googleId: "g-kari" };
};

const row = (name: string) => within(screen.getByText(name, { selector: "p" }).closest("li") as HTMLElement);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  installation.demo = null;
  app.allPersons = [];
  state.own = null;
  state.list = [];
  state.listError = null;
  state.google = { withGoogle: true, googleId: "g-kari" };
  state.lookup = null;
  cms.settings = { vippsNumber: "", vippsDescription: "", bankAccount: "", orgNumber: "" };
  confirmMock.mockImplementation(async () => true);
});

describe("Din tilgang", () => {
  test("uten noen rettighet står det at administrator ikke gir tilgang", async () => {
    signIn(ola);
    await renderTab();

    expect(screen.getByText(/Å være administrator gir ikke tilgang/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Hvem har tilgang" })).toBeNull();
  });

  test("tilgangen er klar til å tas i bruk: knappen tar den i bruk med navnet i registeret og Google-kontoen", async () => {
    signIn(ola);
    state.own = right("ola@eksempel.no", "ola", "Ola H.", { overview: true, individual: true });
    state.google = { withGoogle: true, googleId: "g-ola" };
    await renderTab();

    expect(screen.getByText("Tilgangen er klar til å tas i bruk med Google-kontoen du er logget inn med.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ta i bruk tilgangen" }));

    await waitFor(() => expect(saveAccess).toHaveBeenCalledTimes(1));
    const [access, action, byPersonId] = vi.mocked(saveAccess).mock.calls[0];
    expect(action).toBe("activate");
    expect(byPersonId).toBe("ola");
    expect(access).toMatchObject({ googleId: "g-ola", name: "Ola Hansen", personId: "ola", version: 2, overview: true, individual: true });
    expect(showFeedback).toHaveBeenCalledWith("Tilgangen er tatt i bruk.");
  });

  test("uten Google-innlogging må personen logge inn med Google først", async () => {
    signIn(ola);
    state.own = right("ola@eksempel.no", "ola", "Ola Hansen", { googleId: "g-ola" });
    state.google = { withGoogle: false, googleId: null };
    await renderTab();

    expect(screen.getByText("Logg ut, og logg inn med Google for å bruke tilgangen.")).toBeTruthy();
  });

  test("med en annen Google-konto enn den tilgangen er tatt i bruk med", async () => {
    signIn(ola);
    state.own = right("ola@eksempel.no", "ola", "Ola Hansen", { googleId: "g-ola" });
    state.google = { withGoogle: true, googleId: "g-annen" };
    await renderTab();

    expect(screen.getByText("Tilgangen er tatt i bruk med en annen Google-konto. Den som har «Tilganger», må tilbakestille den.")).toBeTruthy();
  });

  test("tilgangen gjelder en annen person", async () => {
    signIn(ola);
    state.own = right("ola@eksempel.no", "kari", "Ola Hansen", { googleId: "g-ola" });
    await renderTab();

    expect(screen.getByText("Tilgangen på denne e-postadressen gjelder en annen person. Den som har «Tilganger», må gi den på nytt.")).toBeTruthy();
  });
});

describe("Hvem har tilgang", () => {
  test("listen er sortert på navn, og viser adresse, rettigheter og status", async () => {
    kariActive();
    state.list = [
      right("ola@eksempel.no", "ola", "Ola Hansen", { googleId: "g-ola", overview: false, individual: true }),
      right("anne@eksempel.no", "anne", "Anne Berg", { manage: true }),
    ];
    await renderTab();

    const names = screen.getAllByText(/Ola Hansen|Anne Berg/, { selector: "p" }).map((node) => node.textContent);
    expect(names).toEqual(["Anne Berg", "Ola Hansen"]);
    expect(row("Ola Hansen").getByText("ola@eksempel.no")).toBeTruthy();
    expect(row("Ola Hansen").getByText("Givere")).toBeTruthy();
    expect(row("Ola Hansen").getByText("I bruk")).toBeTruthy();
    expect(row("Anne Berg").getByText("Venter på at personen tar den i bruk")).toBeTruthy();
  });

  test("den innloggedes egen rad kan ikke endres, og det står hvorfor", async () => {
    kariActive();
    state.list = [state.own as GivingAccess, right("ola@eksempel.no", "ola", "Ola Hansen")];
    await renderTab();

    expect(row("Kari Nordmann").getByText("Din egen tilgang kan bare endres av en annen med «Tilganger».")).toBeTruthy();
    expect(row("Kari Nordmann").queryByRole("button", { name: "Endre" })).toBeNull();
    expect(row("Kari Nordmann").queryByRole("button", { name: "Fjern all tilgang" })).toBeNull();
    expect(row("Ola Hansen").getByRole("button", { name: "Endre" })).toBeTruthy();
  });

  test("Fjern all tilgang spør først, og setter alle fire rettigheter til nei i stedet for å slette raden", async () => {
    kariActive();
    state.list = [right("ola@eksempel.no", "ola", "Ola Hansen", { googleId: "g-ola", individual: true, manage: true, version: 4 })];
    await renderTab();

    fireEvent.click(row("Ola Hansen").getByRole("button", { name: "Fjern all tilgang" }));

    await waitFor(() => expect(saveAccess).toHaveBeenCalledTimes(1));
    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining("Ola Hansen"), expect.objectContaining({ danger: true }));
    const [access, action, byPersonId] = vi.mocked(saveAccess).mock.calls[0];
    expect(action).toBe("change");
    expect(byPersonId).toBe("kari");
    expect(access).toMatchObject({ overview: false, budget: false, individual: false, manage: false, version: 5, personId: "ola", googleId: "g-ola" });
  });

  test("Fjern all tilgang gjøres ikke når det ikke bekreftes", async () => {
    kariActive();
    state.list = [right("ola@eksempel.no", "ola", "Ola Hansen")];
    confirmMock.mockImplementationOnce(async () => false);
    await renderTab();

    fireEvent.click(row("Ola Hansen").getByRole("button", { name: "Fjern all tilgang" }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(saveAccess).not.toHaveBeenCalled();
  });

  test("Endre viser de fire rettighetene med avkryssing, og Lagre endrer dem", async () => {
    kariActive();
    state.list = [right("ola@eksempel.no", "ola", "Ola Hansen", { googleId: "g-ola" })];
    await renderTab();

    fireEvent.click(row("Ola Hansen").getByRole("button", { name: "Endre" }));
    const boxes = row("Ola Hansen").getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([true, false, false, false]);
    fireEvent.click(boxes[2]);
    fireEvent.click(row("Ola Hansen").getByRole("button", { name: "Lagre" }));

    await waitFor(() => expect(saveAccess).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveAccess).mock.calls[0][0]).toMatchObject({ overview: true, individual: true, budget: false, manage: false, version: 2 });
  });

  test("Tilbakestill Google-konto vises bare når en Google-konto er tatt i bruk", async () => {
    kariActive();
    state.list = [
      right("ola@eksempel.no", "ola", "Ola Hansen", { googleId: "g-ola" }),
      right("anne@eksempel.no", "anne", "Anne Berg"),
    ];
    await renderTab();

    expect(row("Ola Hansen").getByRole("button", { name: "Tilbakestill Google-konto" })).toBeTruthy();
    expect(row("Anne Berg").queryByRole("button", { name: "Tilbakestill Google-konto" })).toBeNull();

    fireEvent.click(row("Ola Hansen").getByRole("button", { name: "Tilbakestill Google-konto" }));
    await waitFor(() => expect(saveAccess).toHaveBeenCalledTimes(1));
    const [access] = vi.mocked(saveAccess).mock.calls[0];
    expect("googleId" in access).toBe(false);
  });

  test("en lesing som databasen avviser, sier det med de ordene", async () => {
    kariActive();
    state.listError = { code: "permission-denied" };
    await renderTab();

    expect(screen.getByRole("alert").textContent).toBe("Databasen avviste lesingen. Sikkerhetsreglene må publiseres på nytt.");
  });

  test("uten «Tilganger» vises ikke listen", async () => {
    signIn(ola);
    state.own = right("ola@eksempel.no", "ola", "Ola Hansen", { googleId: "g-ola", overview: true });
    await renderTab();

    expect(screen.queryByRole("heading", { name: "Hvem har tilgang" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Gi tilgang" })).toBeNull();
  });
});

describe("Gi tilgang", () => {
  test("ingenting er valgt fra start", async () => {
    kariActive();
    await renderTab();

    expect((screen.getByLabelText("E-post") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Navn") as HTMLInputElement).value).toBe("");
    for (const box of screen.getAllByRole("checkbox") as HTMLInputElement[]) expect(box.checked).toBe(false);
  });

  test("hver feil sies, og personen slås ikke opp før de andre sjekkene er gjort", async () => {
    kariActive();
    await renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Gi tilgang" }));
    expect(screen.getByRole("alert").textContent).toBe("Skriv e-postadressen.");

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "ny@eksempel.no" } });
    fireEvent.click(screen.getByRole("button", { name: "Gi tilgang" }));
    expect(screen.getByRole("alert").textContent).toBe("Skriv navnet.");

    fireEvent.change(screen.getByLabelText("Navn"), { target: { value: "Ny Person" } });
    fireEvent.click(screen.getByRole("button", { name: "Gi tilgang" }));
    expect(screen.getByRole("alert").textContent).toBe("Velg minst én tilgang.");

    expect(lookupLoginPersonId).not.toHaveBeenCalled();
    expect(saveAccess).not.toHaveBeenCalled();
  });

  test("en adresse som ikke står som innlogging for noen, gir ikke tilgang", async () => {
    kariActive();
    state.lookup = null;
    await renderTab();

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "ny@eksempel.no" } });
    fireEvent.change(screen.getByLabelText("Navn"), { target: { value: "Ny Person" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /^Oversikt/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gi tilgang" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Adressen står ikke som innlogging for noen i personregisteret."));
    expect(lookupLoginPersonId).toHaveBeenCalledWith("ny@eksempel.no");
    expect(saveAccess).not.toHaveBeenCalled();
  });

  test("en gyldig tilgang lagres for personen i registeret, og skjemaet tømmes etterpå", async () => {
    kariActive();
    state.lookup = "ny-person";
    await renderTab();

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "  Ny@Eksempel.no " } });
    fireEvent.change(screen.getByLabelText("Navn"), { target: { value: "Ny Person" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /^Givere/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gi tilgang" }));

    await waitFor(() => expect(saveAccess).toHaveBeenCalledTimes(1));
    const [access, action, byPersonId] = vi.mocked(saveAccess).mock.calls[0];
    expect(action).toBe("grant");
    expect(byPersonId).toBe("kari");
    expect(access).toMatchObject({ address: "ny@eksempel.no", personId: "ny-person", name: "Ny Person", individual: true, overview: false, version: 1 });
    expect("googleId" in access).toBe(false);
    await waitFor(() => expect((screen.getByLabelText("E-post") as HTMLInputElement).value).toBe(""));
    expect((screen.getByLabelText("Navn") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("checkbox", { name: /^Givere/ }) as HTMLInputElement).checked).toBe(false);
    expect(showFeedback).toHaveBeenCalledWith("Ny Person har fått tilgang.");
  });

  test("en mislykket lagring meldes, og skjemaet beholdes", async () => {
    kariActive();
    state.lookup = "ny-person";
    vi.mocked(saveAccess).mockRejectedValueOnce(new Error("Nettet svarte ikke"));
    await renderTab();

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "ny@eksempel.no" } });
    fireEvent.change(screen.getByLabelText("Navn"), { target: { value: "Ny Person" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /^Givere/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gi tilgang" }));

    await waitFor(() => expect(reportWriteError).toHaveBeenCalledWith("gi tilgangen", expect.any(Error)));
    expect((screen.getByLabelText("Navn") as HTMLInputElement).value).toBe("Ny Person");
  });

  test("en adresse som allerede har en rettighet, sendes ikke på nytt", async () => {
    kariActive();
    state.list = [right("ola@eksempel.no", "ola", "Ola Hansen", { googleId: "g-ola" })];
    await renderTab();

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "OLA@eksempel.no" } });
    fireEvent.change(screen.getByLabelText("Navn"), { target: { value: "Ola" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /^Givere/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gi tilgang" }));

    expect(screen.getByRole("alert").textContent).toBe("Adressen står allerede i listen. Endre den der.");
    expect(lookupLoginPersonId).not.toHaveBeenCalled();
  });
});

describe("Demoen", () => {
  test("viser en merknad om at alle kan se og endre, og ingen innlogging eller egen tilgang", async () => {
    installation.demo = {};
    kariActive();
    await renderTab();

    expect(screen.getByText(/Demo: her kan alle se og endre/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Din tilgang" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Hvem har tilgang" })).toBeTruthy();
  });

  test("en ny tilgang slås opp blant personene i demoen, uten innlogging", async () => {
    installation.demo = {};
    kariActive();
    app.allPersons = [ola as unknown as Record<string, unknown>];
    await renderTab();

    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "ola@eksempel.no" } });
    fireEvent.change(screen.getByLabelText("Navn"), { target: { value: "Ola Hansen" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /^Oversikt/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gi tilgang" }));

    await waitFor(() => expect(saveAccess).toHaveBeenCalledTimes(1));
    expect(lookupLoginPersonId).not.toHaveBeenCalled();
    expect(vi.mocked(saveAccess).mock.calls[0][0]).toMatchObject({ personId: "ola", address: "ola@eksempel.no" });
  });
});

describe("Betalingsinformasjon", () => {
  test("uten noe lagt inn: det står det", async () => {
    kariActive();
    await renderTab();

    expect(screen.getByText("Ingen betalingsinformasjon er lagt inn.")).toBeTruthy();
    expect(screen.getByText("Endres under Nettside-innstillinger.")).toBeTruthy();
  });

  test("bare det som er fylt ut vises", async () => {
    kariActive();
    cms.settings = { vippsNumber: "12345", vippsDescription: "", bankAccount: "1503.45.67890", orgNumber: "" };
    await renderTab();

    expect(screen.getByText("12345")).toBeTruthy();
    expect(screen.getByText("1503.45.67890")).toBeTruthy();
    expect(screen.getByText("Kontonummer")).toBeTruthy();
    expect(screen.queryByText("Organisasjonsnummer")).toBeNull();
  });
});
