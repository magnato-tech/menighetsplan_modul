import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, CircleDashed, Clock, Info, Users } from "lucide-react";
import type { GatheringDetail, EditableTask, InstructionTarget } from "./gatheringDetail";
import {
  needsAction,
  placeOf,
  rosterByTeam,
  rowsNeedingAction,
  estimatedTeamHeight,
  type RosterPlace,
  type RosterRow,
  type RosterTeamCard,
} from "../../utils/staffingRoster";
import { columnCountFor, masonryColumns } from "../../utils/masonry";
import { StaffingRosterRowCard, type AssignMode } from "./StaffingRosterRowCard";
import { AssignPersonDialog } from "./AssignPersonDialog";
import { InstructionDialog } from "./InstructionDialog";
import { EditTaskDialog } from "./EditTaskDialog";
import { TeamCardDialog } from "./TeamCardDialog";
import type { PersonResponse } from "./PersonAssignmentMenu";

interface StaffingViewProps {
  detail: GatheringDetail;
  /** The roles shown: all of them for an admin, the leader's own groups for a leader. */
  rows: RosterRow[];
  canAdminister: boolean;
  /** A task the view was opened for (from the run sheet everyone sees), to scroll to. */
  focusTaskId?: string | null;
  /** Changes each time a role is picked, so the same role scrolls again. */
  focusNonce?: number;
  /** The role picked from the programme panel: its team opens, and the role is marked. */
  highlightTaskId?: string | null;
  /** The width the team columns are laid out in. Measured from the page when not given (tests give it). */
  width?: number;
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

/** From `md` the teams start open; on a phone they start folded. Read once, when the view opens. */
const startsOpen = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 768px)").matches;

/** One count in a team's header: an icon, the number, and the words for a screen reader. */
// A count of nothing is not shown: as few signs as possible
const TeamCount: React.FC<{ icon: React.ReactNode; count: number; words: string }> = ({ icon, count, words }) =>
  count === 0 ? null : (
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
 * team under it. Free slots are filled from «Fyll plassen». A team is folded to its header until it
 * is opened: on a phone that is the start, from `md` all teams start open.
 */
export const StaffingView: React.FC<StaffingViewProps> = ({
  detail,
  rows,
  canAdminister,
  focusTaskId,
  focusNonce = 0,
  highlightTaskId = null,
  width,
  showToast,
}) => {
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
  // The team whose card is open in the popup. Only one at a time.
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  // Teams the reader has folded or opened. The others start as the screen says (see startsOpen).
  const [wide] = useState(startsOpen);
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const isOpen = (key: string) => overrides.get(key) ?? wide;
  const setTeamsOpen = (keys: string[], open: boolean) =>
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, open);
      return next;
    });

  // The team of the role to scroll to is unfolded, so it can be seen on a phone too
  const focusRow = focusTaskId ? rows.find((r) => r.task.id === focusTaskId) : undefined;
  const focusKey = focusRow ? teamKeyOf(focusRow) : null;
  const scrolledTo = useRef<string | null>(null);
  const scrollKey = focusTaskId ? `${focusTaskId}:${focusNonce}` : null;
  useEffect(() => {
    // A picked role may be hidden by the «må ordnes» filter, so the filter is turned off to show it
    if (!scrollKey) return;
    setOnlyAction(false);
    if (focusKey) setOverrides((prev) => (prev.get(focusKey) === true ? prev : new Map(prev).set(focusKey, true)));
  }, [focusKey, scrollKey]);

  const teams = useMemo(() => rosterByTeam(rows), [rows]);
  const allTeamKeys = teams.map((team) => team.groupId ?? NO_TEAM);
  const anyNeedsAction = rows.some((row) => needsAction(row.state));
  const filterOn = onlyAction && anyNeedsAction;
  const shownIds = useMemo(() => new Set(rowsNeedingAction(rows, held).map((row) => row.task.id)), [rows, held]);
  // Each team with the roles to show in it: all of them, or with the filter only those that must be ordered
  const shownTeams = teams
    .map((team) => ({ team, shown: filterOn ? team.rows.filter((row) => shownIds.has(row.task.id)) : team.rows }))
    .filter((entry) => entry.shown.length > 0);

  // The team cards in columns with no gaps: each next card goes into the shortest column (utils/masonry.ts).
  // The width is read from the page, and without ResizeObserver (tests) there is one column.
  const columnsRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const hasRows = rows.length > 0;
  useLayoutEffect(() => {
    const el = columnsRef.current;
    if (!el || width !== undefined) return;
    const read = () => setMeasuredWidth(el.clientWidth);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasRows, width]);
  const columnCount = columnCountFor(width ?? measuredWidth);
  const heights = shownTeams.map(({ team, shown }) => estimatedTeamHeight(shown, isOpen(team.groupId ?? NO_TEAM)));
  const columns = masonryColumns(heights, columnCount);

  const taskIdOfAssignment = (assignmentId: string) =>
    rows.find((row) => row.people.some((p) => p.assignment.id === assignmentId))?.task.id;
  const hold = (taskId?: string) => {
    const row = rows.find((r) => r.task.id === taskId);
    if (taskId && row && !held.has(taskId)) setHeld(new Map([...held, [taskId, placeOf(row, held)]]));
  };

  // Scroll to the role once for each pick, when its team is open
  useEffect(() => {
    if (!focusTaskId || !scrollKey || scrolledTo.current === scrollKey) return;
    if (focusKey && !(overrides.get(focusKey) ?? wide)) return;
    const target = document.getElementById(`roster-${focusTaskId}`);
    if (!target) return;
    scrolledTo.current = scrollKey;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [scrollKey, focusTaskId, focusKey, overrides, wide, teams, filterOn]);

  // Escape closes the choice of a free slot
  useEffect(() => {
    if (!fillingSlot) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFillingSlot(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [fillingSlot]);

  const toggleTeam = (key: string) => setTeamsOpen([key], !isOpen(key));

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
    const open = isOpen(key);
    const contentId = `team-${key}`;
    const holdsPick = team.rows.some((row) => row.task.id === highlightTaskId);
    // A real group's card opens for those who may open it: admin for all, a leader for her own groups
    const groupId = team.groupId;
    const canOpen = Boolean(groupId) && (canAdminister || team.rows.some((row) => row.isMyGroup));
    const openerId = groupId ? `team-open-${groupId}` : undefined;
    return (
      <section
        key={key}
        aria-label={team.name}
        className={`group bg-white rounded-xl border overflow-hidden ${holdsPick ? "border-indigo-400" : "border-slate-200"}`}
      >
        <div className="flex items-center">
          <h2 className="min-w-0 flex-1 text-base font-semibold text-slate-900">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={contentId}
              onClick={() => toggleTeam(key)}
              className="w-full min-h-11 flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
            >
              <span className="min-w-0 truncate">{team.name}</span>
              <span className="shrink-0 flex items-center gap-3 text-xs font-semibold text-slate-700">
                <TeamCount icon={<Check className="w-4 h-4 text-emerald-700" aria-hidden />} count={team.confirmed} words="bekreftet" />
                <TeamCount icon={<Clock className="w-4 h-4 text-amber-500" aria-hidden />} count={team.pending} words="venter" />
                <TeamCount
                  icon={<CircleDashed className="w-4 h-4 text-slate-500" aria-hidden />}
                  count={team.free}
                  words={team.free === 1 ? "ledig" : "ledige"}
                />
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
              </span>
            </button>
          </h2>
          {canOpen && groupId && (
            // From md the icon shows on hover or focus; on a phone it is always there, with a 44 px target
            <button
              type="button"
              id={openerId}
              aria-label={`Åpne teamet ${team.name}`}
              title={`Åpne teamet ${team.name}`}
              onClick={() => setOpenTeamId(groupId)}
              className="shrink-0 w-11 h-11 md:w-8 md:h-8 mr-1 md:mr-2 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <Users className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>

        <div id={contentId} className={`${open ? "block" : "hidden"} print:block border-t border-slate-200`}>
          {shown.map((row) => (
            <StaffingRosterRowCard
              key={row.task.id}
              row={row}
              highlighted={row.task.id === highlightTaskId}
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
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          aria-pressed={filterOn}
          disabled={!anyNeedsAction}
          onClick={() => setOnlyAction((on) => !on)}
          className={`min-h-11 px-4 rounded-full border text-sm font-semibold ${
            filterOn
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer"
          } disabled:cursor-default disabled:text-slate-500 disabled:bg-white`}
        >
          {anyNeedsAction ? "Vis bare det som må ordnes" : "Alt er dekket"}
        </button>
        <button
          type="button"
          onClick={() => setTeamsOpen(allTeamKeys, true)}
          className="min-h-11 px-4 rounded-full border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer text-sm font-semibold text-slate-700"
        >
          Fold ut alle
        </button>
        <button
          type="button"
          onClick={() => setTeamsOpen(allTeamKeys, false)}
          className="min-h-11 px-4 rounded-full border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer text-sm font-semibold text-slate-700"
        >
          Fold sammen alle
        </button>
      </div>

      {/* As many team columns as the width holds, each at least 20rem. A card goes into the shortest column, so no gaps */}
      <div ref={columnsRef} className="flex items-start gap-4">
        {columns.map((indexes, column) => (
          <div key={column} data-staffing-column className="min-w-0 flex-1 flex flex-col gap-4">
            {indexes.map((index) => teamCard(shownTeams[index].team, shownTeams[index].shown))}
          </div>
        ))}
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

      {openTeamId && (
        <TeamCardDialog
          groupId={openTeamId}
          returnFocusId={`team-open-${openTeamId}`}
          onClose={() => setOpenTeamId(null)}
        />
      )}
    </div>
  );
};
