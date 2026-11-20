import React from "react";
import { Link } from "react-router-dom";
import type { Person } from "../../types";
import { membershipApplicationStatusLabel } from "../../utils/membershipClerkWorkflow";
import type { MembershipApplicationStatus } from "../../types";
import { membershipLogEntryLabel } from "../../utils/membershipLog";
import { formatBirthDate } from "../../utils/birthDate";
import { membershipApplicationAdminPath } from "../../services/membershipApplications";

export const PersonMembershipLogSection: React.FC<{ person: Pick<Person, "membershipLog"> }> = ({ person }) => {
  const log = person.membershipLog ?? [];
  if (log.length === 0) return null;

  return (
    <section className={`${"rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 space-y-3"}`}>
      <h3 className="text-sm font-black text-[var(--studio-text)]">Medlemskap – arkiv og logg</h3>
      <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
        Søknader og innmeldinger fra Min side. Fullstendig skjema åpnes fra lenken.
      </p>
      <ul className="space-y-2">
        {[...log].reverse().map((entry) => (
          <li
            key={entry.applicationId ?? entry.taskId ?? `${entry.kind}-${entry.submittedAt}`}
            className="text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
          >
            <div>
              <p className="font-semibold text-[var(--studio-text)]">{membershipLogEntryLabel(entry.kind)}</p>
              <p className="text-xs text-[var(--studio-muted)]">
                {formatBirthDate(entry.submittedAt.slice(0, 10))} ·{" "}
                {entry.status in membershipApplicationStatusLabel
                  ? membershipApplicationStatusLabel[entry.status as MembershipApplicationStatus]
                  : "Fullført"}
                {entry.note ? ` · ${entry.note}` : ""}
              </p>
            </div>
            {entry.applicationId ? (
              <Link
                to={membershipApplicationAdminPath(entry.applicationId)}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
              >
                Åpne skjema
              </Link>
            ) : (
              <span className="text-xs text-[var(--studio-muted)]">Kun i loggen</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};