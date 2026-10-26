import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTaskDetail, formatNorwegianDateTime } from "../hooks/useAppHooks";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  ShieldAlert,
  CheckCircle2,
  Info,
  Pencil,
} from "lucide-react";
import { useFirebase } from "../context/FirebaseDataContext";
import { programEditorAssignment } from "../utils/programEditor";

export const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const {
    task,
    instruction,
    gathering,
    group,
    othersOnTask,
    freeSlots,
    needsSubstitute,
    isAssignedToMe,
    isAskedOfMe,
    canClaim,
    canReportAbsence,
    permissionDenied,
    claimTask,
    answerRequest,
    reportAbsence,
  } = useTaskDetail(taskId);

  const { tasks, assignments, volunteerRoles, currentUser } = useFirebase();
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isConfirmingAbsence, setIsConfirmingAbsence] = useState(false);

  const handleClaim = () => {
    const res = claimTask();
    setActionFeedback(
      res.success ? "Takk for at du stiller opp! Du har nå tatt denne oppgaven." : res.error || "Kunne ikke ta oppgaven."
    );
  };

  const handleAnswer = (accept: boolean) => {
    const res = answerRequest(accept);
    if (!res.success) {
      setActionFeedback(res.error || "Kunne ikke lagre svaret.");
    } else {
      setActionFeedback(
        accept ? "Takk for at du stiller opp! Oppgaven er din." : "Takk for beskjed. Lederen ser at du ikke kan."
      );
    }
  };

  const handleAbsenceClick = () => {
    if (!isConfirmingAbsence) {
      setIsConfirmingAbsence(true);
    }
  };

  const handleConfirmAbsence = () => {
    const res = reportAbsence();
    setIsConfirmingAbsence(false);
    setActionFeedback(
      res.success
        ? "Forfall er registrert. Oppgaven er nå gjort ledig for gruppen din."
        : res.error || "Kunne ikke melde forfall."
    );
  };

  const othersNames = othersOnTask.map((person) => person.name).join(", ");

  // Case 1: Permission Denied State (User tries to access task outside their groups)
  if (permissionDenied) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen p-4 sm:p-6 sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 space-y-6">
        <Link
          to="/minside"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Tilbake til Min side
        </Link>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-800">
              Ikke tilgang til denne oppgaven
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Denne oppgaven tilhører en gruppe du ikke er deltaker i. I Menighetsplan ser du kun oppgaver for dine egne grupper.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/minside"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              Gå til Min side
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Not found
  if (!task) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen p-4 sm:p-6 sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 space-y-6">
        <Link
          to="/minside"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Tilbake til Min side
        </Link>

        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center space-y-2 shadow-sm">
          <Info className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">Oppgaven ble ikke funnet</h2>
          <p className="text-xs text-slate-400">
            Oppgaven kan ha blitt slettet eller ID-en er feil.
          </p>
        </div>
      </div>
    );
  }

  // Case 3: Task Details
  const formattedDate = gathering
    ? formatNorwegianDateTime(gathering.startsAt)
    : "Tidspunkt ikke oppgitt";

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen p-4 sm:p-6 sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 space-y-5">
      {/* Top Nav Back */}
      <div className="flex items-center justify-between">
        <Link
          to="/minside"
          id="btn-back-to-mypage"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Tilbake
        </Link>

        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
          <Users className="w-3 h-3 text-slate-500" />
          {group?.name || "Gruppe"}
        </span>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Main Task Card */}
      <article className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-5">
        {/* Status Indicator */}
        <div>
          {isAssignedToMe ? (
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600">
              Din oppgave
            </span>
          ) : isAskedOfMe ? (
            <div className="space-y-1">
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700">
                Forespørsel til deg
              </span>
              <p className="text-xs text-slate-500 font-medium">
                Du er spurt om å ta denne oppgaven. Svar nederst på siden.
              </p>
            </div>
          ) : needsSubstitute ? (
            <div className="space-y-1">
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-50 text-red-600">
                Trenger vikar
              </span>
              <p className="text-xs text-red-600 font-medium">
                Noen må ta denne – ledig fordi noen meldte forfall.
              </p>
            </div>
          ) : freeSlots > 0 ? (
            <div className="space-y-1">
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                Ledig oppgave
              </span>
              <p className="text-xs text-slate-500 font-medium">
                {othersNames
                  ? `Oppgaven trenger ${freeSlots} til, sammen med ${othersNames}.`
                  : "Denne oppgaven er ledig og venter på en frivillig fra gruppen."}
              </p>
            </div>
          ) : (
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
              Tildelt: {othersNames || "Annen person"}
            </span>
          )}
        </div>

        {/* Title & Gathering */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-snug">
            {task.title}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            {gathering?.title}
          </p>
        </div>

        {/* Time and Place Info Box */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-800">{formattedDate}</span>
          </div>

          {gathering?.location && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{gathering.location}</span>
            </div>
          )}
        </div>

        {/* Instruction / Description for the role */}
        <div className="space-y-1.5">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Instruks for rollen
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 whitespace-pre-line">
            {instruction || "Ingen instruks oppgitt for denne oppgaven ennå."}
          </p>
        </div>

        {/* A meeting leader's own task: the programme of the gathering can be changed from its run sheet */}
        {gathering && task && programEditorAssignment(gathering, tasks, assignments, volunteerRoles, currentUser.id)?.taskId === task.id && (
          <Link
            to={`/samling/${gathering.id}`}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden />
            Se og endre programmet
          </Link>
        )}

        {/* Action Button Section */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          {canClaim && (
            <button
              type="button"
              id="btn-claim-task"
              onClick={handleClaim}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Ta denne oppgaven
            </button>
          )}

          {isAskedOfMe && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-accept-request"
                onClick={() => handleAnswer(true)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-200 transition-all cursor-pointer"
              >
                Ja, jeg kan
              </button>
              <button
                type="button"
                id="btn-decline-request"
                onClick={() => handleAnswer(false)}
                className="py-3 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Kan ikke
              </button>
            </div>
          )}

          {canReportAbsence && (
            <div className="space-y-2">
              {!isConfirmingAbsence ? (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    id="btn-report-absence"
                    onClick={handleAbsenceClick}
                    className="w-full py-2.5 border border-red-200 hover:bg-red-50 active:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Meld forfall
                  </button>
                  <p className="text-[10px] text-center text-slate-400">
                    Oppgaven gjøres umiddelbart ledig for andre i gruppen din.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-red-50/80 rounded-xl border border-red-200 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  <p className="text-xs font-semibold text-red-800 text-center">
                    Er du sikker på at du vil melde forfall?
                  </p>
                  <p className="text-[11px] text-slate-600 text-center">
                    Oppgaven blir umiddelbart lagt ut som ledig for gruppen.
                  </p>
                  <button
                    type="button"
                    id="btn-confirm-absence"
                    onClick={handleConfirmAbsence}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Bekreft forfall
                  </button>
                  <button
                    type="button"
                    id="btn-cancel-absence"
                    onClick={() => setIsConfirmingAbsence(false)}
                    className="w-full py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors text-center block cursor-pointer"
                  >
                    Avbryt
                  </button>
                </div>
              )}
            </div>
          )}

          {!canClaim && !canReportAbsence && !isAskedOfMe && (
            <div className="p-3 bg-slate-50 rounded-xl text-center text-xs font-medium text-slate-500 border border-slate-100">
              {othersNames ? `Tildelt ${othersNames}.` : "Ingen handlinger tilgjengelig."}
            </div>
          )}
        </div>
      </article>
    </div>
  );
};
