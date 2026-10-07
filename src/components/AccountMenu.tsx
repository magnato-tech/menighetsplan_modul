import React from "react";
import { LogOut } from "lucide-react";
import { useFirebase } from "../context/FirebaseDataContext";
import { ROLE_LABELS, roleOf } from "../utils/session";

/** Who is signed in, what they are in the congregation, and the way out. Shown at the top of Min side. */
export const AccountMenu: React.FC = () => {
  const { session, groups, signOut } = useFirebase();
  if (session.status !== "member") return null;
  const { person } = session;

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="min-w-0 text-right">
        <p className="text-xs font-bold text-slate-800 truncate max-w-[9rem]">{person.name}</p>
        <p className="text-[10px] font-medium text-slate-500">{ROLE_LABELS[roleOf(person, groups)]}</p>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
        Logg ut
      </button>
    </div>
  );
};
