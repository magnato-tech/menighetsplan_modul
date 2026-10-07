import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMyPage } from "./myPage/useMyPage";
import { AttentionSection } from "./myPage/AttentionSection";
import { MyGroupsSection } from "./myPage/MyGroupsSection";
import { NextChurchEventSection } from "./myPage/NextChurchEventSection";
import { NextForYouSection } from "./myPage/NextForYouSection";
import { MyTasksModal } from "./myPage/MyTasksModal";
import { MyCalendarPanel } from "./myPage/MyCalendarPanel";
import { AttentionModal } from "./myPage/AttentionModal";
import { MobileBottomNav } from "./myPage/MobileBottomNav";
import {
  Calendar,
  CheckCircle2,
  Info,
  ListTodo,
} from "lucide-react";

export const MyPage: React.FC = () => {
  const page = useMyPage();
  const { currentUser, myTasks, feedbackMessage, clearFeedbackMessage, myGroups, attentionItems } = page;

  const [searchParams] = useSearchParams();

  // Active view toggle for mobile tasks modal / drawer if requested
  const [showTasksModal, setShowTasksModal] = useState(
    searchParams.get("view") === "oppgaver"
  );
  const [showAttentionModal, setShowAttentionModal] = useState(false);
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);

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
            <button
              type="button"
              onClick={() => setShowCalendarPanel(true)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200/80 bg-white text-slate-600 hover:text-emerald-700 hover:border-emerald-200 shadow-2xs cursor-pointer"
              aria-label="Åpne Min kalender"
            >
              <Calendar className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200/80 px-2.5 py-1 rounded-full shadow-2xs">
              {myGroups.length} {myGroups.length === 1 ? "gruppe" : "grupper"}
            </span>
          </div>
        </div>

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

        {/* =========================================================================
            2. MINE GRUPPER
            Hovedinngang til brukerens gruppeliv med siste melding integrert
           ========================================================================= */}
        <MyGroupsSection page={page} />

        {/* =========================================================================
            3. NESTE I MENIGHETEN
            Neste gudstjeneste/arrangement som gjelder hele menigheten
           ========================================================================= */}
        <NextChurchEventSection page={page} />

        {/* =========================================================================
            3. NESTE FOR DEG
            Brukerens neste relevante aktivitet (f.eks. husfellesskap eller tjeneste)
           ========================================================================= */}
        <NextForYouSection page={page} />

        {/* Quick Access to User Groups & Tasks */}
        <div className="pt-2">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <ListTodo className="w-4 h-4 text-slate-500" />
              <span>Dine oppgaver ({myTasks.length})</span>
            </span>
            <button
              type="button"
              onClick={() => setShowTasksModal(true)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              Vis oppgaveliste
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TASKS MODAL / DRAWER (for viewing task details without cluttering dashboard)
         ========================================================================= */}
      {showTasksModal && <MyTasksModal page={page} onClose={() => setShowTasksModal(false)} />}

      {showCalendarPanel && <MyCalendarPanel onClose={() => setShowCalendarPanel(false)} />}

      {/* =========================================================================
          ATTENTION MODAL / DRAWER (for viewing & handling 3+ pending actions)
         ========================================================================= */}
      {showAttentionModal && <AttentionModal page={page} onClose={() => setShowAttentionModal(false)} />}

      {/* =========================================================================
          FAST BUNNNAVIGASJON PÅ MOBIL:
          MIN SIDE | GRUPPER | OPPGAVER | MELDINGER
         ========================================================================= */}
      <MobileBottomNav onShowTasks={() => setShowTasksModal(true)} />
    </div>
  );
};
