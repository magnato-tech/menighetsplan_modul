import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useLeaderGatheringDetail,
  formatNorwegianDateTime,
} from "../hooks/useAppHooks";
import { useTimedMessage } from "../hooks/useTimedMessage";
import { studioTabUrl } from "../pages/admin/studio";
import { buildRunSheet } from "../utils/runSheet";
import { locationOf } from "../utils/gatherings";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  Edit3,
  Plus,
  Printer,
} from "lucide-react";
import { RunSheetRowCard } from "./gathering/RunSheetRowCard";
import { InstructionDialog } from "./gathering/InstructionDialog";
import { AssignPersonDialog } from "./gathering/AssignPersonDialog";
import { EditTaskDialog } from "./gathering/EditTaskDialog";
import { CreateTaskDialog } from "./gathering/CreateTaskDialog";
import { EditGatheringDialog } from "./gathering/EditGatheringDialog";

interface GatheringDetailViewProps {
  gatheringId: string;
  mode?: "admin" | "leader";
}

export const GatheringDetailView: React.FC<GatheringDetailViewProps> = ({
  gatheringId,
  mode = "leader",
}) => {
  const detail = useLeaderGatheringDetail(gatheringId);
  const {
    hasAccess,
    isLeader,
    isDeputy,
    isAdmin: isUserAdmin,
    gathering,
    group,
    involvedGroups,
    tasksWithDetails,
    programSchedule,
    updateAssignmentStatus,
    removeAssignment,
  } = detail;

  const isExplicitAdminView = mode === "admin" || (isUserAdmin && mode !== "leader");
  const canAdminister = isUserAdmin || isExplicitAdminView;

  // Filter state
  const [viewFilter, setViewFilter] = useState<"all" | "needs-action" | "my-group">("all");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");

  // Modals
  const [activeInterveneTaskId, setActiveInterveneTaskId] = useState<string | null>(null);
  const [viewInstructionTask, setViewInstructionTask] = useState<{
    taskId?: string;
    title: string;
    instruction: string;
    volunteerRoleId?: string;
    time?: string;
    groupName?: string;
  } | null>(null);


  // Person status dropdown modal
  const [activePersonActionId, setActivePersonActionId] = useState<string | null>(null);

  // Admin: Edit Gathering modal
  const [isEditingGathering, setIsEditingGathering] = useState<boolean>(false);

  // Admin: Edit Task modal
  const [editingTask, setEditingTask] = useState<{
    id: string;
    title: string;
    volunteerRoleId?: string;
    groupId?: string;
    neededCount: number;
    description: string;
  } | null>(null);

  // Admin: Create Task modal
  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, showToast] = useTimedMessage<string>();

  // The programme and the tasks on one timeline, built from what is registered and nothing else
  const { volunteerRoles } = detail;

  const integratedSchedule = useMemo(
    () => buildRunSheet(programSchedule, tasksWithDetails, volunteerRoles),
    [programSchedule, tasksWithDetails, volunteerRoles]
  );

  // The groups that have tasks in the schedule, for filtering
  const groupsInSchedule = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    integratedSchedule.forEach((r) => {
      if (!r.groupId) return;
      const curr = map.get(r.groupId) || { id: r.groupId, name: r.groupName || "Gruppe", count: 0 };
      curr.count += 1;
      map.set(r.groupId, curr);
    });
    return Array.from(map.values());
  }, [integratedSchedule]);

  // Filtered rows based on view filters
  const filteredSchedule = useMemo(() => {
    return integratedSchedule.filter((row) => {
      if (selectedGroupFilter !== "all" && row.groupId !== selectedGroupFilter) {
        return false;
      }
      if (viewFilter === "my-group") {
        return row.isMyGroup;
      }
      if (viewFilter === "needs-action") {
        return !row.isFullyCovered || row.hasForfall;
      }
      return true;
    });
  }, [integratedSchedule, viewFilter, selectedGroupFilter]);

  // Staffing barometer calculations
  const totalTasks = tasksWithDetails.length;
  const vacantTasks = tasksWithDetails.filter((t) => t.task.status === "vacant" || t.hasWithdrawn);
  const coveredTasks = tasksWithDetails.filter((t) => t.isFullyCovered);
  const myGroupTasks = tasksWithDetails.filter((t) => t.isMyGroup);
  const myGroupNeedsAction = myGroupTasks.filter((t) => !t.isFullyCovered || t.hasWithdrawn);

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

  // Status changer handler
  const handleStatusChange = (assignmentId: string, newResponse: "confirmed" | "pending" | "withdrawn" | "declined", personName?: string) => {
    const res = updateAssignmentStatus(assignmentId, newResponse);
    if (res.success) {
      setActivePersonActionId(null);
      const label =
        newResponse === "confirmed"
          ? "Akseptert"
          : newResponse === "pending"
          ? "Forespurt"
          : newResponse === "withdrawn"
          ? "Forfall"
          : "Avslått";
      showToast(`Status for ${personName || "personen"} ble endret til ${label}.`);
    } else {
      showToast(res.error || "Kunne ikke oppdatere status.");
    }
  };

  // Unassign handler
  const handleRemovePerson = (assignmentId: string, personName?: string) => {
    const res = removeAssignment(assignmentId);
    if (res.success) {
      setActivePersonActionId(null);
      showToast(`${personName || "Personen"} ble fjernet fra oppgaven.`);
    } else {
      showToast(res.error || "Kunne ikke fjerne tildeling.");
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  const backLink = isExplicitAdminView
    ? studioTabUrl("planlegger-samlinger")
    : "/leder?tab=samlinger";

  const backLabel = isExplicitAdminView
    ? "Tilbake til arrangementer"
    : "Tilbake til samlingsoversikt";

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden flex flex-col print:max-w-none print:shadow-none print:my-0 print:border-none print:bg-white">
      {/* Toast feedback banner */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 text-center flex items-center justify-center gap-2 shadow-xs transition-all animate-fadeIn print:hidden">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Container */}
      <div className="p-4 bg-white border-b border-slate-200/80 space-y-3 print:border-b-2 print:border-slate-800 print:p-2">
        {/* Navigation Breadcrumb - hidden in print */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            to={backLink}
            id="btn-back-to-group-or-admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </Link>

          <div className="flex items-center gap-2">
            {canAdminister && (
              <>
                <button
                  type="button"
                  id="btn-admin-edit-gathering"
                  onClick={() => setIsEditingGathering(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Rediger tittel, dato, tid og sted"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Rediger</span>
                </button>
                <button
                  type="button"
                  id="btn-admin-add-task"
                  onClick={() => setIsCreatingTask(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ny oppgave</span>
                </button>
              </>
            )}

            <button
              type="button"
              id="btn-print-schedule"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Skriv ut eller lagre kjøreplan som PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Skriv ut</span>
            </button>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isExplicitAdminView
                  ? "bg-purple-100 text-purple-800 border-purple-200"
                  : "bg-emerald-100 text-emerald-800 border-emerald-200"
              }`}
            >
              {isExplicitAdminView ? "Admin-visning" : isDeputy ? "Nestleder" : "Gruppeleder"}
            </span>
          </div>
        </div>

        {/* Gathering Title & Metadata */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
              {gathering.type === "arrangement" ? "Gudstjeneste / Arrangement" : "Samling"}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 leading-tight">
            {gathering.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1.5 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatNorwegianDateTime(gathering.startsAt)}
            </span>
            {gathering.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {gathering.location}
              </span>
            )}
            <span className="flex items-center gap-1 text-slate-500">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {involvedGroups.length} {involvedGroups.length === 1 ? "tjenestegruppe" : "tjenestegrupper"} involvert
            </span>
          </div>
        </div>

        {/* Staffing Barometer / Status Banner */}
        <div
          id="gathering-staffing-barometer"
          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
            vacantTasks.length > 0
              ? "bg-red-50/80 border-red-200 text-red-900"
              : coveredTasks.length === totalTasks && totalTasks > 0
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
              : "bg-amber-50/80 border-amber-200 text-amber-900"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {vacantTasks.length > 0 ? (
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            ) : coveredTasks.length === totalTasks && totalTasks > 0 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="font-bold block truncate">
                {vacantTasks.length > 0
                  ? `${vacantTasks.length} ${vacantTasks.length === 1 ? "oppgave krever oppfølging (forfall/vikar)" : "oppgaver krever oppfølging"}`
                  : coveredTasks.length === totalTasks && totalTasks > 0
                  ? "Fullt bemannet arrangement"
                  : "Mangler bemanning på noen oppgaver"}
              </span>
              <span className="text-[11px] opacity-80 block truncate">
                Total dekning: {coveredTasks.length} av {totalTasks} oppgaver dekket
                {!isExplicitAdminView && group && ` • Min gruppe (${group.name}): ${myGroupTasks.length - myGroupNeedsAction.length}/${myGroupTasks.length}`}
              </span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1 font-bold text-xs">
            <span
              className={`px-2 py-0.5 rounded-full ${
                vacantTasks.length > 0
                  ? "bg-red-200/80 text-red-900"
                  : coveredTasks.length === totalTasks && totalTasks > 0
                  ? "bg-emerald-200/80 text-emerald-900"
                  : "bg-amber-200/80 text-amber-900"
              }`}
            >
              {coveredTasks.length}/{totalTasks}
            </span>
          </div>
        </div>

        {/* View Filter Controls - hidden in print */}
        <div className="space-y-2 pt-1 print:hidden">
          {/* Main quick tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              id="tab-filter-all"
              onClick={() => setViewFilter("all")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                viewFilter === "all"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hele programmet ({integratedSchedule.length})
            </button>

            <button
              type="button"
              id="tab-filter-needs-action"
              onClick={() => setViewFilter("needs-action")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                viewFilter === "needs-action"
                  ? "bg-white text-red-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Forfall / Mangler</span>
              {vacantTasks.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center">
                  {vacantTasks.length}
                </span>
              )}
            </button>

            {!isExplicitAdminView && group && (
              <button
                type="button"
                id="tab-filter-my-group"
                onClick={() => setViewFilter("my-group")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                  viewFilter === "my-group"
                    ? "bg-white text-emerald-800 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Min gruppe ({myGroupTasks.length})
              </button>
            )}
          </div>

          {/* Group Filter Dropdown / Pills for Admin & Multigroup view */}
          {groupsInSchedule.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] scrollbar-none">
              <span className="text-slate-400 font-bold uppercase text-[10px] pr-1 flex items-center gap-0.5">
                <SlidersHorizontal className="w-3 h-3" />
                Gruppe:
              </span>
              <button
                type="button"
                onClick={() => setSelectedGroupFilter("all")}
                className={`px-2 py-0.5 rounded-full border font-medium transition-colors shrink-0 cursor-pointer ${
                  selectedGroupFilter === "all"
                    ? "bg-slate-800 text-white border-slate-800 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Alle ({integratedSchedule.length})
              </button>
              {groupsInSchedule.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGroupFilter(g.id)}
                  className={`px-2 py-0.5 rounded-full border font-medium transition-colors shrink-0 cursor-pointer ${
                    selectedGroupFilter === g.id
                      ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {g.name} ({g.count})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule & Bemanning Content */}
      <div className="p-3 sm:p-4 space-y-2 flex-1 print:p-0 print:space-y-1">
        <div className="flex items-center justify-between px-1 print:hidden">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Kjøreplan & «Hvem gjør hva»</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            Viser {filteredSchedule.length} av {integratedSchedule.length} punkter
          </span>
        </div>

        {/* Print-only Header */}
        <div className="hidden print:block mb-4 border-b border-slate-300 pb-2">
          <h1 className="text-xl font-bold text-black">{gathering.title}</h1>
          <p className="text-xs text-slate-600">
            {formatNorwegianDateTime(gathering.startsAt)} • {locationOf(gathering)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Offisiell kjøreplan og bemanningsliste – Menighetsplan
          </p>
        </div>

        {filteredSchedule.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
            <Info className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">Ingen programpunkter matcher filteret</p>
            <p className="text-[11px] text-slate-400">
              Prøv å endre filteret til «Hele programmet» eller velg en annen gruppe.
            </p>
            <button
              type="button"
              onClick={() => {
                setViewFilter("all");
                setSelectedGroupFilter("all");
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer mt-1"
            >
              Nullstill alle filtre
            </button>
          </div>
        ) : (
          <div className="space-y-2 print:space-y-1">
            {filteredSchedule.map((row) => (
              <RunSheetRowCard
                key={row.id}
                row={row}
                canIntervene={canAdminister || (row.isMyGroup && isLeader)}
                canAdminister={canAdminister}
                openMenuAssignmentId={activePersonActionId}
                onToggleMenu={setActivePersonActionId}
                onStatusChange={handleStatusChange}
                onRemovePerson={handleRemovePerson}
                onShowInstruction={(shown) =>
                  setViewInstructionTask({
                    taskId: shown.task?.id,
                    title: shown.roleTitle ? `${shown.title} – ${shown.roleTitle}` : shown.title,
                    instruction: shown.instruction || "",
                    volunteerRoleId: shown.task?.volunteerRoleId,
                    time: shown.time,
                    groupName: shown.groupName,
                  })
                }
                onAssign={setActiveInterveneTaskId}
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
        )}
      </div>

      {viewInstructionTask && (
        <InstructionDialog
          detail={detail}
          task={viewInstructionTask}
          canAdminister={canAdminister}
          showToast={showToast}
          onClose={() => setViewInstructionTask(null)}
        />
      )}

      {activeInterveneTaskId && (
        <AssignPersonDialog
          detail={detail}
          taskId={activeInterveneTaskId}
          canAdminister={canAdminister}
          showToast={showToast}
          onClose={() => setActiveInterveneTaskId(null)}
        />
      )}

      {editingTask && (
        <EditTaskDialog
          detail={detail}
          task={editingTask}
          showToast={showToast}
          onClose={() => setEditingTask(null)}
        />
      )}

      <CreateTaskDialog
        detail={detail}
        gathering={gathering}
        open={isCreatingTask}
        showToast={showToast}
        onClose={() => setIsCreatingTask(false)}
      />

      {isEditingGathering && (
        <EditGatheringDialog
          detail={detail}
          gathering={gathering}
          showToast={showToast}
          onClose={() => setIsEditingGathering(false)}
        />
      )}
    </div>
  );
};
