import React from "react";
import { Link } from "react-router-dom";
import { Moon, UsersRound } from "lucide-react";
import type { AnalyticsPeriod, GroupSummary } from "../../../../utils/churchAnalytics";
import { GROUP_CATEGORY_LABELS, QUIET_GROUP_DAYS } from "../../../../utils/churchAnalytics";
import { describeChange, formatDaysAgo, formatPercent } from "../../../../utils/analyticsFormat";
import { AnalyticsSection, MiniStat } from "./AnalyticsSection";

interface GroupSectionProps {
  period: AnalyticsPeriod;
  groups: GroupSummary;
  now: number;
  onHide?: () => void;
}

const NAMES_SHOWN = 12;
const CATEGORY_ORDER = ["ledergruppe", "strategigruppe", "tjenestegruppe", "husgruppe", "interessegruppe"];
const link = "font-semibold text-[var(--studio-link)] hover:text-[var(--studio-link-hover)]";

export const GroupSection: React.FC<GroupSectionProps> = ({ period, groups, now, onHide }) => {
  const messageChange = describeChange(groups.messages, groups.previousMessages);
  const rows = [...groups.groups].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.group.category ?? "") - CATEGORY_ORDER.indexOf(b.group.category ?? "") ||
      a.group.name.localeCompare(b.group.name, "nb")
  );

  return (
    <AnalyticsSection
      id="analyse-grupper"
      title="Grupper og fellesskap"
      description="Hvem som hører til i en gruppe, og hvor mye som skjer i gruppene: samlinger, svar på samlingene og meldinger."
      icon={<UsersRound className="w-5 h-5" />}
      onHide={onHide}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Grupper" value={String(groups.groups.length)}>
          {groups.quietGroups > 0
            ? `${groups.quietGroups} uten aktivitet siste ${QUIET_GROUP_DAYS} dager`
            : `alle aktive siste ${QUIET_GROUP_DAYS} dager`}
        </MiniStat>
        <MiniStat label="Nye deltakere" value={String(groups.newMembers)}>
          i perioden
        </MiniStat>
        <MiniStat label="Meldinger i gruppene" value={String(groups.messages)}>
          {messageChange ? `${messageChange.text} fra ${period.previousLabel}` : "i perioden"}
        </MiniStat>
        <MiniStat label="Uten gruppe" value={String(groups.withoutGroup.length)}>
          {formatPercent(groups.belongingRate)} er med i minst én gruppe
        </MiniStat>
      </div>

      {groups.byCategory.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-[11px]">
          {groups.byCategory.map((row) => (
            <li key={row.category} className="px-2.5 py-1 rounded-lg bg-[var(--studio-row)] border border-[var(--studio-border)] text-[var(--studio-muted)]">
              <span className="font-bold text-[var(--studio-text)]">{row.label}</span>: {row.groups} grupper, {row.people} personer
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--studio-muted)]">Ingen grupper er opprettet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Aktivitet per gruppe</caption>
            <thead>
              <tr className="text-left text-[11px] text-[var(--studio-muted)] border-b border-[var(--studio-border)]">
                <th className="py-2 pr-3 font-bold">Gruppe</th>
                <th className="py-2 pr-3 font-bold">Kategori</th>
                <th className="py-2 pr-3 font-bold text-right">Deltakere</th>
                <th className="py-2 pr-3 font-bold text-right">Samlinger</th>
                <th className="py-2 pr-3 font-bold text-right">Svarte «Kommer»</th>
                <th className="py-2 pr-3 font-bold text-right">Meldinger</th>
                <th className="py-2 font-bold">Sist aktiv</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.group.id} className="border-b border-[var(--studio-border)] last:border-0">
                  <td className="py-2 pr-3">
                    <Link to={`/admin/gruppe/${row.group.id}`} className={link}>
                      {row.group.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-[var(--studio-muted)]">
                    {row.group.category ? GROUP_CATEGORY_LABELS[row.group.category] : "Uten kategori"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.members}
                    {row.newMembers > 0 && <span className="text-[var(--studio-good)] font-bold"> (+{row.newMembers})</span>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.meetings || "–"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {row.responses.possible === 0 ? (
                      "–"
                    ) : row.responses.attending + row.responses.declined === 0 ? (
                      <span className="text-[var(--studio-muted)]">ingen svar</span>
                    ) : (
                      `${row.responses.attending} av ${row.responses.possible} (${formatPercent(row.responses.attending / row.responses.possible)})`
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.messages}</td>
                  <td className="py-2 whitespace-nowrap">
                    {row.quiet ? (
                      <span className="inline-flex items-center gap-1 text-[var(--studio-warn)] font-bold">
                        <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                        Stille · {formatDaysAgo(row.lastActivityAt, now)}
                      </span>
                    ) : (
                      <span className="text-[var(--studio-muted)]">{formatDaysAgo(row.lastActivityAt, now)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 rounded-xl bg-[var(--studio-row)] border border-[var(--studio-border)] space-y-2">
        <h3 className="text-xs font-bold text-[var(--studio-text)]">Ikke med i noen gruppe</h3>
        {groups.withoutGroup.length === 0 ? (
          <p className="text-xs text-[var(--studio-muted)]">Alle i personregisteret er med i minst én gruppe.</p>
        ) : (
          <p className="text-xs leading-relaxed">
            {groups.withoutGroup.slice(0, NAMES_SHOWN).map((person, index) => (
              <React.Fragment key={person.id}>
                {index > 0 && ", "}
                <Link to={`/admin/person/${person.id}`} className={link}>
                  {person.name}
                </Link>
              </React.Fragment>
            ))}
            {groups.withoutGroup.length > NAMES_SHOWN && (
              <span className="text-[var(--studio-muted)]"> og {groups.withoutGroup.length - NAMES_SHOWN} til</span>
            )}
          </p>
        )}
      </div>
    </AnalyticsSection>
  );
};
