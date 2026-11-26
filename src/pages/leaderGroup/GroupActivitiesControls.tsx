import React from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import type { StatusFilter, ViewMode } from "./groupActivitiesTypes";

interface GroupActivitiesControlsProps {
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  monthOptions: { id: string; label: string }[];
  selectedStatusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
}

// The control row: period and status filters, and the cards/table switch
export const GroupActivitiesControls: React.FC<GroupActivitiesControlsProps> = ({
  selectedMonth,
  onMonthChange,
  monthOptions,
  selectedStatusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 pb-1.5 border-b border-slate-100">
      {/* Filter Dropdowns */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Periode */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
          <span className="text-slate-400 font-bold text-[10px] uppercase">Periode:</span>
          <select
            id="select-group-filter-month"
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
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
            onChange={(e) => onStatusFilterChange(e.target.value as any)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
          >
            <option value="all">Alle statuser</option>
            {/* The same words as on the cards: red is an activity that lacks people, also after someone has pulled out. Yellow is one where everybody is asked and not all have answered (see getStaffingStatus). */}
            <option value="red">🔴 Mangler / Forfall</option>
            <option value="yellow">🟡 Venter på svar</option>
            <option value="green">🟢 Fullt dekket</option>
          </select>
        </div>
      </div>

      {/* Visningsvalg: Kort / Tabell */}
      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl self-start sm:self-auto border border-slate-200/60">
        <button
          type="button"
          id="btn-switch-view-kort"
          onClick={() => onViewModeChange("kort")}
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
          onClick={() => onViewModeChange("tabell")}
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
  );
};
