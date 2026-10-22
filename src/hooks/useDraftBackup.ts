import { useEffect } from "react";

// What is typed in an editor is kept in this browser while it is not saved, so it can be brought back
// when the tab was closed, the browser stopped or the power went. It lives only on this machine, and
// is removed when the work is saved or thrown away. Nothing here reaches the database.

const PREFIX = "menighetsplan:utkast:";
const WRITE_AFTER_MS = 1000;

export interface DraftBackup<T> {
  /** When it was written, as an ISO time. */
  savedAt: string;
  draft: T;
}

export function readDraftBackup<T>(key: string): DraftBackup<T> | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftBackup<T>;
    return parsed && typeof parsed.savedAt === "string" && parsed.draft ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDraftBackup<T>(key: string, draft: T, now: Date = new Date()): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: now.toISOString(), draft }));
  } catch {
    // Full or blocked storage: the work is then only kept by saving it, as before
  }
}

export function clearDraftBackup(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to clear where storage is blocked
  }
}

/**
 * Keeps the draft in the browser a moment after each change while it is not saved, and removes it once
 * the editor holds nothing unsaved. `paused` leaves an earlier draft as it is while it is offered, so
 * it is neither removed nor written over before the editor has chosen.
 */
export function useDraftBackup(key: string | null, draft: unknown, unsaved: boolean, paused = false): void {
  useEffect(() => {
    if (!key || paused) return;
    if (!unsaved) {
      clearDraftBackup(key);
      return;
    }
    const timer = window.setTimeout(() => writeDraftBackup(key, draft), WRITE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [key, draft, unsaved, paused]);
}

/** «21. oktober kl. 14:05»: when a draft was kept. */
export function draftTimeLabel(savedAt: string): string {
  const time = new Date(savedAt);
  if (Number.isNaN(time.getTime())) return "tidligere";
  const day = time.toLocaleDateString("nb-NO", { day: "numeric", month: "long", timeZone: "Europe/Oslo" });
  const clock = time.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });
  return `${day} kl. ${clock}`;
}
