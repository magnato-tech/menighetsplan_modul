// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";

const { api, authInstance } = vi.hoisted(() => {
  const authInstance = { languageCode: null as string | null };
  const provider = { setCustomParameters: vi.fn() };
  return {
    authInstance,
    api: {
      provider,
      // Has to be callable with `new`, as the real one is
      GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
        return provider;
      }),
      onAuthStateChanged: vi.fn(),
      signInWithPopup: vi.fn(async () => ({})),
      sendSignInLinkToEmail: vi.fn(async () => {}),
      signInWithEmailLink: vi.fn(async () => ({})),
      isSignInWithEmailLink: vi.fn(() => true),
      signOut: vi.fn(async () => {}),
    },
  };
});
vi.mock("../src/firebase", () => ({ auth: authInstance }));
vi.mock("firebase/auth", () => api);

import {
  completeSignInLink,
  describeSignInError,
  isSignInLink,
  sendSignInLink,
  signInWithGoogle,
  signOut,
  subscribeAccount,
} from "../src/services/auth";

const LINK = "https://kirken.example/logg-inn?neste=%2Fminside&oobCode=abc";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("Hvem som er logget inn, fortelles videre", () => {
  test("en konto blir til det appen trenger å vite om den, og ingen konto til «logget ut»", () => {
    const heard: unknown[] = [];
    subscribeAccount((state) => heard.push(state));
    const [, next] = api.onAuthStateChanged.mock.calls[0];

    next({ uid: "u1", email: "ola@eksempel.no", emailVerified: true, displayName: "Ola Hansen", refreshToken: "hemmelig" });
    next(null);

    expect(heard).toEqual([
      { status: "signedIn", account: { uid: "u1", email: "ola@eksempel.no", emailVerified: true, displayName: "Ola Hansen" } },
      { status: "signedOut" },
    ]);
  });

  test("kan ikke innloggingen leses, er ingen logget inn", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const onChange = vi.fn();
    subscribeAccount(onChange);
    const [, , failed] = api.onAuthStateChanged.mock.calls[0];

    failed(new Error("auth/network-request-failed"));

    expect(onChange).toHaveBeenCalledWith({ status: "signedOut" });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  test("e-postene og innloggingsvinduet er på norsk", () => {
    expect(authInstance.languageCode).toBe("no");
  });
});

describe("Google-konto", () => {
  test("det spørres alltid om hvilken konto, så neste person på en delt maskin ikke går inn som den forrige", async () => {
    await signInWithGoogle();

    expect(api.provider.setCustomParameters).toHaveBeenCalledWith({ prompt: "select_account" });
    expect(api.signInWithPopup).toHaveBeenCalledWith(authInstance, api.provider);
  });

  test("utlogging logger ut kontoen", async () => {
    await signOut();
    expect(api.signOut).toHaveBeenCalledWith(authInstance);
  });
});

describe("Lenke på e-post", () => {
  test("lenken sendes til adressen, og fører tilbake til appen", async () => {
    await sendSignInLink("  ola@eksempel.no ", "https://kirken.example/logg-inn?neste=%2Fminside");

    expect(api.sendSignInLinkToEmail).toHaveBeenCalledWith(authInstance, "ola@eksempel.no", {
      url: "https://kirken.example/logg-inn?neste=%2Fminside",
      handleCodeInApp: true,
    });
  });

  test("åpnet på enheten den ble bestilt fra, logger lenken inn uten å spørre om adressen, og bare én gang", async () => {
    await sendSignInLink("ola@eksempel.no", "https://kirken.example/logg-inn");
    expect(isSignInLink(LINK)).toBe(true);

    expect(await completeSignInLink(LINK)).toBe("signedIn");
    expect(api.signInWithEmailLink).toHaveBeenCalledWith(authInstance, "ola@eksempel.no", LINK);

    // The address is forgotten once it has been used
    expect(await completeSignInLink(LINK)).toBe("needsEmail");
    expect(api.signInWithEmailLink).toHaveBeenCalledTimes(1);
  });

  test("åpnet på en annen enhet må adressen skrives inn, så en lenke på avveie ikke er nok", async () => {
    expect(await completeSignInLink(LINK)).toBe("needsEmail");
    expect(api.signInWithEmailLink).not.toHaveBeenCalled();

    expect(await completeSignInLink(LINK, " ola@eksempel.no ")).toBe("signedIn");
    expect(api.signInWithEmailLink).toHaveBeenCalledWith(authInstance, "ola@eksempel.no", LINK);
  });

  test("sendes ikke lenken, huskes ingen adresse", async () => {
    api.sendSignInLinkToEmail.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "auth/invalid-email" }));

    await expect(sendSignInLink("ikke-en-adresse", "https://kirken.example/logg-inn")).rejects.toThrow();
    expect(await completeSignInLink(LINK)).toBe("needsEmail");
  });
});

describe("Det som går galt, sies slik at en vet hva en skal gjøre", () => {
  const said = (code: string) => describeSignInError(Object.assign(new Error("Firebase: Error"), { code }));

  test("hver kjent feil har sin forklaring, uten koder", () => {
    expect(said("auth/popup-closed-by-user")).toBe("Innloggingen ble avbrutt. Prøv igjen.");
    expect(said("auth/popup-blocked")).toContain("sprettoppvinduer");
    expect(said("auth/network-request-failed")).toContain("Ingen forbindelse");
    expect(said("auth/invalid-email")).toBe("E-postadressen ser ikke riktig ut.");
    expect(said("auth/expired-action-code")).toBe("Lenken er brukt eller utløpt. Be om en ny.");
    expect(said("auth/invalid-action-code")).toBe("Lenken er brukt eller utløpt. Be om en ny.");
    expect(said("auth/too-many-requests")).toContain("Vent litt");
    // A way of signing in that the installation has not been set up with
    for (const code of ["auth/operation-not-allowed", "auth/unauthorized-domain", "auth/unauthorized-continue-uri"]) {
      expect(said(code)).toContain("ikke slått på for denne installasjonen");
    }
  });

  test("en ukjent feil sies også på norsk, uten det tekniske", () => {
    for (const unknown of [said("auth/noe-nytt"), describeSignInError(new Error("boom")), describeSignInError("tekst"), describeSignInError(null)]) {
      expect(unknown).toBe("Innloggingen gikk ikke. Prøv igjen.");
    }
  });
});
