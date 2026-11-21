import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MinSideFrame } from "../../../components/minSide/MinSideFrame";
import { MEMBERSHIP_ARCHIVE_NOTICE } from "../../../utils/membershipApplication";

export const fieldClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400";
export const labelClass = "text-xs font-bold text-slate-700";
export const sectionClass = "rounded-2xl border border-slate-200 bg-white p-4 space-y-3";

export const MembershipFormShell: React.FC<{
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, intro, children }) => (
  <MinSideFrame width="narrow" bottomNavRoom>
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/minside/medlemskap"
          aria-label="Tilbake til Mitt medlemskap"
          className="w-11 h-11 shrink-0 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{title}</h1>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{intro}</p>
      <p className="text-xs text-slate-500 leading-relaxed border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5">
        {MEMBERSHIP_ARCHIVE_NOTICE}
      </p>
      {children}
    </div>
  </MinSideFrame>
);