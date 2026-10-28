import React, { useState } from "react";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import type { RunSheetRow } from "../../utils/runSheet";
import type { RosterRow } from "../../utils/staffingRoster";

const STORAGE_KEY = "menighetsplan_bemanning_program";

/** Whether the panel was left open. Open when nothing is stored, or when storage is blocked. */
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "folded";
  } catch {
    return true;
  }
}

function rememberOpen(open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "open" : "folded");
  } catch {
    // Storage is blocked: the panel still folds, it just does not remember it
  }
}

interface ProgramSidePanelProps {
  /** The programme rows, the same ones «Program» shows. */
  rows: RunSheetRow[];
  /** The roles the reader may open. A programme item with one of them is a button; the rest only show names. */
  roster: RosterRow[];
  /** The role picked from the panel, marked in the list. */
  highlightTaskId: string | null;
  onPickTask: (taskId: string) => void;
  /** Switches to the Program tab. */
  onShowProgram: () => void;
}

interface PanelLine {
  /** The role and the names of those who have said yes. */
  text: string;
  /** What is still open, e.g. "2 ledige". Shown in red with a warning sign, so it is not only the colour. */
  open?: string;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The second line of a programme item with a role: the role, the names of those who have said yes,
 * and what is still open. Only names are shown for a role the reader may not open.
 */
function lineOf(row: RunSheetRow, rosterRow: RosterRow | undefined): PanelLine | null {
  const role = row.roleTitle ?? row.task?.title ?? "";
  const names = row.assignedPersons
    .filter((p) => p.response === "confirmed")
    .map((p) => p.person?.name || p.assignment.personName || "Ukjent person");
  const head = [role, ...(names.length > 0 ? [names.join(", ")] : [])].filter(Boolean).join(" · ");
  if (!rosterRow) return head ? { text: head } : null;
  if (rosterRow.state === "avlyst") return { text: [head, "Avlyst"].filter(Boolean).join(" · ") };
  if (rosterRow.free > 0) {
    const open = plural(rosterRow.free, "ledig", "ledige");
    return { text: head, open: rosterRow.state === "forfall" ? `forfall, ${open}` : open };
  }
  return { text: names.length > 0 ? head : [head, "Venter på svar"].filter(Boolean).join(" · ") };
}

/**
 * «Program» beside «Bemanning» on a large screen: every programme item with its time, and under it
 * the role with the names of those who have said yes, or what is still open. A role the reader may
 * open is a button that picks it in the staffing. Folded, it is a narrow strip.
 */
export const ProgramSidePanel: React.FC<ProgramSidePanelProps> = ({
  rows,
  roster,
  highlightTaskId,
  onPickTask,
  onShowProgram,
}) => {
  const [open, setOpen] = useState(readOpen);
  const rosterByTask = new Map(roster.map((row) => [row.task.id, row]));

  const setFolded = (next: boolean) => {
    setOpen(next);
    rememberOpen(next);
  };

  if (!open) {
    return (
      <div className="hidden xl:block print:hidden w-[44px] shrink-0 xl:sticky xl:top-4 xl:self-start">
        <button
          type="button"
          aria-label="Vis programmet"
          onClick={() => setFolded(true)}
          className="w-[44px] min-h-40 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <span className="[writing-mode:vertical-rl]">Program</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Programmet"
      className="hidden xl:block print:hidden w-[340px] shrink-0 xl:sticky xl:top-4 xl:self-start bg-white rounded-xl border border-slate-200 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Program</h2>
        <button
          type="button"
          aria-label="Fold sammen programmet"
          onClick={() => setFolded(false)}
          className="inline-flex items-center gap-1 min-h-9 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
          Fold sammen
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-xs text-slate-500">Arrangementet har ikke noe program ennå.</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {rows.map((row) => {
            const taskId = row.task?.id;
            const rosterRow = taskId ? rosterByTask.get(taskId) : undefined;
            const picked = Boolean(taskId) && taskId === highlightTaskId;
            const line = lineOf(row, rosterRow);
            const content = (
              <>
                <span className="shrink-0 w-12 pt-0.5 text-xs font-semibold tabular-nums text-slate-700">{row.time || "–"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 leading-snug">{row.title}</span>
                  {line && (
                    <span className="mt-0.5 block text-xs text-slate-600">
                      {line.text}
                      {line.open && (
                        <>
                          {line.text && " · "}
                          <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                            {line.open}
                          </span>
                        </>
                      )}
                    </span>
                  )}
                </span>
              </>
            );

            if (rosterRow && taskId) {
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onPickTask(taskId)}
                    aria-current={picked ? "true" : undefined}
                    className={`w-full flex items-start gap-3 px-4 py-2.5 text-left cursor-pointer hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 ${
                      picked ? "bg-indigo-50" : ""
                    }`}
                  >
                    {content}
                  </button>
                </li>
              );
            }
            return (
              <li key={row.id} className="flex items-start gap-3 px-4 py-2.5">
                {content}
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-4 py-3 border-t border-slate-200 text-[11px] text-slate-500">
        Programmet endres under Program.{" "}
        <button type="button" onClick={onShowProgram} className="font-semibold text-indigo-700 hover:underline cursor-pointer">
          Gå til Program
        </button>
      </p>
    </aside>
  );
};
