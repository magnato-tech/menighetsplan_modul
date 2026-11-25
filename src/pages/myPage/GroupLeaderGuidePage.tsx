import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MinSideFrame } from "../../components/minSide/MinSideFrame";

/** Where the guide for group leaders lives on Min side, so it can be linked to from anywhere. */
export const GROUP_LEADER_GUIDE_PATH = "/minside/veiledning-gruppeledere";

const heading = "text-base font-black text-slate-900 pt-2";
const text = "text-sm text-slate-700 leading-relaxed";
const cell = "px-3 py-2 align-top text-sm text-slate-700 border-t border-slate-200";
const headCell = "px-3 py-2 text-left text-xs font-bold text-slate-500";

/**
 * The guide for group leaders: what they see, what their members see, and how they staff the
 * semester. Plain text kept here, so it follows the app when the app changes. Anyone signed in may
 * read it; it is linked from Mine grupper and the help window for those who lead a group.
 */
export const GroupLeaderGuidePage: React.FC = () => (
  <MinSideFrame width="narrow" bottomNavRoom>
    <article className="p-4 sm:p-6 space-y-4" aria-labelledby="group-leader-guide-title">
      <Link to="/minside" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Min side
      </Link>
      <h1 id="group-leader-guide-title" className="text-2xl font-black text-slate-900">
        Veiledning for gruppeledere
      </h1>
      <p className={text}>
        Som gruppeleder er du den som viser dine medlemmer Min side og spør dem om oppgaver. Her ser du hva du ser, hva de ser, og hvordan du
        hjelper dem i gang.
      </p>

      <h2 className={heading}>Din rolle</h2>
      <p className={text}>
        Du er bindeleddet mellom gruppen din og Min side. Medlemmene skal ikke lete etter oppgaver selv: du spør dem, og de svarer ja eller nei.
      </p>
      <ul className={`${text} list-disc pl-5 space-y-1`}>
        <li>Min side er der hver frivillig ser sine oppgaver og gudstjenestene.</li>
        <li>Du spør medlemmene om oppgaver, følger med på hvem som har svart, og finner noen nye når noen ikke kan.</li>
        <li>Unntaket er semesterplanen: der velger medlemmene selv hva de kan være med på.</li>
      </ul>

      <h2 className={heading}>Ditt ansvar: bemanne semesteret</h2>
      <p className={text}>
        Som leder av en tjenestegruppe har du ansvaret for at gudstjenestene i semesteret har folk i gruppens oppgaver. Semesterplanen gir et
        godt utgangspunkt, men det er du som fyller hullene etter svarfristen.
      </p>
      <table className="w-full border border-slate-200 rounded-xl overflow-hidden">
        <thead className="bg-slate-50">
          <tr>
            <th className={headCell}>Tjenestegruppe</th>
            <th className={headCell}>Oppgaver</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Gudstjenesteledere og forbønn", "Lede gudstjenesten, forbønn"],
            ["Barnekirke", "Ha barnekirke"],
            ["Lovsang", "Lovsang"],
            ["Rigging, lyd og bilde", "Rigging, lyd, bilde"],
            ["Møteverter", "Møtevert"],
            ["Pynting, baking og kjøkken", "Pynting, baking, kjøkken"],
          ].map(([group, tasks]) => (
            <tr key={group}>
              <td className={cell}>{group}</td>
              <td className={cell}>{tasks}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={text}>Målet er at hver gudstjeneste har «Dekket» på alle gruppens oppgaver før semesteret starter.</p>

      <h2 className={heading}>Det du ser, og det medlemmene ser</h2>
      <ul className={`${text} list-disc pl-5 space-y-1`}>
        <li>
          <strong>Du:</strong> Mine oppgaver (semesterplanen, forespørsler, dine oppgaver og «Se ledige oppgaver»), Mine grupper (gruppene du
          leder, med bemanningen) og Gudstjenester.
        </li>
        <li>
          <strong>Medlemmene:</strong> forespørsler fra deg, oppgavene de har sagt ja til, gudstjenestene, og semesterplanen når den er åpen. De
          kan ikke melde seg på andre oppgaver selv: vil de ha en, sier de fra til deg.
        </li>
      </ul>

      <h2 className={heading}>Slik hjelper du dem å logge inn</h2>
      <ol className={`${text} list-decimal pl-5 space-y-1`}>
        <li>Knappen i en e-post fra menigheten logger dem rett inn. Den er personlig og skal ikke sendes videre.</li>
        <li>«Fortsett med Google» for den som har Gmail.</li>
        <li>«Send meg en lenke»: de skriver e-postadressen sin og får en e-post med knappen «Logg inn».</li>
      </ol>
      <p className={text}>
        Kommer ikke e-posten, se i søppelpost. Står det «Vi fant ikke adressen din», har de brukt en annen adresse enn menigheten har: be dem prøve
        den andre, eller si fra til administrator.
      </p>

      <h2 className={heading}>Slik spør du noen om en oppgave</h2>
      <ol className={`${text} list-decimal pl-5 space-y-1`}>
        <li>Gå til Mine grupper og åpne gruppen din.</li>
        <li>Under Planlagte aktiviteter ser du oppgavene og status.</li>
        <li>Ved en oppgave som står Ubesatt, velger du en person under «Tildel fra gruppen».</li>
        <li>Personen får forespørselen øverst på Mine oppgaver og svarer «Ja, jeg kan» eller «Kan ikke».</li>
        <li>Sjekk statusen etter noen dager, og spør en annen hvis svaret er nei.</li>
      </ol>
      <p className={text}>Du kan også ta en ledig oppgave selv: trykk «Se ledige oppgaver» og velg «Ta oppgave».</p>
      <p className={text}>
        Deler gruppen en rolle med et annet team, for eksempel to lovsangsteam, står de nye oppgavene under «Ikke fordelt» i gruppen. Trykk «Vi
        tar denne» på gudstjenestene dere skal ha. Har dere tatt en dere ikke kan likevel, trykker du «Gi fra oss», så kan det andre teamet ta
        den.
      </p>
      <table className="w-full border border-slate-200 rounded-xl overflow-hidden">
        <thead className="bg-slate-50">
          <tr>
            <th className={headCell}>Status</th>
            <th className={headCell}>Betyr</th>
            <th className={headCell}>Det du gjør</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Ubesatt", "Ingen er spurt", "Spør noen"],
            ["Forespurt", "Spurt, ikke svart", "Minn dem på det, eller vent"],
            ["Dekket", "Har sagt ja", "Ingenting"],
            ["Avslått", "Har sagt nei", "Spør en annen"],
            ["Forfall", "Sa ja, men kan ikke likevel", "Finn en vikar"],
          ].map(([status, means, todo]) => (
            <tr key={status}>
              <td className={cell}>{status}</td>
              <td className={cell}>{means}</td>
              <td className={cell}>{todo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className={heading}>Semesterplanen</h2>
      <p className={text}>
        Når semesterplanen er åpen, står den øverst på Mine oppgaver med svarfrist. Medlemmet trykker Start og går gjennom arrangementene ett om
        gangen: Ta oppgave, Kan ikke eller Neste. Alt lagres med en gang. Sett deg gjerne sammen med dem første gang, og minn gruppen på fristen
        en uke før.
      </p>

      <h2 className={heading}>Når noen ikke kan</h2>
      <p className={text}>
        Et medlem som har sagt ja, men ikke kan likevel, trykker «Meld forfall» på oppgaven. Oppgaven får status Forfall, og du finner en ny med
        «Tildel fra gruppen». Haster det, ring: en forespørsel blir ikke alltid sett samme dag.
      </p>

      <h2 className={heading}>Samtalen med dine</h2>
      <ul className={`${text} list-disc pl-5 space-y-1`}>
        <li>Har du kommet inn på Min side?</li>
        <li>Vet du hvor du ser oppgavene dine?</li>
        <li>Vet du at jeg spør deg, og at du svarer med ett trykk?</li>
        <li>Er semesterplanen åpen? Da velger du selv, innen fristen.</li>
        <li>Kan du ikke likevel: meld forfall, og ring meg hvis det haster.</li>
        <li>Har menigheten riktig e-postadresse og telefonnummer?</li>
      </ul>

      <h2 className={heading}>Hvem spør du om hjelp?</h2>
      <p className={text}>Administrator i menigheten, for innlogging, e-postadresser og hvem som står i hvilken gruppe.</p>
    </article>
  </MinSideFrame>
);
