import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { monthKeyOf, monthOptionsOf } from "../../utils/dates";
import { LeaderGroupDetail } from "./leaderGroupDetail";
import { tallyAnswers } from "../../utils/staffing";
import { otherLoadsSameDay } from "../../utils/sameDayLoads";
import { parseIsoToDateAndTime } from "../../utils/dates";
import { useConfirm } from "../../components/ConfirmProvider";
import { Calendar } from "lucide-react";
import { GroupActivitiesStatusBanner } from "./GroupActivitiesStatusBanner";
import { GroupActivitiesUndistributed } from "./GroupActivitiesUndistributed";
import { GroupActivitiesControls } from "./GroupActivitiesControls";
import { GroupActivitiesCards } from "./GroupActivitiesCards";
import { GroupActivitiesTable, type GroupTableRow } from "./GroupActivitiesTable";
import type { GroupActivityActions, StatusFilter, ViewMode } from "./groupActivitiesTypes";

interface GroupActivitiesProps {
  detail: LeaderGroupDetail;
  showToast: (text: string) => void;
}

export const GroupActivities: React.FC<GroupActivitiesProps> = ({ detail, showToast }) => {
  const { hasLeaderAccess, members, group, groupGatherings, dayLoads, assignTaskToPerson, undistributedTasks, takeTask, giveTaskBack, canGiveBack, volunteerRoles } = detail;
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("kort");
  // Several gatherings can be open at once in the cards view
  const [openGatheringIds, setOpenGatheringIds] = useState<ReadonlySet<string>>(() => new Set());
  const [quickAssignTaskId, setQuickAssignTaskId] = useState<string | null>(null);
  // Only the gatherings with a double booking, when the conflict counter is pressed
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);

  // The other live tasks a person has on the same day, for the warnings
  const sameDayOf = (personId: string, startsAt: string, taskId: string) => otherLoadsSameDay(dayLoads, personId, startsAt, taskId);

  // Text for those tasks, e.g. "Lyd kl. 11:00", with the group name when it is another group
  const sameDayTexts = (loads: ReturnType<typeof sameDayOf>) =>
    loads.map((load) => {
      const time = parseIsoToDateAndTime(load.startsAt).time;
      const otherGroup = load.groupId !== group?.id && load.groupName ? ` – ${load.groupName}` : "";
      return `${load.taskTitle} kl. ${time}${otherGroup}`;
    });

  const toggleGathering = (gatheringId: string) => {
    setOpenGatheringIds((prev) => {
      const next = new Set(prev);
      if (next.has(gatheringId)) next.delete(gatheringId);
      else next.add(gatheringId);
      return next;
    });
  };

  const toggleQuickAssign = (taskId: string) => setQuickAssignTaskId(quickAssignTaskId === taskId ? null : taskId);

  // Give the task to a member: at once (confirmed), or as a request they answer (pending)
  const quickAssign = (taskId: string, personId: string, personName: string, response: "confirmed" | "pending") => {
    const res = assignTaskToPerson(taskId, personId, response);
    if (res.success) {
      setQuickAssignTaskId(null);
      showToast(response === "confirmed" ? `Oppgaven ble direkte tildelt ${personName}!` : `${personName} er forespurt.`);
    } else {
      showToast(res.error || "Kunne ikke tildele oppgaven.");
    }
  };

  // The months the group has activities in
  const monthOptions = useMemo(
    () => [
      { id: "all", label: "Alle måneder" },
      ...monthOptionsOf(groupGatherings.map((item) => item.gathering.startsAt)),
    ],
    [groupGatherings]
  );

  // Per gathering, the people with a double booking on it: one pair per person and gathering
  const conflictPairs = useMemo(() => {
    const pairs = new Map<string, Set<string>>();
    for (const item of groupGatherings) {
      for (const { task, assignedPersons } of item.taskItems) {
        for (const { person, response } of assignedPersons) {
          if (!person || (response !== "pending" && response !== "confirmed")) continue;
          if (otherLoadsSameDay(dayLoads, person.id, item.gathering.startsAt, task.id).length === 0) continue;
          const people = pairs.get(item.gathering.id) ?? new Set<string>();
          people.add(person.id);
          pairs.set(item.gathering.id, people);
        }
      }
    }
    return pairs;
  }, [groupGatherings, dayLoads]);
  const conflictCount = Array.from(conflictPairs.values()).reduce((acc, people) => acc + people.size, 0);
  // Ignored when no conflict is left, so the list never stays empty by a stale filter
  const conflictsOnly = showConflictsOnly && conflictCount > 0;

  // Filtered gatherings for this group
  const filteredGroupGatherings = useMemo(() => {
    return groupGatherings.filter((item) => {
      if (selectedMonth !== "all" && monthKeyOf(item.gathering.startsAt) !== selectedMonth) {
        return false;
      }
      if (selectedStatusFilter !== "all") {
        if (item.staffing.color !== selectedStatusFilter) return false;
      }
      if (conflictsOnly && !conflictPairs.has(item.gathering.id)) return false;
      return true;
    });
  }, [groupGatherings, selectedMonth, selectedStatusFilter, conflictsOnly, conflictPairs]);

  // Flattened table rows for fast tabular overview across all semester activities
  const tableRows = useMemo(() => {
    const rows: GroupTableRow[] = [];

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

  // What the people asked have answered, over all the activities of the group
  const answers = useMemo(
    () => tallyAnswers(groupGatherings.flatMap((item) => item.taskItems.flatMap((taskItem) => taskItem.assignedPersons.map(({ assignment }) => assignment)))),
    [groupGatherings]
  );

  // Activities that lack people, and those where everybody is asked and not all have answered
  const lackingCount = groupGatherings.filter((item) => item.staffing.color === "red").length;
  const waitingCount = groupGatherings.filter((item) => item.staffing.color === "yellow").length;
  // No activity has a task at all: «all covered» would then say nothing about the group
  const hasAnyTasks = groupGatherings.some((item) => item.tasks.length > 0);

  // Open every gathering in the filtered list that has tasks
  const expandAllGatherings = () => {
    const ids = filteredGroupGatherings.filter((item) => item.tasks.length > 0).map((item) => item.gathering.id);
    setOpenGatheringIds((prev) => new Set([...Array.from(prev), ...ids]));
  };

  // From the table: open the gathering in the cards view with the task's quick-assign drawer
  const assignSubstitute = (gatheringId: string, taskId: string) => {
    setOpenGatheringIds((prev) => new Set(prev).add(gatheringId));
    setQuickAssignTaskId(taskId);
    setViewMode("kort");
  };

  const openGathering = (gatheringId: string) => navigate(`/leder/samling/${gatheringId}`);

  // Everything the cards and their task rows need
  const actions: GroupActivityActions = {
    hasLeaderAccess,
    members,
    quickAssignTaskId,
    onToggleQuickAssign: toggleQuickAssign,
    sameDayOf,
    sameDayTexts,
    quickAssign,
    canGiveBack,
    giveTaskBack,
    volunteerRoles,
    confirm,
    showToast,
  };

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
      <GroupActivitiesStatusBanner
        totalGroupUrgentTasks={totalGroupUrgentTasks}
        lackingCount={lackingCount}
        waitingCount={waitingCount}
        hasAnyTasks={hasAnyTasks}
        isAdmin={detail.isAdmin}
        onShowUrgent={() => {
          setSelectedStatusFilter("red");
          setSelectedMonth("all");
        }}
        onShowNotCovered={() => {
          setSelectedStatusFilter(lackingCount > 0 ? "red" : "yellow");
          setSelectedMonth("all");
        }}
      />

      {/* What the members have said yes to: a leader reads it here whether or not the groups are shown to the members */}
      {answers.confirmed + answers.pending + answers.declined > 0 && (
        <p id="group-answers-summary" className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">{answers.confirmed} har sagt ja</span>
          {answers.pending > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">{answers.pending} venter på svar</span>}
          {answers.declined > 0 && <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700">{answers.declined} kan ikke</span>}
        </p>
      )}

      {/* Tasks of a shared role that no team has taken yet: this group may take them */}
      {hasLeaderAccess && undistributedTasks.length > 0 && (
        <GroupActivitiesUndistributed tasks={undistributedTasks} takeTask={takeTask} showToast={showToast} />
      )}

      <GroupActivitiesControls
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        monthOptions={monthOptions}
        selectedStatusFilter={selectedStatusFilter}
        onStatusFilterChange={setSelectedStatusFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* VISNING 1: KORTVISNING */}
      {viewMode === "kort" && (
        <GroupActivitiesCards
          gatherings={filteredGroupGatherings}
          conflictCount={conflictCount}
          conflictsOnly={conflictsOnly}
          onToggleConflictsOnly={() => setShowConflictsOnly((prev) => !prev)}
          onExpandAll={expandAllGatherings}
          onCollapseAll={() => setOpenGatheringIds(new Set())}
          openGatheringIds={openGatheringIds}
          onToggleGathering={toggleGathering}
          onOpenGathering={openGathering}
          actions={actions}
        />
      )}

      {/* VISNING 2: TABELLVISNING (Kompakt Excel-stil oversikt over oppgaver) */}
      {viewMode === "tabell" && (
        <GroupActivitiesTable
          rows={tableRows}
          hasLeaderAccess={hasLeaderAccess}
          onOpenGathering={openGathering}
          onAssignSubstitute={assignSubstitute}
        />
      )}
    </section>
  );
};
