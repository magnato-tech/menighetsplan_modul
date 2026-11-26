import React from "react";
import { formatNorwegianDateTime } from "../../utils/dates";
import { ChevronRight } from "lucide-react";

// One row in the table view: a task, or one person on it
export type GroupTableRow = {
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
};

interface GroupActivitiesTableProps {
  rows: GroupTableRow[];
  hasLeaderAccess: boolean;
  onOpenGathering: (gatheringId: string) => void;
  onAssignSubstitute: (gatheringId: string, taskId: string) => void;
}

// The table view (Excel-style overview of the tasks)
export const GroupActivitiesTable: React.FC<GroupActivitiesTableProps> = ({ rows, hasLeaderAccess, onOpenGathering, onAssignSubstitute }) => {
  return (
    <div className="pt-1">
      {rows.length === 0 ? (
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
              {rows.map((row) => {
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
                            onClick={() => onAssignSubstitute(row.gatheringId, row.taskId)}
                            className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            Tildel vikar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenGathering(row.gatheringId)}
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
  );
};
