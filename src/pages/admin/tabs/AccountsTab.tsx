import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { requestAccountList } from "../../../services/accountList";
import { inPeriod, overviewOf, type AccountListAnswer, type AccountPeriod, type AccountOverview, type AccountProvider, type AccountRefusal } from "../../../utils/accountOverview";
import { formatNorwegianDateTime } from "../../../utils/dates";
import type { StudioData } from "../studio";
import { studioBadge, studioCardPadded, studioMuted, studioSecondaryButton } from "../studioTheme";
import { LoginCountsSection } from "./LoginCountsSection";

interface AccountsTabProps {
  studio: Pick<StudioData, "adminPersons" | "adminGroups">;
}

// Reasons that are no fault: the page says so calmly instead of in red
const CALM_REASONS: readonly AccountRefusal[] = ["demo", "no-service-account", "unavailable"];

const PROVIDER_LABEL: Record<AccountProvider, string> = { google: "Google", "e-postlenke": "E-postlenke", annet: "Annet" };

const when = (iso: string | null): string => (iso ? formatNorwegianDateTime(iso) : "ikke logget inn");

const Count: React.FC<{ value: number; label: string; note?: string }> = ({ value, label, note }) => (
  <div className={studioCardPadded}>
    <p className="text-2xl font-black text-[var(--studio-text)]">{value}</p>
    <p className={`text-xs font-bold ${studioMuted}`}>{label}</p>
    {note && <p className={`text-[11px] mt-0.5 ${studioMuted}`}>{note}</p>}
  </div>
);

const PERIODS: { value: AccountPeriod; label: string }[] = [
  { value: 7, label: "Siste 7 dager" },
  { value: 30, label: "Siste 30 dager" },
  { value: null, label: "Alt" },
];

const Tag: React.FC<{ tone?: "red" | "amber"; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className={
      tone === "red" ? "text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400" : tone === "amber" ? "text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500" : studioBadge
    }
  >
    {children}
  </span>
);

const Section: React.FC<{ title: string; help?: string; empty: boolean; children?: React.ReactNode }> = ({ title, help, empty, children }) => (
  <section className={studioCardPadded}>
    <h3 className="text-sm font-black text-[var(--studio-text)]">{title}</h3>
    {help && <p className={`text-xs mt-1 mb-3 ${studioMuted}`}>{help}</p>}
    {empty ? <p className={`text-xs mt-3 ${studioMuted}`}>Ingen.</p> : <ul className="mt-3 divide-y divide-[var(--studio-border)]">{children}</ul>}
  </section>
);

/** The accounts of the installation against the register: who has signed in, who has not, and who cannot. Nothing is stored. */
export const AccountsTab: React.FC<AccountsTabProps> = ({ studio }) => {
  const persons = useMemo(() => studio.adminPersons.map((row) => row.person), [studio.adminPersons]);
  const groups = useMemo(() => studio.adminGroups.map((row) => row.group), [studio.adminGroups]);
  // undefined while the accounts are being fetched
  const [answer, setAnswer] = useState<AccountListAnswer | undefined>(undefined);
  const [showSigned, setShowSigned] = useState(false);
  // The period narrows who signed in and who was stopped; who never has, and who cannot, are the same in every period
  const [period, setPeriod] = useState<AccountPeriod>(null);

  const load = useCallback(() => {
    setAnswer(undefined);
    requestAccountList().then(setAnswer);
  }, []);
  useEffect(() => load(), [load]);

  const overview: AccountOverview | null = answer && answer.ok ? overviewOf(persons, groups, answer.accounts) : null;
  const now = answer && answer.ok ? Date.parse(answer.fetchedAt) : Date.now();
  const signedIn = overview ? overview.signedIn.filter((row) => inPeriod(row.account.lastLoginAt, period, now)) : [];
  const newcomers = period === null ? 0 : signedIn.filter((row) => inPeriod(row.account.createdAt, period, now)).length;
  const stopped = overview ? overview.notInRegister.filter((row) => inPeriod(row.account.lastLoginAt, period, now)) : [];
  const inThePeriod = period === null ? "" : ` (${PERIODS.find((p) => p.value === period)?.label.toLowerCase()})`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Innlogging</h2>
          <p className={`text-xs mt-1 ${studioMuted}`}>Hvem i registeret som har kommet inn på Min side, og hvem som trenger hjelp.</p>
        </div>
        <div className="flex items-center gap-3">
          {answer && answer.ok && <span className={`text-xs ${studioMuted}`}>Hentet {formatNorwegianDateTime(answer.fetchedAt)}</span>}
          <button type="button" onClick={load} disabled={answer === undefined} className={studioSecondaryButton}>
            <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
            Oppdater
          </button>
        </div>
      </div>

      {answer === undefined && <p className={`text-xs ${studioMuted}`}>Henter kontoene fra Firebase …</p>}

      {answer && !answer.ok &&
        (CALM_REASONS.includes(answer.reason) ? (
          <p role="status" className="p-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] text-xs text-[var(--studio-text)]">
            {answer.message}
          </p>
        ) : (
          <p role="alert" className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-[var(--studio-text)] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
            {answer.message}
          </p>
        ))}

      {overview && (
        <>
          <div role="group" aria-label="Periode" className="flex flex-wrap gap-2">
            {PERIODS.map((choice) => (
              <button
                key={String(choice.value)}
                type="button"
                onClick={() => setPeriod(choice.value)}
                aria-pressed={period === choice.value}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  period === choice.value ? "bg-indigo-600 text-white" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] border border-[var(--studio-border)]"
                }`}
              >
                {choice.label}
              </button>
            ))}
          </div>

          <LoginCountsSection days={period} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Count value={signedIn.length} label={period === null ? "Har logget inn" : "Logget inn"} note={period === null ? undefined : `${newcomers} av dem for første gang`} />
            <Count value={overview.neverSignedIn.length} label="Aldri logget inn" />
            <Count value={stopped.length} label="Ble stoppet" />
            <Count value={overview.cannotSignIn.length} label="Kan ikke logge inn" />
          </div>

          <Section
            title={`Ble stoppet – feil e-post?${inThePeriod}`}
            help="De prøvde å logge inn, men adressen de brukte, står ikke i registeret. Som regel har personen en annen adresse der. Rett adressen under Personer, så kommer de inn."
            empty={stopped.length === 0}
          >
            {stopped.map(({ address, account, shared }) => (
              <li key={address} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs font-bold text-[var(--studio-text)] break-all">{address}</span>
                <span className={`text-[11px] ${studioMuted}`}>
                  {PROVIDER_LABEL[account.provider]}, prøvde første gang {when(account.createdAt)}
                  {account.lastLoginAt && when(account.lastLoginAt) !== when(account.createdAt) ? `, sist ${when(account.lastLoginAt)}` : ""}
                </span>
                {shared && <Tag tone="amber">Delt adresse</Tag>}
                {!account.emailVerified && <Tag>Ikke bekreftet</Tag>}
                {account.disabled && <Tag tone="red">Sperret</Tag>}
              </li>
            ))}
          </Section>

          <Section title="Står i registeret, men har aldri logget inn" empty={overview.neverSignedIn.length === 0}>
            {overview.neverSignedIn.map(({ person, isLeader }) => (
              <li key={person.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs font-bold text-[var(--studio-text)]">{person.name}</span>
                <span className={`text-[11px] break-all ${studioMuted}`}>{person.email}</span>
                {isLeader && <Tag>Gruppeleder</Tag>}
              </li>
            ))}
          </Section>

          <Section
            title="Kan ikke logge inn"
            help="Mangler e-post, eller deler adresse med noen andre. Innloggingen kan ikke vite hvem av dem det er."
            empty={overview.cannotSignIn.length === 0}
          >
            {overview.cannotSignIn.map((row) => (
              <li key={row.person.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs font-bold text-[var(--studio-text)]">{row.person.name}</span>
                {row.reason === "no-email" ? (
                  <span className={`text-[11px] ${studioMuted}`}>Mangler gyldig e-post</span>
                ) : (
                  <span className={`text-[11px] break-all ${studioMuted}`}>Deler adressen {row.address}</span>
                )}
              </li>
            ))}
          </Section>

          <section className={studioCardPadded}>
            <button
              type="button"
              onClick={() => setShowSigned((open) => !open)}
              aria-expanded={showSigned}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <span className="text-sm font-black text-[var(--studio-text)]">{period === null ? "Har logget inn" : `Logget inn${inThePeriod}`} ({signedIn.length})</span>
              {showSigned ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
            </button>
            {showSigned &&
              (signedIn.length === 0 ? (
                <p className={`text-xs mt-3 ${studioMuted}`}>Ingen.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--studio-border)]">
                  {signedIn.map(({ person, account }) => (
                    <li key={person.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs font-bold text-[var(--studio-text)]">{person.name}</span>
                      <span className={`text-[11px] ${studioMuted}`}>
                        {PROVIDER_LABEL[account.provider]}, første gang {when(account.createdAt)}, sist {when(account.lastLoginAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
          </section>
        </>
      )}
    </div>
  );
};
