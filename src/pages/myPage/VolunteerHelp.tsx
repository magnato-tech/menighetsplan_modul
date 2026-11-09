import React, { useEffect, useState } from "react";
import { CircleHelp, X } from "lucide-react";

/**
 * Short guidance for a volunteer, on Min side. Not the admin help.
 * Absence is reported without a reason: that is taken in person.
 *
 * A small «?» by the heading, which opens the guidance in a window: the page itself is kept for
 * what the volunteer came to do.
 */
export const VolunteerHelp: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        id="btn-volunteer-help"
        onClick={() => setOpen(true)}
        aria-label="Slik bruker du Min side"
        title="Slik bruker du Min side"
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-white cursor-pointer"
      >
        <CircleHelp className="w-5 h-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          id="modal-volunteer-help"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="volunteer-help-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[85vh] overflow-y-auto border border-slate-200 p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="volunteer-help-title" className="text-base font-black text-slate-900">
                Slik bruker du Min side
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Lukk veiledningen" className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <ol className="space-y-2 list-decimal pl-4 leading-relaxed text-sm text-slate-700">
              <li>
                Min side er en del av menighetens nettside, ikke en app som må lastes ned. Trykk Logg inn på nettsiden, med Google eller en lenke på e-post. Adressen må stå på deg i registeret.
                Vil du ha et ikon på telefonen, velg «Legg til på startskjermen» i nettleseren.
              </li>
              <li>
                Gruppene dine står under Mine grupper. Der ser du hvem som er med, og beskjedene. Under Gudstjenester ser du hvem som gjør hva de neste søndagene.
                Leder du en gruppe, står den øverst med bemanningen, forfall står som Må fylles på Mine oppgaver, og Jeg leder i Kalender viser gruppens arrangementer.
              </li>
              <li>Er du spurt om en oppgave, står forespørselen øverst på Mine oppgaver. Svar Ja, jeg kan eller Kan ikke. Har du flere, kommer den neste når du har svart.</li>
              <li>Under står knappen Se ledige oppgaver. Der ser du alt samlet: forespørslene først, så de ledige oppgavene i gruppene dine.</li>
              <li>Står du allerede på en oppgave og ikke kan likevel, trykk Meld forfall og bekreft. Grunnen tas muntlig.</li>
              <li>
                Når semesterplanen er åpnet, står et flagg ved Min side og et gult kort øverst. Trykk Start og gå gjennom arrangementene ett om gangen:
                Ta oppgave, Kan ikke eller Neste. Alt lagres med en gang, så du kan fortsette senere.
              </li>
              <li>
                I semesterplanen: står du allerede på en oppgave, trykk på den grønne linjen «Du står på …». Oppgaven blir ledig igjen, og lederen får ingen forfallsmelding.
                «Kan ikke» betyr at du ikke kan hele arrangementet, og tar deg ikke av oppgaven. Meld forfall gjelder fortsatt alle andre steder.
              </li>
              <li>
                Har du sagt ja til Møteleder eller Gudstjenesteleder, kan du endre programmet for arrangementet. Åpne oppgaven og trykk Se og endre programmet.
                Dra postene i rekkefølge, endre tittel og varighet, og legg til nye med Ny programpost.
              </li>
            </ol>
            <button type="button" onClick={() => setOpen(false)} className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold cursor-pointer">
              Lukk
            </button>
          </div>
        </div>
      )}
    </>
  );
};
