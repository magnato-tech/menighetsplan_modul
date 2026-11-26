import React from "react";
import { ChevronDown, ChevronRight, ChevronUp, Clock, MapPin } from "lucide-react";
import { formatNorwegianDateTime } from "../../utils/dates";
import { GroupActivitiesTaskRow } from "./GroupActivitiesTaskRow";
import type { GroupActivityActions, GroupGathering } from "./groupActivitiesTypes";

interface GroupActivitiesGatheringCardProps {
  item: GroupGathering;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  actions: GroupActivityActions;
}

// One gathering card in the cards view, with its task list when expanded
export const GroupActivitiesGatheringCard: React.FC<GroupActivitiesGatheringCardProps> = ({ item, isExpanded, onToggle, onOpenDetail, actions }) => {
  const { gathering, tasks: gTasks, taskItems, totalNeeded, totalConfirmed, staffing } = item;
  const isArrangement = gathering.type === "arrangement" || !gathering.type;

  return (
    <div
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
          onClick={onToggle}
          className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
        >
          <span>{gTasks.length} {gTasks.length === 1 ? "oppgave" : "oppgaver"}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </button>

        <button
          type="button"
          id={`btn-open-gathering-detail-${gathering.id}`}
          onClick={onOpenDetail}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
        >
          <span>Åpne aktivitetsdetalj</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded Task list with assigned persons & direct action */}
      {isExpanded && (
        <div className="pt-2 space-y-2 border-t border-slate-200/60 animate-in fade-in duration-150">
          {taskItems.map((taskItem) => (
            <GroupActivitiesTaskRow key={taskItem.task.id} taskItem={taskItem} gathering={gathering} actions={actions} />
          ))}
        </div>
      )}
    </div>
  );
};
