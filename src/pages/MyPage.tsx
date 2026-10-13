import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMyPage } from "./myPage/useMyPage";
import { AttentionSection } from "./myPage/AttentionSection";
import { MyGroupsSection } from "./myPage/MyGroupsSection";
import { NextChurchEventSection } from "./myPage/NextChurchEventSection";
import { NextForYouSection } from "./myPage/NextForYouSection";
import { MyTasksTab } from "./myPage/MyTasksTab";
import { MyPageTabs, toMyPageTab, type MyPageTab } from "./myPage/MyPageTabs";
import { MyCalendarPanel } from "./myPage/MyCalendarPanel";
import { AttentionModal } from "./myPage/AttentionModal";
import { VolunteerHelp } from "./myPage/VolunteerHelp";
import { CheckCircle2, Info } from "lucide-react";

export const MyPage: React.FC = () => {
  const page = useMyPage();
  const { currentUser, myTasks, feedbackMessage, clearFeedbackMessage, myGroups, attentionItems, hasServiceGroupMembership } = page;

  const [searchParams] = useSearchParams();

  // The page has three parts: one's tasks, one's groups and the calendar. An address can ask for
  // one of them (?view=); otherwise it opens on the tasks, which is what a volunteer comes for.
  const [tab, setTab] = useState<MyPageTab>(toMyPageTab(searchParams.get("view")));
  const [showAttentionModal, setShowAttentionModal] = useState(false);

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden pb-20 sm:pb-8">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Floating Feedback Notification */}
        {feedbackMessage && (
          <div
            role="status"
            className={`p-3.5 rounded-2xl border transition-all text-xs sm:text-sm flex items-start gap-2.5 shadow-xs animate-in fade-in slide-in-from-top-2 ${
              feedbackMessage.type === "success"
                ? "bg-emerald-50 text-emerald-950 border-emerald-300"
                : "bg-amber-50 text-amber-950 border-amber-300"
            }`}
          >
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedbackMessage.text}</div>
            <button
              type="button"
              onClick={clearFeedbackMessage}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 ml-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Dashboard Header Greeting */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Min side</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Oversikt for {currentUser.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200/80 px-2.5 py-1 rounded-full shadow-2xs">
              {myGroups.length} {myGroups.length === 1 ? "gruppe" : "grupper"}
            </span>
          </div>
        </div>

        <VolunteerHelp />

        {/* =========================================================================
            1. TRENGER DIN OPPMERKSOMHET
            Vises BARE dersom brukeren faktisk har aktive handlinger.
            0 handlinger: Seksjonen skjules helt (går direkte til Neste i menigheten).
            1–2 handlinger: Vises direkte med eksisterende handlingskort.
            3+ handlinger: Vises som én samlet, kompakt boks [Se og håndter →].
           ========================================================================= */}
        {attentionItems.length > 0 && (
          <AttentionSection page={page} onShowAll={() => setShowAttentionModal(true)} />
        )}

        {!hasServiceGroupMembership && attentionItems.length === 0 && (
          <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200/80 rounded-xl px-3.5 py-2.5 leading-relaxed">
            Ledige tjenesteoppgaver vises her når du er med i en tjenestegruppe (for eksempel lovsang, lyd eller kjøkken). Du er med i{" "}
            {myGroups.length === 0 ? "ingen grupper ennå" : myGroups.map((g) => g.name).join(", ")}.
          </p>
        )}

        {/* What needs one's action stands above. Under it, one part at a time. */}
        <MyPageTabs active={tab} onChange={setTab} taskCount={myTasks.length} />

        {tab === "oppgaver" && <MyTasksTab page={page} />}

        {tab === "grupper" && <MyGroupsSection page={page} />}

        {tab === "kalender" && (
          <div className="space-y-5">
            <NextChurchEventSection page={page} />
            <NextForYouSection page={page} />
            <MyCalendarPanel inline />
          </div>
        )}
      </div>

      {/* =========================================================================
          ATTENTION MODAL / DRAWER (for viewing & handling 3+ pending actions)
         ========================================================================= */}
      {showAttentionModal && <AttentionModal page={page} onClose={() => setShowAttentionModal(false)} />}
    </div>
  );
};
