import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

export interface GatheringAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  to?: string;
  /** Shown as a stronger button on a wide screen. */
  primary?: boolean;
}

/**
 * The actions on a gathering. On a wide screen they are a row of buttons; on a phone they are
 * gathered behind «…», so the staffing is what fills the screen.
 */
export const GatheringActions: React.FC<{ actions: GatheringAction[] }> = ({ actions }) => {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;

  const item = (action: GatheringAction, inMenu: boolean) => {
    const Icon = action.icon;
    const className = inMenu
      ? "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 rounded-lg text-left cursor-pointer"
      : `inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
          action.primary
            ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200/80"
            : "text-slate-700 bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs"
        }`;
    const content = (
      <>
        <Icon className={inMenu ? "w-4 h-4 text-slate-500" : "w-3.5 h-3.5"} />
        <span>{action.label}</span>
      </>
    );
    const close = () => setOpen(false);
    return action.to ? (
      <Link key={action.key} to={action.to} className={className} onClick={close} role={inMenu ? "menuitem" : undefined}>
        {content}
      </Link>
    ) : (
      <button
        key={action.key}
        type="button"
        role={inMenu ? "menuitem" : undefined}
        onClick={() => {
          close();
          action.onClick?.();
        }}
        className={className}
      >
        {content}
      </button>
    );
  };

  return (
    <>
      <div className="hidden sm:flex flex-wrap items-center justify-end gap-2">{actions.map((a) => item(a, false))}</div>
      <div className="sm:hidden relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Flere valg"
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
        >
          <MoreHorizontal className="w-5 h-5" aria-hidden />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
            <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-56 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5">
              {actions.map((a) => item(a, true))}
            </div>
          </>
        )}
      </div>
    </>
  );
};
