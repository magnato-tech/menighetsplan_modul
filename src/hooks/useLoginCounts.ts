import { useEffect, useMemo, useState } from "react";
import { subscribeSiteTraffic } from "../services/siteTraffic";
import { summarizeLoginCounts, type LoginCountSummary } from "../utils/loginCounts";
import { addDays, osloDayAndHour, type TrafficDay } from "../utils/siteTraffic";

export interface LoginCountsState {
  /** The sums of the stretch, or null while it is being fetched. */
  summary: LoginCountSummary | null;
  /** Why the counts could not be fetched, or null. */
  error: string | null;
}

/**
 * The sign-in and Min side counts of the last `span` days, Norwegian time, followed live. Only
 * while the component using it is shown: the subscription stops when it is left.
 */
export function useLoginCounts(span: number): LoginCountsState {
  const to = osloDayAndHour(new Date()).date;
  const from = addDays(to, -(span - 1));
  const [fetched, setFetched] = useState<{ from: string; to: string; days: TrafficDay[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    return subscribeSiteTraffic(
      from,
      to,
      (days) => setFetched({ from, to, days }),
      (failure) => {
        console.error("Innloggingstellingene kunne ikke hentes:", failure);
        setError(failure.message);
      }
    );
  }, [from, to]);

  // Only counts for the stretch asked for: a period that has just changed waits for its own
  const summary = useMemo(
    () => (fetched && fetched.from === from && fetched.to === to ? summarizeLoginCounts(fetched.days, from, to) : null),
    [fetched, from, to]
  );
  return { summary, error };
}
