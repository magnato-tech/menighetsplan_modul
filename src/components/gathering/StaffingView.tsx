import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { GatheringDetail, EditableTask, InstructionTarget } from "./gatheringDetail";
import { orderStaffingRoster, placeOf, type RosterPlace, type RosterRow } from "../../utils/staffingRoster";
import { StaffingRosterRowCard, type AssignMode } from "./StaffingRosterRowCard";
import { AssignPersonDialog } from "./AssignPersonDialog";
import { InstructionDialog } from "./InstructionDialog";
import { EditTaskDialog } from "./EditTaskDialog";
import type { PersonResponse } from "./PersonAssignmentMenu";

interface StaffingViewProps {
  detail: GatheringDetail;
  /** The roles shown: all of them for an admin, the leader's own groups for a leader. */
  rows: RosterRow[];
  canAdminister: boolean;
  /** A task the view was opened for (from the run sheet everyone sees), to scroll to. */
  focusTaskId?: string | null;
  showToast: (text: string) => void;
}

const DONE_TEXT: Record<"confirmed" | "pending" | "withdrawn" | "declined", string> = {
  confirmed: "Bekreftet",
  pending: "Forespurt",
  withdrawn: "Forfall",
  declined: "Avslått",
};

/**
 * «Bemanning»: every role once, with its team and its people. What must be found someone for comes
 * first. Here people are put on, asked, marked with forfall and deleted.
 */
export const StaffingView: React.FC<StaffingViewProps> = ({ detail, rows, canAdminister, focusTaskId, showToast }) => {
  const { updateAssignmentStatus, removeAssignment } = detail;
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<{ taskId: string; mode: AssignMode } | null>(null);
  const [instruction, setInstruction] = useState<InstructionTarget | null>(null);
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);
  // Roles changed here stay where they are while the view is open, so nothing jumps away from the finger
  const [held, setHeld] = useState<ReadonlyMap<string, RosterPlace>>(new Map());

  const ordered = useMemo(() => orderStaffingRoster(rows, held), [rows, held]);
  const taskIdOfAssignment = (assignmentId: string) =>
    rows.find((row) => row.people.some((p) => p.assignment.id === assignmentId))?.task.id;
  const hold = (taskId?: string) => {
    const row = rows.find((r) => r.task.id === taskId);
    if (taskId && row && !held.has(taskId)) setHeld(new Map([...held, [taskId, placeOf(row, held)]]));
  };

  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!focusTaskId || scrolledTo.current === focusTaskId) return;
    const target = document.getElementById(`roster-${focusTaskId}`);
    if (!target) return;
    scrolledTo.current = focusTaskId;
    target.scrollIntoView({ block: "center" });
  }, [focusTaskId, ordered]);

  const handleStatusChange = (assignmentId: string, response: PersonResponse, personName?: string) => {
    const taskId = taskIdOfAssignment(assignmentId);
    const res = updateAssignmentStatus(assignmentId, response);
    setOpenMenuId(null);
    if (res.success) {
      hold(taskId);
      showToast(`${personName || "Personen"}: ${DONE_TEXT[response]}`);
    } else {
      showToast(res.error || "Kunne ikke lagre.");
    }
  };

  const handleRemove = (assignmentId: string, personName?: string) => {
    const taskId = taskIdOfAssignment(assignmentId);
    const res = removeAssignment(assignmentId);
    setOpenMenuId(null);
    if (res.success) {
      hold(taskId);
      showToast(`${personName || "Personen"} er slettet fra oppgaven.`);
    } else {
      showToast(res.error || "Kunne ikke slette.");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
        <Info className="w-8 h-8 text-slate-300 mx-auto" aria-hidden />
        <p className="text-xs font-bold text-slate-700">
          {canAdminister ? "Arrangementet har ingen oppgaver ennå" : "Gruppene dine har ingen oppgaver på dette arrangementet"}
        </p>
        {canAdminister && <p className="text-[11px] text-slate-400">Legg dem inn med «Ny oppgave», eller hent dem fra en mal.</p>}
      </div>
    );
  }

  const card = (row: RosterRow, showTeam = true) => (
    <StaffingRosterRowCard
      key={row.task.id}
      row={row}
      canIntervene={canAdminister || row.isMyGroup}
      canAdminister={canAdminister}
      showTeam={showTeam}
      openMenuAssignmentId={openMenuId}
      onToggleMenu={setOpenMenuId}
      onStatusChange={handleStatusChange}
      onRemovePerson={handleRemove}
      onShowInstruction={(shown) =>
        setInstruction({
          taskId: shown.task.id,
          title: shown.roleTitle,
          instruction: shown.instruction || "",
          volunteerRoleId: shown.task.volunteerRoleId,
          time: shown.meetAt || shown.programTimes[0],
          groupName: shown.groupName,
        })
      }
      onAssign={(taskId, mode) => setAssigning({ taskId, mode })}
      onEditTask={(task) =>
        setEditingTask({
          id: task.id,
          title: task.title,
          volunteerRoleId: task.volunteerRoleId,
          groupId: task.groupId,
          neededCount: task.neededCount || 1,
          description: task.description || "",
        })
      }
    />
  );

  return (
    <div className="space-y-4">
      {ordered.attention.length > 0 && (
        <section aria-labelledby="staffing-attention" className="space-y-2">
          <h2 id="staffing-attention" className="px-1 text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
            Må ordnes ({ordered.attention.length})
          </h2>
          <div className="space-y-2">{ordered.attention.map((row) => card(row))}</div>
        </section>
      )}

      {ordered.teams.map((team) => (
        <section key={team.groupId ?? "uten-team"} aria-label={team.name} className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">{team.name}</h2>
          <div className="space-y-2">{team.rows.map((row) => card(row, false))}</div>
        </section>
      ))}

      {assigning && (
        <AssignPersonDialog
          detail={detail}
          taskId={assigning.taskId}
          mode={assigning.mode}
          canAdminister={canAdminister}
          showToast={(text) => {
            hold(assigning.taskId);
            showToast(text);
          }}
          onClose={() => setAssigning(null)}
        />
      )}

      {instruction && (
        <InstructionDialog
          detail={detail}
          task={instruction}
          canAdminister={canAdminister}
          showToast={showToast}
          onClose={() => setInstruction(null)}
        />
      )}

      {editingTask && <EditTaskDialog detail={detail} task={editingTask} showToast={showToast} onClose={() => setEditingTask(null)} />}
    </div>
  );
};
