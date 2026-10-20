import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, CalendarPlus, CheckCircle2, Clock, ListTodo, Repeat, Trash2 } from "lucide-react";
import { formatNorwegianDateTime } from "../../../../utils/dates";
import type { GatheringSortDirection, GatheringSortKey } from "../../../../utils/gatheringList";
import { isWorshipService, locationOf } from "../../../../utils/gatherings";
import type { AdminGatheringItem } from "../../../../hooks/adminHooks";

interface GatheringsTableProps {
  rows: AdminGatheringItem[];
  sortKey: GatheringSortKey;
  sortDirection: GatheringSortDirection;
  onSort: (key: GatheringSortKey) => void;
  onMoveRest: (item: AdminGatheringItem) => void;
  onNext: (item: AdminGatheringItem) => void;
  onDelete: (item: AdminGatheringItem) => void;
}

const COLUMNS: { key: GatheringSortKey; label: string }[] = [
  { key: "date", label: "Dato" },
  { key: "title", label: "Arrangement" },
  { key: "location", label: "Sted" },
  { key: "staffing", label: "Bemanning" },
];

const iconButton =
  "inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-bg)] text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer";

/** The events as a table: one line each, in the order of the column the admin has pressed. The same actions as on the cards. */
export const GatheringsTable: React.FC<GatheringsTableProps> = ({ rows, sortKey, sortDirection, onSort, onMoveRest, onNext, onDelete }) => {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)]/40">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead>
          <tr className="border-b border-[var(--studio-border)] bg-[var(--studio-row)] text-[10px] uppercase tracking-wider text-[var(--studio-text)]/75">
            {COLUMNS.map((column) => {
              const active = sortKey === column.key;
              return (
                <th key={column.key} className="px-3 py-2.5 font-bold" aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className={`inline-flex items-center gap-1 hover:text-[var(--studio-text)] cursor-pointer ${
                      active ? "text-[var(--studio-text)]" : "text-[var(--studio-muted)]"
                    }`}
                  >
                    {column.label}
                    {active ? sortDirection === "asc" ? <ArrowUp className="w-3 h-3" aria-hidden="true" /> : <ArrowDown className="w-3 h-3" aria-hidden="true" /> : null}
                  </button>
                </th>
              );
            })}
            <th className="px-3 py-2.5 font-bold text-right">Handling</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const g = item.gathering;
            const when = formatNorwegianDateTime(g.startsAt);
            return (
              <tr key={g.id} className="border-b border-[var(--studio-border)] last:border-b-0 align-middle">
                <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-[var(--studio-text)]">{when}</td>
                <td className="px-3 py-2.5">
                  <Link to={`/admin/samling/${g.id}?vis=bemanning`} className="font-bold text-[var(--studio-text)] hover:underline">
                    {g.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-[var(--studio-muted)]">
                    {isWorshipService(g) && <span>Gudstjeneste</span>}
                    {g.seriesId && (
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="w-3 h-3" aria-hidden="true" />
                        Del av serie
                      </span>
                    )}
                    {g.theme && <span>Tema: {g.theme}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[var(--studio-muted)]">{locationOf(g)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {item.totalTasks === 0 && <span className="text-[var(--studio-muted)]">Ingen oppgaver</span>}
                  {item.totalTasks !== 0 && item.staffing.color === "green" && (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Dekket ({item.coveredTasksCount}/{item.totalTasks})
                    </span>
                  )}
                  {item.totalTasks !== 0 && item.staffing.color === "yellow" && (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      Venter på svar
                    </span>
                  )}
                  {item.totalTasks !== 0 && item.staffing.color === "red" && (
                    <span className="inline-flex items-center gap-1 font-bold text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      Mangler {item.missingStaffingCount}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {g.seriesId && (
                      <button type="button" onClick={() => onMoveRest(item)} className={iconButton} aria-label={`Flytt resten av serien fra ${when}`} title="Flytt resten av serien">
                        <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button type="button" onClick={() => onNext(item)} className={iconButton} aria-label={`Lag neste arrangement etter ${g.title} ${when}`} title="Lag neste arrangement">
                      <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => onDelete(item)} className={`${iconButton} hover:text-red-400`} aria-label={`Slett ${g.title} ${when}`} title="Slett">
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <Link
                      to={`/admin/samling/${g.id}?vis=program`}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold whitespace-nowrap"
                    >
                      <ListTodo className="w-3.5 h-3.5" aria-hidden="true" />
                      Kjøreplan
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
