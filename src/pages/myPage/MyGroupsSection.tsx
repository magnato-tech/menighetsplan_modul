import React from "react";
import { formatChatMessageTime, formatNorwegianDateTime } from "../../utils/dates";
import { MyPageModel } from "./useMyPage";
import { allGroupPersonIds } from "../../utils/groups";
import { useMinSideModules } from "../../hooks/useMinSideModules";
import {
  ChevronRight,
  Clock,
  MessageSquare,
  Users,
} from "lucide-react";

// The colour of the staffing pill on a card, by the staffing colour
const STAFFING_PILL: Record<"red" | "yellow" | "green", string> = {
  red: "bg-red-100 text-red-700",
  yellow: "bg-amber-100 text-amber-800",
  green: "bg-emerald-100 text-emerald-800",
};

interface MyGroupsSectionProps {
  page: MyPageModel;
}

export const MyGroupsSection: React.FC<MyGroupsSectionProps> = ({ page }) => {
  const {
    currentUser,
    myGroups,
    getGroupNextActivity,
    getLedActivity,
    handleOpenGatheringPlanning,
    getGroupLatestMessage,
    handleOpenGroupChat,
    handleOpenGroupRoom,
  } = page;
  const { isOn } = useMinSideModules();
  const chatOn = isOn("gruppechat");
  const husfellesskapOn = isOn("husfellesskap");

  return (
    <section id="section-mine-grupper" className="space-y-2">
      {myGroups.length > 0 ? (
        <div className="space-y-2.5">
          {myGroups.map((group) => {
            const isGroupLeader = group.leaderIds.includes(currentUser.id);
            const isGroupDeputy = group.deputyLeaderIds?.includes(currentUser.id);
            const nextActivity = getGroupNextActivity(group);
            const ledActivity = getLedActivity(group);
            const latestMsg = getGroupLatestMessage(group.id);

            return (
              <div
                key={group.id}
                id={`my-group-card-${group.id}`}
                className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3 hover:border-slate-300 transition-all"
              >
                {/* Header: Type, Rolle og Gruppenavn */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      {group.category === "husgruppe" && husfellesskapOn
                        ? "Husfellesskap"
                        : group.category === "husgruppe"
                        ? "Gruppe"
                        : group.category === "tjenestegruppe"
                        ? "Tjenestegruppe"
                        : group.category}
                    </span>
                    {isGroupLeader ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        Leder
                      </span>
                    ) : isGroupDeputy ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                        Nestleder
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        Deltaker
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {group.name}
                  </h3>
                </div>

                {/* Meta: antall medlemmer · neste aktivitet */}
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {allGroupPersonIds(group).length}{" "}
                      {allGroupPersonIds(group).length === 1 ? "deltaker" : "deltakere"}
                    </span>
                  </span>
                  {ledActivity ? (
                    <>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        aria-label={`Planlegg ${ledActivity.gathering.title}`}
                        onClick={() => handleOpenGatheringPlanning(ledActivity.gathering.id)}
                        className="flex items-center gap-1.5 flex-wrap text-left hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ledActivity.gathering.title}</span>
                        <span className="text-slate-400">{formatNorwegianDateTime(ledActivity.gathering.startsAt)}</span>
                        {ledActivity.hasTasks && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${STAFFING_PILL[ledActivity.staffing.color]}`}>
                            {ledActivity.staffing.badgeText}
                          </span>
                        )}
                      </button>
                    </>
                  ) : nextActivity && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{nextActivity}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Siste melding fra gruppens chat (sekundær informasjon) - skjules dersom ingen melding */}
                {latestMsg && (
                  <div
                    onClick={() => handleOpenGroupChat(group)}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 hover:bg-slate-100/70 transition-colors cursor-pointer space-y-1 group/msg"
                    title="Trykk for å gå til chatten"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800">
                        {latestMsg.senderName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatChatMessageTime(latestMsg.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {latestMsg.content || (latestMsg.imageUrl ? "[Bilde]" : "")}
                    </p>
                  </div>
                )}

                {/* Handlinger: Gå til grupperommet →       Chat */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    id={`btn-open-group-${group.id}`}
                    onClick={() => handleOpenGroupRoom(group)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                  >
                    <span>Gå til grupperommet</span>
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                  {chatOn && (
                    <button
                      type="button"
                      id={`btn-open-group-chat-${group.id}`}
                      onClick={() => handleOpenGroupChat(group)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer px-2.5 py-1 rounded-lg hover:bg-blue-50"
                      title="Åpne gruppechat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 text-center text-xs text-slate-400">
          Du er ikke lagt til i noen grupper ennå.
        </div>
      )}
    </section>
  );
};
