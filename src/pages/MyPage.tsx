import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMyPage } from "./myPage/useMyPage";
import { AttentionSection } from "./myPage/AttentionSection";
import { MyGroupsSection } from "./myPage/MyGroupsSection";
import { MyTasksTab } from "./myPage/MyTasksTab";
import { MyPageTabs, shownMyPageTabs, toMyPageTab, type MyPageTab } from "./myPage/MyPageTabs";
import { MyPageSideMenu } from "./myPage/MyPageSideMenu";
import { MinSideFrame } from "../components/minSide/MinSideFrame";
import { useMinSideModules } from "../hooks/useMinSideModules";
import { MyCalendarPanel } from "./myPage/MyCalendarPanel";
import { WorshipPlanPanel } from "./myPage/WorshipPlanPanel";
import { AttentionModal } from "./myPage/AttentionModal";
import { VolunteerHelp } from "./myPage/VolunteerHelp";
import { SemesterPlanDone, SemesterPlanWaiting } from "./myPage/SemesterPlanSection";
import { CheckCircle2, Info } from "lucide-react";

// Min side shows as little as it can: nothing that repeats something, explains what can be seen,
// or cannot be pressed (PRODUKTDOKUMENTASJON.md chapter 14, «Min side, forenklet»).

export const MyPage: React.FC = () => {
  const page = useMyPage();
  const { feedbackMessage, clearFeedbackMessage, myGroups, attentionItems, hasServiceGroupMembership, semesterPlans } = page;
  const plansWaiting = semesterPlans.filter((item) => item.waiting);
  const plansDone = semesterPlans.filter((item) => !item.waiting);

  const [searchParams] = useSearchParams();
  const { isOn } = useMinSideModules();
  const tasksOn = isOn("tjeneste");

  // The page has three parts: one's tasks, one's groups and the calendar. An address can ask for
  // one of them (?view=); otherwise it opens on the tasks, which is what a volunteer comes for.
  const [requested, setTab] = useState<MyPageTab>(toMyPageTab(searchParams.get("view")));
  const [showAttentionModal, setShowAttentionModal] = useState(false);
  // A part that is switched off is not shown: the tasks open instead
  const tabs = shownMyPageTabs(isOn);
  const tab: MyPageTab = tabs.some((candidate) => candidate.id === requested) ? requested : "oppgaver";
  const heading = (tabs.find((candidate) => candidate.id === tab) ?? tabs[0]).label;

  return (
    // The room at the bottom is for the menu that is fixed there on a phone: the last card can be scrolled clear of it
    <MinSideFrame bottomNavRoom>
      {/* On a PC the parts are listed in a column to the left; the page itself is the column to the right */}
      <div className="p-4 sm:p-6 lg:grid lg:grid-cols-[13rem_1fr] lg:gap-6 lg:items-start">
        <MyPageSideMenu active={tab} onChange={setTab} tabs={tabs} />
        <div className="space-y-4 min-w-0">
        {/* Floating Feedback Notification */}
        {feedbackMessage && (
          <div
            role="status"
            className={`p-3.5 rounded-2xl border transition-all text-xs sm:text-sm flex items-start gap-2.5 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
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

        {/* The heading is the name of the part that is open, so nobody wonders where they are */}
        <div className="flex items-center justify-between gap-2">
          <h1 id="my-page-heading" className="text-xl font-black text-slate-900 tracking-tight">
            {heading}
          </h1>
          <VolunteerHelp />
        </div>

        <MyPageTabs active={tab} onChange={setTab} tabs={tabs} />

        {tab === "oppgaver" && (
          <>
            {/* A semester plan waiting for the user comes first: it covers the whole semester at once */}
            {plansWaiting.length > 0 && <SemesterPlanWaiting plans={plansWaiting} />}

            {/* What waits for an answer, and the open tasks, belong with one's tasks and nowhere else */}
            {attentionItems.length > 0 && (
              <AttentionSection page={page} quiet={plansWaiting.length > 0} onShowAll={() => setShowAttentionModal(true)} />
            )}

            {plansDone.length > 0 && <SemesterPlanDone plans={plansDone} />}

            {tasksOn && !hasServiceGroupMembership && attentionItems.length === 0 && (
              <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200/80 rounded-xl px-3.5 py-2.5 leading-relaxed">
                Ledige tjenesteoppgaver vises her når du er med i en tjenestegruppe (for eksempel lovsang, lyd eller kjøkken). Du er med i{" "}
                {myGroups.length === 0 ? "ingen grupper ennå" : myGroups.map((g) => g.name).join(", ")}.
              </p>
            )}

            {tasksOn && <MyTasksTab page={page} />}
          </>
        )}

        {tab === "grupper" && <MyGroupsSection page={page} />}

        {tab === "kalender" && <MyCalendarPanel />}

        {tab === "gudstjenester" && <WorshipPlanPanel />}
        </div>
      </div>

      {showAttentionModal && <AttentionModal page={page} onClose={() => setShowAttentionModal(false)} />}
    </MinSideFrame>
  );
};
