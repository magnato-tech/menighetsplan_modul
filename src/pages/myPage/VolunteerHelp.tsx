import React from "react";
import { CircleHelp } from "lucide-react";

/**
 * Short guidance for a volunteer, on Min side. Not the admin help.
 * Absence is reported without a reason: that is taken in person.
 */
export const VolunteerHelp: React.FC = () => (
  <details className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
    <summary className="font-bold text-slate-800 cursor-pointer flex items-center gap-2">
      <CircleHelp className="w-4 h-4 text-emerald-700" />
      Slik bruker du Min side
    </summary>
    <ol className="mt-3 space-y-2 list-decimal pl-4 leading-relaxed">
      <li>Logg inn med Google eller en lenke på e-post. Adressen må stå på deg i registeret.</li>
      <li>Gruppene dine står under Mine grupper. Der ser du hvem som er med, og beskjedene.</li>
      <li>En ledig oppgave i en gruppe du er med i, ligger under det som trenger svar. Trykk Ta oppgaven.</li>
      <li>Er du spurt om en oppgave, svarer du Ja, jeg kan eller Kan ikke.</li>
      <li>Står du allerede på en oppgave og ikke kan likevel, trykk Meld forfall og bekreft. Grunnen tas muntlig.</li>
    </ol>
  </details>
);
