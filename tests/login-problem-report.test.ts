// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The report from the sign-in page, once a day per browser and address. The signed-in account and
// whether sign-ins are counted here are made up; the fetch is a stand-in.

const { auth, isLoginCounted } = vi.hoisted(() => ({
  auth: { currentUser: null as null | { email: string | null; emailVerified: boolean; getIdToken: () => Promise<string> } },
  isLoginCounted: vi.fn(() => true),
}));
vi.mock("../src/firebase", () => ({ auth }));
vi.mock("../src/utils/countedVisit", () => ({ isLoginCounted }));

import { LOGIN_PROBLEM_PATH, reportKeyOf, reportLoginProblem } from "../src/services/loginProblem";

const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));

const signedIn = (email: string, emailVerified = true) => {
  auth.currentUser = { email, emailVerified, getIdToken: async () => "godt-token" };
};

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  isLoginCounted.mockReturnValue(true);
});

afterEach(() => {
  auth.currentUser = null;
  vi.unstubAllGlobals();
});

describe("Melding fra innloggingssiden", () => {
  test("meldes én gang per dag og adresse i denne nettleseren", async () => {
    signedIn("Ukjent@Eksempel.no");
    await reportLoginProblem();
    await reportLoginProblem();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe(LOGIN_PROBLEM_PATH);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer godt-token");
  });

  test("en annen adresse meldes også, og ingen adresse ligger i nettleseren", async () => {
    signedIn("ukjent@eksempel.no");
    await reportLoginProblem();
    signedIn("annen@eksempel.no");
    await reportLoginProblem();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const stored = Object.keys(window.localStorage).join(" ");
    expect(stored).not.toContain("eksempel");
  });

  test("meldes ikke for en adresse som ikke er bekreftet", async () => {
    signedIn("ukjent@eksempel.no", false);
    await reportLoginProblem();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("meldes ikke der innloggingene ikke telles, som på en utviklers maskin og i demoen", async () => {
    isLoginCounted.mockReturnValue(false);
    signedIn("ukjent@eksempel.no");
    await reportLoginProblem();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("kaster ikke når svaret ikke kommer, og når ingen er innlogget", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("ingen forbindelse");
    });
    signedIn("ukjent@eksempel.no");
    await expect(reportLoginProblem()).resolves.toBeUndefined();
    auth.currentUser = null;
    await expect(reportLoginProblem()).resolves.toBeUndefined();
  });

  test("nøkkelen er ny for en ny dag", () => {
    expect(reportKeyOf("ola@eksempel.no", "2026-11-24")).not.toBe(reportKeyOf("ola@eksempel.no", "2026-11-25"));
  });
});
