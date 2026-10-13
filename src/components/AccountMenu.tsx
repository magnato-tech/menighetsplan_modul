import React, { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useFirebase } from "../context/FirebaseDataContext";
import { ROLE_LABELS, roleOf } from "../utils/session";

/** The letters a person is shown by: the first of the first name and of the last, «MT». */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? [parts[0][0]] : [parts[0][0], parts[parts.length - 1][0]];
  return letters.join("").toLocaleUpperCase("nb");
}

/**
 * Who is signed in, what they are in the congregation, and the way out: behind a round mark with
 * the person's initials, so the top of the page has room for the congregation's name.
 */
export const AccountMenu: React.FC = () => {
  const { session, groups, signOut } = useFirebase();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (session.status !== "member") return null;
  const { person } = session;

  return (
    <div ref={menu} className="relative shrink-0">
      <button
        type="button"
        id="account-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Konto: ${person.name}`}
        onClick={() => setOpen((shown) => !shown)}
        className="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-black tracking-wide flex items-center justify-center cursor-pointer hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        {initialsOf(person.name)}
      </button>

      {open && (
        <div role="menu" aria-label="Konto" className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl border border-slate-200 bg-white shadow-lg p-3 space-y-3">
          <div className="px-1">
            <p className="text-sm font-bold text-slate-900 break-words">{person.name}</p>
            <p className="text-xs font-medium text-slate-500">{ROLE_LABELS[roleOf(person, groups)]}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Logg ut
          </button>
        </div>
      )}
    </div>
  );
};
