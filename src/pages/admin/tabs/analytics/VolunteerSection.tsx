import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, HandHeart, HeartHandshake } from "lucide-react";
import type { AnalyticsPeriod, VolunteerSummary } from "../../../../utils/churchAnalytics";
import { formatCount, formatHours, formatPercent } from "../../../../utils/analyticsFormat";
import { AnalyticsSection, MiniStat } from "./AnalyticsSection";

interface VolunteerSectionProps {
  period: AnalyticsPeriod;
  volunteers: VolunteerSummary;
  onHide?: () => void;
}

const NAMES_SHOWN = 12;

const personLink = "font-semibold text-[var(--studio-link)] hover:text-[var(--studio-link-hover)]";

/** How often the volunteers served: one bar per band, the number at the end. */
const LoadBars: React.FC<{ load: VolunteerSummary["load"] }> = ({ load }) => {
  const max = Math.max(1, ...load.map((band) => band.people));
  return (
    <ul className="space-y-2.5" aria-label="Antall frivillige etter hvor ofte de har stått på">
      {load.map((band) => (
        <li key={band.label} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-xs">
          <span className="text-[var(--studio-muted)]">{band.label}</span>
          <span className="flex items-center gap-2">
            {band.people > 0 && (
              <span
                className="h-3 rounded-r-[4px] bg-[var(--viz-1)]"
                style={{ width: `${(band.people / max) * 65}%` }}
                aria-hidden="true"
              />
            )}
            <span className="font-bold text-[var(--studio-text)] tabular-nums whitespace-nowrap">
              {band.people} {band.people === 1 ? "person" : "personer"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
};

export const VolunteerSection: React.FC<VolunteerSectionProps> = ({ period, volunteers, onHide }) => {
  const roles = volunteers.roles.slice(0, 6);
  const { upcoming } = volunteers;

  return (
    <AnalyticsSection
      id="analyse-frivillige"
      title="Frivillighet og bemanning"
      description="Oppgavene på samlingene som er holdt i perioden: hvem som sa ja, forfall og hvor ofte hver enkelt har stått på."
      icon={<HandHeart className="w-5 h-5" />}
      onHide={onHide}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Forfall" value={formatCount(volunteers.withdrawals)}>
          {volunteers.acuteWithdrawals === null
            ? "ingen oppgaver i perioden"
            : volunteers.acuteWithdrawals > 0
              ? `hvorav ${volunteers.acuteWithdrawals} akutt (under 48 timer før)`
              : "ingen akutte"}
        </MiniStat>
        <MiniStat label="Avslag på forespørsler" value={formatCount(volunteers.declines)} />
        <MiniStat label="Svartid på forespørsler" value={formatHours(volunteers.medianResponseHours)}>
          {volunteers.medianResponseHours === null ? "ingen besvarte forespørsler" : "median fra forespurt til svar"}
        </MiniStat>
        <MiniStat
          label="De neste fire ukene"
          value={upcoming.slotsNeeded > 0 ? `${upcoming.slotsFilled} av ${upcoming.slotsNeeded}` : "–"}
        >
          {upcoming.slotsNeeded === 0
            ? "ingen oppgaver planlagt"
            : upcoming.openSlots > 0
              ? `${upcoming.openSlots} plasser er ikke bekreftet`
              : "alle plasser bekreftet"}
        </MiniStat>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[var(--studio-text)]">Hvor ofte de frivillige har stått på</h3>
          {!volunteers.activeVolunteers ? (
            <p className="text-xs text-[var(--studio-muted)]">Ingen har tjenestegjort på samlinger i perioden.</p>
          ) : (
            <LoadBars load={volunteers.load} />
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[var(--studio-text)]">Roller som er vanskeligst å bemanne</h3>
          {roles.length === 0 ? (
            <p className="text-xs text-[var(--studio-muted)]">Ingen oppgaver på samlingene i perioden.</p>
          ) : (
            <ul className="space-y-2.5">
              {roles.map((role) => {
                const missing = role.needed - role.filled;
                return (
                  <li key={role.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[var(--studio-text)] truncate">{role.name}</span>
                      <span className="flex items-center gap-1 shrink-0 tabular-nums">
                        {missing > 0 ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-[var(--studio-warn)]" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--studio-good)]" aria-hidden="true" />
                        )}
                        <span className="text-[var(--studio-muted)]">
                          {role.filled} av {role.needed} ({formatPercent(role.rate)})
                          {missing > 0 ? ` · mangler ${missing}` : " · dekket"}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--viz-track)] overflow-hidden" aria-hidden="true">
                      <div className="h-full rounded-full bg-[var(--viz-1)]" style={{ width: `${(role.rate ?? 0) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)] space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-bold text-[var(--studio-text)]">
            <HeartHandshake className="w-4 h-4 text-[var(--studio-warn)]" aria-hidden="true" />
            Kan trenge avlastning
          </h3>
          <p className="text-[11px] text-[var(--studio-muted)]">
            Har stått på {volunteers.highLoadThreshold} samlinger eller flere i perioden ({period.label.toLowerCase()}).
          </p>
          {volunteers.highLoad.length === 0 ? (
            <p className="text-xs text-[var(--studio-muted)]">Ingen står på oftere enn annenhver uke.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {volunteers.highLoad.map(({ person, gatherings }) => (
                <li key={person.id} className="flex items-center justify-between gap-2">
                  <Link to={`/admin/person/${person.id}`} className={personLink}>
                    {person.name}
                  </Link>
                  <span className="text-[var(--studio-muted)] tabular-nums">{gatherings} samlinger</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)] space-y-2">
          <h3 className="text-xs font-bold text-[var(--studio-text)]">Ikke brukt i perioden</h3>
          <p className="text-[11px] text-[var(--studio-muted)]">
            Deltakere i tjenestegrupper som ikke har hatt en oppgave på samlingene i perioden.
          </p>
          {volunteers.unused.length === 0 ? (
            <p className="text-xs text-[var(--studio-muted)]">Alle i tjenestegruppene har vært i bruk.</p>
          ) : (
            <p className="text-xs leading-relaxed">
              {volunteers.unused.slice(0, NAMES_SHOWN).map((person, index) => (
                <React.Fragment key={person.id}>
                  {index > 0 && ", "}
                  <Link to={`/admin/person/${person.id}`} className={personLink}>
                    {person.name}
                  </Link>
                </React.Fragment>
              ))}
              {volunteers.unused.length > NAMES_SHOWN && (
                <span className="text-[var(--studio-muted)]"> og {volunteers.unused.length - NAMES_SHOWN} til</span>
              )}
            </p>
          )}
        </div>
      </div>
    </AnalyticsSection>
  );
};
