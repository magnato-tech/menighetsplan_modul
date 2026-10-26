import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

// Moves rows in a list by pointer (mouse or finger) or by keyboard. Pointer events are used instead of
// HTML5 drag, which does not work on touch screens. The handle must have `touch-none`, so the page can
// still scroll everywhere else.

/** Each movable row carries its place in the list in this attribute, so the hook can find the rows. */
export const REORDER_ROW_ATTR = "data-reorder-index";

export interface PointerReorderHandleProps {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  "data-reorder-handle": number;
}

interface Options {
  /** The element that holds the rows. */
  containerRef: RefObject<HTMLElement | null>;
  /** How many rows can be moved. */
  count: number;
  /** Called once when a move is done: from the old place to the new one. */
  onMove: (from: number, to: number) => void;
}

interface DragState {
  from: number;
  over: number;
  pointerId: number;
}

/**
 * The place a dragged row would land on: the last row whose upper half the pointer has passed. Above
 * the first row it is the first row. Rows are found by their REORDER_ROW_ATTR.
 */
function placeAt(container: HTMLElement, clientY: number): number | null {
  const rows = Array.from(container.querySelectorAll<HTMLElement>(`[${REORDER_ROW_ATTR}]`));
  if (rows.length === 0) return null;
  let place = Number(rows[0].getAttribute(REORDER_ROW_ATTR));
  for (const row of rows) {
    const box = row.getBoundingClientRect();
    if (clientY >= box.top + box.height / 2) place = Number(row.getAttribute(REORDER_ROW_ATTR));
  }
  return place;
}

export function usePointerReorder({ containerRef, count, onMove }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Refs hold the latest values for the event handlers, which may run before a render
  const dragRef = useRef<DragState | null>(null);
  // After a keyboard move the focus follows the post to its new place
  const focusAfterMove = useRef<number | null>(null);

  // Runs after every render, so the focus lands once the list shows the moved post in its new place
  useEffect(() => {
    const target = focusAfterMove.current;
    if (target === null) return;
    const handle = containerRef.current?.querySelector<HTMLElement>(`[data-reorder-handle="${target}"]`);
    if (handle) {
      handle.focus();
      focusAfterMove.current = null;
    }
  });

  const finish = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const handlePropsFor = (index: number): PointerReorderHandleProps => ({
    "data-reorder-handle": index,
    onPointerDown: (event) => {
      // Only the main button of a mouse starts a drag. Touch and pen always count as main.
      if (event.button !== 0) return;
      event.preventDefault();
      // Keep receiving the pointer's moves even when it leaves the handle
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const next = { from: index, over: index, pointerId: event.pointerId };
      dragRef.current = next;
      setDrag(next);
    },
    onPointerMove: (event) => {
      const current = dragRef.current;
      const container = containerRef.current;
      if (!current || current.pointerId !== event.pointerId || !container) return;
      const over = placeAt(container, event.clientY);
      if (over === null || over === current.over) return;
      const next = { ...current, over };
      dragRef.current = next;
      setDrag(next);
    },
    onPointerUp: (event) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      finish();
      if (current.over !== current.from) onMove(current.from, current.over);
    },
    onPointerCancel: finish,
    onKeyDown: (event) => {
      // Alt with an arrow key moves one step, the same as the arrows on the handle
      if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
      event.preventDefault();
      const target = index + (event.key === "ArrowUp" ? -1 : 1);
      if (target < 0 || target >= count) return;
      focusAfterMove.current = target;
      onMove(index, target);
    },
  });

  return {
    /** The row being dragged by pointer, or null. */
    dragFrom: drag?.from ?? null,
    /** The place the dragged row would land on, or null. */
    dragOver: drag ? drag.over : null,
    handlePropsFor,
  };
}
