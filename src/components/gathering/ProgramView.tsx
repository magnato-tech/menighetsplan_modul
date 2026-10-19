import React, { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { RunSheetRow } from "../../utils/runSheet";
import { programIndexOfRunSheetRow } from "../../utils/runSheet";
import { ProgramRowCard } from "./ProgramRowCard";

interface ProgramViewProps {
  /** The programme items of the run sheet, in order. */
  rows: RunSheetRow[];
  /** Whether the reader sees the whole staffing on every item (an admin) or only on their own groups. */
  canAdminister: boolean;
  /** An admin may move programme items by dragging them. */
  onReorder?: (from: number, to: number) => void;
  /** A row the view was opened for, to scroll to. */
  focusRowId?: string | null;
  emptyHint: string;
}

/** «Program»: the programme as it runs, with who is set up. Read only, apart from moving items. */
export const ProgramView: React.FC<ProgramViewProps> = ({ rows, canAdminister, onReorder, focusRowId, emptyHint }) => {
  const [dragged, setDragged] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!focusRowId || scrolledTo.current === focusRowId) return;
    const target = document.getElementById(`schedule-row-${focusRowId}`);
    if (!target) return;
    scrolledTo.current = focusRowId;
    target.scrollIntoView({ block: "center" });
  }, [focusRowId, rows]);

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
        <Info className="w-8 h-8 text-slate-300 mx-auto" aria-hidden />
        <p className="text-xs font-bold text-slate-700">Arrangementet har ikke noe program ennå</p>
        <p className="text-[11px] text-slate-400">{emptyHint}</p>
      </div>
    );
  }

  const reset = () => {
    setDragged(null);
    setDragOver(null);
  };

  return (
    <div className="space-y-2 print:space-y-0">
      {onReorder && rows.length > 1 && (
        <p className="px-1 text-[11px] text-slate-400 print:hidden">Dra i håndtaket for å flytte en programpost.</p>
      )}
      {rows.map((row) => {
        const index = programIndexOfRunSheetRow(row.id);
        const reorder = Boolean(onReorder) && index !== null;
        return (
          <ProgramRowCard
            key={row.id}
            row={row}
            staffing={canAdminister || row.isMyGroup ? "full" : "names"}
            canReorder={reorder}
            isDragging={reorder && dragged === index}
            isDragOver={reorder && dragOver === index}
            onDragStart={(event) => {
              setDragged(index);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
            }}
            onDragEnd={reset}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (dragOver !== index) setDragOver(index);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragged !== null && index !== null && dragged !== index) onReorder?.(dragged, index);
              reset();
            }}
          />
        );
      })}
    </div>
  );
};
