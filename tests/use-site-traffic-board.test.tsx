// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

const { cms, mode } = vi.hoisted(() => ({
  cms: {
    pages: [
      { id: "p-forside", slug: "", title: "Velkommen", isPublished: true, menuOrder: 0 },
      { id: "p-om", slug: "om-oss", title: "Om oss", isPublished: true, menuOrder: 1 },
      { id: "p-gi", slug: "gi", title: "Gi en gave", isPublished: true, menuOrder: 2 },
    ],
    news: [],
    media: [],
    sermons: [{ id: "tale-1", title: "Håp i hverdagen" }],
    settings: { churchName: "Lillesand Misjonskirke", appName: "Menighetsplan", tagline: "", welcomeSubtext: "" } as Record<string, unknown>,
    saveSettings: vi.fn(async () => true),
  },
  mode: { current: "demo" as "demo" | "production" | null },
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => ({ gatherings: [] }) }));
vi.mock("../src/hooks/useOperatingMode", () => ({ useOperatingMode: () => mode.current }));
vi.mock("../src/services/siteTraffic", () => ({
  subscribeSiteTraffic: vi.fn(),
  clearSiteTraffic: vi.fn(),
  addExampleTraffic: vi.fn(),
  removeExampleTraffic: vi.fn(),
}));

import { useSiteTrafficBoard } from "../src/hooks/useSiteTrafficBoard";
import { addExampleTraffic, clearSiteTraffic, removeExampleTraffic, subscribeSiteTraffic } from "../src/services/siteTraffic";
import { areOwnVisitsExcluded } from "../src/utils/ownVisits";
import { emptyTrafficDay, type TrafficDay } from "../src/utils/siteTraffic";

// Wednesday 7 October 2026, 12:00 in Norway
const NOW = new Date("2026-10-07T10:00:00.000Z");
const day = (date: string, fill: Partial<TrafficDay>): TrafficDay => ({ ...emptyTrafficDay(date), ...fill });
/** What the database answers with, handed to the board as the listener would. */
const answerWith = (days: TrafficDay[]) =>
  vi.mocked(subscribeSiteTraffic).mockImplementation((_from, _to, onChange) => {
    onChange(days);
    return () => {};
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  mode.current = "demo";
  cms.settings = { churchName: "Lillesand Misjonskirke", appName: "Menighetsplan", tagline: "", welcomeSubtext: "" };
  answerWith([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Bordet over besøk på nettsiden", () => {
  test("perioden og den før hentes sammen, og blir til det bordet viser", () => {
    answerWith([
      day("2026-10-06", { visits: 4, views: { "/": 6, "/om-oss": 2 } }),
      day("2026-09-01", { visits: 2, views: { "/": 2 } }),
    ]);
    const { result } = renderHook(() => useSiteTrafficBoard("4w"));

    expect(vi.mocked(subscribeSiteTraffic).mock.calls[0].slice(0, 2)).toEqual(["2026-08-13", "2026-10-07"]);
    expect(result.current.summary?.totals).toMatchObject({ visits: 4, views: 8 });
    expect(result.current.summary?.previous).toMatchObject({ visits: 2, views: 2 });
    expect(result.current.summary?.pages.map((page) => page.title)).toEqual(["Forsiden", "Om oss"]);
    expect(result.current.summary?.neverOpened).toEqual([{ address: "/gi", title: "Gi en gave" }]);
    expect(result.current.error).toBeNull();
  });

  test("bordet er tomt til det første svaret er der", () => {
    vi.mocked(subscribeSiteTraffic).mockImplementation(() => () => {});
    const { result } = renderHook(() => useSiteTrafficBoard("4w"));
    expect(result.current.summary).toBeNull();
  });

  test("en kortere periode vises med en gang, av det som alt er hentet", () => {
    answerWith([day("2026-10-06", { visits: 4, views: { "/": 6 } }), day("2026-09-20", { visits: 3, views: { "/": 3 } })]);
    const { result, rerender } = renderHook(({ period }) => useSiteTrafficBoard(period), { initialProps: { period: "4w" as "4w" | "7d" } });
    expect(result.current.summary?.totals.visits).toBe(7);

    rerender({ period: "7d" });
    expect(result.current.summary?.period.id).toBe("7d");
    expect(result.current.summary?.totals.visits).toBe(4);
    // The week before lay empty, and is compared with as such; nothing new was fetched
    expect(result.current.summary?.previous).toBeNull();
    expect(subscribeSiteTraffic).toHaveBeenCalledTimes(1);
  });

  test("en lengre periode hentes, og bordet viser det det viste til svaret er der", () => {
    let answer: (days: TrafficDay[]) => void = () => {};
    vi.mocked(subscribeSiteTraffic).mockImplementation((_from, _to, onChange) => {
      answer = onChange;
      return () => {};
    });
    const { result, rerender } = renderHook(({ period }) => useSiteTrafficBoard(period), { initialProps: { period: "7d" as "7d" | "3m" } });
    act(() => answer([day("2026-10-06", { visits: 4, views: { "/": 6 } })]));
    expect(result.current.summary).toMatchObject({ period: { id: "7d" }, totals: { visits: 4 } });

    rerender({ period: "3m" });
    // Three months and the three before them: 182 days, today included
    expect(vi.mocked(subscribeSiteTraffic).mock.calls[1].slice(0, 2)).toEqual(["2026-04-09", "2026-10-07"]);
    // Not a quarter summed from the two weeks that happen to be there
    expect(result.current.summary).toMatchObject({ period: { id: "7d" }, totals: { visits: 4 } });

    act(() => answer([day("2026-10-06", { visits: 4, views: { "/": 6 } }), day("2026-08-01", { visits: 10, views: { "/": 12 } })]));
    expect(result.current.summary).toMatchObject({ period: { id: "3m" }, totals: { visits: 14 } });
  });

  test("kan ikke tallene hentes, sier bordet hvorfor", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(subscribeSiteTraffic).mockImplementation((_from, _to, _onChange, onError) => {
      onError(new Error("Ingen forbindelse"));
      return () => {};
    });
    const { result } = renderHook(() => useSiteTrafficBoard("4w"));

    expect(result.current.error).toBe("Ingen forbindelse");
    expect(result.current.summary).toBeNull();
  });

  test("eksempeltall lages for sidene som finnes, i 26 uker fram til i går", async () => {
    vi.mocked(addExampleTraffic).mockResolvedValue(182);
    const { result } = renderHook(() => useSiteTrafficBoard("4w"));
    await act(async () => {
      expect(await result.current.addExamples()).toBe(182);
    });

    const days = vi.mocked(addExampleTraffic).mock.calls[0][0];
    expect(days).toHaveLength(182);
    // Never today: the day being counted stays a counted day
    expect([days[0].date, days[181].date]).toEqual(["2026-04-08", "2026-10-06"]);
    expect(days.every((example) => example.simulated)).toBe(true);
    const addresses = new Set(days.flatMap((example) => Object.keys(example.views)));
    expect([...addresses].every((address) => ["/", "/om-oss", "/gi"].includes(address))).toBe(true);
    expect(addresses.has("/")).toBe(true);
  });

  test("nullstilling og fjerning av eksempeltall går til tjenesten, og er bare for demo", async () => {
    vi.mocked(clearSiteTraffic).mockResolvedValue(30);
    vi.mocked(removeExampleTraffic).mockResolvedValue(12);
    const { result, rerender } = renderHook(() => useSiteTrafficBoard("4w"));

    expect(result.current.demo).toBe(true);
    expect(await result.current.reset()).toBe(30);
    expect(await result.current.removeExamples()).toBe(12);

    mode.current = "production";
    rerender();
    expect(result.current.demo).toBe(false);
    // Until the database has said which mode the app is in, nothing is offered that deletes
    mode.current = null;
    rerender();
    expect(result.current.demo).toBe(false);
  });

  test("valget om å holde egne besøk utenfor huskes i nettleseren", () => {
    const { result } = renderHook(() => useSiteTrafficBoard("4w"));
    expect(result.current.ownVisitsExcluded).toBe(false);

    act(() => {
      expect(result.current.excludeOwnVisits(true)).toBe(true);
    });
    expect(result.current.ownVisitsExcluded).toBe(true);
    expect(areOwnVisitsExcluded()).toBe(true);

    act(() => {
      result.current.excludeOwnVisits(false);
    });
    expect(result.current.ownVisitsExcluded).toBe(false);
  });

  test("vil ikke nettleseren huske valget, sier bordet at det ikke ble husket", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Sperret", "SecurityError");
    });
    const { result } = renderHook(() => useSiteTrafficBoard("4w"));

    act(() => {
      expect(result.current.excludeOwnVisits(true)).toBe(false);
    });
    expect(result.current.ownVisitsExcluded).toBe(false);
    vi.restoreAllMocks();
  });

  test("menigheten teller besøk til den selv slår det av, og valget lagres i innstillingene", async () => {
    const { result, rerender } = renderHook(() => useSiteTrafficBoard("4w"));
    expect(result.current.counting).toBe(true);

    await act(async () => {
      expect(await result.current.setCounting(false)).toBe(true);
    });
    expect(cms.saveSettings).toHaveBeenCalledWith({ countVisits: false });

    cms.settings = { ...cms.settings, countVisits: false };
    rerender();
    await waitFor(() => expect(result.current.counting).toBe(false));
  });
});
