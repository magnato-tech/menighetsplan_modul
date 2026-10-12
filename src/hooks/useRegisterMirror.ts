import { useEffect, useRef, useState } from "react";
import { storeLoginChanges, storePublicProfileChanges, subscribeLogins, subscribePublicProfiles } from "../services/registerMirror";
import type { Person } from "../types";
import { keepingOwnLogin, loginsOf, type Login } from "../utils/logins";
import { hasChanges, mirrorChanges } from "../utils/mirror";
import { publicCopiesOf } from "../utils/publicProfile";

/**
 * Keeps the logins and the public copies of persons in step with the register (see
 * utils/mirror.ts), from the browser of an administrator who has the app open. An administrator
 * is the only one who changes an address, a role or a public profile, so the one who makes the
 * change is also the one whose browser writes what follows from it.
 *
 * `active` is whether the one at the screen is an administrator and the whole register has
 * arrived. Nothing is written from a register that is only half there.
 */
export function useRegisterMirror(persons: Person[], active: boolean, ownEmail: string | null): void {
  // What the database holds, once it has said so itself: never a copy in the browser, and never while a write of our own is on its way
  const [logins, setLogins] = useState<Login[] | null>(null);
  const [copies, setCopies] = useState<Person[] | null>(null);
  // A write that was turned away is not tried again and again
  const stopped = useRef(false);

  useEffect(() => {
    if (!active) return;
    stopped.current = false;
    const unsubscribers = [
      subscribeLogins((list, settled) => setLogins(settled ? list : null)),
      subscribePublicProfiles((list, settled) => setCopies(settled ? list : null)),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      setLogins(null);
      setCopies(null);
    };
  }, [active]);

  useEffect(() => {
    if (!active || stopped.current || logins === null) return;
    const changes = keepingOwnLogin(mirrorChanges(loginsOf(persons), logins), ownEmail);
    if (!hasChanges(changes)) return;
    storeLoginChanges(changes).catch((error) => {
      stopped.current = true;
      console.warn("Innloggingene kunne ikke oppdateres etter registeret:", error);
    });
  }, [active, persons, logins, ownEmail]);

  useEffect(() => {
    if (!active || stopped.current || copies === null) return;
    const changes = mirrorChanges(publicCopiesOf(persons), copies);
    if (!hasChanges(changes)) return;
    storePublicProfileChanges(changes).catch((error) => {
      stopped.current = true;
      console.warn("De offentlige profilene kunne ikke oppdateres etter registeret:", error);
    });
  }, [active, persons, copies]);
}
