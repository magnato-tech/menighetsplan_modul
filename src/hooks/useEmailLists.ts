import { useEffect, useState } from "react";
import { subscribeEmailLists } from "../services/emailLists";
import type { EmailList } from "../utils/emailLists";

export interface EmailListsState {
  /** The lists, or null while they are being read, or when they cannot be read. */
  lists: EmailList[] | null;
  /** Why they cannot be read: the rules are not published again yet, or something else went wrong. */
  problem: "denied" | "failed" | null;
}

/** The e-mail lists, followed live while the component using it is shown. Nothing is read when `enabled` is false. */
export function useEmailLists(enabled = true): EmailListsState {
  const [state, setState] = useState<EmailListsState>({ lists: null, problem: null });

  useEffect(() => {
    if (!enabled) return;
    return subscribeEmailLists(
      (lists) => setState({ lists, problem: null }),
      (failure) => {
        console.error("Listene over personer kunne ikke leses:", failure);
        setState({ lists: null, problem: (failure as { code?: unknown } | null)?.code === "permission-denied" ? "denied" : "failed" });
      }
    );
  }, [enabled]);

  return state;
}
