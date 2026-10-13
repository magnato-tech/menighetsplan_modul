import React, { useState } from "react";
import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import type { EngagementSummary, PersonEngagement } from "../../../../utils/churchAnalytics";
import { formatPercent } from "../../../../utils/analyticsFormat";
import { AnalyticsSection } from "./AnalyticsSection";
import { studioSecondaryButton } from "../../studioTheme";

interface PeopleEngagementSectionProps {
  engagement: EngagementSummary;
  onHide?: () => void;
  /** The numbers are of what is planned: tasks the person has said yes to on events that come. */
  ahead?: boolean;
  /** On this many events or more in the period, a person carries much (see highLoadThreshold). Marked when given. */
  highLoadFrom?: number;
}

const SHOWN = 15;

const SORTS: { id: string; label: string; compare: (a: PersonEngagement, b: PersonEngagement) => number }[] = [
  { id: "oppgaver", label: "Oppgaver", compare: (a, b) => b.tasks - a.tasks },
  { id: "gudstjenester", label: "Andel gudstjenester", compare: (a, b) => b.worshipServed - a.worshipServed },
  { id: "flere", label: "Flere oppgaver samme samling", compare: (a, b) => b.multiTaskTimes - a.multiTaskTimes },
  { id: "grupper", label: "Antall grupper", compare: (a, b) => b.serviceGroups + b.otherGroups - (a.serviceGroups + a.otherGroups) },
  { id: "aktiviteter", label: "Aktiviteter per måned", compare: (a, b) => b.activitiesPerMonth - a.activitiesPerMonth },
  { id: "navn", label: "Navn", compare: () => 0 },
];

const byName = (a: PersonEngagement, b: PersonEngagement) => a.person.name.localeCompare(b.person.name, "nb");

/** Each person in the register: how much they serve, and where they belong. */
export const PeopleEngagementSection: React.FC<PeopleEngagementSectionProps> = ({ engagement, onHide, ahead = false, highLoadFrom }) => {
  const [sortId, setSortId] = useState(SORTS[0].id);
  const [onlyActive, setOnlyActive] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const sort = SORTS.find((s) => s.id === sortId) ?? SORTS[0];
  const rows = engagement.people
    .filter((row) => !onlyActive || row.tasks > 0 || row.meetingsAttending > 0)
    .sort((a, b) => sort.compare(a, b) || byName(a, b));
  const shown = showAll ? rows : rows.slice(0, SHOWN);

  return (
    <AnalyticsSection
      id="analyse-hver-enkelt"
      title="Hver enkelt"
      description={ahead ? `Alle i personregisteret: oppgaver de har sagt ja til i perioden som kommer, på hvor mange av de ${engagement.worshipHeld} gudstjenestene de har en oppgave, hvor ofte de har flere oppgaver på samme arrangement, og grupper. Den som er spurt og ikke har svart, teller ikke.${highLoadFrom ? ` «Mye» står på den som har oppgaver på ${highLoadFrom} arrangementer eller flere.` : ""}` : `Alle i personregisteret: oppgaver i perioden, på hvor mange av de ${engagement.worshipHeld} gudstjenestene de hadde en oppgave, hvor ofte de hadde flere oppgaver på samme samling, grupper, og aktiviteter (oppgaver og gruppesamlinger) per måned.`}
      icon={<UserRound className="w-5 h-5" />}
      onHide={onHide}
      actions={
        <>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--studio-muted)]">
            Sorter etter
            <select
              value={sortId}
              onChange={(e) => setSortId(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-[11px] cursor-pointer"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--studio-muted)] cursor-pointer">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-indigo-600" />
            {ahead ? "Bare de som har oppgaver" : "Bare de som har vært med"}
          </label>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Oppgaver og grupper per person</caption>
          <thead>
            <tr className="text-left text-[11px] text-[var(--studio-muted)] border-b border-[var(--studio-border)]">
              <th className="py-2 pr-3 font-bold">Navn</th>
              <th className="py-2 pr-3 font-bold text-right">Oppgaver</th>
              <th className="py-2 pr-3 font-bold text-right">Gudstjenester med oppgave</th>
              <th className="py-2 pr-3 font-bold text-right">Flere oppgaver samme samling</th>
              <th className="py-2 pr-3 font-bold text-right">Tjenestegrupper</th>
              <th className="py-2 pr-3 font-bold text-right">Andre grupper</th>
              <th className="py-2 font-bold text-right">Aktiviteter per måned</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 text-[var(--studio-muted)]">
                  Ingen å vise.
                </td>
              </tr>
            )}
            {shown.map((row) => (
              <tr key={row.person.id} className="border-b border-[var(--studio-border)] last:border-0">
                <td className="py-2 pr-3 whitespace-nowrap">
                  <Link to={`/admin/person/${row.person.id}`} className="font-semibold text-[var(--studio-link)] hover:text-[var(--studio-link-hover)]">
                    {row.person.name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums font-bold whitespace-nowrap">
                  {highLoadFrom !== undefined && row.gatheringsServed >= highLoadFrom && (
                    <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300">Mye</span>
                  )}
                  {row.tasks}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                  {engagement.worshipHeld > 0 ? `${row.worshipServed} av ${engagement.worshipHeld} (${formatPercent(row.worshipShare)})` : "–"}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {row.multiTaskTimes > 0 ? <span className="font-bold text-[var(--studio-warn)]">{row.multiTaskTimes}</span> : 0}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.serviceGroups}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.otherGroups}</td>
                <td className="py-2 text-right tabular-nums">{row.activitiesPerMonth.toLocaleString("nb-NO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > SHOWN && (
        <button type="button" onClick={() => setShowAll(!showAll)} className={studioSecondaryButton}>
          {showAll ? "Vis færre" : `Vis alle ${rows.length}`}
        </button>
      )}
    </AnalyticsSection>
  );
};
