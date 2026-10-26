import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Lock, Plus, Printer } from "lucide-react";
import { useLeaderGatheringDetail } from "../hooks/leaderHooks";
import { useFirebase } from "../context/FirebaseDataContext";
import type { ProgramItem } from "../types";
import { buildRunSheet, maySeeRunSheet, programIndexOfRunSheetRow } from "../utils/runSheet";
import { canDeleteProgramItem, programEditorAssignment } from "../utils/programEditor";
import { withComputedTimes } from "../utils/programTiming";
import { SharedRunSheetView } from "../components/gathering/SharedRunSheetView";
import { ProgramView } from "../components/gathering/ProgramView";
import { ProgramPostDialog } from "../components/gathering/ProgramPostDialog";
import { ProgramUndoToast } from "../components/gathering/ProgramUndoToast";

const CALENDAR_ON_MY_PAGE = "/minside?view=kalender";

/**
 * An event opened from the calendar on Min side: the run sheet as everyone reads it. The one who leads
 * the event may also change its programme here, with the same view as the planning uses.
 */
export const GatheringRunSheetPage: React.FC = () => {
  const { gatheringId = "" } = useParams<{ gatheringId: string }>();
  const detail = useLeaderGatheringDetail(gatheringId);
  const { watchGatheringAssignments, getGroupById, assignments } = useFirebase();
  const { gathering, hasAccess, isAdmin, currentUser, tasksWithDetails, gatheringTasks, programSchedule, volunteerRoles, updateGathering } = detail;
  const [creating, setCreating] = useState(false);
  const [undo, setUndo] = useState<{ id: number; previous: ProgramItem[]; what: string } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const standsOnTask = tasksWithDetails.some((t) =>
    t.assignedPersons.some((p) => p.assignment.personId === currentUser.id)
  );
  const allowed = Boolean(
    gathering &&
      maySeeRunSheet({
        gathering,
        gatheringGroup: getGroupById(gathering.groupId),
        personId: currentUser.id,
        mayPlan: hasAccess,
        standsOnTask,
      })
  );

  // The names are only asked for where the database gives them
  useEffect(
    () => (allowed ? watchGatheringAssignments(gatheringId) : undefined),
    [allowed, gatheringId, watchGatheringAssignments]
  );

  // Only the one who has said yes to leading this gathering may change its programme
  const editorAssignment =
    gathering && allowed
      ? programEditorAssignment(gathering, gatheringTasks, assignments, volunteerRoles, currentUser.id)
      : null;

  // The programme rows, built the same way as in the planning
  const programRows = useMemo(
    () =>
      buildRunSheet(programSchedule, tasksWithDetails, volunteerRoles).filter(
        (row) => programIndexOfRunSheetRow(row.id) !== null
      ),
    [programSchedule, tasksWithDetails, volunteerRoles]
  );

  // Saves the programme. Only these three fields are written, so the database rule for leaders accepts it.
  const writeProgram = (items: ProgramItem[]): boolean => {
    if (!gathering || !editorAssignment) return false;
    const res = updateGathering(gathering.id, {
      programSchedule: withComputedTimes(items, gathering.startsAt, gathering.endsAt),
      programEditedBy: {
        assignmentId: editorAssignment.id,
        personId: currentUser.id,
        personName: currentUser.name,
      },
      programEditedAt: new Date().toISOString(),
    });
    return res.success;
  };

  const changeProgram = (items: ProgramItem[], what: string) => {
    const previous = programSchedule;
    if (writeProgram(items)) {
      setSaveFailed(false);
      setUndo({ id: Date.now(), previous, what });
    } else {
      setSaveFailed(true);
    }
  };

  const undoChange = () => {
    if (!undo) return;
    const ok = writeProgram(undo.previous);
    setUndo(null);
    setSaveFailed(!ok);
  };

  if (!gathering || !allowed) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-50 sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden">
        <div className="p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-500 border border-slate-200">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-base font-bold text-slate-800">
              {!gathering ? "Fant ikke arrangementet" : "Arrangementet hører til en gruppe"}
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              {!gathering
                ? "Det kan være flyttet eller slettet."
                : "Kjøreplanen vises for dem som er med i gruppen. Ta kontakt med gruppelederen hvis du skal være med."}
            </p>
          </div>
          <Link
            to={CALENDAR_ON_MY_PAGE}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Tilbake til kalenderen
          </Link>
        </div>
      </div>
    );
  }

  // The meeting leader gets the planning's programme view and only the actions for the programme
  if (editorAssignment) {
    return (
      <>
        <SharedRunSheetView
          detail={detail}
          personId={currentUser.id}
          planningLink={null}
          backLink={CALENDAR_ON_MY_PAGE}
          headerActions={
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden />
                <span>Ny programpost</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" aria-hidden />
                <span>Skriv ut</span>
              </button>
            </div>
          }
          program={
            <ProgramView
              rows={programRows}
              items={programSchedule}
              startsAt={gathering.startsAt}
              endsAt={gathering.endsAt}
              canAdminister={false}
              permissions={{ reorder: true, edit: true, deleteItem: canDeleteProgramItem }}
              onChangeProgram={changeProgram}
              emptyHint="Legg til den første programposten med «Ny programpost»."
            />
          }
        />

        {saveFailed && (
          <p role="alert" className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold shadow-lg print:hidden">
            Programmet kunne ikke lagres. Prøv igjen.
          </p>
        )}

        {undo && <ProgramUndoToast key={undo.id} what={undo.what} onUndo={undoChange} onHide={() => setUndo(null)} />}

        {creating && (
          <ProgramPostDialog
            canDelete
            onSave={(item) => {
              setCreating(false);
              changeProgram([...programSchedule, item], `La til «${item.title}»`);
            }}
            onClose={() => setCreating(false)}
          />
        )}
      </>
    );
  }

  const planningLink = isAdmin
    ? `/admin/samling/${gathering.id}?fra=kjoreplan`
    : hasAccess
    ? `/leder/samling/${gathering.id}?fra=kjoreplan`
    : null;

  return (
    <SharedRunSheetView
      detail={detail}
      personId={currentUser.id}
      planningLink={planningLink}
      backLink={CALENDAR_ON_MY_PAGE}
    />
  );
};
