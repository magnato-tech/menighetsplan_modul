import React, { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { LogIn, Mail } from "lucide-react";
import { useCms } from "../context/CmsContext";
import { useFirebase } from "../context/FirebaseDataContext";
import { completeSignInLink, describeSignInError, isSignInLink, sendSignInLink, signInWithGoogle } from "../services/auth";
import { destinationAfterSignIn, signInUrl, type NotInRegisterReason } from "../utils/session";

const card = "w-full max-w-sm mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5";
const primaryButton =
  "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait";
const secondaryButton =
  "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait";
const input =
  "w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500";

const NOT_IN_REGISTER: Record<NotInRegisterReason, string> = {
  unverified: "E-postadressen på kontoen er ikke bekreftet, så den kan ikke brukes til å logge inn her.",
  noMatch: "Ingen i personregisteret har denne e-postadressen. Ta kontakt med menigheten for å bli lagt inn, eller logg inn med adressen menigheten har registrert på deg.",
  severalMatches: "Flere personer i registeret har denne e-postadressen, så den sier ikke hvem du er. Be menigheten rette det.",
};

/**
 * The way in to Min side and the admin: a Google account, or a link sent to an e-mail address.
 * Who gets in is decided by the register (see utils/session.ts), so the page also says so to
 * someone who is signed in without being in it.
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

  if (session.status === "member") return <Navigate to={destination} replace />;

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
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">{settings.churchName}</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Logg inn</h1>
        </div>

        {session.status === "loading" && <p className="text-sm text-slate-500">Laster …</p>}

        {session.status === "notInRegister" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Du er logget inn som <strong>{session.account.email ?? "en konto uten e-postadresse"}</strong>, men står ikke i personregisteret til{" "}
              {settings.churchName}.
            </p>
            <p className="text-sm text-slate-600">{NOT_IN_REGISTER[session.reason]}</p>
            <button type="button" onClick={() => void signOut()} className={secondaryButton}>
              Logg ut og prøv en annen konto
            </button>
          </div>
        )}

        {session.status === "signedOut" && linkNeedsEmail && (
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

        {session.status === "signedOut" && !linkNeedsEmail && sentTo && (
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

        {session.status === "signedOut" && !linkNeedsEmail && !sentTo && (
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
        {standInAs && session.status === "signedOut" && (
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
          <Link to="/" className="text-xs font-bold text-slate-600 hover:text-slate-900">
            Tilbake til nettsiden
          </Link>
        </p>
      </div>
    </main>
  );
};
