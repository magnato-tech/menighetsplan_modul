import React from "react";
import { AlertTriangle, Check, Clock, GripVertical } from "lucide-react";
import type { RunSheetRow } from "../../utils/runSheet";
import { holdsSlot } from "../../utils/staffing";

interface ProgramRowCardProps {
  row: RunSheetRow;
  /**
   * How much of the staffing shows: everyone set up, with whether they have answered ("full",
   * for an admin and on a leader's own groups), or only those who have said yes ("names").
   */
  staffing: "full" | "names";
  canReorder?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
}

/**
 * One programme item in «Program»: time, what happens, the theme, the role, the team and who is set
 * up. Nothing about the staffing is changed here; that is done in «Bemanning».
 */
export const ProgramRowCard: React.FC<ProgramRowCardProps> = ({
  row,
  staffing,
  canReorder = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) => {
  const people = row.assignedPersons
    .filter((p) => (staffing === "full" ? holdsSlot(p.assignment) : p.response === "confirmed"))
    .sort((a, b) => Number(a.response !== "confirmed") - Number(b.response !== "confirmed"));
  const nameOf = (p: (typeof people)[number]) => p.person?.name || p.assignment.personName || "Ukjent person";

  return (
    <div
      id={`schedule-row-${row.id}`}
      onDragOver={canReorder ? onDragOver : undefined}
      onDrop={canReorder ? onDrop : undefined}
      className={`p-3 bg-white rounded-2xl border border-slate-200/80 flex items-start gap-2.5 break-inside-avoid transition-all ${
        isDragging ? "opacity-50" : ""
      } ${isDragOver ? "border-indigo-400 ring-1 ring-indigo-200" : ""} print:rounded-none print:border-x-0 print:border-t-0 print:p-1.5`}
    >
      {canReorder && (
        <button
          type="button"
          draggable
          aria-label={`Flytt programposten ${row.title}`}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="p-1 -ml-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing touch-none shrink-0 print:hidden"
        >
          <GripVertical className="w-4 h-4" aria-hidden />
        </button>
      )}
      <span className="shrink-0 font-mono text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 min-w-[3.25rem] text-center">
        {row.time || "–"}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div>
          <p className="text-sm font-bold text-slate-900 leading-snug">{row.title}</p>
          {row.description && <p className="text-xs text-slate-500">{row.description}</p>}
        </div>

        {row.task && (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.roleTitle && row.roleTitle !== row.title && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                {row.roleTitle}
              </span>
            )}
            {row.groupName && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                  row.isMyGroup ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                {row.groupName}
              </span>
            )}
            {people.map((p) => (
              <span
                key={p.assignment.id}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                  p.response === "confirmed" ? "bg-white text-slate-800 border-slate-200" : "bg-amber-50 text-amber-900 border-amber-200"
                }`}
              >
                {p.response === "confirmed" ? (
                  <Check className="w-3 h-3 text-emerald-600" aria-hidden />
                ) : (
                  <Clock className="w-3 h-3 text-amber-600" aria-hidden />
                )}
                {nameOf(p)}
                {p.response === "pending" && <span className="text-[10px] font-bold opacity-80">Forespurt</span>}
              </span>
            ))}
            {staffing === "full" && people.length === 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                {row.hasForfall ? "Forfall" : "Ubesatt"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
