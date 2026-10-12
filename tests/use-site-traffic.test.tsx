// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://kirken.example/" }
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

const { cms, planner } = vi.hoisted(() => ({
  planner: {
    gatherings: [{ id: "host", title: "Høstfest", startsAt: "2026-10-18T15:00:00.000Z", groupId: "g", type: "arrangement", visibility: "offentlig" }],
    gatheringsReady: true,
  },
  cms: {
    pages: [
      { id: "p-forside", slug: "", title: "Velkommen", isPublished: true },
      { id: "p-om", slug: "om-oss", title: "Om oss", isPublished: true },
    ],
    news: [],
    media: [],
    sermons: [{ id: "tale-1", title: "Håp i hverdagen", audioUrl: "https://eksempel.no/lyd/tale-1.mp3" }],
    settings: { churchName: "Lillesand Misjonskirke", appName: "Menighetsplan", tagline: "", welcomeSubtext: "" } as {
      churchName: string;
      appName: string;
      tagline: string;
      welcomeSubtext: string;
      countVisits?: boolean;
    },
    contentReady: true,
    addons: { nettsidebesok: true } as { nettsidebesok?: boolean },
  },
}));
vi.mock("../src/context/CmsContext", () => ({ useCms: () => cms }));
vi.mock("../src/context/FirebaseDataContext", () => ({ useFirebase: () => planner }));
vi.mock("../src/services/siteTraffic", () => ({
  siteTrafficRecorder: { view: vi.fn(), seconds: vi.fn(), missing: vi.fn() },
  recordTrafficAction: vi.fn(),
}));

import { forgetVisit, isVisitCounted, useSiteTraffic } from "../src/hooks/useSiteTraffic";
import { recordTrafficAction, siteTrafficRecorder } from "../src/services/siteTraffic";
import { setOwnVisitsExcluded } from "../src/utils/ownVisits";

/** The website showing an address, as the app does where it knows which address that is. */
const Site: React.FC<{ path: string; children?: React.ReactNode }> = ({ path, children }) => {
  useSiteTraffic(path);
  return <>{children}</>;
};
/** Opens the website at an address. The address bar follows, as it does in a browser. */
const open = (path: string, children?: React.ReactNode) => {
  window.history.replaceState(null, "", path);
  return render(<Site path={path.split("?")[0]}>{children}</Site>);
};
const views = () => vi.mocked(siteTrafficRecorder.view).mock.calls.map(([address, , visit]) => [address, visit]);
const setVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T10:00:00.000Z"));
  cms.contentReady = true;
  planner.gatheringsReady = true;
  cms.settings = { ...cms.settings, countVisits: undefined };
  cms.addons = { nettsidebesok: true };
  localStorage.clear();
  setVisibility("visible");
  forgetVisit();
  vi.clearAllMocks();
  vi.mocked(siteTrafficRecorder.view).mockReset();
  vi.mocked(recordTrafficAction).mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("Besøk på nettsiden telles mens de skjer", () => {
  test("siden som åpnes, er der besøket starter, og neste side gjør det til flere", () => {
    const { rerender } = open("/");
    rerender(<Site path="/om-oss" />);
    rerender(<Site path="/om-oss" />);

    expect(views()).toEqual([
      ["/", { entry: true, second: false }],
      ["/om-oss", { entry: false, second: true }],
    ]);
  });

  test("en side som tegnes to ganger på rad, telles én gang, og tiden går videre", () => {
    // React draws everything twice while the app is being developed, to find mistakes
    window.history.replaceState(null, "", "/");
    render(
      <React.StrictMode>
        <Site path="/" />
      </React.StrictMode>
    );
    vi.advanceTimersByTime(5_000);

    expect(views()).toEqual([["/", { entry: true, second: false }]]);
    expect(vi.mocked(siteTrafficRecorder.seconds).mock.calls.map(([, , seconds]) => seconds)).toEqual([5]);
  });

  test("ingenting telles før sidene er hentet, så en side som finnes, ikke tas for en adresse uten side", () => {
    cms.contentReady = false;
    const { rerender } = open("/om-oss");
    expect(siteTrafficRecorder.view).not.toHaveBeenCalled();
    expect(siteTrafficRecorder.missing).not.toHaveBeenCalled();

    cms.contentReady = true;
    rerender(<Site path="/om-oss" />);
    expect(views()).toEqual([["/om-oss", { entry: true, second: false }]]);
  });

  test("siden til et arrangement er en side, og en adresse til et arrangement som ikke finnes, er det ikke", () => {
    const { rerender } = open("/arrangement/host");
    expect(views()).toEqual([["/arrangement/host", { entry: true, second: false }]]);

    rerender(<Site path="/arrangement/borte" />);
    expect(vi.mocked(siteTrafficRecorder.missing).mock.calls.map(([address]) => address)).toEqual(["/arrangement/borte"]);
  });

  test("siden til et arrangement telles ikke før arrangementene er hentet", () => {
    planner.gatheringsReady = false;
    const { rerender } = open("/arrangement/host");
    expect(siteTrafficRecorder.view).not.toHaveBeenCalled();
    expect(siteTrafficRecorder.missing).not.toHaveBeenCalled();

    planner.gatheringsReady = true;
    rerender(<Site path="/arrangement/host" />);
    expect(views()).toEqual([["/arrangement/host", { entry: true, second: false }]]);
  });

  test("en adresse uten side telles som det, og Min side og admin telles ikke", () => {
    const { rerender } = open("/gammel-lenke/fra-for");
    rerender(<Site path="/admin" />);
    rerender(<Site path="/minside" />);

    expect(siteTrafficRecorder.missing).toHaveBeenCalledTimes(1);
    expect(vi.mocked(siteTrafficRecorder.missing).mock.calls[0][0]).toBe("/gammel-lenke/fra-for");
    expect(siteTrafficRecorder.view).not.toHaveBeenCalled();
  });

  test("tiden på en side sendes underveis, og når fanen ikke lenger er framme", () => {
    open("/");
    vi.advanceTimersByTime(5_000);
    expect(vi.mocked(siteTrafficRecorder.seconds).mock.calls.map(([address, , seconds]) => [address, seconds])).toEqual([["/", 5]]);

    vi.advanceTimersByTime(4_000);
    setVisibility("hidden");
    // Time in a tab nobody looks at is not time on the page
    vi.advanceTimersByTime(600_000);
    setVisibility("visible");
    vi.advanceTimersByTime(16_000);

    // Five seconds at the first mark, four when the tab was left, and six more up to the mark at fifteen
    expect(vi.mocked(siteTrafficRecorder.seconds).mock.calls.map(([, , seconds]) => seconds)).toEqual([5, 4, 6]);
  });

  test("når den besøkende forlater siden, sendes det som er sett", () => {
    open("/");
    vi.advanceTimersByTime(3_500);
    window.dispatchEvent(new Event("pagehide"));

    expect(vi.mocked(siteTrafficRecorder.seconds).mock.calls.map(([, , seconds]) => seconds)).toEqual([3]);
  });
});

describe("Tellingen forstyrrer aldri den besøkende", () => {
  test("går noe galt i tellingen, står siden som før, og feilen sies én gang", () => {
    const said = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = () => {
      throw new Error("Tellingen er i ustand");
    };
    vi.mocked(siteTrafficRecorder.view).mockImplementation(broken);
    vi.mocked(recordTrafficAction).mockImplementation(broken);

    const { getByText, rerender } = open("/", <a href="tel:+4737270000">Ring oss</a>);
    fireEvent.click(getByText("Ring oss"));
    rerender(
      <Site path="/om-oss">
        <a href="tel:+4737270000">Ring oss</a>
      </Site>
    );
    window.dispatchEvent(new Event("pagehide"));

    // The page is still there for the visitor, and the log is not filled with the same failure
    expect(getByText("Ring oss")).toBeTruthy();
    expect(said).toHaveBeenCalledTimes(1);
    expect(said.mock.calls[0][0]).toBe("Besøkstellingen stoppet på en feil:");
    said.mockRestore();
  });
});

describe("Det som ikke er et besøk", () => {
  test("forhåndsvisning fra admin telles ikke", () => {
    open("/om-oss?preview=true");
    expect(siteTrafficRecorder.view).not.toHaveBeenCalled();
    expect(isVisitCounted()).toBe(false);
  });

  test("en nettleser som har bedt om å holdes utenfor, telles ikke", () => {
    expect(isVisitCounted()).toBe(true);
    setOwnVisitsExcluded(true);
    open("/");
    expect(siteTrafficRecorder.view).not.toHaveBeenCalled();

    setOwnVisitsExcluded(false);
    expect(isVisitCounted()).toBe(true);
  });

  test("er modulen ikke slått på, telles verken besøk eller handlinger", () => {
    cms.addons = {};
    const { getByText, rerender } = open("/", <a href="tel:+4737270000">Ring oss</a>);
    fireEvent.click(getByText("Ring oss"));
    vi.advanceTimersByTime(60_000);
    expect(siteTrafficRecorder.view).not.toHaveBeenCalled();
    expect(siteTrafficRecorder.seconds).not.toHaveBeenCalled();
    expect(recordTrafficAction).not.toHaveBeenCalled();

    // The database answers that the module is on, or someone turns it on: the page in view is counted from then
    cms.addons = { nettsidebesok: true };
    rerender(
      <Site path="/">
        <a href="tel:+4737270000">Ring oss</a>
      </Site>
    );
    fireEvent.click(getByText("Ring oss"));
    expect(views()).toEqual([["/", { entry: true, second: false }]]);
    expect(recordTrafficAction).toHaveBeenCalledTimes(1);
  });

  test("har menigheten slått tellingen av, telles verken besøk eller handlinger", () => {
    cms.settings = { ...cms.settings, countVisits: false };
    const { getByText, rerender } = open("/", <a href="tel:+4737270000">Ring oss</a>);
    fireEvent.click(getByText("Ring oss"));
    expect(siteTrafficRecorder.view).not.toHaveBeenCalled();
    expect(recordTrafficAction).not.toHaveBeenCalled();

    // Turned on again, the page in view is counted from then on
    cms.settings = { ...cms.settings, countVisits: true };
    rerender(
      <Site path="/">
        <a href="tel:+4737270000">Ring oss</a>
      </Site>
    );
    fireEvent.click(getByText("Ring oss"));
    expect(views()).toEqual([["/", { entry: true, second: false }]]);
    expect(recordTrafficAction).toHaveBeenCalledTimes(1);
  });

  test("en kopi av nettsiden på utviklerens egen maskin telles ikke", () => {
    const at = (hostname: string) => {
      const win = { parent: null as unknown, location: { search: "", hostname }, navigator: { webdriver: false, userAgent: "Mozilla/5.0" } };
      win.parent = win;
      return isVisitCounted(win as unknown as Window);
    };
    expect(at("localhost")).toBe(false);
    expect(at("127.0.0.1")).toBe(false);
    expect(at("menighet.localhost")).toBe(false);
    expect(at("lillesandmisjonskirke.no")).toBe(true);
    expect(at("localhost.example.no")).toBe(true);
  });

  test("et program som leser siden, og en side vist inne i en annen, telles ikke", () => {
    const robot = { parent: null as unknown, location: { search: "", hostname: "kirken.example" }, navigator: { webdriver: false, userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" } };
    robot.parent = robot;
    expect(isVisitCounted(robot as unknown as Window)).toBe(false);

    const steered = { ...robot, navigator: { webdriver: true, userAgent: "Mozilla/5.0" } };
    steered.parent = steered;
    expect(isVisitCounted(steered as unknown as Window)).toBe(false);

    const person = { ...robot, navigator: { webdriver: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" } };
    person.parent = person;
    expect(isVisitCounted(person as unknown as Window)).toBe(true);

    const counted = (userAgent: string) => {
      const win = { ...robot, navigator: { webdriver: false, userAgent } };
      win.parent = win;
      return isVisitCounted(win as unknown as Window);
    };
    for (const reader of ["Mozilla/5.0 (compatible; bingbot/2.0)", "Mozilla/5.0 AppleWebKit (compatible; AdsBot-Google)", "Mozilla/5.0 HeadlessChrome/126.0", "Chrome-Lighthouse"]) {
      expect(counted(reader), reader).toBe(false);
    }
    // A phone whose make happens to hold the letters is a person
    expect(counted("Mozilla/5.0 (Linux; Android 13; CUBOT_X18 Plus) AppleWebKit/537.36 Mobile Safari/537.36")).toBe(true);
    // The same page shown inside the admin's preview frame
    expect(isVisitCounted({ ...person, parent: {} } as unknown as Window)).toBe(false);
  });
});

describe("Handlinger på nettsiden", () => {
  test("trykk på telefonnummer, e-postadresse og kalenderabonnement telles, andre lenker ikke", () => {
    const { getByText } = open(
      "/",
      <>
        <a href="tel:+4737270000">
          <span>Ring oss</span>
        </a>
        <a href="mailto:post@eksempel.no">Send e-post</a>
        <a href="/api/offentlig/kalender.ics">Abonner på kalenderen</a>
        <a href="/om-oss">Om oss</a>
      </>
    );
    for (const text of ["Ring oss", "Send e-post", "Abonner på kalenderen", "Om oss"]) fireEvent.click(getByText(text));

    expect(vi.mocked(recordTrafficAction).mock.calls.map(([action]) => action)).toEqual(["kontakt-telefon", "kontakt-epost", "kalender-abonner"]);
  });

  test("en tale som åpnes i en spiller utenfor nettsiden, telles der den åpnes", () => {
    const { getByText } = open(
      "/taler",
      <button type="button" data-besok-tale="tale-2">
        <span>Spill i Spotify</span>
      </button>
    );
    fireEvent.click(getByText("Spill i Spotify"));

    expect(vi.mocked(recordTrafficAction).mock.calls.map(([action, , sermon]) => [action, sermon])).toEqual([["tale-avspilt", "tale-2"]]);
  });

  test("en lydfil som spilles, telles én gang, på talen den hører til", () => {
    const { container } = open("/taler", <audio src="https://eksempel.no/lyd/tale-1.mp3" />);
    const player = container.querySelector("audio")!;
    player.dispatchEvent(new Event("play"));
    // Taken up again after a pause: the same play
    player.dispatchEvent(new Event("play"));

    expect(vi.mocked(recordTrafficAction).mock.calls.map(([action, , sermon]) => [action, sermon])).toEqual([["tale-avspilt", "tale-1"]]);
  });

  test("handlinger telles ikke i forhåndsvisning eller på Min side", () => {
    const { getByText, rerender } = open("/om-oss?preview=true", <a href="tel:+4737270000">Ring oss</a>);
    fireEvent.click(getByText("Ring oss"));

    window.history.replaceState(null, "", "/minside");
    rerender(
      <Site path="/minside">
        <a href="tel:+4737270000">Ring oss</a>
      </Site>
    );
    fireEvent.click(getByText("Ring oss"));

    expect(recordTrafficAction).not.toHaveBeenCalled();
  });
});
