// The focus point of a picture: the place that must stay in view when the picture is cut to fit a hero
// or a card, as in Squarespace. Stored as "x% y%", from the top left corner; the middle when not chosen.

export interface FocusPoint {
  x: number;
  y: number;
}

export const FOCUS_MIDDLE: FocusPoint = { x: 50, y: 50 };

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** The point stored, or null when none is, or what is stored is not a point. */
export function parseFocusPoint(value: string | undefined | null): FocusPoint | null {
  const match = value?.trim().match(/^(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return x <= 100 && y <= 100 ? { x: clamp(x), y: clamp(y) } : null;
}

export function formatFocusPoint(point: FocusPoint): string {
  return `${clamp(point.x)}% ${clamp(point.y)}%`;
}

/** The point pressed in a picture shown in a box, from where the press landed. */
export function focusPointFromPress(clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }): FocusPoint {
  return {
    x: clamp(((clientX - box.left) / Math.max(1, box.width)) * 100),
    y: clamp(((clientY - box.top) / Math.max(1, box.height)) * 100),
  };
}

/** The CSS object-position for a picture, or undefined to keep the middle, as before. */
export function objectPositionOf(value: string | undefined | null): string | undefined {
  const point = parseFocusPoint(value);
  return point && (point.x !== 50 || point.y !== 50) ? formatFocusPoint(point) : undefined;
}
