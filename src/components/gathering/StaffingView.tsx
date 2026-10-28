import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, CircleDashed, Clock, Info } from "lucide-react";
import type { GatheringDetail, EditableTask, InstructionTarget } from "./gatheringDetail";
import {
  needsAction,
  placeOf,
  rosterByTeam,
  rowsNeedingAction,
  type RosterPlace,
  type RosterRow,
  type RosterTeamCard,
} from "../../utils/staffingRoster";
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

const NO_TEAM = "uten-team";
const teamKeyOf = (row: RosterRow) => row.groupId ?? NO_TEAM;

/** One count in a team's header: an icon, the number, and the words for a screen reader. */
const TeamCount: React.FC<{ icon: React.ReactNode; count: number; words: string }> = ({ icon, count, words }) => (
  <span className="inline-flex items-center gap-1">
    {icon}
    <span aria-hidden="true">{count}</span>
    <span className="sr-only">
      {count} {words}
    </span>
  </span>
);

/**
 * «Bemanning»: one card per team, with the counts of the team in its header and every role of the
 * team under it. Free slots are filled from «Fyll plassen». On a phone a team is folded to its
 * header until it is opened.
 */
export const StaffingView: React.FC<StaffingViewProps> = ({ detail, rows, canAdminister, focusTaskId, showToast }) => {
  const { updateAssignmentStatus, removeAssignment } = detail;
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<{ taskId: string; mode: AssignMode } | null>(null);
  const [instruction, setInstruction] = useState<InstructionTarget | null>(null);
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);
  // Roles changed here stay where they are while the view is open, so nothing jumps away from the finger
  const [held, setHeld] = useState<ReadonlyMap<string, RosterPlace>>(new Map());
  const [onlyAction, setOnlyAction] = useState(false);
  // The one free slot whose «Tildel» and «Forespør» are open, as "taskId:number"
  const [fillingSlot, setFillingSlot] = useState<string | null>(null);

  // The team of the role to scroll to is unfolded, so it can be seen on a phone too
  const focusRow = focusTaskId ? rows.find((r) => r.task.id === focusTaskId) : undefined;
  const focusKey = focusRow ? teamKeyOf(focusRow) : null;
  const [openTeams, setOpenTeams] = useState<ReadonlySet<string>>(() => new Set(focusKey ? [focusKey] : []));
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!focusKey) return;
    setOpenTeams((prev) => (prev.has(focusKey) ? prev : new Set([...prev, focusKey])));
  }, [focusKey]);

  const teams = useMemo(() => rosterByTeam(rows), [rows]);
  const anyNeedsAction = rows.some((row) => needsAction(row.state));
  const filterOn = onlyAction && anyNeedsAction;
  const shownIds = useMemo(() => new Set(rowsNeedingAction(rows, held).map((row) => row.task.id)), [rows, held]);
  // Each team with the roles to show in it: all of them, or with the filter only those that must be ordered
  const shownTeams = teams
    .map((team) => ({ team, shown: filterOn ? team.rows.filter((row) => shownIds.has(row.task.id)) : team.rows }))
    .filter((entry) => entry.shown.length > 0);

  const taskIdOfAssignment = (assignmentId: string) =>
    rows.find((row) => row.people.some((p) => p.assignment.id === assignmentId))?.task.id;
  const hold = (taskId?: string) => {
    const row = rows.find((r) => r.task.id === taskId);
    if (taskId && row && !held.has(taskId)) setHeld(new Map([...held, [taskId, placeOf(row, held)]]));
  };

  // Scroll to the role once, when its team is open
  useEffect(() => {
    if (!focusTaskId || scrolledTo.current === focusTaskId) return;
    if (focusKey && !openTeams.has(focusKey)) return;
    const target = document.getElementById(`roster-${focusTaskId}`);
    if (!target) return;
    scrolledTo.current = focusTaskId;
    target.scrollIntoView({ block: "center" });
  }, [focusTaskId, focusKey, openTeams, teams]);

  // Escape closes the choice of a free slot
  useEffect(() => {
    if (!fillingSlot) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFillingSlot(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [fillingSlot]);

  const toggleTeam = (key: string) =>
    setOpenTeams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

  const teamCard = (team: RosterTeamCard, shown: RosterRow[]) => {
    const key = team.groupId ?? NO_TEAM;
    const open = openTeams.has(key);
    const contentId = `team-${key}`;
    return (
      <section key={key} aria-label={team.name} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <h2 className="text-base font-semibold text-slate-900">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => toggleTeam(key)}
            className="w-full min-h-11 flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer md:cursor-default"
          >
            <span className="min-w-0 truncate">{team.name}</span>
            <span className="shrink-0 flex items-center gap-3 text-xs font-semibold text-slate-700">
              <TeamCount icon={<Check className="w-4 h-4 text-emerald-700" aria-hidden />} count={team.confirmed} words="bekreftet" />
              <TeamCount icon={<Clock className="w-4 h-4 text-amber-700" aria-hidden />} count={team.pending} words="venter" />
              <TeamCount
                icon={<CircleDashed className="w-4 h-4 text-slate-500" aria-hidden />}
                count={team.free}
                words={team.free === 1 ? "ledig" : "ledige"}
              />
              <ChevronDown className={`w-4 h-4 text-slate-500 md:hidden transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
            </span>
          </button>
        </h2>

        <div id={contentId} className={`${open ? "block" : "hidden"} md:block print:block border-t border-slate-200`}>
          {shown.map((row) => (
            <StaffingRosterRowCard
              key={row.task.id}
              row={row}
              canIntervene={canAdminister || row.isMyGroup}
              canAdminister={canAdminister}
              openMenuAssignmentId={openMenuId}
              onToggleMenu={setOpenMenuId}
              onStatusChange={handleStatusChange}
              onRemovePerson={handleRemove}
              onShowInstruction={(shownRow) =>
                setInstruction({
                  taskId: shownRow.task.id,
                  title: shownRow.roleTitle,
                  instruction: shownRow.instruction || "",
                  volunteerRoleId: shownRow.task.volunteerRoleId,
                  time: shownRow.meetAt || shownRow.programTimes[0],
                  groupName: shownRow.groupName,
                })
              }
              fillingSlot={fillingSlot}
              onToggleFill={(slot) => setFillingSlot((current) => (current === slot ? null : slot))}
              onAssign={(taskId, mode) => {
                setFillingSlot(null);
                setAssigning({ taskId, mode });
              }}
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
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          aria-pressed={filterOn}
          disabled={!anyNeedsAction}
          onClick={() => setOnlyAction((on) => !on)}
          className={`min-h-11 px-4 rounded-full border text-sm font-semibold print:hidden ${
            filterOn
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer"
          } disabled:cursor-default disabled:text-slate-500 disabled:bg-white`}
        >
          {anyNeedsAction ? "Vis bare det som må ordnes" : "Alt er dekket"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {shownTeams.map(({ team, shown }) => teamCard(team, shown))}
      </div>

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
