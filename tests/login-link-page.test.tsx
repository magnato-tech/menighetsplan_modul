// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginLinkPage } from "../src/pages/LoginLinkPage";
import { signInWithLoginLink } from "../src/services/auth";

// The sign-in itself is the auth service's; here it is only asked for. The address and the server are made up.
vi.mock("../src/services/auth", () => ({
  signInWithLoginLink: vi.fn(async () => undefined),
  describeSignInError: () => "Innloggingen gikk ikke. Prøv igjen.",
}));
vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({ settings: { churchName: "Fjellbygda menighet" } }),
}));

const page = () =>
  render(
    <MemoryRouter initialEntries={["/lenke"]}>
      <Routes>
        <Route path="/lenke" element={<LoginLinkPage />} />
        <Route path="/minside" element={<p>Min side vises</p>} />
      </Routes>
    </MemoryRouter>
  );

/** Puts the address of a login link in the browser, as the e-mail's button opens it. */
const openLink = (address: string) => window.history.replaceState(null, "", address);

describe("Siden som innloggingslenken åpner", () => {
  beforeEach(() => {
    openLink("/");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.mocked(signInWithLoginLink).mockClear();
  });

  test("logger inn med bevisset fra serveren, tar lenken ut av adressen, og går til siden den ble sendt til", async () => {
    openLink("/lenke?til=%2Fminside#tok.en");
    const fetchMock = vi.fn(async (_url: string, _init: { body: string }) => ({ ok: true, status: 200, json: async () => ({ ok: true, customToken: "innlogging-1" }) }));
    vi.stubGlobal("fetch", fetchMock);

    page();
    expect(screen.getByText("Logger deg inn …")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Min side vises")).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/innlogging");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ token: "tok.en" });
    expect(signInWithLoginLink).toHaveBeenCalledWith("innlogging-1");
    expect(window.location.hash).toBe("");
  });

  test("en lenke som ikke lenger virker, sier hva som er galt, og tilbyr vanlig innlogging", async () => {
    openLink("/lenke?til=%2Fminside#tok.en");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 410, json: async () => ({ ok: false, message: "Lenken er gått ut. Logg inn på vanlig måte, eller be om en ny e-post." }) })));

    page();
    expect((await screen.findByRole("alert")).textContent).toBe("Lenken er gått ut. Logg inn på vanlig måte, eller be om en ny e-post.");
    expect(screen.getByRole("link", { name: "Logg inn på vanlig måte" }).getAttribute("href")).toBe("/logg-inn?neste=%2Fminside");
    expect(signInWithLoginLink).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  test("uten noe i lenken blir det ikke spurt, og det sies at lenken ikke er gyldig", async () => {
    openLink("/lenke?til=%2Fminside");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    page();
    expect((await screen.findByRole("alert")).textContent).toBe("Lenken er ikke gyldig. Logg inn på vanlig måte.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("et sted som ikke er i appen, blir Min side", async () => {
    openLink("/lenke?til=https%3A%2F%2Fevil.example#tok.en");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, customToken: "innlogging-2" }) })));

    page();
    expect(await screen.findByText("Min side vises")).toBeTruthy();
  });
});
