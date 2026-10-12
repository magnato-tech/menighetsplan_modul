import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useHusfellesskap } from "../hooks/useAppHooks";
import { HusfellesskapChat } from "./HusfellesskapChat";
import { MeetingTab } from "./husfellesskap/MeetingTab";
import { MembersTab } from "./husfellesskap/MembersTab";
import { CreateMeetingDialog } from "./husfellesskap/CreateMeetingDialog";
import { EditMeetingDialog } from "./husfellesskap/EditMeetingDialog";
import { useTimedMessage } from "../hooks/useTimedMessage";
import {
  Calendar,
  Users,
  MessageSquare,
  Plus,
  CheckCircle2,
} from "lucide-react";

export const HusfellesskapView: React.FC<{
  groupId?: string;
  defaultTab?: "meeting" | "chat" | "members";
}> = ({ groupId, defaultTab = "meeting" }) => {
  const model = useHusfellesskap(groupId);
  const { group, isLeader, isDeputyLeader, leaders, deputyLeaders, members, activeMeeting, messages } = model;

  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") as "meeting" | "chat" | "members" | null;
  const [activeTab, setActiveTab] = useState<"meeting" | "chat" | "members">(urlTab || defaultTab);

  useEffect(() => {
    if (urlTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);
  const [feedback, setFeedback, clearFeedback] = useTimedMessage<{ text: string; type: "success" | "info" }>(4000);

  // Modal / Accordion state for creating and editing meetings
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const showToast = (text: string, type: "success" | "info" = "success") => setFeedback({ text, type });

  if (!group) {
    return null;
  }

  return (
    <div
      id={`husfellesskap-view-${group.id}`}
      className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all"
    >
      {/* Group Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
              <Users className="w-3 h-3 text-emerald-700" />
              Husfellesskap
            </span>
            {(isLeader || isDeputyLeader) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                {isLeader ? "Du er leder" : "Du er nestleder"}
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-800">{group.name}</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {leaders.length > 0 && `Leder: ${leaders.map((l) => l.name).join(", ")}`}
            {deputyLeaders.length > 0 && ` • Nestleder: ${deputyLeaders.map((d) => d.name).join(", ")}`}
          </p>
        </div>

        {/* Quick leader action: create meeting */}
        {(isLeader || isDeputyLeader) && (
          <button
            type="button"
            id="btn-create-meeting-header"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1 shadow-2xs shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ny samling</span>
          </button>
        )}
      </div>

      {/* Tabs Navigation: Samling, Gruppechat, Medlemmer */}
      <div className="px-4 pt-3 pb-2 bg-slate-50/70 border-b border-slate-100 flex items-center gap-1.5">
        <button
          type="button"
          id="tab-btn-samling"
          onClick={() => setActiveTab("meeting")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "meeting"
              ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span>Samling & Innkalling</span>
        </button>

        <button
          type="button"
          id="tab-btn-chat"
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === "chat"
              ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
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
          id="tab-btn-medlemmer"
          onClick={() => setActiveTab("members")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "members"
              ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
          }`}
        >
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>Deltakere ({members.length})</span>
        </button>
      </div>

      {/* Floating Feedback Notification */}
      {feedback && (
        <div
          role="status"
          className={`mx-5 mt-4 p-3 rounded-2xl border transition-all text-xs font-semibold flex items-center gap-2 shadow-2xs animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-950 border-emerald-300"
              : "bg-amber-50 text-amber-950 border-amber-300"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{feedback.text}</span>
          <button
            type="button"
            onClick={clearFeedback}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 ml-1 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Tab Content 1: Samling & Oppmøte */}
      {activeTab === "meeting" && (
        <MeetingTab
          model={model}
          showToast={showToast}
          onCreateMeeting={() => setShowCreateModal(true)}
          onEditMeeting={() => setShowEditModal(true)}
        />
      )}

      {/* Tab Content 2: Gruppechat */}
      {activeTab === "chat" && (
        <div id="section-husfellesskap-chat" className="p-3">
          <HusfellesskapChat groupId={group.id} />
        </div>
      )}

      {/* Tab Content 3: Medlemmer */}
      {activeTab === "members" && <MembersTab model={model} group={group} />}

      {/* MODAL: Opprett ny samling */}
      {showCreateModal && (
        <CreateMeetingDialog model={model} showToast={showToast} onClose={() => setShowCreateModal(false)} />
      )}

      {/* MODAL: Endre eksisterende samling */}
      {showEditModal && activeMeeting && (
        <EditMeetingDialog
          model={model}
          activeMeeting={activeMeeting}
          showToast={showToast}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};
