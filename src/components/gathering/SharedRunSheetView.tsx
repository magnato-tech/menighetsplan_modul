import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, Printer, SlidersHorizontal } from "lucide-react";
import { formatNorwegianDateTime } from "../../utils/dates";
import { locationOf } from "../../utils/gatherings";
import { buildRunSheet, sharedRunSheet } from "../../utils/runSheet";
import { GatheringDetail, InstructionTarget } from "./gatheringDetail";
import { InstructionDialog } from "./InstructionDialog";
import { SharedRunSheetRowCard } from "./SharedRunSheetRowCard";

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
            <SharedRunSheetRowCard
              key={row.id}
              row={row}
              onShowInstruction={(shown) =>
                setInstructionFor({
                  title: shown.roleTitle || shown.title,
                  instruction: shown.instruction || "",
                  time: shown.meetAt || shown.time,
                  groupName: shown.groupName,
                })
              }
            />
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
