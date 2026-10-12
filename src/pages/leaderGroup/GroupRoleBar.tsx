import React from "react";
import { Link } from "react-router-dom";
import { LeaderGroupDetail } from "./leaderGroupDetail";
import {
  ArrowLeft,
} from "lucide-react";

interface GroupRoleBarProps {
  detail: LeaderGroupDetail;
}

export const GroupRoleBar: React.FC<GroupRoleBarProps> = ({ detail }) => {
  const { hasLeaderAccess, isLeader, isDeputy, isAdmin } = detail;

  return (
    <div className="flex items-center justify-between">
      {hasLeaderAccess ? (
        <Link
          to="/leder"
          id="btn-back-to-leader-nav"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Gruppeleder</span>
        </Link>
      ) : (
        <Link
          to="/minside"
          id="btn-back-to-home-nav"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Min side</span>
        </Link>
      )}
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
          isLeader
            ? "bg-emerald-100 text-emerald-800"
            : isDeputy
            ? "bg-blue-100 text-blue-800"
            : isAdmin
            ? "bg-indigo-100 text-indigo-800"
            : "bg-slate-100 text-slate-700"
        }`}
      >
        {isLeader ? "Gruppeleder" : isDeputy ? "Nestleder" : isAdmin ? "Admin" : "Deltaker"}
      </span>
    </div>
  );
};
