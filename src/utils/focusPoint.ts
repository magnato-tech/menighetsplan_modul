// The focus point of a picture: the place that must stay in view when the picture is cut to fit a hero
// or a card, as in Squarespace. Stored as "x% y%", from the top left corner; the middle when not chosen.
// A crop adds a zoom as a third part, "x% y% z", with z from 1 to 3. Without it the zoom is 1.
import type { CSSProperties } from "react";

export interface FocusPoint {
  x: number;
  y: number;
}

export interface Crop extends FocusPoint {
  zoom: number;
}

/** A part of a picture, as fractions of the whole picture from 0 to 1. */
export interface PictureRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const FOCUS_MIDDLE: FocusPoint = { x: 50, y: 50 };

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));
const clampZoom = (zoom: number) => Math.min(3, Math.max(1, Math.round(zoom * 10) / 10));

/** The point and zoom stored, or null when none is, or what is stored is not a crop. */
export function parseCrop(value: string | undefined | null): Crop | null {
  const match = value?.trim().match(/^(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%(?:\s+(\d{1,2}(?:\.\d+)?))?$/);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (x > 100 || y > 100) return null;
  const zoom = match[3] === undefined ? 1 : Number(match[3]);
  return { x: clamp(x), y: clamp(y), zoom: clampZoom(zoom) };
}

/** The crop as stored: "x% y%" when the zoom is 1, as before, otherwise "x% y% z". */
export function formatCrop(crop: Crop): string {
  const zoom = clampZoom(crop.zoom);
  const point = `${clamp(crop.x)}% ${clamp(crop.y)}%`;
  return zoom === 1 ? point : `${point} ${zoom.toFixed(1)}`;
}

/** The point stored, or null when none is, or what is stored is not a point. A zoom is left out. */
export function parseFocusPoint(value: string | undefined | null): FocusPoint | null {
  const crop = parseCrop(value);
  return crop ? { x: crop.x, y: crop.y } : null;
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

/**
 * The CSS for a picture in a box with object-fit cover. With object-position x% y% the picture's x% y% point
 * sits on the box's x% y% point, so scaling around that same point keeps it in place.
 */
export function objectStyleOf(value: string | undefined | null): CSSProperties {
  const crop = parseCrop(value);
  if (!crop || (crop.x === 50 && crop.y === 50 && crop.zoom === 1)) return {};
  const position = `${crop.x}% ${crop.y}%`;
  const zoomed = crop.zoom > 1;
  return {
    objectPosition: position,
    transform: zoomed ? `scale(${crop.zoom})` : undefined,
    transformOrigin: zoomed ? position : undefined,
  };
}

/** The part of a picture that is visible in a frame of the given aspect (width / height), with the crop applied. */
export function visibleRect(natural: { w: number; h: number }, aspect: number, crop: Crop): PictureRect {
  let width = 1;
  let height = 1;
  if (natural.w / natural.h > aspect) {
    width = (aspect * natural.h) / natural.w;
  } else {
    height = natural.w / aspect / natural.h;
  }
  width /= crop.zoom;
  height /= crop.zoom;
  return {
    left: (crop.x / 100) * (1 - width),
    top: (crop.y / 100) * (1 - height),
    width,
    height,
  };
}

/** The point, in percent, that puts a frame of the given size where it stands. The inverse of visibleRect. */
export function cropFromRect(left: number, top: number, width: number, height: number): FocusPoint {
  const x = width < 1 ? (left / (1 - width)) * 100 : 50;
  const y = height < 1 ? (top / (1 - height)) * 100 : 50;
  return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
}
