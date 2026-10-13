import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Layers } from "lucide-react";
import type { MultiTaskSummary } from "../../../../utils/churchAnalytics";
import { formatCount, formatPercent } from "../../../../utils/analyticsFormat";
import { formatNorwegianDateTime } from "../../../../utils/dates";
import { AnalyticsSection, MiniStat } from "./AnalyticsSection";

interface MultiTaskSectionProps {
  multiTasks: MultiTaskSummary;
  onHide?: () => void;
  /** The numbers are of events that come. */
  ahead?: boolean;
}

const SHOWN = 8;
const link = "font-semibold text-[var(--studio-link)] hover:text-[var(--studio-link-hover)]";

/** People who said yes to two or more tasks on the same gathering. */
export const MultiTaskSection: React.FC<MultiTaskSectionProps> = ({ multiTasks, onHide, ahead = false }) => {
  // Newest first when looking back. Looking ahead, the nearest comes first.
  const occurrences = ahead ? [...multiTasks.occurrences].reverse() : multiTasks.occurrences;
  const combinations = multiTasks.combinations.slice(0, 6);
  const most = Math.max(1, ...combinations.map((c) => c.count));

  return (
    <AnalyticsSection
      id="analyse-flere-oppgaver"
      title="Flere oppgaver på samme samling"
      description="Personer som har sagt ja til to eller flere oppgaver på samme samling, for eksempel bilde og møteleder. Det kan være krevende å stå i begge samtidig."
      icon={<Layers className="w-5 h-5" />}
      onHide={onHide}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Ganger" value={multiTasks.hadTasks ? String(multiTasks.occurrences.length) : "–"}>
          {multiTasks.hadTasks
            ? `på ${multiTasks.gatherings} ${multiTasks.gatherings === 1 ? "samling" : "samlinger"}`
            : "ingen samlinger med oppgaver"}
        </MiniStat>
        <MiniStat label="Personer" value={multiTasks.hadTasks ? String(multiTasks.people) : "–"}>
          {ahead ? "har flere oppgaver på samme samling" : "har hatt flere oppgaver på samme samling"}
        </MiniStat>
        <MiniStat label="Andel av tjenestene" value={formatPercent(multiTasks.shareOfServings)}>
          {ahead ? "av gangene noen står på" : "av gangene noen tjenestegjorde"}
        </MiniStat>
        <MiniStat label="Samme klokkeslett" value={formatCount(multiTasks.sameTimeCount)}>
          {multiTasks.sameTimeCount === null ? "kjøreplanene har ikke klokkeslett for oppgavene" : "der kjøreplanen viser det"}
        </MiniStat>
      </div>

      {!multiTasks.hadTasks ? (
        <p className="text-xs text-[var(--studio-muted)]">{ahead ? "Ingen samlinger i perioden har oppgaver." : "Ingen samlinger i perioden hadde oppgaver."}</p>
      ) : multiTasks.occurrences.length === 0 ? (
        <p className="text-xs text-[var(--studio-muted)]">{ahead ? "Ingen har flere oppgaver på samme samling i perioden." : "Ingen har hatt flere oppgaver på samme samling i perioden."}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[var(--studio-text)]">Vanligste kombinasjoner</h3>
              <ul className="space-y-2.5" aria-label="Rollekombinasjoner og hvor mange ganger de har forekommet">
                {combinations.map((combination) => (
                  <li key={combination.roles} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[var(--studio-text)]">{combination.roles}</span>
                      <span className="text-[var(--studio-muted)] tabular-nums shrink-0">
                        {combination.count} {combination.count === 1 ? "gang" : "ganger"}
                      </span>
                    </div>
                    <div className="h-2 rounded-r-[4px] bg-[var(--viz-1)]" style={{ width: `${(combination.count / most) * 100}%` }} aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[var(--studio-text)]">Hvem</h3>
              <ul className="space-y-1.5 text-xs">
                {multiTasks.byPerson.slice(0, SHOWN).map((row) => (
                  <li key={row.person.id} className="flex items-center justify-between gap-2">
                    <Link to={`/admin/person/${row.person.id}`} className={link}>
                      {row.person.name}
                    </Link>
                    <span className="text-[var(--studio-muted)] tabular-nums">
                      {row.times} {row.times === 1 ? "gang" : "ganger"}
                      {row.mostTasks > 2 ? ` · inntil ${row.mostTasks} oppgaver` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {multiTasks.byPerson.length > SHOWN && (
                <p className="text-[11px] text-[var(--studio-muted)]">Og {multiTasks.byPerson.length - SHOWN} til.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[var(--studio-text)]">{ahead ? "De nærmeste gangene" : "Siste gangene"}</h3>
            <ul className="space-y-1.5 text-xs">
              {occurrences.slice(0, SHOWN).map((o) => (
                <li key={`${o.person.id}-${o.gathering.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[var(--studio-muted)] whitespace-nowrap">{formatNorwegianDateTime(o.gathering.startsAt)}</span>
                  <span className="text-[var(--studio-muted)]">·</span>
                  <Link to={`/admin/person/${o.person.id}`} className={link}>
                    {o.person.name}
                  </Link>
                  <span className="text-[var(--studio-text)]">{o.roles.join(" + ")}</span>
                  {o.sameTime === true && (
                    <span className="inline-flex items-center gap-1 font-bold text-[var(--studio-warn)]">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      Samme klokkeslett i kjøreplanen
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </AnalyticsSection>
  );
};
