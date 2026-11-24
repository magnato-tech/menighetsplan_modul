import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { LOGIN_REQUESTS_COLLECTION } from "../data/collections";
import type { LoginRequest } from "../utils/loginRequests";

// The log of the requests for a sign-in link (see server/signInEmail.ts). Only an administrator may
// read it, and the rules that let them are in firestore.rules: until they are published again, the
// subscription is refused, and the Innlogging tab says so.

/** Follows the requests made since `since` (an ISO time), and the ones made later. Returns the function that stops following. */
export function subscribeLoginRequests(since: string, onChange: (requests: LoginRequest[]) => void, onError: (error: unknown) => void): () => void {
  return onSnapshot(
    query(collection(db, LOGIN_REQUESTS_COLLECTION), where("at", ">=", since)),
    (snapshot) => onChange(snapshot.docs.map((d) => d.data() as LoginRequest)),
    onError
  );
}
