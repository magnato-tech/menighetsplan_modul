import React from "react";
import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import { useFirebase } from "../context/FirebaseDataContext";

interface AdminAccessRequiredProps {
  /** What the user tried to open, as it reads after "har ikke tilgang til": "denne admin-siden". */
  target: string;
}

/** What a member sees on a page only administrators may open. */
export const AdminAccessRequired: React.FC<AdminAccessRequiredProps> = ({ target }) => {
  const { currentUser } = useFirebase();

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden">
      <div className="p-6 text-center space-y-4">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
          <Shield className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-800">Admin-tilgang kreves</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {currentUser.name} er ikke administrator og har ikke tilgang til {target}.
          </p>
        </div>
        <Link
          to="/minside"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Tilbake til Min side
        </Link>
      </div>
    </div>
  );
};
