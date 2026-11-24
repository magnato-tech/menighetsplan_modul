import { useEffect, useMemo, useState } from "react";
import { subscribeLoginRequests } from "../services/loginRequests";
import type { LoginRequest } from "../utils/loginRequests";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LoginRequestsState {
  /** The requests of the stretch, or null while they are being fetched, or when they cannot be read. */
  requests: LoginRequest[] | null;
  /** Why they cannot be read: the rules are not published again yet, or something else went wrong. */
  problem: "denied" | "failed" | null;
}

/**
 * The requests for a sign-in link made in the last `span` days, followed live. Only while the
 * component using it is shown: the subscription stops when it is left.
 */
export function useLoginRequests(span: number): LoginRequestsState {
  // Fixed for the span, so that the subscription is not made again on every render
  const since = useMemo(() => new Date(Date.now() - span * DAY_MS).toISOString(), [span]);
  const [fetched, setFetched] = useState<{ since: string; requests: LoginRequest[] } | null>(null);
  const [problem, setProblem] = useState<LoginRequestsState["problem"]>(null);

  useEffect(() => {
    setProblem(null);
    return subscribeLoginRequests(
      since,
      (requests) => setFetched({ since, requests }),
      (failure) => {
        console.error("Loggen over innloggingslenker kunne ikke leses:", failure);
        setProblem((failure as { code?: unknown } | null)?.code === "permission-denied" ? "denied" : "failed");
      }
    );
  }, [since]);

  return { requests: fetched && fetched.since === since ? fetched.requests : null, problem };
}
