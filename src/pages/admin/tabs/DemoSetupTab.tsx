import React, { useEffect, useState } from "react";
import { Copy, ExternalLink, KeyRound, Lock, SlidersHorizontal } from "lucide-react";
import { DEMO } from "../../../demo";
import { DEMO_SITE } from "../../../demoSite";
import { useDemoOwner } from "../../../hooks/useDemoOwner";
import { isDemoOwnerSetUp, lockDemoOwner, unlockDemoOwner } from "../../../services/demoOwner";
import { chooseDemoSite } from "../../../services/demoSite";
import { listDemoSetStatuses, saveSiteListing, type DemoSetStatus } from "../../../services/demoSiteList";
import { reportWriteError } from "../../../services/writeErrors";
import { DEMO_SETTINGS } from "../../../installation";
import { MIN_OWNER_CODE_LENGTH, ownerCodeHashOf, ownerCodeProblem } from "../../../utils/demoOwner";
import { SITE_PARAMETER } from "../../../utils/demoSite";
import type { ShowFeedback } from "../studio";
import { studioCard, studioInputFull, studioPrimaryButton, studioSecondaryButton } from "../studioTheme";
import { AddonSwitch } from "./addons/AddonSwitch";

interface DemoSetupTabProps {
  showFeedback: ShowFeedback;
}

const heading = "text-2xl sm:text-3xl font-black text-[var(--studio-text)] tracking-tight flex items-center gap-2.5";
const muted = "text-xs text-[var(--studio-muted)]";

/** The address that opens the demo with one congregation. */
const linkTo = (site: string): string => `${window.location.origin}/?${SITE_PARAMETER}=${site}`;

/** The older way of copying, for a browser that keeps the clipboard from the page: the text is marked in a field of its own and copied from there. */
function copyFromField(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.focus();
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

async function copy(text: string, showFeedback: ShowFeedback, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showFeedback(done);
  } catch {
    if (copyFromField(text)) showFeedback(done);
    else showFeedback("Nettleseren lot ikke teksten kopieres. Klikk på teksten, så blir den merket, og trykk Ctrl+C.", "error");
  }
}

/** One click marks the whole text, for the one who copies it by hand. */
const copyable = "select-all cursor-text";

interface ChooseOwnerCodeProps extends DemoSetupTabProps {
  /** Whether the demo has a code that is to be replaced, or none yet. */
  replacing?: boolean;
}

/**
 * Makes the line that goes into the demo's settings from a code the owner chooses. Shown to
 * whoever opens the tab before the demo has a code, and to the owner who wants another.
 */
const ChooseOwnerCode: React.FC<ChooseOwnerCodeProps> = ({ showFeedback, replacing = false }) => {
  const [code, setCode] = useState("");
  const [line, setLine] = useState("");
  const problem = ownerCodeProblem(code);

  useEffect(() => {
    let stopped = false;
    if (code.trim().length < MIN_OWNER_CODE_LENGTH) {
      setLine("");
      return;
    }
    ownerCodeHashOf(code).then((hash) => {
      if (!stopped) setLine(`${DEMO_SETTINGS.ownerCodeHash}=${hash}`);
    });
    return () => {
      stopped = true;
    };
  }, [code]);

  return (
    <div className={`${studioCard} p-5 space-y-4`}>
      <h2 className="text-sm font-black text-[var(--studio-text)]">{replacing ? "Bytt eierkode" : "Eierkoden er ikke satt opp"}</h2>
      <p className={muted}>
        {replacing
          ? "Velg en ny kode her. Den gamle virker til det nye fingeravtrykket er lagt inn i demoens innstillinger og demoen er bygget på nytt."
          : "Demo-oppsettet er bare for eieren av demoen, som låser det opp med en kode. Velg en kode her."}{" "}
        Koden blir værende i nettleseren din: det som skal inn i demoens innstillinger, er et fingeravtrykk av koden, ikke koden selv.
      </p>
      <p className={muted}>Bruk en kode du ikke bruker noe annet sted, gjerne flere ord etter hverandre.</p>
      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-[var(--studio-text)]">
          Velg en {replacing ? "ny " : ""}eierkode (minst {MIN_OWNER_CODE_LENGTH} tegn)
        </span>
        <input type="password" autoComplete="new-password" value={code} onChange={(event) => setCode(event.target.value)} className={studioInputFull} />
      </label>
      {problem && <p className="text-xs text-amber-500">{problem}</p>}
      {line && (
        <div className="space-y-2">
          <p className={muted}>
            {replacing
              ? `Fjern ${DEMO_SETTINGS.ownerCodeHash} fra innstillingene til demoen der den er publisert, legg inn denne linja i stedet, og bygg demoen på nytt. Da låser du opp med den nye koden.`
              : "Legg denne linja inn i innstillingene til demoen der den er publisert, og bygg demoen på nytt."}{" "}
            Husk koden du valgte.
          </p>
          <code className={`block p-3 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)] text-[11px] text-[var(--studio-text)] break-all ${copyable}`}>
            {line}
          </code>
          <button type="button" onClick={() => copy(line, showFeedback, "Linja er kopiert.")} className={`${studioSecondaryButton} flex items-center gap-1.5`}>
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            Kopier linja
          </button>
        </div>
      )}
    </div>
  );
};

/** Asks for the owner's code. */
const Unlock: React.FC = () => {
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);
  const [trying, setTrying] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTrying(true);
    const opened = await unlockDemoOwner(code);
    setTrying(false);
    setWrong(!opened);
  };

  return (
    <form onSubmit={submit} className={`${studioCard} max-w-md p-5 space-y-4`}>
      <h2 className="text-sm font-black text-[var(--studio-text)] flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-[var(--studio-icon)]" aria-hidden="true" />
        For eieren av demoen
      </h2>
      <p className={muted}>Her bestemmer eieren hvordan demoen er satt opp. Skriv eierkoden for å åpne. Den huskes i denne nettleseren.</p>
      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-[var(--studio-text)]">Eierkode</span>
        <input
          type="password"
          autoComplete="current-password"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setWrong(false);
          }}
          className={studioInputFull}
        />
      </label>
      {wrong && (
        <p role="alert" className="text-xs text-red-500">
          Det var ikke eierkoden.
        </p>
      )}
      <button type="submit" disabled={trying || code.trim() === ""} className={`${studioPrimaryButton} px-4 py-2 text-xs disabled:opacity-60`}>
        Lås opp
      </button>
    </form>
  );
};

/** The congregations of the demo, each with its switch and its link. */
const Congregations: React.FC<DemoSetupTabProps> = ({ showFeedback }) => {
  const [sets, setSets] = useState<DemoSetStatus[] | null | undefined>(undefined);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    listDemoSetStatuses().then((list) => {
      if (!stopped) setSets(list);
    });
    return () => {
      stopped = true;
    };
  }, []);

  const toggle = async (set: DemoSetStatus, listed: boolean) => {
    setSaving(set.id);
    try {
      await saveSiteListing(set.id, listed);
      setSets((current) => current?.map((other) => (other.id === set.id ? { ...other, listed } : other)));
      showFeedback(
        listed
          ? `${set.name} står nå i lista alle besøkende ser.`
          : `${set.name} er tatt ut av lista. Den kan fortsatt åpnes med lenken.`
      );
    } catch (error) {
      reportWriteError(`lagre valget for ${set.name}`, error);
    }
    setSaving(null);
  };

  if (sets === undefined) return <p className="text-sm text-[var(--studio-muted)]">Henter menighetene …</p>;
  if (sets === null) {
    return (
      <p role="alert" className={`${studioCard} p-4 text-xs text-[var(--studio-text)]`}>
        Lista over menigheter kunne ikke hentes. Last siden på nytt for å prøve igjen.
      </p>
    );
  }
  if (sets.length === 0) return <p className={`${studioCard} p-4 ${muted}`}>Det følger ingen menigheter med demoen ennå.</p>;

  return (
    <section aria-label="Menigheter i demoen" className="space-y-3">
      <p className={`${muted} max-w-2xl`}>
        Slå en menighet på når den har sagt ja til å vises. Da står den i lista «Se din menighet» for alle som besøker demoen. En
        menighet som er av, står ikke i lista, men du kan åpne den selv eller sende lenken til menigheten det gjelder.
      </p>
      <ul className="space-y-3">
        {sets.map((set) => (
          <li key={set.id} className={`${studioCard} p-4 flex flex-col gap-3 ${set.listed ? "border-emerald-600/60" : ""}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-[var(--studio-text)]">{set.name}</h3>
                <p className={muted}>
                  Hentet fra {set.source}. {set.listed ? "Står i lista for alle." : "Står ikke i lista."}
                  {DEMO_SITE === set.id && " Du ser på denne nå."}
                </p>
                {!set.ready && <p className="text-xs text-amber-500 mt-1">Ligger ikke i demoens database ennå, og kan ikke vises før etter neste nullstilling.</p>}
              </div>
              <AddonSwitch on={set.listed} label={`${set.name} i lista for alle`} onChange={(on) => toggle(set, on)} disabled={saving === set.id} />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--studio-border)]">
              <code className={`min-w-0 flex-1 text-[11px] text-[var(--studio-muted)] truncate ${copyable}`}>{linkTo(set.id)}</code>
              <button type="button" onClick={() => copy(linkTo(set.id), showFeedback, `Lenken til ${set.name} er kopiert.`)} className={`${studioSecondaryButton} flex items-center gap-1.5`}>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                Kopier lenke
              </button>
              <button type="button" disabled={!set.ready} onClick={() => chooseDemoSite(set.id)} className={`${studioSecondaryButton} flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Vis denne menigheten
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

/**
 * Demo-oppsett: where the owner of the demo decides how it is set up. Only in the demo, and
 * only for the one who has the owner's code (see utils/demoOwner.ts).
 */
export const DemoSetupTab: React.FC<DemoSetupTabProps> = ({ showFeedback }) => {
  const owner = useDemoOwner();
  const [changingCode, setChangingCode] = useState(false);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--studio-border)] pb-6">
        <div>
          <h1 className={heading}>
            <SlidersHorizontal className="w-6 h-6 text-[var(--studio-icon)]" aria-hidden="true" />
            Demo-oppsett
          </h1>
          <p className="text-xs sm:text-sm text-[var(--studio-muted)] mt-1 max-w-2xl">Hvilke menigheter besøkende kan velge å se demoen med.</p>
        </div>
        {DEMO && owner === "owner" && (
          <button type="button" onClick={lockDemoOwner} className={`${studioSecondaryButton} self-start sm:self-auto flex items-center gap-1.5`}>
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            Lås
          </button>
        )}
      </div>

      {!DEMO ? (
        <p className={`${studioCard} p-4 ${muted}`}>Demo-oppsettet finnes bare i demoen.</p>
      ) : !isDemoOwnerSetUp() ? (
        <ChooseOwnerCode showFeedback={showFeedback} />
      ) : owner === "checking" ? (
        <p className="text-sm text-[var(--studio-muted)]">Et øyeblikk …</p>
      ) : owner === "locked" ? (
        <Unlock />
      ) : (
        <>
          <Congregations showFeedback={showFeedback} />
          <section aria-label="Eierkoden" className="space-y-3 pt-2">
            {changingCode ? (
              <ChooseOwnerCode showFeedback={showFeedback} replacing />
            ) : (
              <button type="button" onClick={() => setChangingCode(true)} className={`${studioSecondaryButton} flex items-center gap-1.5`}>
                <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                Bytt eierkode
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
};
