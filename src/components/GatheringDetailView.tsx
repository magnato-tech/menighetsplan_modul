import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  useLeaderGatheringDetail,
  formatNorwegianDateTime,
} from "../hooks/useAppHooks";
import { useTimedMessage } from "../hooks/useTimedMessage";
import { studioTabUrl } from "../pages/admin/studio";
import { buildRunSheet, programIndexOfRunSheetRow } from "../utils/runSheet";
import { withComputedTimes } from "../utils/programTiming";
import type { ProgramItem } from "../types";
import { buildStaffingRoster, needsAction, summarizeStaffingRoster } from "../utils/staffingRoster";
import { locationOf } from "../utils/gatherings";
import { teamsOfTasks } from "../utils/gatheringMail";
import {
  ArrowLeft,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit3,
  Plus,
  Printer,
  LayoutTemplate,
  Globe,
  ListOrdered,
  Users,
  Mail,
  MessageSquare,
} from "lucide-react";
import { ProgramView } from "./gathering/ProgramView";
import { ProgramUndoToast } from "./gathering/ProgramUndoToast";
import { StaffingView } from "./gathering/StaffingView";
import { ProgramSidePanel } from "./gathering/ProgramSidePanel";
import { GatheringDateNav } from "./gathering/GatheringDateNav";
import { GatheringRoleHolders } from "./gathering/GatheringRoleHolders";
import { GatheringNotes } from "./gathering/GatheringNotes";
import { GatheringMailDialog } from "./gathering/GatheringMailDialog";
import { GatheringTeamMessageDialog } from "./gathering/GatheringTeamMessageDialog";
import { gatheringSequence, type SequenceItem } from "../utils/gatheringSequence";
import { GatheringActions, type GatheringAction } from "./gathering/GatheringActions";
import { CreateTaskDialog } from "./gathering/CreateTaskDialog";
import { ApplyTemplateDialog } from "./gathering/ApplyTemplateDialog";
import { GatheringFormDialog } from "./gathering/GatheringFormDialog";
import { useGatheringTemplates } from "../hooks/useGatheringTemplates";
import { useFirebase } from "../context/FirebaseDataContext";
import { useLevel } from "../hooks/useLevel";
import { formOfGathering, gatheringUpdatesOf } from "../utils/gatheringForm";
import { hasPlanner } from "../utils/level";
import { saveGatheringTemplate } from "../services/gatheringTemplates";
import { templateFromGathering } from "../utils/gatheringTemplates";

interface GatheringDetailViewProps {
  gatheringId: string;
  mode?: "admin" | "leader";
}

type View = "program" | "bemanning";

/** The view named in the address (`?vis=program`). Bemanning is where the planning is done, and opens first. */
function viewOf(value: string | null): View {
  return value === "program" ? "program" : "bemanning";
}

/**
 * The planning of one gathering, for an admin and for the leaders of the groups on it. Two views:
 * «Program», the programme with who is set up, and «Bemanning», every role once with its people,
 * where the staffing is changed. A leader sees the whole programme, and the staffing of their own groups.
 */
export const GatheringDetailView: React.FC<GatheringDetailViewProps> = ({
  gatheringId,
  mode = "leader",
}) => {
  const detail = useLeaderGatheringDetail(gatheringId);
  const { watchGatheringAssignments } = useFirebase();
  useEffect(() => watchGatheringAssignments(gatheringId), [gatheringId, watchGatheringAssignments]);
  const {
    hasAccess,
    isDeputy,
    isAdmin: isUserAdmin,
    gathering,
    tasksWithDetails,
    programSchedule,
    updateGathering,
    volunteerRoles,
    openableGatherings,
    allPersons,
    gatheringTasks,
  } = detail;

  // The form the event is changed in is the one it was made in (see utils/gatheringForm.ts)
  const { groups: allGroups, gatherings: allGatherings, assignments } = useFirebase();
  const withPlanner = hasPlanner(useLevel());

  const isExplicitAdminView = mode === "admin" || (isUserAdmin && mode !== "leader");
  const [searchParams, setSearchParams] = useSearchParams();
  const fromRunSheet = searchParams.get("fra") === "kjoreplan";
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();
  const canAdminister = isUserAdmin || isExplicitAdminView;
  // A group leader changes the staffing of the groups they lead. The rest reads as it does for everyone.
  const limitToMyGroups = !canAdminister;

  const [isEditingGathering, setIsEditingGathering] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [isMailing, setIsMailing] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const { templates: gatheringTemplates } = useGatheringTemplates();
  const [toastMessage, showToast] = useTimedMessage<string>();
  // The programme as it was before the last change, so «Angre» can put it back
  const [programUndo, setProgramUndo] = useState<{ id: number; previous: ProgramItem[]; what: string } | null>(null);

  // The programme and the tasks, built from what is registered and nothing else
  const runSheet = useMemo(
    () => buildRunSheet(programSchedule, tasksWithDetails, volunteerRoles),
    [programSchedule, tasksWithDetails, volunteerRoles]
  );
  const programRows = useMemo(() => runSheet.filter((row) => programIndexOfRunSheetRow(row.id) !== null), [runSheet]);
  const roster = useMemo(() => {
    const rows = buildStaffingRoster(programSchedule, tasksWithDetails, volunteerRoles);
    return limitToMyGroups ? rows.filter((row) => row.isMyGroup) : rows;
  }, [programSchedule, tasksWithDetails, volunteerRoles, limitToMyGroups]);
  const summary = summarizeStaffingRoster(roster);
  // The teams of this gathering, each once: the groups of its tasks
  const teams = useMemo(() => teamsOfTasks(gatheringTasks, allGroups), [gatheringTasks, allGroups]);
  const toOrder = roster.filter((row) => needsAction(row.state)).length;

  // The gatherings the arrows step through: all for an admin, the ones the leader can open otherwise
  const sequence = useMemo(() => {
    if (!detail.gathering) return [];
    const groupById = new Map(allGroups.map((g) => [g.id, g]));
    const items: SequenceItem[] = (canAdminister ? allGatherings : openableGatherings).map((g) => ({
      gathering: g,
      group: groupById.get(g.groupId),
    }));
    const current: SequenceItem = { gathering: detail.gathering, group: groupById.get(detail.gathering.groupId) };
    return gatheringSequence(current, items);
  }, [detail.gathering, canAdminister, allGatherings, openableGatherings, allGroups]);

  // Moves to another gathering in the same address shape, keeping the tab (program or bemanning)
  const openGathering = (gatheringId: string) => {
    const base = pathname.startsWith("/admin/") ? "/admin/samling/" : "/leder/samling/";
    const params = new URLSearchParams();
    params.set("vis", view);
    navigate({ pathname: `${base}${gatheringId}`, search: `?${params.toString()}` });
  };

  // Opened from a row of the run sheet everyone sees (#schedule-row-…): that row's role in Bemanning
  const focusTaskId = useMemo(() => {
    const rowId = hash.replace(/^#schedule-row-/, "");
    if (!rowId || rowId === hash) return null;
    const index = programIndexOfRunSheetRow(rowId);
    if (index !== null) return programSchedule[index]?.taskId ?? null;
    return rowId.startsWith("task-") ? rowId.slice("task-".length) : null;
  }, [hash, programSchedule]);
  const view: View = searchParams.get("vis") ? viewOf(searchParams.get("vis")) : "bemanning";
  const showView = (next: View) => {
    const params = new URLSearchParams(searchParams);
    params.set("vis", next);
    setSearchParams(params, { replace: true });
  };

  // A role picked from the programme panel: it is marked and scrolled to, also when picked again
  const [picked, setPicked] = useState<{ taskId: string; nonce: number } | null>(null);
  const pickTask = (taskId: string) => setPicked((prev) => ({ taskId, nonce: (prev?.nonce ?? 0) + 1 }));

  // Access check
  if (!gathering || !hasAccess) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden">
        <div className="p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-800">
              Arrangementet krever leder- eller admin-tilgang
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              {!gathering
                ? "Arrangementet ble ikke funnet."
                : `Du har ikke tilgang til dette arrangementet med din nåværende rolle.`}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to={canAdminister ? studioTabUrl("planlegger-samlinger") : "/leder?tab=samlinger"}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Tilbake til {canAdminister ? "Samlinger" : "Samlingsoversikt"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Saves the programme with its times worked out again. The change can be taken back until the notice hides.
  const saveProgram = (items: ProgramItem[], what: string) => {
    const res = updateGathering(gathering.id, {
      programSchedule: withComputedTimes(items, gathering.startsAt, gathering.endsAt),
    });
    if (res.success) setProgramUndo({ id: Date.now(), previous: programSchedule, what });
    else showToast(res.error || "Programmet kunne ikke lagres.");
  };

  const undoProgram = () => {
    if (!programUndo) return;
    const res = updateGathering(gathering.id, {
      programSchedule: withComputedTimes(programUndo.previous, gathering.startsAt, gathering.endsAt),
    });
    setProgramUndo(null);
    if (!res.success) showToast(res.error || "Angringen kunne ikke lagres.");
  };

  // A template made of this event, as it stands: its programme, its tasks and how it is presented
  const handleMakeTemplate = async () => {
    const template = templateFromGathering(
      gathering,
      tasksWithDetails.map((item) => item.task),
      volunteerRoles
    );
    if (await saveGatheringTemplate(template)) showToast(`Malen «${template.name}» er laget. Du finner den under Maler i menyen.`);
  };

  // Opened with «Åpne planlegging» from the run sheet everyone sees: back goes there
  const backLink = fromRunSheet
    ? `/samling/${gathering.id}`
    : isExplicitAdminView
    ? studioTabUrl("planlegger-samlinger")
    : "/leder?tab=samlinger";

  const backLabel = fromRunSheet ? "Kjøreplanen" : isExplicitAdminView ? "Kalender" : "Samlinger";

  const actions: GatheringAction[] = [
    ...(canAdminister
      ? [
          { key: "edit", label: "Rediger", icon: Edit3, onClick: () => setIsEditingGathering(true) },
          { key: "task", label: "Ny programpost", icon: Plus, onClick: () => setIsCreatingTask(true), primary: true },
          ...(withPlanner
            ? [{ key: "template", label: "Hent fra mal", icon: LayoutTemplate, onClick: () => setIsApplyingTemplate(true), primary: true }]
            : []),
          ...(isExplicitAdminView ? [{ key: "web", label: "Vis på nettsiden", icon: Globe, to: studioTabUrl("cms-overstyringer") }] : []),
          { key: "make-template", label: "Lag mal", icon: LayoutTemplate, onClick: handleMakeTemplate },
        ]
      : []),
    { key: "print", label: "Skriv ut", icon: Printer, onClick: () => window.print() },
  ];

  const tabClass = (active: boolean) =>
    `flex-1 py-2 px-2 rounded-lg text-center text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
      active ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900 font-semibold"
    }`;

  return (
    <div
      data-ui="light"
      className={`w-full max-w-none bg-slate-50 overflow-x-hidden flex flex-col print:shadow-none print:my-0 print:border-none print:bg-white ${
        isExplicitAdminView
          ? "min-h-0 rounded-2xl border border-slate-200/80 shadow-sm"
          : "min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80"
      }`}
    >
      {/* Toast feedback banner */}
      {toastMessage && (
        <div
          role="status"
          className="sticky top-[var(--demo-strip,0px)] z-30 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 text-center flex items-center justify-center gap-2 shadow-xs animate-fadeIn print:hidden"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="p-4 bg-white border-b border-slate-200/80 space-y-3 print:border-b-2 print:border-slate-800 print:p-2">
        <div className="flex items-center justify-between gap-2 print:hidden">
          <Link
            to={backLink}
            id="btn-back-to-group-or-admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </Link>

          <div className="flex items-center gap-2">
            {canAdminister && (
              <div className="flex items-center gap-1 print:hidden">
                <button
                  type="button"
                  aria-label="E-post til alle som er med"
                  title="E-post til alle som er med"
                  onClick={() => setIsMailing(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <Mail className="w-4 h-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Melding til teamene"
                  title="Melding til teamene"
                  onClick={() => setIsMessaging(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" aria-hidden />
                </button>
              </div>
            )}
            <span
              className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isExplicitAdminView
                  ? "bg-purple-100 text-purple-800 border-purple-200"
                  : "bg-emerald-100 text-emerald-800 border-emerald-200"
              }`}
            >
              {isExplicitAdminView ? "Admin" : isDeputy ? "Nestleder" : "Gruppeleder"}
            </span>
            <GatheringActions actions={actions} />
          </div>
        </div>

        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">{gathering.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1 font-medium">
            <GatheringDateNav gathering={gathering} sequence={sequence} onOpen={openGathering} />
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {locationOf(gathering)}
            </span>
          </div>
          {gathering.theme && <p className="text-xs text-slate-500 mt-1">Tema: {gathering.theme}</p>}
          <GatheringRoleHolders gatheringId={gathering.id} tasks={gatheringTasks} assignments={assignments} roles={volunteerRoles} persons={allPersons} />
        </div>

        <GatheringNotes gatheringId={gathering.id} canEdit={isUserAdmin} authorName={detail.currentUser.name} />

        {/* The staffing in one line. Not for an event without tasks: nobody is lacking where nobody is asked for */}
        {summary.total > 0 && (
          <button
            type="button"
            id="gathering-staffing-barometer"
            onClick={() => showView("bemanning")}
            className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-700 text-left cursor-pointer print:hidden"
          >
            {toOrder === 0 && summary.venter === 0 ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden />
                Fullt bemannet
              </span>
            ) : (
              <>
                {summary.forfall > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-700" aria-hidden />
                    {summary.forfall} forfall
                  </span>
                )}
                {summary.ubesatt > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-700" aria-hidden />
                    {summary.ubesatt} ubesatt
                  </span>
                )}
                {summary.venter > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-amber-500" aria-hidden />
                    {summary.venter} venter på svar
                  </span>
                )}
              </>
            )}
            <span className="ml-auto font-semibold">
              {limitToMyGroups ? "Dine grupper: " : ""}
              {summary.dekket} av {summary.total} dekket
            </span>
          </button>
        )}

        <div role="tablist" aria-label="Visning" className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl print:hidden">
          <button
            type="button"
            role="tab"
            id="tab-program"
            aria-selected={view === "program"}
            onClick={() => showView("program")}
            className={tabClass(view === "program")}
          >
            <ListOrdered className="w-4 h-4" aria-hidden />
            Program
          </button>
          <button
            type="button"
            role="tab"
            id="tab-bemanning"
            aria-selected={view === "bemanning"}
            onClick={() => showView("bemanning")}
            className={tabClass(view === "bemanning")}
          >
            <Users className="w-4 h-4" aria-hidden />
            Bemanning
            {toOrder > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center" aria-label={`${toOrder} må ordnes`}>
                {toOrder}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-2 flex-1 print:p-0">
        {/* On paper the header above stays (title, time, place, Tema, leaders and notes); this names the view printed */}
        <p className="hidden print:block text-sm font-bold text-black border-b border-slate-300 pb-1 mb-2">
          {view === "program" ? "Program" : "Bemanning"}
        </p>

        {/* Shown when a meeting leader last changed the programme from Min side */}
        {view === "program" && gathering.programEditedBy && gathering.programEditedAt && (
          <p className="px-1 pb-2 text-[11px] text-slate-400 print:hidden">
            Sist endret av {gathering.programEditedBy.personName}, {formatNorwegianDateTime(gathering.programEditedAt)}
          </p>
        )}

        {view === "program" ? (
          <ProgramView
            rows={programRows}
            items={programSchedule}
            startsAt={gathering.startsAt}
            endsAt={gathering.endsAt}
            canAdminister={canAdminister}
            permissions={{
              reorder: canAdminister,
              edit: canAdminister,
              deleteItem: () => true,
            }}
            onChangeProgram={saveProgram}
            focusRowId={null}
            emptyHint={
              canAdminister && withPlanner
                ? "Bruk «Hent fra mal» for et ferdig program. Oppgavene står under Bemanning."
                : "Oppgavene står under Bemanning."
            }
          />
        ) : (
          // From xl the programme sits beside the staffing; below xl the panel is not shown
          <div className="xl:flex xl:items-start xl:gap-4">
            <ProgramSidePanel
              rows={programRows}
              roster={roster}
              highlightTaskId={picked?.taskId ?? null}
              onPickTask={pickTask}
              onShowProgram={() => showView("program")}
            />
            <div className="min-w-0 flex-1">
              <StaffingView
                detail={detail}
                rows={roster}
                canAdminister={canAdminister}
                focusTaskId={picked?.taskId ?? focusTaskId}
                focusNonce={picked?.nonce ?? 0}
                highlightTaskId={picked?.taskId ?? null}
                showToast={showToast}
              />
            </div>
          </div>
        )}
      </div>

      {programUndo && (
        <ProgramUndoToast
          key={programUndo.id}
          what={programUndo.what}
          onUndo={undoProgram}
          onHide={() => setProgramUndo(null)}
        />
      )}

      <CreateTaskDialog
        detail={detail}
        gathering={gathering}
        open={isCreatingTask}
        showToast={showToast}
        onClose={() => setIsCreatingTask(false)}
      />

      <ApplyTemplateDialog
        detail={detail}
        gathering={gathering}
        templates={gatheringTemplates}
        withPlanner={withPlanner}
        open={isApplyingTemplate}
        showToast={showToast}
        onClose={() => setIsApplyingTemplate(false)}
      />

      {isMailing && canAdminister && (
        <GatheringMailDialog
          gathering={gathering}
          tasks={gatheringTasks}
          assignments={assignments}
          persons={allPersons}
          onSent={(count) => {
            setIsMailing(false);
            showToast(count === 1 ? "E-posten er sendt til 1 person." : `E-posten er sendt til ${count} personer.`);
          }}
          onClose={() => setIsMailing(false)}
        />
      )}

      {isMessaging && canAdminister && (
        <GatheringTeamMessageDialog
          teams={teams}
          onSent={(count) => {
            setIsMessaging(false);
            showToast(`Sendt til ${count} team`);
          }}
          onClose={() => setIsMessaging(false)}
        />
      )}

      {isEditingGathering && (
        <GatheringFormDialog
          isNew={false}
          initial={formOfGathering(gathering)}
          groups={allGroups}
          showGroup={withPlanner}
          onSave={(values) => {
            const result = detail.updateGathering(gathering.id, gatheringUpdatesOf(values, withPlanner));
            if (result.success) showToast("Arrangementet ble oppdatert!");
            return result;
          }}
          onClose={() => setIsEditingGathering(false)}
        />
      )}
    </div>
  );
};
