import React from "react";
import { GroupActivitiesGatheringCard } from "./GroupActivitiesGatheringCard";
import type { GroupActivityActions, GroupGathering } from "./groupActivitiesTypes";

interface GroupActivitiesCardsProps {
  gatherings: GroupGathering[];
  conflictCount: number;
  conflictsOnly: boolean;
  onToggleConflictsOnly: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  openGatheringIds: ReadonlySet<string>;
  onToggleGathering: (gatheringId: string) => void;
  onOpenGathering: (gatheringId: string) => void;
  actions: GroupActivityActions;
}

// The cards view: the toolbar above the list of gathering cards
export const GroupActivitiesCards: React.FC<GroupActivitiesCardsProps> = ({
  gatherings,
  conflictCount,
  conflictsOnly,
  onToggleConflictsOnly,
  onExpandAll,
  onCollapseAll,
  openGatheringIds,
  onToggleGathering,
  onOpenGathering,
  actions,
}) => {
  return (
    <div>
      {/* Open or close all the gatherings in the list at once */}
      <div className="flex items-center justify-end gap-1.5 pb-2">
        {conflictCount > 0 && (
          <button
            type="button"
            id="btn-group-filter-conflicts"
            onClick={onToggleConflictsOnly}
            className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-200 px-2.5 py-1 rounded-xl transition-colors cursor-pointer mr-auto"
          >
            {conflictsOnly
              ? "Vis alle"
              : `${conflictCount} ${conflictCount === 1 ? "mulig konflikt" : "mulige konflikter"}`}
          </button>
        )}
        <button
          type="button"
          id="btn-group-expand-all"
          onClick={onExpandAll}
          className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
        >
          Fold ut alle
        </button>
        <button
          type="button"
          id="btn-group-collapse-all"
          onClick={onCollapseAll}
          className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
        >
          Fold sammen alle
        </button>
      </div>

      {gatherings.length === 0 ? (
        <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
          Ingen aktiviteter matcher valgt måned eller filter for denne gruppen.
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {gatherings.map((item) => (
            <GroupActivitiesGatheringCard
              key={item.gathering.id}
              item={item}
              isExpanded={openGatheringIds.has(item.gathering.id)}
              onToggle={() => onToggleGathering(item.gathering.id)}
              onOpenDetail={() => onOpenGathering(item.gathering.id)}
              actions={actions}
            />
          ))}
        </div>
      )}
    </div>
  );
};
