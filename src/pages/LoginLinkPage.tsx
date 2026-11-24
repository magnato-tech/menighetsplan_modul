import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCms } from "../context/CmsContext";
import { describeSignInError, signInWithLoginLink } from "../services/auth";
import { exchangeLoginLink } from "../services/loginLink";
import { DEMO } from "../demo";
import { logoOf } from "../utils/logo";
import { safeDestination } from "../utils/loginLink";
import { signInUrl } from "../utils/session";

const card = "w-full max-w-sm mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5";
const primaryButton =
  "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer";

const INVALID_LINK = "Lenken er ikke gyldig. Logg inn på vanlig måte.";

/** What the link holds: the token in the fragment, and where to go afterwards in the query. Read once. */
interface LinkStart {
  token: string;
  destination: string;
}

const readStart = (): LinkStart => ({
  token: window.location.hash.replace(/^#/, ""),
  destination: safeDestination(new URLSearchParams(window.location.search).get("til")),
});

/**
 * The page a personal link in an e-mail opens (see utils/loginLink.ts). It is not behind sign-in:
 * the token is the proof. The token is taken out of the address at once, so it is not left in the
 * history or on the screen, and then sent to the server, which gives back a sign-in for the account.
 */
export const LoginLinkPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useCms();
  const [start] = useState<LinkStart>(readStart);
  // Set when the sign-in has been asked for, so that a page drawn twice asks once
  const asked = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    if (DEMO !== null || asked.current) return;
    asked.current = true;
    if (start.token === "") {
      setProblem(INVALID_LINK);
      return;
    }
    const signIn = async () => {
      const answer = await exchangeLoginLink(start.token);
      if (!answer.ok) {
        setProblem(answer.message);
        return;
      }
      try {
        await signInWithLoginLink(answer.customToken);
        navigate(start.destination, { replace: true });
      } catch (error) {
        setProblem(describeSignInError(error));
      }
    };
    void signIn();
  }, [start, navigate]);

  const churchName = settings.churchName?.trim() || "menigheten";

  return (
    <main className="min-h-[calc(100vh-var(--demo-strip,0px))] bg-slate-100 px-4 py-10 sm:py-16">
      <div className={card}>
        <div className="space-y-1">
          {logoOf(settings) ? (
            <img src={logoOf(settings)} alt={settings.churchName} className="h-12 w-auto max-w-full object-contain mb-4" />
          ) : (
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">{churchName}</p>
          )}
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Logg inn</h1>
        </div>

        {DEMO !== null && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">Demoen har ikke innloggingslenker.</p>
            <Link to="/logg-inn" className={primaryButton}>
              Gå til innlogging
            </Link>
          </div>
        )}

        {DEMO === null && problem === null && <p className="text-sm text-slate-500">Logger deg inn …</p>}

        {DEMO === null && problem !== null && (
          <div className="space-y-4">
            <p role="alert" className="text-sm text-red-700">
              {problem}
            </p>
            <Link to={signInUrl(start.destination)} className={primaryButton}>
              Logg inn på vanlig måte
            </Link>
          </div>
        )}

        <Link to="/" className="block text-center text-xs font-bold text-indigo-700 underline underline-offset-2">
          Til nettsiden
        </Link>
      </div>
    </main>
  );
};
