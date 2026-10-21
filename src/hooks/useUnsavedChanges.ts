import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/** An editor in the studio that holds changes not saved: what it is called, and how to save it. */
export interface UnsavedEntry {
  title?: string;
  save: () => Promise<boolean>;
}

interface UnsavedRegistry {
  report: (key: string, entry: UnsavedEntry | null) => void;
}

export const UnsavedChangesContext = createContext<UnsavedRegistry | null>(null);

/**
 * Held by the studio: which editors hold changes not saved (for the mark in the side menu and the
 * question before one leaves the studio), and the browser's own question when the tab is closed or
 * reloaded while any does.
 */
export function useUnsavedRegistry() {
  const [entries, setEntries] = useState<Record<string, UnsavedEntry>>({});
  const report = useCallback((key: string, entry: UnsavedEntry | null) => {
    setEntries((current) => {
      if (!entry && !(key in current)) return current;
      const next = { ...current };
      if (entry) next[key] = entry;
      else delete next[key];
      return next;
    });
  }, []);
  const registry = useMemo(() => ({ report }), [report]);

  const anyUnsaved = Object.keys(entries).length > 0;
  useEffect(() => {
    if (!anyUnsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anyUnsaved]);

  return { entries, registry };
}

/** Tells the studio whether this editor holds changes not saved. Outside the studio it does nothing. */
export function useReportUnsaved(key: string, unsaved: boolean, title: string | undefined, save: () => Promise<boolean>) {
  const registry = useContext(UnsavedChangesContext);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    registry?.report(key, unsaved ? { title, save: () => saveRef.current() } : null);
  }, [registry, key, unsaved, title]);
  useEffect(() => () => registry?.report(key, null), [registry, key]);
}

/**
 * Closing an editor, or opening another thing in it, goes through `leave`: with changes not saved, the
 * question «Endringene er ikke lagret» is asked first, and the action is done after Lagre or Forkast.
 */
export function useLeaveGuard(unsaved: boolean, save: () => Promise<boolean>) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const leave = (action: () => void) => {
    if (unsaved) setPending(() => action);
    else action();
  };
  const dialog = {
    open: pending !== null,
    onStay: () => setPending(null),
    onDiscard: () => {
      const action = pending;
      setPending(null);
      action?.();
    },
    onSave: async () => {
      const action = pending;
      setPending(null);
      if ((await save()) && action) action();
    },
  };
  return { leave, dialog };
}

/** The editor's content as it stands, to compare with how it was opened or last saved. */
export function draftFingerprint(draft: unknown): string {
  return draft == null ? "" : JSON.stringify(draft);
}
