import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatNorwegianDateTime, monthKeyOf, monthOptionsOf } from "../../utils/dates";
import { LeaderGroupDetail } from "./leaderGroupDetail";
import {
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UserPlus,
  LayoutGrid,
  Table2,
} from "lucide-react";

interface GroupActivitiesProps {
  detail: LeaderGroupDetail;
  showToast: (text: string) => void;
}

export const GroupActivities: React.FC<GroupActivitiesProps> = ({ detail, showToast }) => {
  const { hasLeaderAccess, members, groupGatherings, assignTaskToPerson } = detail;
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "red" | "yellow" | "green">("all");
  const [viewMode, setViewMode] = useState<"kort" | "tabell">("kort");
  const [expandedGatheringId, setExpandedGatheringId] = useState<string | null>(null);
  const [quickAssignTaskId, setQuickAssignTaskId] = useState<string | null>(null);

  // The months the group has activities in
  const monthOptions = useMemo(
    () => [
      { id: "all", label: "Alle måneder" },
      ...monthOptionsOf(groupGatherings.map((item) => item.gathering.startsAt)),
    ],
    [groupGatherings]
  );

  // Filtered gatherings for this group
  const filteredGroupGatherings = useMemo(() => {
    return groupGatherings.filter((item) => {
      if (selectedMonth !== "all" && monthKeyOf(item.gathering.startsAt) !== selectedMonth) {
        return false;
      }
      if (selectedStatusFilter !== "all") {
        if (item.staffing.color !== selectedStatusFilter) return false;
      }
      return true;
    });
  }, [groupGatherings, selectedMonth, selectedStatusFilter]);

  // Flattened table rows for fast tabular overview across all semester activities
  const tableRows = useMemo(() => {
    const rows: {
      rowId: string;
      gatheringId: string;
      gatheringTitle: string;
      gatheringType: "arrangement" | "gruppesamling";
      startsAt: string;
      location?: string;
      taskId: string;
      taskTitle: string;
      neededCount: number;
      confirmedCount: number;
      assignedPersonName?: string;
      assignedPersonId?: string;
      statusLabel: string;
      statusType: "confirmed" | "pending" | "withdrawn" | "declined" | "vacant";
    }[] = [];

    filteredGroupGatherings.forEach((item) => {
      const { gathering, taskItems } = item;
      const gType = gathering.type === "arrangement" || !gathering.type ? "arrangement" : "gruppesamling";

      taskItems.forEach(({ task, assignedPersons, confirmedCount, neededCount }) => {
        if (assignedPersons.length > 0) {
          assignedPersons.forEach(({ assignment, person, statusLabel, response }) => {
            rows.push({
              rowId: `${gathering.id}-${task.id}-${assignment.id}`,
              gatheringId: gathering.id,
              gatheringTitle: gathering.title,
              gatheringType: gType,
              startsAt: gathering.startsAt,
              location: gathering.location,
              taskId: task.id,
              taskTitle: task.title,
              neededCount,
              confirmedCount,
              assignedPersonName: person?.name,
              assignedPersonId: person?.id,
              statusLabel,
              statusType: response,
            });
          });
        } else {
          // Vacant task without assignment
          rows.push({
            rowId: `${gathering.id}-${task.id}-vacant`,
            gatheringId: gathering.id,
            gatheringTitle: gathering.title,
            gatheringType: gType,
            startsAt: gathering.startsAt,
            location: gathering.location,
            taskId: task.id,
            taskTitle: task.title,
            neededCount,
            confirmedCount: 0,
            assignedPersonName: undefined,
            assignedPersonId: undefined,
            statusLabel: "Ubesatt",
            statusType: "vacant",
          });
        }
      });
    });

    return rows;
  }, [filteredGroupGatherings]);

  // Total urgent tasks in this group
  const totalGroupUrgentTasks = useMemo(() => {
    return groupGatherings.reduce((acc, item) => {
      const urgentInGathering = item.tasks.filter((t) => t.status === "vacant").length;
      return acc + urgentInGathering;
    }, 0);
  }, [groupGatherings]);

  return (
    <section
      id="section-group-gatherings"
      className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span>Planlagte aktiviteter</span>
        </h2>
        <span className="text-[11px] text-slate-400 font-medium">
          {filteredGroupGatherings.length} av {groupGatherings.length} aktiviteter
        </span>
      </div>

      {/* Compact Group Status Indicator */}
      {totalGroupUrgentTasks > 0 ? (
        <div className="px-3.5 py-2.5 bg-red-50 rounded-xl border border-red-200 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-red-900">
              {totalGroupUrgentTasks} {totalGroupUrgentTasks === 1 ? "oppgave trenger oppfølging / vikar" : "oppgaver trenger oppfølging / vikar"}
            </span>
          </div>
          <button
            type="button"
            id="btn-group-filter-urgent-shortcut"
            onClick={() => {
              setSelectedStatusFilter("red");
              setSelectedMonth("all");
            }}
            className="text-[11px] font-bold text-red-700 hover:text-red-900 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            Filtrer forfall →
          </button>
        </div>
      ) : (
        <div className="px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-emerald-900">
              Alle oppgaver er dekket for planlagte aktiviteter
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
            🟢 I rute
          </span>
        </div>
      )}

      {/* 1 Kompakt Kontrollrad: Filter + Visningsvalg */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 pb-1.5 border-b border-slate-100">
        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Periode */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Periode:</span>
            <select
              id="select-group-filter-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              {monthOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
            <span className="text-slate-400 font-bold text-[10px] uppercase">Status:</span>
            <select
              id="select-group-filter-status"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">Alle statuser</option>
              <option value="red">🔴 Forfall / Trenger vikar</option>
              <option value="yellow">🟡 Mangler frivillig</option>
              <option value="green">🟢 Fullt dekket</option>
            </select>
          </div>
        </div>

        {/* Visningsvalg: Kort / Tabell */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl self-start sm:self-auto border border-slate-200/60">
          <button
            type="button"
            id="btn-switch-view-kort"
            onClick={() => setViewMode("kort")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === "kort"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
            title="Kortvisning"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
            <span>Kort</span>
          </button>
          <button
            type="button"
            id="btn-switch-view-tabell"
            onClick={() => setViewMode("tabell")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === "tabell"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
            title="Tabellvisning"
          >
            <Table2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Tabell</span>
          </button>
        </div>
      </div>

      {/* VISNING 1: KORTVISNING */}
      {viewMode === "kort" && (
        <div>
          {filteredGroupGatherings.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              Ingen aktiviteter matcher valgt måned eller filter for denne gruppen.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {filteredGroupGatherings.map((item) => {
                const { gathering, tasks: gTasks, taskItems, totalNeeded, totalConfirmed, staffing } = item;
                const isArrangement = gathering.type === "arrangement" || !gathering.type;
                const isExpanded = expandedGatheringId === gathering.id;

                return (
                  <div
                    key={gathering.id}
                    id={`group-gathering-card-${gathering.id}`}
                    className={`p-3.5 bg-slate-50 rounded-2xl border transition-all space-y-3 ${
                      staffing.color === "red"
                        ? "border-red-200 ring-1 ring-red-100 bg-red-50/20"
                        : staffing.color === "yellow"
                        ? "border-amber-200 bg-amber-50/20"
                        : "border-slate-200"
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs font-bold text-slate-900">{gathering.title}</h3>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              isArrangement
                                ? "bg-blue-50 text-blue-700 border border-blue-100"
                                : "bg-purple-50 text-purple-700 border border-purple-100"
                            }`}
                          >
                            {isArrangement ? "Arrangement" : "Gruppesamling"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formatNorwegianDateTime(gathering.startsAt)}
                          </span>
                          {gathering.location && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {gathering.location}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Staffing Pill */}
                      <div className="text-right space-y-0.5">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            staffing.color === "red"
                              ? "bg-red-100 text-red-700"
                              : staffing.color === "yellow"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {staffing.color === "green" ? "🟢 Dekket" : staffing.badgeText}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {totalConfirmed} av {totalNeeded} dekket
                        </p>
                      </div>
                    </div>

                    {/* Tasks Summary / Expander toggle */}
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <button
                        type="button"
                        id={`btn-toggle-tasks-${gathering.id}`}
                        onClick={() => setExpandedGatheringId(isExpanded ? null : gathering.id)}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        <span>{gTasks.length} {gTasks.length === 1 ? "oppgave" : "oppgaver"}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                      </button>

                      <button
                        type="button"
                        id={`btn-open-gathering-detail-${gathering.id}`}
                        onClick={() => navigate(`/leder/samling/${gathering.id}`)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Åpne aktivitetsdetalj</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Expanded Task list with assigned persons & direct action */}
                    {isExpanded && (
                      <div className="pt-2 space-y-2 border-t border-slate-200/60 animate-in fade-in duration-150">
                        {taskItems.map(({ task, assignedPersons, confirmedCount, neededCount, isFullyCovered: taskCovered, hasForfall: taskForfall }) => (
                          <div
                            key={task.id}
                            id={`group-gathering-task-${task.id}`}
                            className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div>
                                <span className="font-bold text-slate-800">{task.title}</span>
                                <span className="text-[11px] text-slate-500 ml-2">
                                  ({confirmedCount}/{neededCount} dekket)
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  taskForfall
                                    ? "bg-red-100 text-red-700"
                                    : taskCovered
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {taskForfall ? "Forfall" : taskCovered ? "Dekket" : "Mangler"}
                              </span>
                            </div>

                            {/* Assigned persons tags */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {assignedPersons.length > 0 ? (
                                assignedPersons.map(({ assignment, person, response }) => (
                                  <span
                                    key={assignment.id}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                                      response === "confirmed"
                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold"
                                        : response === "withdrawn"
                                        ? "bg-red-50 text-red-800 border border-red-300"
                                        : "bg-amber-50 text-amber-800 border border-amber-300"
                                    }`}
                                  >
                                    <span>{person?.name || "Ukjent"}</span>
                                    {response !== "confirmed" && (
                                      <span className="text-[9px] font-bold opacity-90">
                                        ({response === "withdrawn" ? "Forfall" : response === "declined" ? "Avslått" : "Forespurt"})
                                      </span>
                                    )}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Ingen tildelt</span>
                              )}
                            </div>

                            {/* Quick Assign action button */}
                            {!taskCovered && hasLeaderAccess && (
                              <div className="pt-1 flex items-center justify-between">
                                <button
                                  type="button"
                                  id={`btn-quick-assign-${task.id}`}
                                  onClick={() => setQuickAssignTaskId(quickAssignTaskId === task.id ? null : task.id)}
                                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Tildel fra gruppen</span>
                                </button>
                              </div>
                            )}

                            {/* Quick Assign Dropdown Drawer */}
                            {quickAssignTaskId === task.id && (
                              <div className="p-2.5 bg-slate-900 text-white rounded-xl space-y-2 mt-1">
                                <span className="text-[10px] uppercase font-bold text-amber-400 block">
                                  Velg deltaker for direkte tildeling:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                  {members.map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      id={`btn-do-quick-assign-${task.id}-${m.id}`}
                                      onClick={() => {
                                        // A direct assignment: the leader has already agreed it with the person
                                        const res = assignTaskToPerson(task.id, m.id, "confirmed");
                                        if (res.success) {
                                          setQuickAssignTaskId(null);
                                          showToast(`Oppgaven ble direkte tildelt ${m.name}!`);
                                        } else {
                                          showToast(res.error || "Kunne ikke tildele oppgaven.");
                                        }
                                      }}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-left rounded-lg text-xs font-medium text-slate-200 flex items-center justify-between cursor-pointer"
                                    >
                                      <span>{m.name}</span>
                                      <UserPlus className="w-3 h-3 text-emerald-400" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISNING 2: TABELLVISNING (Kompakt Excel-stil oversikt over oppgaver) */}
      {viewMode === "tabell" && (
        <div className="pt-1">
          {tableRows.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
              Ingen oppgaver matcher valgt filter for denne gruppen.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Dato & Tid</th>
                    <th className="py-2.5 px-3">Aktivitet</th>
                    <th className="py-2.5 px-3">Rolle / Oppgave</th>
                    <th className="py-2.5 px-3">Person</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Handling</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {tableRows.map((row) => {
                    const isVacant = row.statusType === "vacant";
                    const isForfall = row.statusType === "withdrawn" || row.statusType === "declined";
                    const isConfirmed = row.statusType === "confirmed";

                    return (
                      <tr
                        key={row.rowId}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isForfall ? "bg-red-50/30" : isVacant ? "bg-amber-50/20" : ""
                        }`}
                      >
                        {/* Dato & Tid */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">
                          {formatNorwegianDateTime(row.startsAt)}
                        </td>

                        {/* Aktivitet */}
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 block">{row.gatheringTitle}</span>
                          {row.location && (
                            <span className="text-[10px] text-slate-400 block">{row.location}</span>
                          )}
                        </td>

                        {/* Rolle / Oppgave */}
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800">{row.taskTitle}</span>
                        </td>

                        {/* Person */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {row.assignedPersonName ? (
                            <span className="font-bold text-slate-900">{row.assignedPersonName}</span>
                          ) : (
                            <span className="text-amber-700 font-bold italic text-[11px]">Ubesatt</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isConfirmed
                                ? "bg-emerald-100 text-emerald-800"
                                : isForfall
                                ? "bg-red-100 text-red-800"
                                : isVacant
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isConfirmed
                                  ? "bg-emerald-600"
                                  : isForfall
                                  ? "bg-red-600"
                                  : isVacant
                                  ? "bg-amber-600"
                                  : "bg-blue-600"
                              }`}
                            />
                            <span>{row.statusLabel}</span>
                          </span>
                        </td>

                        {/* Handling */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {(isVacant || isForfall) && hasLeaderAccess && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedGatheringId(row.gatheringId);
                                  setQuickAssignTaskId(row.taskId);
                                  setViewMode("kort");
                                }}
                                className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors cursor-pointer"
                              >
                                Tildel vikar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigate(`/leder/samling/${row.gatheringId}`)}
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer ml-1"
                            >
                              <span>Åpne</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
