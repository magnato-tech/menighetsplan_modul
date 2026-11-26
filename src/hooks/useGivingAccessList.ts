import { useEffect, useState } from "react";
import { subscribeAllAccess } from "../services/giving/access";
import type { GivingAccess } from "../utils/giving/access";

export interface GivingAccessListState {
  /** Every right that has been given, or null while they are being read, or when they cannot be read. */
  list: GivingAccess[] | null;
  /** Why they cannot be read: the rules are not published again yet, or something else went wrong. */
  problem: "denied" | "failed" | null;
}

/** The rights given in givertjeneste, followed live while the component using it is shown. Only someone with «Tilganger» may read them. */
export function useGivingAccessList(): GivingAccessListState {
  const [state, setState] = useState<GivingAccessListState>({ list: null, problem: null });

  useEffect(
    () =>
      subscribeAllAccess(
        (list) => setState({ list, problem: null }),
        (failure) => {
          // The code only: a database message can hold an address
          const code = typeof failure === "object" && failure !== null && "code" in failure ? String((failure as { code: unknown }).code) : "ukjent";
          console.error("Tilgangslisten til givertjenesten kunne ikke leses. Feilkode:", code);
          setState({ list: null, problem: code === "permission-denied" ? "denied" : "failed" });
        }
      ),
    []
  );

  return state;
}
