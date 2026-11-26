import { Link } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { formatNorwegianDateTime } from "../../../utils/dates";
import type { PersonTaskOverview, PersonTaskRow } from "../../../utils/personTasks";
import { studioDetailRow, studioDetailSection } from "../studioDetailTheme";

interface PersonTasksSectionProps {
  taskOverview: PersonTaskOverview;
}

const taskLine = (row: PersonTaskRow) => (
  <div key={row.assignmentId} className={studioDetailRow}>
    <Link to={`/admin/samling/${row.gatheringId}`} className="min-w-0">
      <span className="block font-semibold text-[var(--studio-text)]">{row.role}</span>
      <span className="block text-[11px] text-[var(--studio-muted)]">
        {row.gatheringTitle} · {formatNorwegianDateTime(row.startsAt)}
      </span>
    </Link>
    <span
      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${
        row.response === "confirmed" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-900 border-amber-200"
      }`}
    >
      {row.response === "confirmed" ? "Bekreftet" : "Spurt"}
    </span>
  </div>
);

// What the person has taken on: the events that come, and those held lately
export function PersonTasksSection({ taskOverview }: PersonTasksSectionProps) {
  return (
    <section id="person-tasks-section" className={studioDetailSection}>
      <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
        <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
          <CheckSquare className="w-4 h-4 text-emerald-600" />
          Oppgaver
        </span>
        <span className="text-[11px] text-[var(--studio-muted)] font-medium">
          {taskOverview.comingCount} framover · {taskOverview.heldCount} holdt siste 3 måneder
          {taskOverview.askedCount > 0 ? ` · ${taskOverview.askedCount} spurt, ikke svart` : ""}
        </span>
      </div>

      {taskOverview.byRole.length > 0 && (
        <table className="w-full text-xs">
          <caption className="sr-only">Oppgaver personen har sagt ja til, per rolle</caption>
          <thead>
            <tr className="text-left text-[11px] text-[var(--studio-muted)]">
              <th className="py-1 pr-3 font-bold">Rolle</th>
              <th className="py-1 pr-3 font-bold text-right">Kommer</th>
              <th className="py-1 font-bold text-right">Holdt siste 3 mnd.</th>
            </tr>
          </thead>
          <tbody>
            {taskOverview.byRole.map((line) => (
              <tr key={line.role} className="border-t border-[var(--studio-border)]">
                <td className="py-1.5 pr-3 font-semibold text-[var(--studio-text)]">{line.role}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--studio-text)]">{line.coming}</td>
                <td className="py-1.5 text-right tabular-nums text-[var(--studio-text)]">{line.held}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {taskOverview.coming.length === 0 && taskOverview.held.length === 0 ? (
        <p className="text-xs text-[var(--studio-muted)] italic py-1">Personen har ingen oppgaver framover, og hadde ingen de siste 3 månedene.</p>
      ) : (
        <>
          {taskOverview.coming.length > 0 && (
            <div className="space-y-1.5 pt-1" role="list" aria-label="Oppgaver som kommer">
              {taskOverview.coming.map(taskLine)}
            </div>
          )}
          {taskOverview.held.length > 0 && (
            <details className="pt-1">
              <summary className="text-xs font-bold text-[var(--studio-text)] cursor-pointer">Holdt siste 3 måneder ({taskOverview.held.length})</summary>
              <div className="space-y-1.5 pt-2">{taskOverview.held.map(taskLine)}</div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
