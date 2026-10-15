import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, MailX } from "lucide-react";
import { useCms } from "../context/CmsContext";
import { isOptedOut, optOut } from "../services/newsletter";
import { TEST_UNSUBSCRIBE_TOKEN, isNewsletterToken } from "../utils/newsletter";
import { logoOf } from "../utils/logo";

const card = "w-full max-w-sm mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5";
const primaryButton =
  "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait";

type State = "checking" | "ready" | "working" | "done" | "already" | "test" | "unknown" | "failed";

/**
 * Where the link at the bottom of the newsletter leads: /avmelding/<key>. Nothing happens before
 * the button is pressed, since a mail program may open the links in an e-mail to check them.
 * No sign-in: the key in the link is the proof (see utils/newsletter.ts).
 */
export const UnsubscribePage: React.FC = () => {
  const { key = "" } = useParams();
  const { settings } = useCms();
  const [state, setState] = useState<State>(() => (key === TEST_UNSUBSCRIBE_TOKEN ? "test" : isNewsletterToken(key) ? "checking" : "unknown"));

  useEffect(() => {
    if (state !== "checking") return;
    isOptedOut(key).then(
      (already) => setState(already ? "already" : "ready"),
      () => setState("ready")
    );
  }, [key, state]);

  const confirm = () => {
    setState("working");
    optOut(key).then(
      () => setState("done"),
      () => setState("failed")
    );
  };

  const churchName = settings.churchName?.trim() || "menigheten";
  const done = state === "done" || state === "already";

  return (
    <main className="min-h-[calc(100vh-var(--demo-strip,0px))] bg-slate-100 px-4 py-10 sm:py-16">
      <div className={card}>
        <div className="space-y-1">
          {logoOf(settings) ? (
            <img src={logoOf(settings)} alt={settings.churchName} className="h-12 w-auto max-w-full object-contain mb-4" />
          ) : (
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">{settings.churchName}</p>
          )}
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{done ? "Du er meldt av" : "Meld deg av nyhetsbrevet"}</h1>
        </div>

        {state === "checking" && <p className="text-sm text-slate-500">Laster …</p>}

        {(state === "ready" || state === "working") && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">Trykk på knappen, så får du ikke flere nyhetsbrev fra {churchName} på denne e-postadressen.</p>
            <button type="button" onClick={confirm} disabled={state === "working"} className={primaryButton}>
              <MailX className="w-4 h-4" aria-hidden="true" />
              {state === "working" ? "Melder av …" : "Meld meg av"}
            </button>
            <p className="text-xs text-slate-500">Andre beskjeder, for eksempel fra en gruppe du er med i, får du fortsatt.</p>
          </div>
        )}

        {done && (
          <div id="unsubscribe-done" className="space-y-3">
            <p className="text-sm text-slate-700 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>Du får ikke flere nyhetsbrev fra {churchName} på denne e-postadressen.</span>
            </p>
            <p className="text-xs text-slate-500">Ombestemmer du deg, kan du svare på et av nyhetsbrevene eller ta kontakt med menigheten, så melder de deg på igjen.</p>
          </div>
        )}

        {state === "test" && (
          <p className="text-sm text-slate-700">Denne lenken kom i en prøve. I et ekte nyhetsbrev melder den mottakeren av.</p>
        )}

        {state === "unknown" && <p className="text-sm text-slate-700">Lenken er ikke hel. Prøv å trykke på lenken i e-posten en gang til, eller svar på e-posten og be om å bli meldt av.</p>}

        {state === "failed" && (
          <p role="alert" className="text-sm text-red-700">
            Det gikk ikke å melde deg av akkurat nå. Prøv igjen om litt, eller svar på e-posten og be om å bli meldt av.
          </p>
        )}

        <Link to="/" className="block text-center text-xs font-bold text-indigo-700 underline underline-offset-2">
          Til nettsiden
        </Link>
      </div>
    </main>
  );
};
