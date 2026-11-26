import { useCallback, useEffect, useMemo, useState } from "react";
import { useCms } from "../context/CmsContext";
import { useFirebase } from "../context/FirebaseDataContext";
import { DEMO } from "../demo";
import { readGoogleSignIn } from "../services/auth";
import { subscribeOwnAccess } from "../services/giving/access";
import { isAddonOn } from "../utils/addons";
import {
  normalizeGivingAddress,
  ownAccessState,
  type GivingAccess,
  type GoogleSignIn,
  type OwnAccessState,
} from "../utils/giving/access";
import { isAdministrator } from "../utils/session";

export interface GivingAccessState {
  /** Whether the module list or the own rights are not known yet. Nothing is decided on a guess meanwhile. */
  loading: boolean;
  /** The rights on the address the person signs in with, or null. */
  access: GivingAccess | null;
  /** Where the person stands with those rights (see utils/giving/access.ts). */
  state: OwnAccessState;
  /** Reads the sign-in and the rights again, for instance after the rights were taken into use. */
  reload: () => void;
}

const NO_GOOGLE: GoogleSignIn = { withGoogle: false, googleId: null };

// The demo has no sign-in: what the made-up rights are taken into use with
const DEMO_GOOGLE_ID = "demo";

/** The code of a failure, and nothing else of it: the message of a database error can hold the address. */
const codeOf = (failure: unknown): string =>
  typeof failure === "object" && failure !== null && "code" in failure ? String((failure as { code: unknown }).code) : "ukjent";

/**
 * The rights of the person signed in, in givertjeneste (see utils/giving/access.ts). Reads nothing while the
 * module is off, and nothing in a congregation without a sign-in with an e-mail address. In the demo nobody
 * signs in, so an administrator is given all four rights, and nobody else any.
 */
export function useGivingAccess(): GivingAccessState {
  const { session } = useFirebase();
  const { addons, addonsState } = useCms();
  const person = session.status === "member" ? session.person : null;
  const address = normalizeGivingAddress(session.status === "member" ? session.account?.email : null);
  const uid = session.status === "member" ? (session.account?.uid ?? "") : "";
  const [round, setRound] = useState(0);
  const enabled = !DEMO && isAddonOn(addons, "givertjeneste") && person !== null && address !== "" && addonsState !== "loading";

  const [own, setOwn] = useState<{ address: string; access: GivingAccess | null; failed: boolean } | null>(null);
  const [google, setGoogle] = useState<{ uid: string; value: GoogleSignIn } | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeOwnAccess(
      address,
      (access) => setOwn({ address, access, failed: false }),
      (failure) => {
        // A refused read is no access, and says so in the log without the address
        console.error("Tilgangen til givertjenesten kunne ikke leses. Feilkode:", codeOf(failure));
        setOwn({ address, access: null, failed: true });
      }
    );
  }, [enabled, address, round]);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    readGoogleSignIn()
      .catch((failure: unknown) => {
        console.error("Innloggingsmåten kunne ikke leses. Feilkode:", codeOf(failure));
        return NO_GOOGLE;
      })
      .then((value) => {
        if (active) setGoogle({ uid, value });
      });
    return () => {
      active = false;
    };
  }, [enabled, uid, round]);

  const reload = useCallback(() => setRound((n) => n + 1), []);

  const demoAccess = useMemo<GivingAccess | null>(
    () =>
      DEMO && person && isAdministrator(person)
        ? {
            address,
            personId: person.id,
            name: person.name,
            overview: true,
            budget: true,
            individual: true,
            manage: true,
            googleId: DEMO_GOOGLE_ID,
            version: 1,
          }
        : null,
    [person, address]
  );

  if (DEMO) {
    const access = demoAccess;
    const googleSignIn: GoogleSignIn = { withGoogle: true, googleId: DEMO_GOOGLE_ID };
    return {
      loading: false,
      access,
      state: ownAccessState({ access, personId: person?.id ?? "", googleSignIn }),
      reload,
    };
  }

  const ready = enabled && own?.address === address && google?.uid === uid;
  const access = ready && own && !own.failed ? own.access : null;
  const googleSignIn = google?.uid === uid ? google.value : NO_GOOGLE;
  const loading = addonsState === "loading" || session.status === "loading" || (enabled && !ready);

  return {
    loading,
    access,
    state: ownAccessState({ access, personId: person?.id ?? "", googleSignIn }),
    reload,
  };
}
