import React, { useMemo } from "react";
import type { GatheringDetail } from "./gatheringDetail";
import { worshipPlanRows } from "../../utils/worshipPlan";

interface RunSheetSidePanelProps {
  detail: GatheringDetail;
  /** The reader. Their own rows are marked, and their tasks are listed. */
  personId: string;
}

const HEADING = "text-[11px] uppercase tracking-wider font-bold text-slate-500";
const CARD = "bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5";

/**
 * The side panel of the run sheet on a large screen: who has said yes to each role, the same rows as
 * Gudstjenester on Min side, and the reader's own roles here. Only names of those who have said yes.
 */
export const RunSheetSidePanel: React.FC<RunSheetSidePanelProps> = ({ detail, personId }) => {
  const { gathering, tasksWithDetails, volunteerRoles } = detail;

  const { rows, myRoles } = useMemo(() => {
    if (!gathering) return { rows: [], myRoles: [] as string[] };

    const names = new Map<string, string>();
    tasksWithDetails.forEach((item) =>
      item.assignedPersons.forEach((person) => {
        if (person.person?.name) names.set(person.assignment.personId, person.person.name);
      })
    );

    const rows = worshipPlanRows({
      gathering,
      tasks: tasksWithDetails.map((item) => item.task),
      assignments: tasksWithDetails.flatMap((item) => item.assignedPersons.map((person) => person.assignment)),
      volunteerRoles,
      personName: (id) => names.get(id),
      me: personId,
    });

    // Asked or accepted, as on the run sheet: a cancelled task is not listed
    const roleName = new Map(volunteerRoles.map((role) => [role.id, role.name]));
    const myRoles = tasksWithDetails
      .filter(
        (item) =>
          item.task.status !== "cancelled" &&
          item.assignedPersons.some(
            (person) =>
              person.assignment.personId === personId && (person.response === "confirmed" || person.response === "pending")
          )
      )
      .map((item) => (item.task.volunteerRoleId && roleName.get(item.task.volunteerRoleId)) || item.task.title);

    return { rows, myRoles };
  }, [gathering, tasksWithDetails, volunteerRoles, personId]);

  if (!gathering) return null;

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <section className={CARD}>
          <h3 className={HEADING}>Bemanning</h3>
          <div className="space-y-1.5">
            {rows.map((row) => (
              <div key={row.taskId} className="flex items-start gap-2 text-xs">
                <span className={`min-w-0 flex-1 ${row.isMine ? "font-bold text-slate-900" : "text-slate-700"}`}>
                  <span>{row.role}</span>
                  {/* Nobody has said yes: one dash, not a separator and a dash */}
                  <span className="text-slate-400">{row.people.length === 0 ? " –" : " — "}</span>
                  {row.people.map((person, index) => (
                    <span key={person.personId}>
                      {index > 0 && ", "}
                      <span className={person.isMe ? "font-bold text-slate-900" : ""}>{person.name}</span>
                    </span>
                  ))}
                </span>
                {row.isMine && (
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Du</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {myRoles.length > 0 && (
        <section className={CARD}>
          <h3 className={HEADING}>Dine oppgaver</h3>
          <ul className="space-y-1 text-xs font-bold text-slate-900">
            {myRoles.map((role, index) => (
              <li key={`${role}-${index}`}>{role}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
