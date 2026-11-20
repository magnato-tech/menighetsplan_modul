import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { MembershipApplication } from "../../../types";
import { membershipApplicationAdminPath } from "../../../services/membershipApplications";
import { applicantLabel, membershipApplicationStatusLabel } from "../../../utils/membershipClerkWorkflow";
import { membershipLogEntryLabel } from "../../../utils/membershipLog";
import { formatBirthDate } from "../../../utils/birthDate";
import { MEMBERSHIP_ARCHIVE_NOTICE } from "../../../utils/membershipApplication";

export const MembershipArchiveList: React.FC<{
  applications: readonly MembershipApplication[];
}> = ({ applications }) => {
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...applications]
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .filter((app) => {
        if (onlyOpen && (app.status === "completed" || app.status === "dismissed")) return false;
        if (!q) return true;
        const hay = `${app.applicantName} ${app.firstNames} ${app.lastName} ${app.email}`.toLowerCase();
        return hay.includes(q);
      });
  }, [applications, onlyOpen, query]);

  return (
    <section className="space-y-3 pt-6 border-t border-[var(--studio-border)]">
      <div>
        <h2 className="text-sm font-black text-[var(--studio-text)]">Arkiv – innmeldingsskjema</h2>
        <p className="text-xs text-[var(--studio-muted)] mt-1 leading-relaxed">{MEMBERSHIP_ARCHIVE_NOTICE}</p>
        <p className="text-xs text-[var(--studio-muted)] mt-1">
          Logg per person står på personkortet under «Medlemskap – arkiv og logg».
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk navn eller e-post"
          className="flex-1 rounded-xl border border-[var(--studio-border)] px-3 py-2 text-sm bg-[var(--studio-bg)] text-[var(--studio-text)]"
        />
        <label className="flex items-center gap-2 text-xs text-[var(--studio-text)] px-2">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Bare åpne i arbeidsflyten
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--studio-muted)]">Ingen treff i arkivet.</p>
      ) : (
        <ul className="rounded-xl border border-[var(--studio-border)] divide-y divide-[var(--studio-border)] overflow-hidden">
          {rows.slice(0, 50).map((app) => (
            <li key={app.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-[var(--studio-surface)]">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--studio-text)] truncate">
                  {app.applicantName || applicantLabel(app)}
                </p>
                <p className="text-xs text-[var(--studio-muted)]">
                  {membershipLogEntryLabel(app.kind)} · {membershipApplicationStatusLabel[app.status]} ·{" "}
                  {formatBirthDate(app.submittedAt.slice(0, 10))}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={`/admin/person/${app.personId}`}
                  className="text-xs font-bold text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
                >
                  Person
                </Link>
                <Link
                  to={membershipApplicationAdminPath(app.id)}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                >
                  Åpne skjema
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 50 && (
        <p className="text-xs text-[var(--studio-muted)]">Viser 50 nyeste treff. Bruk søk for å finne eldre.</p>
      )}
    </section>
  );
};