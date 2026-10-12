import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCms } from "../context/CmsContext";
import { useFirebase } from "../context/FirebaseDataContext";
import { exampleAddresses, simulateSiteTraffic } from "../data/simulatedSiteTraffic";
import { addExampleTraffic, clearSiteTraffic, removeExampleTraffic, subscribeSiteTraffic } from "../services/siteTraffic";
import { areOwnVisitsExcluded, setOwnVisitsExcluded } from "../utils/ownVisits";
import {
  addDays,
  osloDayAndHour,
  summarizeTraffic,
  trafficPeriod,
  type TrafficDay,
  type TrafficPeriodId,
  type TrafficSummary,
} from "../utils/siteTraffic";
import { useOperatingMode } from "./useOperatingMode";

/** How many weeks of example numbers are made. Enough to fill the three shortest periods. */
const EXAMPLE_WEEKS = 26;

export interface SiteTrafficBoard {
  /** What the board shows for the period. Null until the counts have been fetched the first time. */
  summary: TrafficSummary | null;
  /** Why the counts could not be fetched, or null. */
  error: string | null;
  /** Whether the congregation counts visits at all. */
  counting: boolean;
  /** Turns the counting on or off, for every visitor. Resolves to whether the choice was saved. */
  setCounting: (on: boolean) => Promise<boolean>;
  /** Whether this browser's own visits are left out of the counting. */
  ownVisitsExcluded: boolean;
  /** Leaves this browser's visits out, or takes them in again. False when the browser will not remember it. */
  excludeOwnVisits: (excluded: boolean) => boolean;
  /** Emptying the counts and making example numbers are for demonstrations, so only in demo. */
  demo: boolean;
  /** Deletes every count. Resolves to the number of days deleted; rejects with what went wrong. */
  reset: () => Promise<number>;
  /** Fills the days before today with example numbers, where nothing is counted. Resolves to the days filled. */
  addExamples: () => Promise<number>;
  /** Removes the example numbers and nothing else. Resolves to the days removed. */
  removeExamples: () => Promise<number>;
}

/** The board over visits to the website: the counts of the period, followed live, and what can be done with them. */
export function useSiteTrafficBoard(periodId: TrafficPeriodId): SiteTrafficBoard {
  const { pages, news, media, settings, sermons, saveSettings } = useCms();
  const mode = useOperatingMode();
  const [now, setNow] = useState(() => new Date());
  /** The days fetched, and the stretch of days they were fetched for. */
  const [fetched, setFetched] = useState<{ from: string; to: string; days: TrafficDay[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownVisitsExcluded, setExcluded] = useState(() => areOwnVisitsExcluded());

  // A board left open over midnight moves on to the new day
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const period = useMemo(() => trafficPeriod(periodId, now), [periodId, now]);
  // The period and the one before it are fetched together, so there is something to compare
  // with. The stretch fetched only grows: a shorter period is already there and is shown at once.
  const [since, setSince] = useState(period.previousFrom);
  if (period.previousFrom < since) setSince(period.previousFrom);
  useEffect(() => {
    setError(null);
    return subscribeSiteTraffic(
      since,
      period.to,
      (days) => setFetched({ from: since, to: period.to, days }),
      (failure) => {
        console.error("Besøkstallene kunne ikke hentes:", failure);
        setError(failure.message);
      }
    );
  }, [since, period.to]);

  const { gatherings } = useFirebase();
  const site = useMemo(() => ({ pages, news, media, settings, sermons, gatherings }), [pages, news, media, settings, sermons, gatherings]);
  // While a longer stretch is on its way, the board keeps what it showed, rather than going blank
  // or showing a long period summed from the few days it happens to have
  const covering = fetched !== null && fetched.from <= period.previousFrom && fetched.to >= period.to ? fetched.days : null;
  const current = useMemo(() => (covering ? summarizeTraffic(covering, site, periodId, now) : null), [covering, site, periodId, now]);
  const shown = useRef<TrafficSummary | null>(null);
  if (current) shown.current = current;
  const summary = current ?? shown.current;

  const excludeOwnVisits = useCallback((excluded: boolean) => {
    const remembered = setOwnVisitsExcluded(excluded);
    setExcluded(areOwnVisitsExcluded());
    return remembered;
  }, []);

  const addExamples = useCallback(() => {
    // Never today: the day that is being counted now stays a counted day
    const yesterday = addDays(osloDayAndHour(new Date()).date, -1);
    return addExampleTraffic(
      simulateSiteTraffic({
        from: addDays(yesterday, -(EXAMPLE_WEEKS * 7 - 1)),
        to: yesterday,
        addresses: exampleAddresses(site),
        sermonIds: sermons.map((sermon) => sermon.id),
      })
    );
  }, [site, sermons]);

  const setCounting = useCallback((on: boolean) => saveSettings({ countVisits: on }), [saveSettings]);

  return {
    summary,
    error,
    counting: settings.countVisits !== false,
    setCounting,
    ownVisitsExcluded,
    excludeOwnVisits,
    demo: mode === "demo",
    reset: clearSiteTraffic,
    addExamples,
    removeExamples: removeExampleTraffic,
  };
}
