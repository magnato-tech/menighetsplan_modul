import React, { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ChurchSiteLink } from "../components/ChurchSiteLink";
import { LogIn, Mail } from "lucide-react";
import { useCms } from "../context/CmsContext";
import { useFirebase } from "../context/FirebaseDataContext";
import { completeSignInLink, describeSignInError, isSignInLink, sendSignInLink, signInWithGoogle } from "../services/auth";
import { destinationAfterSignIn, signInUrl } from "../utils/session";
import { DEMO } from "../demo";
import { DemoDoor } from "./DemoDoor";
import { whereDoorLeads } from "../utils/demoDoor";
import { logoOf } from "../utils/logo";

const card = "w-full max-w-sm mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5";
const primaryButton =
  "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait";
const secondaryButton =
  "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait";
const input =
  "w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500";

/** The link that opens an e-mail to the congregation, asking for help to get in. */
export const helpToSignInLink = (address: string): string => `mailto:${address}?subject=${encodeURIComponent("Hjelp til å logge inn")}`;

/**
 * The way in to Min side and the admin: a Google account, or a link sent to an e-mail address.
 * Who gets in is decided by the register (see utils/session.ts). Someone the register does not
 * know, is not told they are signed in, nor why they were not found: they are told who to ask.
 *
 * In the demo installation nobody signs in: the page is the way in, with what to look at as the
 * choice. Someone who is inside already comes here to choose again.
 */
export const SignInPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { session, signOut, standInAs, allPersons } = useFirebase();
  const { settings } = useCms();
  const destination = destinationAfterSignIn(searchParams.get("neste"));

  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // The page was opened from a link in an e-mail, on a device that does not know which address it was sent to
  const [linkNeedsEmail, setLinkNeedsEmail] = useState(false);
  // In the demo: where the way in that was chosen starts. Nothing is chosen until the visitor has pressed one.
  const [doorStart, setDoorStart] = useState<string | null>(null);
  const atDemoDoor = DEMO !== null && standInAs !== undefined;
  const signedOut = session.status === "signedOut";

  const attempt = async (signIn: () => Promise<unknown>) => {
    setWorking(true);
    setError(null);
    try {
      await signIn();
    } catch (problem) {
      setError(describeSignInError(problem));
    } finally {
      setWorking(false);
    }
  };

  // A link from an e-mail signs in as soon as the page is opened
  useEffect(() => {
    if (!isSignInLink(window.location.href)) return;
    void attempt(async () => {
      if ((await completeSignInLink(window.location.href)) === "needsEmail") setLinkNeedsEmail(true);
    });
  }, []);

  // In the demo, someone who is inside stays on the page until they have chosen, and the choice decides where they go
  const choosingAgain = atDemoDoor && session.status === "member" && doorStart === null;
  if (session.status === "member" && !choosingAgain) return <Navigate to={doorStart ?? destination} replace />;

  const sendLink = (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    void attempt(async () => {
      await sendSignInLink(address, `${window.location.origin}${signInUrl(destination)}`);
      setSentTo(address);
    });
  };

  const confirmLink = (event: React.FormEvent) => {
    event.preventDefault();
    void attempt(async () => {
      await completeSignInLink(window.location.href, email);
    });
  };

  return (
    <main className="min-h-[calc(100vh-var(--demo-strip,0px))] bg-slate-100 px-4 py-10 sm:py-16">
      <div className={card}>
        <div className="space-y-1">
          {logoOf(settings) ? (
            <img src={logoOf(settings)} alt={settings.churchName} className="h-12 w-auto max-w-full object-contain mb-4" />
          ) : (
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">{settings.churchName}</p>
          )}
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{atDemoDoor ? "Gå inn i demoen" : "Logg inn"}</h1>
        </div>

        {session.status === "loading" && <p className="text-sm text-slate-500">Laster …</p>}

        {session.status === "notInRegister" && (
          <div id="sign-in-not-found" className="space-y-4">
            <p className="text-sm text-slate-700">
              <strong>Vi fant deg ikke.</strong>{" "}
              {settings.email?.trim() ? (
                <>
                  Send en e-post til{" "}
                  <a href={helpToSignInLink(settings.email.trim())} className="font-bold text-indigo-700 underline underline-offset-2 break-all">
                    {settings.email.trim()}
                  </a>{" "}
                  og be om hjelp til å logge inn.
                </>
              ) : (
                "Ta kontakt med menigheten og be om hjelp til å logge inn."
              )}
            </p>
            <button type="button" onClick={() => void signOut()} className={secondaryButton}>
              Prøv en annen e-postadresse
            </button>
          </div>
        )}

        {atDemoDoor && (signedOut || choosingAgain) && (
          <DemoDoor
            onEnter={(door) => {
              setDoorStart(whereDoorLeads(door, destination));
              standInAs(door.person.id);
            }}
          />
        )}

        {signedOut && !atDemoDoor && linkNeedsEmail && (
          <form onSubmit={confirmLink} className="space-y-3">
            <p className="text-sm text-slate-700">
              Lenken er åpnet på en annen enhet enn den ble bestilt fra. Skriv e-postadressen den ble sendt til, så logges du inn.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">E-postadresse</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            </label>
            <button type="submit" disabled={working} className={primaryButton}>
              Logg inn
            </button>
          </form>
        )}

        {signedOut && !atDemoDoor && !linkNeedsEmail && sentTo && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Vi har sendt en lenke til <strong>{sentTo}</strong>. Åpne e-posten og trykk på lenken for å logge inn.
            </p>
            <p className="text-xs text-slate-500">Kommer den ikke, så se i søppelposten, eller prøv igjen om litt.</p>
            <button type="button" onClick={() => setSentTo(null)} className={secondaryButton}>
              Bruk en annen adresse
            </button>
          </div>
        )}

        {signedOut && !atDemoDoor && !linkNeedsEmail && !sentTo && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Min side og administrasjonen er for dem som står i menighetens personregister.</p>
            <button type="button" disabled={working} onClick={() => void attempt(signInWithGoogle)} className={secondaryButton}>
              <LogIn className="w-4 h-4" aria-hidden="true" />
              Fortsett med Google
            </button>

            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              eller
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={sendLink} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-700">E-postadresse</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="navn@eksempel.no"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={input}
                />
              </label>
              <button type="submit" disabled={working} className={primaryButton}>
                <Mail className="w-4 h-4" aria-hidden="true" />
                Send meg en lenke
              </button>
              <p className="text-xs text-slate-500">Du får en e-post med en lenke som logger deg inn. Du trenger ikke passord.</p>
            </form>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* Only on a developer's own machine: the published app has no way in without signing in */}
        {standInAs && !atDemoDoor && signedOut && (
          <label className="block space-y-1 pt-3 border-t border-dashed border-slate-300">
            <span className="text-xs font-bold text-slate-700">På egen maskin: gå inn som en person uten å logge inn</span>
            <select defaultValue="" onChange={(e) => e.target.value && standInAs(e.target.value)} className={input}>
              <option value="" disabled>
                Velg en person
              </option>
              {allPersons.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {person.globalRole === "admin" ? " (administrator)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="pt-1 text-center">
          <ChurchSiteLink className="text-xs font-bold text-slate-600 hover:text-slate-900">
            Tilbake til nettsiden
          </ChurchSiteLink>
        </p>
      </div>
    </main>
  );
};
