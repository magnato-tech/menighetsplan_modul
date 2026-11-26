import { useEffect, useState } from "react";
import { subscribeGivingPurposes } from "../services/giving/purposes";
import type { GivingPurpose } from "../utils/giving/purposes";

export interface GivingPurposesState {
  /** The purposes, or null while they are being read, or when they cannot be read. */
  purposes: GivingPurpose[] | null;
  /** Why they cannot be read: the rules are not published again yet, or something else went wrong. */
  problem: "denied" | "failed" | null;
}

/** The gift purposes, followed live while the component using it is shown. */
export function useGivingPurposes(): GivingPurposesState {
  const [state, setState] = useState<GivingPurposesState>({ purposes: null, problem: null });

  useEffect(
    () =>
      subscribeGivingPurposes(
        (purposes) => setState({ purposes, problem: null }),
        (failure) => {
          console.error("Gaveformålene kunne ikke leses:", failure);
          setState({
            purposes: null,
            problem: (failure as { code?: unknown } | null)?.code === "permission-denied" ? "denied" : "failed",
          });
        }
      ),
    []
  );

  return state;
}
