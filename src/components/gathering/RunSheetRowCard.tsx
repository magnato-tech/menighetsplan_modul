import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  AlertTriangle,
  UserPlus,
  FileText,
  Check,
  ChevronDown,
  Edit3,
  GripVertical,
  Trash2,
} from "lucide-react";
import { Assignment, Task } from "../../types";
import { RunSheetRow } from "../../utils/runSheet";
import { RESPONSE_LABELS } from "../../utils/staffing";

const MENU_HEIGHT = 260;
const MENU_WIDTH = 192;

interface PersonAssignmentMenuProps {
  assignment: Assignment;
  personName?: string;
  response: Assignment["response"];
  open: boolean;
  canIntervene: boolean;
  onToggle: () => void;
  onStatusChange: (assignmentId: string, response: Assignment["response"], personName?: string) => void;
  onRemovePerson: (assignmentId: string, personName?: string) => void;
}

/** Status menu for one person on a task. Rendered in a portal so it is not clipped at the bottom of the screen. */
const PersonAssignmentMenu: React.FC<PersonAssignmentMenuProps> = ({
  assignment,
  personName,
  response,
  open,
  canIntervene,
  onToggle,
  onStatusChange,
  onRemovePerson,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const button = buttonRef.current;
    if (!button) return;

    const place = () => {
      const rect = button.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < MENU_HEIGHT ? Math.max(8, rect.top - MENU_HEIGHT - 4) : rect.bottom + 4;
      const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8);
      setMenuStyle({ position: "fixed", top, left, width: MENU_WIDTH, zIndex: 100 });
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        disabled={!canIntervene}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
          response === "confirmed"
            ? "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100/80"
            : response === "withdrawn"
            ? "bg-red-50 text-red-900 border-red-300 hover:bg-red-100/80"
            : response === "declined"
            ? "bg-slate-100 text-slate-700 border-slate-300 line-through"
            : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/80"
        } ${canIntervene ? "cursor-pointer" : "cursor-default"}`}
      >
        <span>{personName || "Ukjent person"}</span>
        {response !== "confirmed" && (
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              response === "withdrawn"
                ? "bg-red-200 text-red-800"
                : response === "declined"
                ? "bg-slate-200 text-slate-700"
                : "bg-amber-200 text-amber-900"
            }`}
          >
            {RESPONSE_LABELS[response]}
          </span>
        )}
        {canIntervene && <ChevronDown className="w-3 h-3 text-slate-400 print:hidden" />}
      </button>

      {open &&
        menuStyle &&
        createPortal(
          <div
            role="menu"
            style={menuStyle}
            className="bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 space-y-1 text-xs animate-fadeIn print:hidden"
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
              Endre status for {personName}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => onStatusChange(assignment.id, "confirmed", personName)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-emerald-50 text-emerald-800 font-medium flex items-center justify-between cursor-pointer"
            >
              <span>Akseptert / Bekreftet</span>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onStatusChange(assignment.id, "pending", personName)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-amber-50 text-amber-800 font-medium flex items-center justify-between cursor-pointer"
            >
              <span>Sett som Forespurt</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onStatusChange(assignment.id, "withdrawn", personName)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-red-50 text-red-700 font-medium flex items-center justify-between cursor-pointer"
            >
              <span>Meld forfall (Trenger vikar)</span>
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            </button>
            <div className="border-t border-slate-100 pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => onRemovePerson(assignment.id, personName)}
                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-red-50 text-red-600 font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>Fjern fra oppgave</span>
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

interface RunSheetRowCardProps {
  row: RunSheetRow;
  /** May change who is on the task: an admin, or the leader of the group the task belongs to. */
  canIntervene: boolean;
  canAdminister: boolean;
  /** The assignment whose status menu is open, so only one menu shows at a time. */
  openMenuAssignmentId: string | null;
  onToggleMenu: (assignmentId: string | null) => void;
  onStatusChange: (assignmentId: string, response: Assignment["response"], personName?: string) => void;
  onRemovePerson: (assignmentId: string, personName?: string) => void;
  onShowInstruction: (row: RunSheetRow) => void;
  onAssign: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  /** Admin may reorder programme items in the gathering's schedule. */
  canReorder?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onProgramDragStart?: (event: React.DragEvent) => void;
  onProgramDragEnd?: () => void;
  onProgramDragOver?: (event: React.DragEvent) => void;
  onProgramDrop?: (event: React.DragEvent) => void;
}

/**
 * One line of the run sheet. A line with a task shows who is on it and lets a leader
 * change that; a programme item without a task is only the time and what happens.
 */
export const RunSheetRowCard: React.FC<RunSheetRowCardProps> = ({
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
  canReorder = false,
  isDragging = false,
  isDragOver = false,
  onProgramDragStart,
  onProgramDragEnd,
  onProgramDragOver,
  onProgramDrop,
}) => {
  const { task } = row;
  const isVacant = !row.isFullyCovered || row.hasForfall;

  return (
    <div
      id={`schedule-row-${row.id}`}
      onDragOver={canReorder ? onProgramDragOver : undefined}
      onDrop={canReorder ? onProgramDrop : undefined}
      className={`p-3 bg-white rounded-2xl border transition-all ${
        isDragging ? "opacity-50" : ""
      } ${
        isDragOver ? "border-indigo-400 ring-1 ring-indigo-200" : ""
      } ${
        row.hasForfall
          ? "border-red-300/80 bg-red-50/20 shadow-xs"
          : !row.isFullyCovered
          ? "border-amber-300/80 bg-amber-50/10 shadow-xs"
          : "border-slate-200/80 hover:border-slate-300"
      } print:rounded-none print:border-b print:border-t-0 print:border-l-0 print:border-r-0 print:border-slate-200 print:p-1.5`}
    >
      {/* Top line: Time, Program Item, Group & Status indicator */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {canReorder && (
            <button
              type="button"
              draggable
              aria-label={`Flytt programposten ${row.title}`}
              onDragStart={onProgramDragStart}
              onDragEnd={onProgramDragEnd}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-grab active:cursor-grabbing touch-none shrink-0 mt-0.5 print:hidden"
            >
              <GripVertical className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {/* Time pill */}
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/60 shrink-0 mt-0.5">
            {row.time || "–"}
          </span>

          {/* Program Item and Role */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs font-extrabold text-slate-900">{row.title}</h3>
              {row.roleTitle && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-semibold text-slate-700">{row.roleTitle}</span>
                </>
              )}
            </div>

            {row.description && (
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{row.description}</p>
            )}
            {/* The people on the task may be asked to come earlier than the item itself */}
            {row.meetAt && row.meetAt !== row.time && (
              <p className="text-[11px] font-semibold text-slate-600 mt-0.5">Oppmøte kl. {row.meetAt}</p>
            )}
          </div>
        </div>

        {/* Group Badge & Staffing Fraction */}
        <div className="flex items-center gap-1.5 shrink-0">
          {row.groupName && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                row.isMyGroup
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {row.groupName}
            </span>
          )}

          {task && row.neededCount > 1 && (
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                row.isFullyCovered ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {row.confirmedCount}/{row.neededCount}
            </span>
          )}
        </div>
      </div>

      {/* Who is on the task, with interactive status. Left out for a programme item without a task. */}
      {task && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Ansvarlig:</span>

            {row.assignedPersons.length > 0 ? (
              row.assignedPersons.map(({ assignment, person, response }) => (
                <div key={assignment.id} className="inline-flex items-center">
                  <PersonAssignmentMenu
                    assignment={assignment}
                    personName={person?.name}
                    response={response}
                    open={openMenuAssignmentId === assignment.id}
                    canIntervene={canIntervene}
                    onToggle={() => onToggleMenu(openMenuAssignmentId === assignment.id ? null : assignment.id)}
                    onStatusChange={onStatusChange}
                    onRemovePerson={onRemovePerson}
                  />
                </div>
              ))
            ) : (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200/60">
                Ubesatt (Trenger frivillig)
              </span>
            )}
          </div>

          {/* Actions on this row (hidden in print) */}
          <div className="flex items-center gap-1.5 print:hidden">
            {row.instruction && (
              <button
                type="button"
                id={`btn-instruction-${row.id}`}
                onClick={() => onShowInstruction(row)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-200/60 transition-colors cursor-pointer"
              >
                <FileText className="w-3 h-3 text-indigo-600" />
                <span>Instruks</span>
              </button>
            )}

            {canIntervene && (
              <button
                type="button"
                id={`btn-intervene-assign-${task.id}`}
                onClick={() => onAssign(task.id)}
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  isVacant
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                }`}
              >
                <UserPlus className="w-3 h-3" />
                <span>{isVacant ? "Grip inn / Tildel" : "Tildel flere"}</span>
              </button>
            )}

            {canAdminister && (
              <button
                type="button"
                id={`btn-admin-edit-task-${task.id}`}
                onClick={() => onEditTask(task)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Rediger oppgave, behov eller gruppe"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
