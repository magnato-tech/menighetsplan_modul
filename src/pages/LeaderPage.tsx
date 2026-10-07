import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useLeaderDashboard,
  formatNorwegianDateTime,
  formatCompactGatheringSubtitle,
} from "../hooks/useAppHooks";
import {
  ShieldAlert,
  Clock,
  ArrowLeft,
  ChevronRight,
  Users,
  Calendar,
} from "lucide-react";

export const LeaderPage: React.FC = () => {
  const {
    isLeader,
    leaderData,
    allSemesterGatherings,
    urgentGatherings,
    urgentTasksCount,
    currentUser,
  } = useLeaderDashboard();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get("tab") === "samlinger" ? "samlinger" : "grupper";
  const [activeTab, setActiveTab] = useState<"grupper" | "samlinger">(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "samlinger" || tabParam === "grupper") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab: "grupper" | "samlinger") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "red" | "yellow" | "green">("all");

  // Shortcut from urgent banner: switch to Semesteroversikt and select 'red' status
  const handleShowUrgentInSemester = () => {
    handleTabChange("samlinger");
    setSelectedStatusFilter("red");
  };

  const totalRedCount = useMemo(() => allSemesterGatherings.filter((item) => item.staffing.color === "red").length, [allSemesterGatherings]);
  const totalYellowCount = useMemo(() => allSemesterGatherings.filter((item) => item.staffing.color === "yellow").length, [allSemesterGatherings]);
  const totalGreenCount = useMemo(() => allSemesterGatherings.filter((item) => item.staffing.color === "green").length, [allSemesterGatherings]);

  // Filtered semester gatherings by status
  const filteredSemesterGatherings = useMemo(() => {
    if (selectedStatusFilter === "all") return allSemesterGatherings;
    return allSemesterGatherings.filter((item) => item.staffing.color === selectedStatusFilter);
  }, [allSemesterGatherings, selectedStatusFilter]);

  // Count urgent tasks inside the filtered gatherings
  const filteredUrgentTasksCount = useMemo(() => {
    return filteredSemesterGatherings.reduce((acc, item) => {
      return acc + item.tasks.filter((t) => t.status === "vacant").length;
    }, 0);
  }, [filteredSemesterGatherings]);

  // Friendly message if user is not a leader or deputy in any group
  if (!isLeader) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden">
        <div className="p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-800">Ikke registrert som leder</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              <span className="font-semibold text-slate-700">{currentUser.name}</span> er registrert som medlem, men leder for øyeblikket ingen grupper. Bytt bruker i toppen for å teste lederflaten.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/minside"
              id="btn-back-to-my-page"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Tilbake til Min side
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen shadow-md sm:my-4 sm:rounded-3xl sm:border sm:border-slate-200/80 overflow-hidden">
      {/* Subheader & Tabs */}
      <div className="bg-white px-5 pt-3 pb-3 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-emerald-800 font-bold">
              Gruppeleder-arbeidsflate
            </span>
            <h2 className="text-base font-bold text-slate-800">
              {currentUser.name}
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {leaderData.length} {leaderData.length === 1 ? "ledergruppe" : "ledergrupper"}
          </span>
        </div>

        {/* View Switcher Tabs: Grupper vs Semesteroversikt */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            id="tab-btn-mine-grupper"
            onClick={() => handleTabChange("grupper")}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "grupper"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Mine ledergrupper</span>
          </button>

          <button
            type="button"
            id="tab-btn-samlingsoversikt"
            onClick={() => handleTabChange("samlinger")}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "samlinger"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Semesteroversikt</span>
            {urgentGatherings.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Executive Summary: Rolig og kompakt statusindikator */}
        <section aria-labelledby="leader-summary-title">
          <h2 id="leader-summary-title" className="sr-only">
            Statusoppsummering for gruppeleder
          </h2>

          {urgentTasksCount > 0 ? (
            <div
              id="leader-urgent-banner"
              className="px-4 py-3 bg-red-50 rounded-2xl border border-red-200 flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                <div>
                  <span className="text-xs font-bold text-red-900 block leading-snug">
                    {urgentTasksCount} {urgentTasksCount === 1 ? "oppgave trenger vikar / oppfølging" : "oppgaver trenger vikar / oppfølging"}
                  </span>
                  <span className="text-[11px] text-red-700 font-medium">
                    I {urgentGatherings.length} {urgentGatherings.length === 1 ? "aktivitet" : "aktiviteter"} dette semesteret
                  </span>
                </div>
              </div>
              <button
                type="button"
                id="btn-show-urgent-in-semester"
                onClick={handleShowUrgentInSemester}
                className="text-xs font-bold px-3 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer whitespace-nowrap flex items-center gap-1"
              >
                <span>Vis i semesteroversikt</span>
                <span>→</span>
              </button>
            </div>
          ) : (
            <div className="px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-semibold text-emerald-900">
                  Alt er i rute • Alle planlagte oppgaver er dekket
                </span>
              </div>
              <span className="text-[11px] font-medium text-emerald-700">
                🟢 Dekket
              </span>
            </div>
          )}
        </section>

        {/* TAB 1: Mine Ledergrupper (Gruppekort overblikk) */}
        {activeTab === "grupper" && (
          <section className="space-y-3.5" aria-labelledby="leader-groups-heading">
            <div className="flex items-center justify-between">
              <h3 id="leader-groups-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mine grupper
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                Velg gruppe for å åpne gruppekortet
              </span>
            </div>

            <div className="space-y-3">
              {leaderData.map(({ group, members, gatherings }) => {
                const isMainLeader = group.leaderIds.includes(currentUser.id);
                const isDeputy = group.deputyLeaderIds?.includes(currentUser.id);

                // Find next upcoming activity for this group
                const nextGatheringItem = gatherings[0];

                return (
                  <div
                    key={group.id}
                    id={`leader-group-card-${group.id}`}
                    className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3 hover:border-emerald-300 transition-all group"
                  >
                    {/* Header: Gruppenavn, Kategori & Medlemmer */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-800 group-hover:text-emerald-800 transition-colors">
                            {group.name}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              isMainLeader
                                ? "bg-emerald-100 text-emerald-800"
                                : isDeputy
                                ? "bg-blue-100 text-blue-800"
                                : "bg-indigo-100 text-indigo-800"
                            }`}
                          >
                            {isMainLeader ? "Hovedleder" : isDeputy ? "Nestleder" : "Admin"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          <span className="capitalize">{group.category || "Tjenestegruppe"}</span> · {members.length} medlemmer
                        </p>
                      </div>
                    </div>

                    {/* Neste relevante aktivitet & Bemanningsstatus */}
                    {nextGatheringItem ? (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-500 font-medium">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            Neste aktivitet:
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              nextGatheringItem.staffing.color === "red"
                                ? "bg-red-100 text-red-700"
                                : nextGatheringItem.staffing.color === "yellow"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {nextGatheringItem.staffing.color === "green" ? "🟢 Dekket" : nextGatheringItem.staffing.badgeText}
                          </span>
                        </div>
                        <div className="font-bold text-slate-800">
                          {nextGatheringItem.gathering.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatNorwegianDateTime(nextGatheringItem.gathering.startsAt)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-400 italic">
                        Ingen planlagte aktiviteter for denne gruppen.
                      </div>
                    )}

                    {/* Fast møteplan */}
                    {group.meetingSchedule && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 px-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Fast tid: {group.meetingSchedule.weekday} kl. {group.meetingSchedule.time} ({group.meetingSchedule.frequency})</span>
                      </div>
                    )}

                    {/* Action link */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {gatherings.length} planlagte aktiviteter
                      </span>
                      <button
                        type="button"
                        id={`btn-open-group-card-${group.id}`}
                        onClick={() => navigate(`/leder/gruppe/${group.id}`)}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>Gå til gruppekort</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 2: Semesteroversikt for Arrangementer (Kompakt liste) */}
        {activeTab === "samlinger" && (
          <section className="space-y-3" aria-labelledby="leader-semester-heading">
            <div className="flex items-center justify-between">
              <h3 id="leader-semester-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Semesteroversikt
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                {filteredSemesterGatherings.length} {filteredSemesterGatherings.length === 1 ? "arrangement" : "arrangementer"}
              </span>
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
              <button
                type="button"
                id="filter-status-all"
                onClick={() => setSelectedStatusFilter("all")}
                className={`px-2.5 py-1.5 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
                  selectedStatusFilter === "all"
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs font-bold"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                <span>Alle</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                  {allSemesterGatherings.length}
                </span>
              </button>
              <button
                type="button"
                id="filter-status-red"
                onClick={() => setSelectedStatusFilter("red")}
                className={`px-2.5 py-1.5 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
                  selectedStatusFilter === "red"
                    ? "bg-red-100 text-red-900 border border-red-300 shadow-2xs font-bold"
                    : "bg-white text-red-600 border border-slate-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Forfall</span>
                {totalRedCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-200/80 text-red-900 font-bold">
                    {totalRedCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                id="filter-status-yellow"
                onClick={() => setSelectedStatusFilter("yellow")}
                className={`px-2.5 py-1.5 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
                  selectedStatusFilter === "yellow"
                    ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs font-bold"
                    : "bg-white text-amber-600 border border-slate-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Mangler</span>
                {totalYellowCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200/80 text-amber-900 font-bold">
                    {totalYellowCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                id="filter-status-green"
                onClick={() => setSelectedStatusFilter("green")}
                className={`px-2.5 py-1.5 rounded-xl font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
                  selectedStatusFilter === "green"
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs font-bold"
                    : "bg-white text-emerald-600 border border-slate-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Dekket</span>
                {totalGreenCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200/80 text-emerald-900 font-bold">
                    {totalGreenCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active Filter Notification Bar */}
            {selectedStatusFilter !== "all" && (
              <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200/80 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500 text-[11px] font-medium">Filter:</span>
                  {selectedStatusFilter === "red" && (
                    <span className="font-bold bg-red-100 text-red-800 text-[11px] px-2 py-0.5 rounded-md border border-red-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Trenger vikar / Forfall
                    </span>
                  )}
                  {selectedStatusFilter === "yellow" && (
                    <span className="font-bold bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Mangler frivillig
                    </span>
                  )}
                  {selectedStatusFilter === "green" && (
                    <span className="font-bold bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Fullt dekket
                    </span>
                  )}
                  <span className="text-slate-400">•</span>
                  <span className="font-bold text-slate-700 text-[11px]">
                    {filteredSemesterGatherings.length} {filteredSemesterGatherings.length === 1 ? "aktivitet" : "aktiviteter"}
                    {selectedStatusFilter === "red" && ` (${filteredUrgentTasksCount} ${filteredUrgentTasksCount === 1 ? "oppgave" : "oppgaver"} med forfall)`}
                  </span>
                </div>
                <button
                  type="button"
                  id="btn-reset-filters"
                  onClick={() => setSelectedStatusFilter("all")}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2 shrink-0 cursor-pointer"
                >
                  Nullstill
                </button>
              </div>
            )}

            {filteredSemesterGatherings.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-3">
                <p className="text-xs text-slate-500 font-medium">
                  {selectedStatusFilter === "red"
                    ? "Ingen aktiviteter med forfall eller vikarbehov."
                    : "Ingen aktiviteter matcher valgt filter."}
                </p>
                {selectedStatusFilter !== "all" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedStatusFilter("all")}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                    >
                      Nullstill filter
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Compact Semester Gathering List Container */
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
                {filteredSemesterGatherings.map((item) => {
                  const { gathering, group, staffing } = item;
                  const subtitle = formatCompactGatheringSubtitle(
                    gathering.startsAt,
                    gathering.location,
                    gathering.type === "arrangement" ? "Gudstjeneste" : (gathering.type === "gruppesamling" ? "Gruppesamling" : group.name)
                  );

                  return (
                    <div
                      key={gathering.id}
                      id={`leader-semester-gathering-${gathering.id}`}
                      onClick={() => navigate(`/leder/samling/${gathering.id}`)}
                      className="px-4 py-3 hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors truncate">
                          {gathering.title}
                        </h4>
                        <p className="text-xs text-slate-500 font-normal truncate">
                          {subtitle}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {staffing.color === "red" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Forfall
                          </span>
                        ) : staffing.color === "yellow" ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Mangler
                          </span>
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" title="Fullt dekket" />
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

