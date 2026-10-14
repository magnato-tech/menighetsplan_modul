import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, FileText, MapPin, Printer, SlidersHorizontal } from "lucide-react";
import { formatNorwegianDateTime } from "../../utils/dates";
import { locationOf } from "../../utils/gatherings";
import { buildRunSheet, sharedRunSheet } from "../../utils/runSheet";
import { GatheringDetail, InstructionTarget } from "./gatheringDetail";
import { InstructionDialog } from "./InstructionDialog";

interface SharedRunSheetViewProps {
  detail: GatheringDetail;
  personId: string;
  /** To the full planning, for a leader or an administrator. */
  planningLink: string | null;
  backLink: string;
}

/**
 * «Kjøreplan»: the programme of an event and who is responsible for each item, as everyone who
 * may see the event reads it. Only those who have accepted are named; nothing can be changed here.
 */
export const SharedRunSheetView: React.FC<SharedRunSheetViewProps> = ({ detail, personId, planningLink, backLink }) => {
  const { gathering, programSchedule, tasksWithDetails, volunteerRoles } = detail;
  const [instructionFor, setInstructionFor] = useState<InstructionTarget | null>(null);

  const rows = useMemo(
    () => sharedRunSheet(buildRunSheet(programSchedule, tasksWithDetails, volunteerRoles), personId),
    [programSchedule, tasksWithDetails, volunteerRoles, personId]
  );

  if (!gathering) return null;

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-50 sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden print:bg-white print:border-none print:my-0">
      <div className="p-4 bg-white border-b border-slate-200/80 space-y-3 print:p-2 print:border-b-2 print:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            to={backLink}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tilbake til kalenderen</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {planningLink && (
              <Link
                to={planningLink}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Åpne planlegging</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Skriv ut</span>
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">{gathering.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1.5 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatNorwegianDateTime(gathering.startsAt)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {locationOf(gathering)}
            </span>
          </div>
          {gathering.cancelled && (
            <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              Avlyst
            </span>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-2.5">
        <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 px-1">
          <Clock className="w-3.5 h-3.5" />
          Kjøreplan
        </h2>

        {rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200/80">
            Programmet er ikke lagt inn ennå.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
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
                    {row.roleTitle && row.roleTitle !== row.title && (
                      <span className="text-xs text-slate-500">• {row.roleTitle}</span>
                    )}
                    {row.isMine && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Du
                      </span>
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
                      onClick={() =>
                        setInstructionFor({
                          title: row.roleTitle || row.title,
                          instruction: row.instruction || "",
                          time: row.meetAt || row.time,
                          groupName: row.groupName,
                        })
                      }
                      className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2 py-1 rounded-lg cursor-pointer print:hidden"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Instruks
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {instructionFor && (
        <InstructionDialog
          detail={detail}
          task={instructionFor}
          canAdminister={false}
          showToast={() => undefined}
          onClose={() => setInstructionFor(null)}
        />
      )}
    </div>
  );
};
