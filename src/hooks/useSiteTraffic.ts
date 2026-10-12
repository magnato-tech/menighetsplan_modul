import { useEffect, useMemo, useRef } from "react";
import { useCms } from "../context/CmsContext";
import { useFirebase } from "../context/FirebaseDataContext";
import { isEventPath } from "../utils/gatheringPresentation";
import { recordTrafficAction, siteTrafficRecorder } from "../services/siteTraffic";
import { areOwnVisitsExcluded } from "../utils/ownVisits";
import { readPreviewModeFlags } from "../utils/previewBridge";
import { isPublicPath } from "../utils/routes";
import { trafficActionForLink, trafficTarget, visitCounting } from "../utils/siteTraffic";
import { VisitTracker } from "../utils/visitTracker";

// Counts the visits to the public website as they happen (see utils/siteTraffic.ts for what is
// counted and what is deliberately not). One tracker lives for as long as the website stays
// open in the tab; it is the visit. Nothing is stored in the visitor's browser.

let tracker: VisitTracker | null = null;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let failureReported = false;

const theTracker = (): VisitTracker =>
  (tracker ??= new VisitTracker(siteTrafficRecorder, document.visibilityState !== "hidden"));

/**
 * Counting must never be what breaks the page for a visitor. Whatever goes wrong in it stays
 * here: it is said once, for whoever looks, and the page goes on as if nothing was counted.
 */
function quietly(count: () => void): void {
  try {
    count();
  } catch (error) {
    if (failureReported) return;
    failureReported = true;
    console.warn("Besøkstellingen stoppet på en feil:", error);
  }
}

/** Sends what has been seen so far when the next mark is reached, and then again at the one after. */
function scheduleFlush(): void {
  clearTimeout(flushTimer);
  const wait = theTracker().nextFlushInMs(Date.now());
  if (wait === null) return;
  flushTimer = setTimeout(
    () =>
      quietly(() => {
        theTracker().flush(Date.now());
        scheduleFlush();
      }),
    wait
  );
}

/**
 * Whether this opening of the website is a visit to count. The editor's preview is not, a
 * program reading the page is not, a copy of the website running on a developer's own machine
 * is not, and neither is a browser whose owner has asked to be left out.
 */
export function isVisitCounted(win: Window = window): boolean {
  if (win.parent !== win) return false;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(win.location.hostname)) return false;
  if (readPreviewModeFlags(win.location.search, false).preview) return false;
  // "bot" at the end of a word is a robot (Googlebot, bingbot). Inside a word it is a phone (CUBOT_X18).
  const robot =
    win.navigator.webdriver === true || /bot\b|crawl|spider|slurp|lighthouse|headless|pagespeed|prerender/i.test(win.navigator.userAgent);
  return !robot && !areOwnVisitsExcluded();
}

const sameFile = (a: string, b: string): boolean => {
  try {
    return new URL(a, window.location.href).href === new URL(b, window.location.href).href;
  } catch {
    // An address that cannot be read as one is compared as written
    return a === b;
  }
};

/** Starts the counting for the address shown. Called once, where the app knows which address that is. */
export function useSiteTraffic(pathname: string): void {
  const { pages, news, media, settings, sermons, contentReady, addons } = useCms();
  const { gatherings, gatheringsReady } = useFirebase();
  const site = useMemo(() => ({ pages, news, media, settings, gatherings }), [pages, news, media, settings, gatherings]);
  const sermonsNow = useRef(sermons);
  sermonsNow.current = sermons;

  // The congregation decides whether visits are counted at all: the add-on has to be on, and the
  // counting not paused. Until the database has said that the add-on is on, nothing is counted.
  const counting = visitCounting(addons, settings) === "counted";
  const countingNow = useRef(counting);
  countingNow.current = counting;

  useEffect(() => {
    // Until the pages are fetched, a page that exists would be taken for an address without one
    if (!contentReady) return;
    // The same goes for the page of an event, until the events are fetched
    if (isEventPath(pathname) && !gatheringsReady) return;
    quietly(() => {
      theTracker().show(counting && isVisitCounted() ? trafficTarget(pathname, site) : null, Date.now());
      scheduleFlush();
    });
  }, [pathname, site, contentReady, gatheringsReady, counting]);

  useEffect(() => {
    const counted = () => countingNow.current && isPublicPath(window.location.pathname) && isVisitCounted();

    const onVisibility = () =>
      quietly(() => {
        theTracker().setVisible(document.visibilityState !== "hidden", Date.now());
        scheduleFlush();
      });
    // The last chance to send what was seen of the page the visitor leaves from
    const onPageHide = () => quietly(() => theTracker().flush(Date.now()));

    const onClick = (event: MouseEvent) =>
      quietly(() => {
        const pressed = event.target instanceof Element ? event.target : null;
        if (!pressed || !counted()) return;
        // A sermon opened in a player the website cannot listen to (Spotify, video) is marked where it is opened
        const sermonId = pressed.closest("[data-besok-tale]")?.getAttribute("data-besok-tale");
        if (sermonId) {
          recordTrafficAction("tale-avspilt", new Date(), sermonId);
          return;
        }
        const action = trafficActionForLink(pressed.closest("a[href]")?.getAttribute("href"));
        if (action) recordTrafficAction(action);
      });

    // Taking a paused sermon up again is the same play, so each player counts each recording once
    const played = new WeakMap<HTMLMediaElement, string>();
    const onPlay = (event: Event) =>
      quietly(() => {
        const player = event.target;
        if (!(player instanceof HTMLMediaElement) || !counted()) return;
        const recording = player.currentSrc || player.src;
        if (played.get(player) === recording) return;
        played.set(player, recording);
        const sermon = sermonsNow.current.find((candidate) => candidate.audioUrl && sameFile(candidate.audioUrl, recording));
        recordTrafficAction("tale-avspilt", new Date(), sermon?.id);
      });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("click", onClick, true);
    // A player's own events do not bubble, so they are caught on the way down
    document.addEventListener("play", onPlay, true);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("play", onPlay, true);
      clearTimeout(flushTimer);
    };
  }, []);
}

/** For tests: forgets the visit, as when the website is opened anew. */
export function forgetVisit(): void {
  clearTimeout(flushTimer);
  tracker = null;
  failureReported = false;
}
