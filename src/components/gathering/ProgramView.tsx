import React, { useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { ProgramItem } from "../../types";
import type { RunSheetRow } from "../../utils/runSheet";
import { programIndexOfRunSheetRow } from "../../utils/runSheet";
import { durationsOf, moveProgramItem, programStartMinutes, withComputedTimes } from "../../utils/programTiming";
import { usePointerReorder } from "../../hooks/usePointerReorder";
import { ProgramRowCard } from "./ProgramRowCard";
import { ProgramPostDialog } from "./ProgramPostDialog";

export interface ProgramPermissions {
  /** May move posts. */
  reorder: boolean;
  /** May change a post's title, text and length. */
  edit: boolean;
  /** May delete this post. */
  deleteItem: (item: ProgramItem) => boolean;
}

interface ProgramViewProps {
  /** The programme's rows, in order. Only programme posts, not tasks without a post. */
  rows: RunSheetRow[];
  /** The programme itself, as saved on the gathering. */
  items: ProgramItem[];
  /** The gathering's start and end: the clock times are worked out from these. */
  startsAt: string;
  endsAt?: string;
  /** Whether the reader sees the whole staffing on every item (an admin) or only on their own groups. */
  canAdminister: boolean;
  permissions: ProgramPermissions;
  /** Saves the whole programme. `what` is a short Norwegian note of the change, for the undo message. */
  onChangeProgram: (items: ProgramItem[], what: string) => void;
  /** A row the view was opened for, to scroll to. */
  focusRowId?: string | null;
  emptyHint: string;
}

/**
 * «Program»: the programme as it runs, with who is set up. Who may move or change posts is decided by
 * `permissions`; the one who sees the view only reads the names and the gaps.
 */
export const ProgramView: React.FC<ProgramViewProps> = ({
  rows,
  items,
  startsAt,
  endsAt,
  canAdminister,
  permissions,
  onChangeProgram,
  focusRowId,
  emptyHint,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const durations = useMemo(() => durationsOf(items, endsAt), [items, endsAt]);

  const handleMove = (from: number, to: number) => {
    if (from === to) return;
    const title = items[from]?.title ?? "";
    onChangeProgram(moveProgramItem(items, from, to, startsAt, endsAt), `Flyttet «${title}»`);
  };

  const { dragFrom, dragOver, handlePropsFor } = usePointerReorder({
    containerRef: listRef,
    count: items.length,
    onMove: handleMove,
  });

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

  // Every post gets its length written out before a change, so the times of the rest stay right
  const withDurations = (): ProgramItem[] => items.map((item, index) => ({ ...item, durationMinutes: durations[index] }));

  const saveEdit = (edited: ProgramItem) => {
    if (editingIndex === null) return;
    const next = withDurations();
    next[editingIndex] = edited;
    setEditingIndex(null);
    onChangeProgram(withComputedTimes(next, startsAt, endsAt), `Endret «${edited.title}»`);
  };

  const deleteEdited = () => {
    if (editingIndex === null) return;
    const title = items[editingIndex]?.title ?? "";
    const next = withDurations().filter((_, index) => index !== editingIndex);
    setEditingIndex(null);
    // The programme keeps its start, also when its first post is the one removed
    onChangeProgram(withComputedTimes(next, startsAt, endsAt, programStartMinutes(items, startsAt)), `Slettet «${title}»`);
  };

  const editedItem = editingIndex !== null ? items[editingIndex] : undefined;

  return (
    <div className="space-y-2 print:space-y-0" ref={listRef}>
      {permissions.reorder && rows.length > 1 && (
        // On a phone the six dots speak for themselves; the hint (with the keys) is for a big screen
        <p className="hidden sm:block px-1 text-[11px] text-slate-400 print:hidden">
          Dra i håndtaket for å flytte en programpost. Med tastatur: Alt og piltast opp eller ned.
        </p>
      )}
      {rows.map((row) => {
        const index = programIndexOfRunSheetRow(row.id);
        const movable = permissions.reorder && index !== null;
        return (
          <ProgramRowCard
            key={row.id}
            row={row}
            index={index}
            // The one who leads the gathering sees who is asked and what is unstaffed, like the planning does
            staffing={canAdminister || permissions.edit || row.isMyGroup ? "full" : "names"}
            reorder={movable && index !== null ? handlePropsFor(index) : undefined}
            durationMinutes={index !== null ? durations[index] : undefined}
            onEdit={permissions.edit && index !== null ? () => setEditingIndex(index) : undefined}
            isDragging={movable && dragFrom === index}
            isDragOver={movable && dragOver === index && dragFrom !== index}
          />
        );
      })}

      {editedItem && editingIndex !== null && (
        <ProgramPostDialog
          item={{ ...editedItem, durationMinutes: durations[editingIndex] }}
          canDelete={permissions.deleteItem(editedItem)}
          onSave={saveEdit}
          onDelete={deleteEdited}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
};
