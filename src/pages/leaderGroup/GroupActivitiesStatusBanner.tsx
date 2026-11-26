import React from "react";

interface GroupActivitiesStatusBannerProps {
  totalGroupUrgentTasks: number;
  lackingCount: number;
  waitingCount: number;
  hasAnyTasks: boolean;
  isAdmin: boolean;
  onShowUrgent: () => void;
  onShowNotCovered: () => void;
}

// The one-line status at the top of GroupActivities
export const GroupActivitiesStatusBanner: React.FC<GroupActivitiesStatusBannerProps> = ({
  totalGroupUrgentTasks,
  lackingCount,
  waitingCount,
  hasAnyTasks,
  isAdmin,
  onShowUrgent,
  onShowNotCovered,
}) => {
  return totalGroupUrgentTasks > 0 ? (
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
        onClick={onShowUrgent}
        className="text-[11px] font-bold text-red-700 hover:text-red-900 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
      >
        Filtrer forfall →
      </button>
    </div>
  ) : lackingCount > 0 || waitingCount > 0 ? (
    <div id="group-status-not-covered" className="px-3.5 py-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-2 shadow-2xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
        <span className="text-xs font-bold text-amber-900">
          {lackingCount > 0
            ? `${lackingCount} ${lackingCount === 1 ? "aktivitet mangler folk" : "aktiviteter mangler folk"}`
            : `Venter på svar på ${waitingCount} ${waitingCount === 1 ? "aktivitet" : "aktiviteter"}`}
        </span>
      </div>
      <button
        type="button"
        id="btn-group-filter-not-covered"
        onClick={onShowNotCovered}
        className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
      >
        Vis dem →
      </button>
    </div>
  ) : !hasAnyTasks ? (
    <div id="group-status-no-tasks" className="px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs space-y-0.5">
      <p className="text-xs font-semibold text-slate-800">Gruppen har ingen oppgaver ennå.</p>
      <p className="text-[11px] text-slate-500">Oppgaver kommer hit når en rolle er knyttet til gruppen.</p>
      {isAdmin && <p className="text-[11px] text-slate-500">Det gjøres i Admin → Roller → Team.</p>}
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
  );
};
