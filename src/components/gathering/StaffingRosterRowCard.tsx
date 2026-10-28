import React, { useState } from "react";
import { Ban, Clock, Edit3, FileText, Send, UserPlus } from "lucide-react";
import type { Task } from "../../types";
import type { RosterRow } from "../../utils/staffingRoster";
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
  /** The free slot whose choice is open, as "taskId:number", or null. */
  fillingSlot: string | null;
  onToggleFill: (slot: string) => void;
  onAssign: (taskId: string, mode: AssignMode) => void;
  onEditTask: (task: Task) => void;
  /** The role picked from the programme panel: tinted, with a bar on its left. */
  highlighted?: boolean;
}

/** When the role is on: the programme items it is used in, or when its people meet. */
function whenText(row: RosterRow): string | null {
  const times = row.programTimes;
  if (times.length === 0) return row.meetAt ? `Oppmøte ${row.meetAt}` : null;
  if (times.length <= 3) return times.join(" · ");
  return `${times[0]} og ${times.length - 1} til`;
}

/**
 * One role in a team's card: a grey band with the role, its times and the edit pencil, then one
 * line per person, the free slots and those who said no. The role's title opens the instruction.
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
  fillingSlot,
  onToggleFill,
  onAssign,
  onEditTask,
  highlighted = false,
}) => {
  const [showDeclined, setShowDeclined] = useState(false);
  const cancelled = row.state === "avlyst";
  const when = whenText(row);
  const people = row.people.filter((p) => p.response !== "declined");
  const declined = row.people.filter((p) => p.response === "declined");
  const slots = cancelled ? 0 : row.free;

  return (
    <div
      id={`roster-${row.task.id}`}
      aria-current={highlighted ? "true" : undefined}
      className={`break-inside-avoid ${highlighted ? "bg-indigo-50/60 shadow-[inset_3px_0_0_#6366F1]" : ""}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 border-y border-slate-200 ${
          highlighted ? "" : "bg-slate-50"
        }`}
      >
        {row.instruction ? (
          <button
            type="button"
            onClick={() => onShowInstruction(row)}
            className="inline-flex items-center gap-1.5 min-h-9 text-[11px] font-semibold uppercase tracking-wider text-slate-600 hover:text-indigo-700 text-left cursor-pointer"
          >
            <span>{row.roleTitle}</span>
            <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0 print:hidden" aria-label="Instruks" />
          </button>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">{row.roleTitle}</span>
        )}

        <div className="flex items-center gap-3 text-[11px] text-slate-600">
            {!cancelled && row.programTimes.length === 0 && (
              <span className="text-[11px] text-slate-500">Utenfor programmet</span>
            )}
            {cancelled && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold">
                <Ban className="w-3.5 h-3.5" aria-hidden />
                Avlyst
              </span>
            )}
            {!cancelled && when && (
              <span className="inline-flex items-center gap-1 font-mono font-semibold">
                <Clock className="w-3 h-3" aria-hidden />
                {when}
              </span>
            )}
            {!cancelled && row.needed > 1 && (
              <span className="font-semibold">
                {row.confirmed}/{row.needed} bekreftet
              </span>
            )}
            {canAdminister && (
              <button
                type="button"
                onClick={() => onEditTask(row.task)}
                className="p-1.5 -my-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer print:hidden"
                aria-label={`Rediger ${row.roleTitle}`}
              >
                <Edit3 className="w-4 h-4" aria-hidden />
              </button>
            )}
        </div>
      </div>

      {!cancelled && (
        <div>
          {people.map(({ assignment, person, response }) => (
            <PersonAssignmentMenu
              key={assignment.id}
              assignment={assignment}
              person={person}
              response={response}
              open={openMenuAssignmentId === assignment.id}
              canIntervene={canIntervene}
              variant="row"
              onToggle={() => onToggleMenu(openMenuAssignmentId === assignment.id ? null : assignment.id)}
              onStatusChange={onStatusChange}
              onRemovePerson={onRemovePerson}
            />
          ))}

          {Array.from({ length: slots }, (_, index) => {
            const slot = `${row.task.id}:${index}`;
            const open = canIntervene && fillingSlot === slot;
            return (
              <div key={slot} className="border-t border-slate-100 first:border-t-0">
                <div className="flex items-center gap-3 px-4 min-h-11 py-2">
                  <span className="w-[30px] h-[30px] rounded-full border-2 border-dashed border-slate-400 shrink-0" aria-hidden />
                  <span className="flex-1 text-sm text-slate-500">Ledig plass</span>
                  {canIntervene && (
                    <button
                      type="button"
                      onClick={() => onToggleFill(slot)}
                      aria-expanded={open}
                      className="min-h-11 px-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer print:hidden"
                    >
                      Fyll plassen
                    </button>
                  )}
                </div>
                {open && (
                  <div className="flex flex-wrap gap-2 px-4 pb-3 pl-[62px] print:hidden">
                    <button
                      type="button"
                      autoFocus
                      onClick={() => onAssign(row.task.id, "confirmed")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" aria-hidden />
                      Tildel
                    </button>
                    <button
                      type="button"
                      onClick={() => onAssign(row.task.id, "pending")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" aria-hidden />
                      Forespør
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {declined.length > 0 && (
            <div className="border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeclined((shown) => !shown)}
                aria-expanded={showDeclined}
                className="w-full min-h-9 px-4 text-left text-xs text-slate-500 hover:text-slate-700 cursor-pointer print:hidden"
              >
                {declined.length} sa nei
              </button>
              {showDeclined &&
                declined.map(({ assignment, person, response }) => (
                  <PersonAssignmentMenu
                    key={assignment.id}
                    assignment={assignment}
                    person={person}
                    response={response}
                    open={openMenuAssignmentId === assignment.id}
                    canIntervene={canIntervene}
                    variant="row"
                    onToggle={() => onToggleMenu(openMenuAssignmentId === assignment.id ? null : assignment.id)}
                    onStatusChange={onStatusChange}
                    onRemovePerson={onRemovePerson}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
