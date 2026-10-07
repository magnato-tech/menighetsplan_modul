import React, { useState, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLeaderGroupDetail } from "../hooks/useAppHooks";
import { useTimedMessage } from "../hooks/useTimedMessage";
import { HusfellesskapView } from "../components/HusfellesskapView";
import { GroupChat } from "../components/GroupChat";
import { GroupRoleBar } from "./leaderGroup/GroupRoleBar";
import { GroupMetaForm } from "./leaderGroup/GroupMetaForm";
import { GroupScheduleCard } from "./leaderGroup/GroupScheduleCard";
import { GroupActivities } from "./leaderGroup/GroupActivities";
import { GroupMembers } from "./leaderGroup/GroupMembers";
import {
  ArrowLeft,
  Users,
  Calendar,
  Edit2,
  Check,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";

export const LeaderGroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();

  const detail = useLeaderGroupDetail(groupId || "");
  const { group, hasAccess, hasLeaderAccess, currentUser, members, messages } = detail;

  // Editing state for group basic metadata
  const [isEditingMeta, setIsEditingMeta] = useState(false);

  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") as "aktiviteter" | "chat" | "medlemmer" | null;

  // Room Tab for non-husgruppe: 'aktiviteter' | 'chat' | 'medlemmer'
  const [activeRoomTab, setActiveRoomTab] = useState<"aktiviteter" | "chat" | "medlemmer">(urlTab || "aktiviteter");

  useEffect(() => {
    if (urlTab) {
      setActiveRoomTab(urlTab);
    }
  }, [urlTab]);

  const [actionFeedback, showToast] = useTimedMessage<string>();

  // If group not found or unauthorized
  if (!group || !hasAccess) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden">
        <div className="p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-800">
              Ingen tilgang til gruppen
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              {!group
                ? "Gruppen ble ikke funnet."
                : `Du har ikke tilgang til denne gruppen. ${currentUser.name} er ikke registrert som medlem eller leder for ${group.name}.`}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/minside"
              id="btn-back-to-home"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Tilbake til Min side
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (group.category === "husgruppe") {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden">
        {/* Header & Breadcrumb */}
        <div className="bg-white px-5 pt-4 pb-3 border-b border-slate-100 space-y-2">
          <GroupRoleBar detail={detail} />
        </div>

        <div className="p-4 sm:p-5">
          <HusfellesskapView groupId={group.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden">
      {/* Header & Breadcrumb */}
      <div className="bg-white px-5 pt-4 pb-3 border-b border-slate-100 space-y-2">
        <GroupRoleBar detail={detail} />

        <div className="flex items-start justify-between gap-2 pt-1">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{group.name}</h1>
            <p className="text-xs text-slate-500 capitalize">
              {group.category || "Tjenestegruppe"} • {members.length} medlemmer
            </p>
          </div>
          {hasLeaderAccess && !isEditingMeta && (
            <button
              type="button"
              id="btn-edit-group-meta"
              onClick={() => setIsEditingMeta(true)}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Rediger</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation: Aktiviteter, Gruppechat, Medlemmer */}
      <div className="px-4 pt-3 pb-2 bg-slate-50 border-b border-slate-200/60 flex items-center gap-1.5">
        <button
          type="button"
          id="tab-btn-group-aktiviteter"
          onClick={() => setActiveRoomTab("aktiviteter")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeRoomTab === "aktiviteter"
              ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span>Aktiviteter</span>
        </button>

        <button
          type="button"
          id="tab-btn-group-chat"
          onClick={() => setActiveRoomTab("chat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeRoomTab === "chat"
              ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
          <span>Gruppechat</span>
          {messages.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/60">
              {messages.length}
            </span>
          )}
        </button>

        <button
          type="button"
          id="tab-btn-group-medlemmer"
          onClick={() => setActiveRoomTab("medlemmer")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeRoomTab === "medlemmer"
              ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>Medlemmer ({members.length})</span>
        </button>
      </div>

      {/* Toast feedback */}
      {actionFeedback && (
        <div
          id="group-card-toast"
          className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm animate-in fade-in"
        >
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      <div className="p-5 space-y-6">

        {isEditingMeta && (
          <GroupMetaForm detail={detail} group={group} showToast={showToast} onClose={() => setIsEditingMeta(false)} />
        )}

        {/* Activities and members stay mounted while hidden, so filters and a half-edited
            meeting plan are still there after a look at another tab. */}
        <div>
          <div id="section-group-aktiviteter-tab" className="space-y-6" hidden={activeRoomTab !== "aktiviteter"}>
            <GroupScheduleCard detail={detail} group={group} showToast={showToast} />
            <GroupActivities detail={detail} showToast={showToast} />
          </div>

          {/* TAB 2: CHAT */}
          {activeRoomTab === "chat" && (
            <div id="section-group-chat-tab" className="space-y-4">
              <GroupChat groupId={group.id} />
            </div>
          )}

          <div id="section-group-medlemmer-tab" className="space-y-4" hidden={activeRoomTab !== "medlemmer"}>
            <GroupMembers detail={detail} group={group} showToast={showToast} />
          </div>
        </div>
      </div>
    </div>
  );
};
