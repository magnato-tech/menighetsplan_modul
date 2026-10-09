import React from "react";
import { ArrowRight } from "lucide-react";
import { useFirebase } from "../context/FirebaseDataContext";
import { demoDoors, type DemoDoor as Door } from "../utils/demoDoor";

interface DemoDoorProps {
  onEnter: (door: Door) => void;
}

/**
 * The ways into the demo, shown where a congregation's own installation asks one to sign in:
 * one button for each, and no account. See utils/demoDoor.ts for what they are and who one
 * goes in as.
 */
export const DemoDoor: React.FC<DemoDoorProps> = ({ onEnter }) => {
  const { allPersons, groups, registerReady } = useFirebase();

  // Until the register has arrived, nobody can be said to be missing from it
  if (!registerReady) return <p className="text-sm text-slate-500">Laster …</p>;

  const doors = demoDoors(allPersons, groups);
  if (doors.length === 0) return <p className="text-sm text-slate-600">Demoen har ingen personer å gå inn som ennå.</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Velg hva du vil se. Du trenger ikke logge inn, og du kan bytte når du vil.</p>
      {doors.map((door) => (
        <button
          key={door.way}
          type="button"
          onClick={() => onEnter(door)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-300 bg-white hover:border-indigo-500 hover:bg-indigo-50/50 text-left cursor-pointer transition-colors"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-slate-900">{door.name}</span>
            <span className="block text-xs text-slate-600">{door.does}</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">Du går inn som {door.person.name}</span>
          </span>
          <ArrowRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
};
