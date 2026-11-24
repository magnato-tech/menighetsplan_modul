// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

describe("Lenke sendt av menigheten selv, eller av Firebase", () => {
  const SIGN_IN = "https://kirken.example/logg-inn";
  // What the server answers, as the browser's fetch gives it; a page that is not JSON cannot be read
  const reply = (status: number, body: unknown, json = true) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (!json) throw new SyntaxError("Unexpected token '<'");
      return body;
    },
  });
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("ber menigheten sende lenken, med adressen og stedet å komme tilbake til", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true }));
    await sendSignInLink(" ola@eksempel.no ", SIGN_IN);

    expect(fetchMock).toHaveBeenCalledWith("/api/innloggingsepost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ola@eksempel.no", returnTo: SIGN_IN }),
    });
    expect(api.sendSignInLinkToEmail).not.toHaveBeenCalled();
    expect(localStorage.getItem("menighetsplan_epost_for_lenke")).toBe("ola@eksempel.no");
  });

  test("faller tilbake til Firebase når installasjonen ikke kan sende selv", async () => {
    fetchMock.mockResolvedValueOnce(reply(503, { ok: false, reason: "not-available" }));
    await sendSignInLink("ola@eksempel.no", SIGN_IN);

    expect(api.sendSignInLinkToEmail).toHaveBeenCalledWith(authInstance, "ola@eksempel.no", { url: SIGN_IN, handleCodeInApp: true });
  });

  test("faller tilbake til Firebase når svaret ikke er JSON, eller nettet svikter", async () => {
    fetchMock.mockResolvedValueOnce(reply(404, null, false));
    await sendSignInLink("ola@eksempel.no", SIGN_IN);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await sendSignInLink("kari@eksempel.no", SIGN_IN);

    expect(api.sendSignInLinkToEmail).toHaveBeenCalledTimes(2);
    expect(api.sendSignInLinkToEmail).toHaveBeenLastCalledWith(authInstance, "kari@eksempel.no", { url: SIGN_IN, handleCodeInApp: true });
  });

  test("når menigheten avviser adressen, sier den det den selv skriver, og ingen lenke sendes", async () => {
    fetchMock.mockResolvedValueOnce(reply(400, { ok: false, reason: "bad-email", message: "E-postadressen ser ikke riktig ut." }));

    const failure = await sendSignInLink("ikke-en-adresse", SIGN_IN).catch((error: unknown) => error);
    expect(describeSignInError(failure)).toBe("E-postadressen ser ikke riktig ut.");
    expect(api.sendSignInLinkToEmail).not.toHaveBeenCalled();
  });

  test("når e-posttjenesten svikter, sies serverens melding, og Firebase sender ikke i stedet", async () => {
    fetchMock.mockResolvedValueOnce(reply(502, { ok: false, reason: "failed", message: "E-posten kunne ikke sendes akkurat nå. Prøv igjen om litt." }));

    const failure = await sendSignInLink("ola@eksempel.no", SIGN_IN).catch((error: unknown) => error);
    expect(describeSignInError(failure)).toBe("E-posten kunne ikke sendes akkurat nå. Prøv igjen om litt.");
    expect(api.sendSignInLinkToEmail).not.toHaveBeenCalled();
  });

  test("har Firebase stoppet for mange lenker i dag, sies det på norsk", () => {
    const said = describeSignInError(Object.assign(new Error("Firebase: Error"), { code: "auth/quota-exceeded" }));
    expect(said).toBe("Innloggingen er midlertidig sperret fordi for mange har bedt om lenke i dag. Prøv igjen senere, eller logg inn med Google.");
  });
});
