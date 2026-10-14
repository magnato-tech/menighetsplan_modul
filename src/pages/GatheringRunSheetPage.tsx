import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { useLeaderGatheringDetail } from "../hooks/leaderHooks";
import { useFirebase } from "../context/FirebaseDataContext";
import { maySeeRunSheet } from "../utils/runSheet";
import { SharedRunSheetView } from "../components/gathering/SharedRunSheetView";

const CALENDAR_ON_MY_PAGE = "/minside?view=kalender";

/**
 * An event opened from the calendar on Min side: the run sheet as everyone reads it. Leaders and
 * administrators see the same, with a way on to the planning (/leder/samling, /admin/samling).
 */
export const GatheringRunSheetPage: React.FC = () => {
  const { gatheringId = "" } = useParams<{ gatheringId: string }>();
  const detail = useLeaderGatheringDetail(gatheringId);
  const { watchGatheringAssignments, getGroupById } = useFirebase();
  const { gathering, hasAccess, isAdmin, currentUser, tasksWithDetails } = detail;

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
