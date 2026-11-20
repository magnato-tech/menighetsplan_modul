import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import type { MembershipApplication, MembershipClerkTask, Person } from "../../../types";
import { formatBirthDate } from "../../../utils/birthDate";
import {
  filterProtocolLogRows,
  type ProtocolLogCategoryFilter,
  type ProtocolLogPeriod,
  protocolLogCsv,
  protocolLogRows,
} from "../../../utils/membershipProtocolLog";

export const MembershipProtocolLogPanel: React.FC<{
  tasks: readonly MembershipClerkTask[];
  persons: readonly Person[];
  applications: readonly MembershipApplication[];
}> = ({ tasks, persons, applications }) => {
  const currentYear = new Date().getFullYear();
  const [period, setPeriod] = useState<ProtocolLogPeriod>({ kind: "rolling12" });
  const [category, setCategory] = useState<ProtocolLogCategoryFilter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => filterProtocolLogRows(protocolLogRows(tasks, persons, applications, period, category), query),
    [tasks, persons, applications, period, category, query]
  );

  const download = () => {
    const blob = new Blob([protocolLogCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "protokoll-logg.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="inline-flex rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5">
          <button
            type="button"
            onClick={() => setPeriod({ kind: "rolling12" })}
            className={`px-3 py-1.5 rounded-lg font-bold ${
              period.kind === "rolling12" ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)]"
            }`}
          >
            Siste 12 mnd
          </button>
          {[currentYear, currentYear - 1].map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setPeriod({ kind: "year", year })}
              className={`px-3 py-1.5 rounded-lg font-bold ${
                period.kind === "year" && period.year === year
                  ? "bg-[var(--studio-hover)] text-[var(--studio-text)]"
                  : "text-[var(--studio-muted)]"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-0.5">
          {(["all", "A", "G"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setCategory(opt)}
              className={`px-3 py-1.5 rounded-lg font-bold ${
                category === opt ? "bg-[var(--studio-hover)] text-[var(--studio-text)]" : "text-[var(--studio-muted)]"
              }`}
            >
              {opt === "all" ? "Alle" : opt}
            </button>
          ))}
        </div>
        <button type="button" onClick={download} className="font-bold text-indigo-700 cursor-pointer">
          Last ned listen
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-[var(--studio-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk navn eller hendelse…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs placeholder:text-[var(--studio-muted)] focus:outline-hidden focus:border-indigo-500"
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--studio-muted)] text-center py-8">Ingen hendelser i valgt periode.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)]/40">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--studio-border)] bg-[var(--studio-row)] text-[10px] uppercase tracking-wider text-[var(--studio-text)]/75">
                {["Navn", "Hendelse", "Kat.", "Virkningsdato", "Dokument", "Utført", ""].map((label) => (
                  <th key={label || "link"} className="px-3 py-2.5 font-bold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--studio-border)] hover:bg-[var(--studio-surface)]">
                  <td className="px-3 py-3 font-semibold text-[var(--studio-text)]">{row.name}</td>
                  <td className="px-3 py-3 text-[var(--studio-muted)]">{row.event}</td>
                  <td className="px-3 py-3">{row.category}</td>
                  <td className="px-3 py-3">{formatBirthDate(row.effectiveDate)}</td>
                  <td className="px-3 py-3">
                    {row.documentHref ? (
                      <Link to={row.documentHref} className="font-bold text-indigo-500">
                        {row.document}
                      </Link>
                    ) : (
                      row.document
                    )}
                  </td>
                  <td className="px-3 py-3">{formatBirthDate(row.completedAt.slice(0, 10))}</td>
                  <td className="px-3 py-3 text-right">
                    <Link to={row.personHref} className="font-bold text-indigo-500">
                      Personkort
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};