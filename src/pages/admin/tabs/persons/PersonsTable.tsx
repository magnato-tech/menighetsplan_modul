import React from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  PERSON_ACCESS_LABEL,
  PersonDirectoryRow,
  PersonSortKey,
  SortDirection,
  personAccess,
  personGroupNames,
} from "../../../../utils/personDirectory";
import { studioSecondaryButton } from "../../studioTheme";

interface PersonsTableProps {
  rows: PersonDirectoryRow[];
  sortKey: PersonSortKey;
  sortDirection: SortDirection;
  onSort: (key: PersonSortKey) => void;
}

const COLUMNS: { key: PersonSortKey; label: string }[] = [
  { key: "name", label: "Navn" },
  { key: "access", label: "Tilgang" },
  { key: "groups", label: "Grupper" },
  { key: "email", label: "E-post" },
  { key: "phone", label: "Telefon" },
];

function accessClass(access: ReturnType<typeof personAccess>): string {
  switch (access) {
    case "administrator":
      return "bg-amber-950/80 border-amber-800 text-amber-300";
    case "gruppeleder":
      return "bg-[var(--studio-accent-bg)] border-indigo-700 text-[var(--studio-accent-text)]";
    case "nestleder":
      return "bg-sky-950/80 border-sky-800 text-sky-300";
    default:
      return "bg-[var(--studio-accent-bg)] border-[var(--studio-accent-border)] text-[var(--studio-accent-text)]";
  }
}

export const PersonsTable: React.FC<PersonsTableProps> = ({ rows, sortKey, sortDirection, onSort }) => {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)]/40">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b border-[var(--studio-border)] bg-[var(--studio-row)] text-[10px] uppercase tracking-wider text-[var(--studio-text)]/75">
            {COLUMNS.map((column) => {
              const active = sortKey === column.key;
              return (
                <th key={column.key} className="px-3 py-2.5 font-bold">
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className={`inline-flex items-center gap-1 hover:text-[var(--studio-text)] cursor-pointer ${
                      active ? "text-[var(--studio-text)]" : "text-[var(--studio-muted)]"
                    }`}
                  >
                    {column.label}
                    {active ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )
                    ) : null}
                  </button>
                </th>
              );
            })}
            <th className="px-3 py-2.5 font-bold text-right">Handling</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const access = personAccess(row);
            const groups = personGroupNames(row);
            return (
              <tr key={row.person.id} className="border-b border-[var(--studio-border)] hover:bg-[var(--studio-surface)]">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    {row.person.avatarUrl ? (
                      <img
                        src={row.person.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-[var(--studio-hover)] text-[var(--studio-muted)] flex items-center justify-center font-bold shrink-0">
                        {row.person.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="font-bold text-[var(--studio-text)]">{row.person.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {access === "ingen" ? (
                    <span className="text-[var(--studio-muted)]">–</span>
                  ) : (
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${accessClass(access)}`}
                    >
                      {PERSON_ACCESS_LABEL[access]}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-[var(--studio-muted)] max-w-[220px]">
                  {groups.length > 0 ? groups.join(", ") : <span className="text-[var(--studio-muted)]">–</span>}
                </td>
                <td className="px-3 py-3 text-[var(--studio-muted)] whitespace-nowrap">
                  {row.person.email || <span className="text-[var(--studio-muted)]">–</span>}
                </td>
                <td className="px-3 py-3 text-[var(--studio-muted)] whitespace-nowrap">
                  {row.person.phone || <span className="text-[var(--studio-muted)]">–</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  <Link
                    to={`/admin/person/${row.person.id}`}
                    className={`${studioSecondaryButton} inline-block`}
                  >
                    Åpne
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
