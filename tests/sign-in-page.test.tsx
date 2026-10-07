// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://kirken.example/logg-inn?neste=%2Fadmin%3Ftab%3Dmoduler" }
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Person } from "../src/types";
import type { Session } from "../src/utils/session";

const kari: Person = { id: "kari", name: "Kari Nordmann", email: "kari@menigheten.no", globalRole: "admin" };
const ola: Person = { id: "ola", name: "Ola Hansen", email: "ola@eksempel.no", globalRole: "member" };

const { app, auth } = vi.hoisted(() => ({
  app: {
    session: { status: "signedOut" } as Session,
    signOut: vi.fn(async () => {}),
    standInAs: undefined as undefined | ((personId: string) => void),
    allPersons: [] as Person[],
  },
  auth: {
    signInWithGoogle: vi.fn(async () => {}),
    sendSignInLink: vi.fn(async (_email: string, _returnTo: string) => {}),
    isSignInLink: vi.fn((_url: string) => false),
    completeSignInLink: vi.fn(async (_url: string, _email?: string): Promise<"signedIn" | "needsEmail"> => "signedIn"),
    describeSignInError: (error: unknown) => `Forklart: ${error instanceof Error ? error.message : "ukjent"}`,
  },
}));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => app }));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ settings: { churchName: "Sentrumskirken" } }) }));
vi.mock("../src/services/auth", () => auth);

import { SignInPage } from "../src/pages/SignInPage";

const Arrived: React.FC = () => {
  const location = useLocation();
  return <p>Kom til: {location.pathname + location.search}</p>;
};
const open = (address = "/logg-inn?neste=%2Fadmin%3Ftab%3Dmoduler") =>
  render(
    <MemoryRouter initialEntries={[address]}>
      <Routes>
        <Route path="/logg-inn" element={<SignInPage />} />
        <Route path="*" element={<Arrived />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  app.session = { status: "signedOut" };
  app.standInAs = undefined;
  app.allPersons = [];
  auth.isSignInLink.mockReturnValue(false);
  auth.completeSignInLink.mockResolvedValue("signedIn");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Innloggingssiden", () => {
  test("den som ikke er logget inn, får to veier inn: Google-konto eller lenke på e-post", () => {
    open();

    expect(screen.getByRole("heading", { name: "Logg inn" })).toBeTruthy();
    expect(screen.getByText("Sentrumskirken")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fortsett med Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send meg en lenke" })).toBeTruthy();
    // No password is asked for, and nobody can go in without signing in
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByText(/uten å logge inn/)).toBeNull();
    expect(screen.getByRole("link", { name: "Tilbake til nettsiden" }).getAttribute("href")).toBe("/");
  });

  test("Google-knappen logger inn med Google, og en feil sies under knappene", async () => {
    auth.signInWithGoogle.mockRejectedValueOnce(new Error("vinduet ble lukket"));
    open();

    fireEvent.click(screen.getByRole("button", { name: "Fortsett med Google" }));

    expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Forklart: vinduet ble lukket"));
  });

  test("lenken sendes til adressen som skrives inn, og fører tilbake til siden en ville til", async () => {
    open();

    fireEvent.change(screen.getByLabelText("E-postadresse"), { target: { value: " ola@eksempel.no " } });
    fireEvent.click(screen.getByRole("button", { name: "Send meg en lenke" }));

    await waitFor(() => expect(screen.getByText(/Vi har sendt en lenke til/).textContent).toContain("ola@eksempel.no"));
    expect(auth.sendSignInLink).toHaveBeenCalledWith("ola@eksempel.no", "https://kirken.example/logg-inn?neste=%2Fadmin%3Ftab%3Dmoduler");
    // The form is put away, and can be taken out again for another address
    expect(screen.queryByRole("button", { name: "Send meg en lenke" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bruk en annen adresse" }));
    expect(screen.getByRole("button", { name: "Send meg en lenke" })).toBeTruthy();
  });

  test("kan ikke lenken sendes, sies det, og skjemaet står", async () => {
    auth.sendSignInLink.mockRejectedValueOnce(new Error("ikke slått på"));
    open();

    fireEvent.change(screen.getByLabelText("E-postadresse"), { target: { value: "ola@eksempel.no" } });
    fireEvent.click(screen.getByRole("button", { name: "Send meg en lenke" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Forklart: ikke slått på"));
    expect(screen.queryByText(/Vi har sendt en lenke/)).toBeNull();
    expect(screen.getByRole("button", { name: "Send meg en lenke" })).toBeTruthy();
  });
});

describe("Lenken fra e-posten", () => {
  test("logger inn med en gang siden åpnes", async () => {
    auth.isSignInLink.mockReturnValue(true);
    open();

    await waitFor(() => expect(auth.completeSignInLink).toHaveBeenCalledTimes(1));
    expect(auth.completeSignInLink.mock.calls[0][0]).toBe(window.location.href);
    expect(auth.completeSignInLink.mock.calls[0][1]).toBeUndefined();
  });

  test("åpnet på en annen enhet spør siden om adressen, og logger inn med den", async () => {
    auth.isSignInLink.mockReturnValue(true);
    auth.completeSignInLink.mockResolvedValueOnce("needsEmail");
    open();

    await waitFor(() => expect(screen.getByText(/åpnet på en annen enhet/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Fortsett med Google" })).toBeNull();

    fireEvent.change(screen.getByLabelText("E-postadresse"), { target: { value: "ola@eksempel.no" } });
    fireEvent.click(screen.getByRole("button", { name: "Logg inn" }));

    await waitFor(() => expect(auth.completeSignInLink).toHaveBeenCalledTimes(2));
    expect(auth.completeSignInLink.mock.calls[1]).toEqual([window.location.href, "ola@eksempel.no"]);
  });

  test("en lenke som er brukt eller utløpt, sies som det", async () => {
    auth.isSignInLink.mockReturnValue(true);
    auth.completeSignInLink.mockRejectedValueOnce(new Error("lenken er utløpt"));
    open();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Forklart: lenken er utløpt"));
    // The other ways in are still there
    expect(screen.getByRole("button", { name: "Fortsett med Google" })).toBeTruthy();
  });
});

describe("Den som er logget inn", () => {
  test("og står i registeret, sendes videre dit en ville", () => {
    app.session = { status: "member", person: kari, account: { uid: "u", email: kari.email!, emailVerified: true } };
    open();
    expect(screen.getByText("Kom til: /admin?tab=moduler")).toBeTruthy();
  });

  test("uten et mål, eller med et mål utenfor appen, sendes til Min side", () => {
    app.session = { status: "member", person: ola, account: { uid: "u", email: ola.email!, emailVerified: true } };
    const { unmount } = open("/logg-inn");
    expect(screen.getByText("Kom til: /minside")).toBeTruthy();
    unmount();

    open("/logg-inn?neste=https%3A%2F%2Fannet.example%2F");
    expect(screen.getByText("Kom til: /minside")).toBeTruthy();
  });

  test("uten å stå i registeret, får vite det, hvorfor, og kan logge ut", () => {
    app.session = { status: "notInRegister", account: { uid: "u", email: "fremmed@eksempel.no", emailVerified: true }, reason: "noMatch" };
    open();

    expect(screen.getByText("fremmed@eksempel.no")).toBeTruthy();
    expect(screen.getByText(/står ikke i personregisteret til\s+Sentrumskirken/)).toBeTruthy();
    expect(screen.getByText(/Ingen i personregisteret har denne e-postadressen/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fortsett med Google" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Logg ut og prøv en annen konto" }));
    expect(app.signOut).toHaveBeenCalledTimes(1);
  });

  test("med en adresse flere deler, eller en som ikke er bekreftet, får vite akkurat det", () => {
    app.session = { status: "notInRegister", account: { uid: "u", email: "familien@berg.no", emailVerified: true }, reason: "severalMatches" };
    const { unmount } = open();
    expect(screen.getByText(/Flere personer i registeret har denne e-postadressen/)).toBeTruthy();
    unmount();

    app.session = { status: "notInRegister", account: { uid: "u", email: "ola@eksempel.no", emailVerified: false }, reason: "unverified" };
    open();
    expect(screen.getByText(/er ikke bekreftet/)).toBeTruthy();
  });

  test("mens det ikke er kjent hvem som spør, vises ingen veier inn", () => {
    app.session = { status: "loading" };
    open();
    expect(screen.getByText("Laster …")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fortsett med Google" })).toBeNull();
  });
});

describe("På en utviklers egen maskin", () => {
  test("kan en gå inn som en person fra registeret, uten å logge inn", () => {
    const standInAs = vi.fn();
    app.standInAs = standInAs;
    app.allPersons = [kari, ola];
    open();

    const picker = screen.getByLabelText(/På egen maskin/) as HTMLSelectElement;
    expect([...picker.options].map((option) => option.textContent)).toEqual(["Velg en person", "Kari Nordmann (administrator)", "Ola Hansen"]);
    fireEvent.change(picker, { target: { value: "ola" } });
    expect(standInAs).toHaveBeenCalledWith("ola");
  });
});
