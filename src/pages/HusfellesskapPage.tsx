import { MinSideFrame } from "../components/minSide/MinSideFrame";
import React from "react";
import { useParams, Link } from "react-router-dom";
import { HusfellesskapView } from "../components/HusfellesskapView";
import { ChevronLeft } from "lucide-react";

export const HusfellesskapPage: React.FC = () => {
  const { groupId } = useParams<{ groupId?: string }>();

  return (
    <MinSideFrame>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link
            to="/minside"
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Tilbake til Min side</span>
          </Link>
        </div>

        <HusfellesskapView groupId={groupId} columns />
      </div>
    </MinSideFrame>
  );
};
