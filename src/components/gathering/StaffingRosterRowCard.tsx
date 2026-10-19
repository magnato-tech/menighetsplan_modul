import React from "react";
import { AlertTriangle, CheckCircle2, Clock, Edit3, FileText, Send, UserPlus, Ban } from "lucide-react";
import type { Task } from "../../types";
import { ROSTER_STATE_LABELS, type RosterRow, type RosterState } from "../../utils/staffingRoster";
import { PersonAssignmentMenu, type PersonResponse } from "./PersonAssignmentMenu";

export type AssignMode = "confirmed" | "pending";

interface StaffingRosterRowCardProps {
  row: RosterRow;
  /** May change who is on the task: an admin, or the leader of the task's group. */
  canIntervene: boolean;
  canAdminister: boolean;
  openMenuAssignmentId: string | null;
  onToggleMenu: (assignmentId: string | null) => void;
  onStatusChange: (assignmentId: string, response: PersonResponse, personName?: string) => void;
  onRemovePerson: (assignmentId: string, personName?: string) => void;
  onShowInstruction: (row: RosterRow) => void;
  onAssign: (taskId: string, mode: AssignMode) => void;
  onEditTask: (task: Task) => void;
}

const BORDER: Record<RosterState, string> = {
  forfall: "border-red-300 bg-red-50/30",
  ubesatt: "border-red-300 bg-red-50/20",
  venter: "border-amber-300 bg-amber-50/20",
  dekket: "border-slate-200",
  avlyst: "border-slate-200 opacity-70",
};

/** The state of a role in a word, with an icon. */
export const RosterStateMark: React.FC<{ state: RosterState; count?: number }> = ({ state, count }) => {
  const label = ROSTER_STATE_LABELS[state];
  const text = count && count > 1 && (state === "forfall" || state === "ubesatt") ? `${label} (${count})` : label;
  if (state === "dekket") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
        {text}
      </span>
    );
  }
  if (state === "venter") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
        <Clock className="w-3.5 h-3.5" aria-hidden />
        {text}
      </span>
    );
  }
  if (state === "avlyst") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
        <Ban className="w-3.5 h-3.5" aria-hidden />
        {text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700">
      <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
      {text}
    </span>
  );
};

/** When the role is on: the programme items it is used in, or when its people meet. */
function whenText(row: RosterRow): string | null {
  const times = row.programTimes;
  if (times.length === 0) return row.meetAt ? `Oppmøte ${row.meetAt}` : null;
  if (times.length <= 3) return times.join(" · ");
  return `${times[0]} og ${times.length - 1} til`;
}

/**
 * One role in the staffing: the role (pressed, it shows the instruction), its team, when it is on,
 * and the people on it. Tildel and Forespør are shown while a slot is free.
 */
export const StaffingRosterRowCard: React.FC<StaffingRosterRowCardProps> = ({
  row,
  canIntervene,
  canAdminister,
  openMenuAssignmentId,
  onToggleMenu,
  onStatusChange,
  onRemovePerson,
  onShowInstruction,
  onAssign,
  onEditTask,
}) => {
  const when = whenText(row);
  const showActions = canIntervene && row.free > 0 && row.state !== "avlyst";

  return (
    <div id={`roster-${row.task.id}`} className={`p-3 bg-white rounded-2xl border ${BORDER[row.state]} space-y-2 break-inside-avoid`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {row.instruction ? (
            <button
              type="button"
              onClick={() => onShowInstruction(row)}
              className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-900 hover:text-indigo-700 text-left cursor-pointer"
            >
              <span>{row.roleTitle}</span>
              <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0 print:hidden" aria-label="Instruks" />
            </button>
          ) : (
            <span className="text-sm font-extrabold text-slate-900">{row.roleTitle}</span>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500">
            {when && (
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-600">
                <Clock className="w-3 h-3" aria-hidden />
                {when}
              </span>
            )}
            {row.needed > 1 && (
              <span className="font-semibold">
                {row.confirmed}/{row.needed} bekreftet
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {row.groupName && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                row.isMyGroup ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {row.groupName}
            </span>
          )}
          {canAdminister && (
            <button
              type="button"
              onClick={() => onEditTask(row.task)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer print:hidden"
              aria-label={`Rediger ${row.roleTitle}`}
            >
              <Edit3 className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {row.people.map(({ assignment, person, response }) => (
          <PersonAssignmentMenu
            key={assignment.id}
            assignment={assignment}
            person={person}
            response={response}
            open={openMenuAssignmentId === assignment.id}
            canIntervene={canIntervene}
            onToggle={() => onToggleMenu(openMenuAssignmentId === assignment.id ? null : assignment.id)}
            onStatusChange={onStatusChange}
            onRemovePerson={onRemovePerson}
          />
        ))}
        {/* The chips already say Forespurt and Forfall; the mark is for what no chip says */}
        {(row.people.length === 0 || row.state === "ubesatt" || row.state === "avlyst") && (
          <RosterStateMark state={row.state} count={row.free} />
        )}
      </div>

      {showActions && (
        <div className="flex gap-2 pt-0.5 print:hidden">
          <button
            type="button"
            onClick={() => onAssign(row.task.id, "confirmed")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" aria-hidden />
            Tildel
          </button>
          <button
            type="button"
            onClick={() => onAssign(row.task.id, "pending")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden />
            Forespør
          </button>
        </div>
      )}
    </div>
  );
};
