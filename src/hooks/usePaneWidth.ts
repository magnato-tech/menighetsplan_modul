import { useCallback, useState } from "react";

// Reads a width in pixels from the browser. Storage can be blocked or hold something that is not a
// number, so anything unusable means "use the default" (null) instead of an error.
function readStoredWidth(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * A pane width the user has chosen by dragging, remembered in the browser. null means the default.
 */
export function usePaneWidth(storageKey: string): { width: number | null; setWidth: (px: number | null) => void } {
  const [width, setWidthState] = useState<number | null>(() => readStoredWidth(storageKey));

  const setWidth = useCallback(
    (px: number | null) => {
      setWidthState(px);
      try {
        if (px === null) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, String(Math.round(px)));
      } catch {
        // Storage is blocked: the width lasts until the page is reloaded
      }
    },
    [storageKey]
  );

  return { width, setWidth };
}
