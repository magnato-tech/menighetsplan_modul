import React from "react";
import { FileText } from "lucide-react";
import type { SharedRunSheetRow } from "../../utils/runSheet";

interface SharedRunSheetRowCardProps {
  row: SharedRunSheetRow;
  onShowInstruction: (row: SharedRunSheetRow) => void;
}

/**
 * One row of the run sheet as everyone reads it: time, title and those who have accepted.
 * Used in «Kjøreplan», and in a leader's planning for the rows of groups they do not lead.
 */
export const SharedRunSheetRowCard: React.FC<SharedRunSheetRowCardProps> = ({ row, onShowInstruction }) => (
  <div
    className={`bg-white rounded-2xl border p-3 space-y-2 break-inside-avoid ${
      row.isMine ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200/80"
    }`}
  >
    <div className="flex items-start gap-3">
      <span className="shrink-0 font-mono text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 min-w-[3.25rem] text-center">
        {row.time || "–"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-bold text-slate-900">{row.title}</span>
          {row.roleTitle && row.roleTitle !== row.title && <span className="text-xs text-slate-500">• {row.roleTitle}</span>}
          {row.isMine && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Du</span>
          )}
        </div>
        {row.description && <p className="text-xs text-slate-500 mt-0.5">{row.description}</p>}
      </div>
    </div>

    {(row.names.length > 0 || row.isMine) && (
      <div className="flex flex-wrap items-center gap-1.5 pl-[3.95rem]">
        {row.names.length > 0 && (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ansvarlig:</span>
            {row.names.map((name, index) => (
              <span
                key={`${name}-${index}`}
                className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5"
              >
                {name}
              </span>
            ))}
          </>
        )}
        {row.isMine && (
          <button
            type="button"
            onClick={() => onShowInstruction(row)}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2 py-1 rounded-lg cursor-pointer print:hidden"
          >
            <FileText className="w-3.5 h-3.5" />
            Instruks
          </button>
        )}
      </div>
    )}
  </div>
);
