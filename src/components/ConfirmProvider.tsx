import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

export interface ConfirmOptions {
  /** The words of the yes button. Default «OK». */
  yes?: string;
  /** Styles the yes button as something that deletes or removes. */
  danger?: boolean;
}

export type ConfirmFn = (text: string, options?: ConfirmOptions) => Promise<boolean>;

interface Pending {
  text: string;
  yes: string;
  danger: boolean;
  resolve: (answer: boolean) => void;
}

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * One in-page question at a time. Browsers can suppress window.confirm (after «Ikke la denne siden
 * lage flere dialoger»), and then it answers no at once. This dialog is always shown.
 * A line break in the text starts a new paragraph.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const current = useRef<Pending | null>(null);
  const titleId = useId();
  const yesRef = useRef<HTMLButtonElement>(null);

  const finish = useCallback((answer: boolean) => {
    const asked = current.current;
    current.current = null;
    setPending(null);
    asked?.resolve(answer);
  }, []);

  const confirm = useCallback<ConfirmFn>((text, options = {}) => {
    return new Promise<boolean>((resolve) => {
      // A new question leaves the old one unanswered: that counts as no
      current.current?.resolve(false);
      const next: Pending = { text, yes: options.yes ?? "OK", danger: Boolean(options.danger), resolve };
      current.current = next;
      setPending(next);
    });
  }, []);

  useEffect(() => {
    if (!pending) return undefined;
    yesRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") finish(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pending, finish]);

  const lines = pending ? pending.text.split("\n") : [];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => finish(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={`${titleId}-text`}
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5 space-y-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div id={`${titleId}-text`} className="space-y-2">
              {lines.map((line, index) => (
                <p key={index} id={index === 0 ? titleId : undefined} className={index === 0 ? "text-sm font-bold text-slate-900" : "text-xs text-slate-600 leading-relaxed"}>
                  {line}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button type="button" onClick={() => finish(false)} className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer">
                Avbryt
              </button>
              <button
                ref={yesRef}
                type="button"
                onClick={() => finish(true)}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold cursor-pointer ${pending.danger ? "bg-red-700 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {pending.yes}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * The shared question: `await confirmInPage("Slette?", { yes: "Slett", danger: true })`.
 * Without a ConfirmProvider above it (a component rendered alone), it asks window.confirm.
 */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  return useCallback<ConfirmFn>(
    (text, options) => {
      if (confirm) return confirm(text, options);
      return Promise.resolve(window.confirm(text));
    },
    [confirm]
  );
}
