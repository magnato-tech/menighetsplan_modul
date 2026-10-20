import React from "react";
import { Link } from "react-router-dom";
import { useCms } from "../../../context/CmsContext";
import {
  Globe,
  Calendar,
  FileText,
  Plus,
  Users,
  ListTodo,
  LayoutDashboard,
  Newspaper,
  Sliders,
  Headphones,
} from "lucide-react";
import {
  StudioData,
  StudioTab,
  NEAR_WEEKS,
  countPublicGatherings,
  isUrgentTask,
  taskStateOf,
  upcomingGatherings,
  withinWeeks,
} from "../studio";
import { UpcomingGatheringsPanel } from "./dashboard/UpcomingGatheringsPanel";
import type { StudioArea } from "../studioAreas";
import { useLevel } from "../../../hooks/useLevel";
import { hasPlanner } from "../../../utils/level";

interface DashboardTabProps {
  studio: StudioData;
  /** The part of the admin that is chosen: the overview shows what belongs to it (see studioAreas.ts). */
  area: StudioArea;
  onTabChange: (tab: StudioTab) => void;
  /** Opens the tab with its editor for a new item already showing. */
  onCreateIn: (tab: StudioTab) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ studio, area, onTabChange, onCreateIn }) => {
  const { adminGatherings, adminTasks } = studio;
  const { pages, news, sermons, staff, settings } = useCms();
  const publicGatheringsCount = countPublicGatherings(adminGatherings);
  const withPlanner = hasPlanner(useLevel());
  const planning = area === "planlegging";
  // What the planning opens with: the next gatherings, and what must be ordered in the nearest weeks
  const upcoming = planning ? upcomingGatherings(adminGatherings, adminTasks, 3) : [];
  const upcomingCount = planning ? upcomingGatherings(adminGatherings, [], Infinity).length : 0;
  const near = planning ? withinWeeks(adminTasks, NEAR_WEEKS) : [];
  const nearToOrder = near.filter(isUrgentTask).length;
  const nearForfall = near.filter((item) => taskStateOf(item) === "forfall").length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--studio-text)] tracking-tight">
            {planning ? "Planlegging" : "Nettside"}
          </h1>
          <p className={`text-xs sm:text-sm text-[var(--studio-muted)] mt-1 ${planning ? "hidden sm:block" : ""}`}>
            {planning
              ? `Arrangementene, de frivillige og bemanningen i ${settings.churchName}.`
              : `Sidene, nyhetene, talene og utseendet på nettsiden til ${settings.churchName}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            target="_blank"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Se nettsiden live</span>
          </Link>
          <Link
            to="/minside"
            className="px-4 py-2 rounded-xl bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-amber-300" />
            <span>Min Side</span>
          </Link>
        </div>
      </div>

      {planning && (
        <UpcomingGatheringsPanel
          upcoming={upcoming}
          withPlanner={withPlanner}
          onShowAll={() => onTabChange("planlegger-samlinger")}
        />
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {planning && (
        <div
          onClick={() => onTabChange("planlegger-samlinger")}
          className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] hover:border-indigo-500 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--studio-muted)] uppercase tracking-wider">Arrangementer framover</span>
            <Calendar className="w-4 h-4 text-[var(--studio-icon)]" />
          </div>
          <div className="text-3xl font-black text-[var(--studio-text)]">{upcomingCount}</div>
          <p className="text-[11px] text-[var(--studio-muted)]">{publicGatheringsCount} offentlig i kalenderen</p>
        </div>
        )}

        {planning && withPlanner && (
        <div
          onClick={() => onTabChange("planlegger-oppgaver")}
          className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] hover:border-indigo-500 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--studio-muted)] uppercase tracking-wider">Neste {NEAR_WEEKS} uker</span>
            <ListTodo className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-3xl font-black ${nearToOrder > 0 ? "text-rose-400" : "text-[var(--studio-text)]"}`}>{nearToOrder}</div>
          <p className="text-[11px] text-[var(--studio-muted)]">
            {nearToOrder === 0
              ? "Ingenting må ordnes"
              : nearForfall > 0
              ? `må ordnes, ${nearForfall} av dem forfall`
              : "må ordnes"}
          </p>
        </div>
        )}

        {!planning && (
          <>

        <div
          onClick={() => onTabChange("cms-taler")}
          className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] hover:border-indigo-500 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--studio-muted)] uppercase tracking-wider">Taler & Prekener</span>
            <Headphones className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-3xl font-black text-[var(--studio-text)]">{sermons.length}</div>
          <p className="text-[11px] text-[var(--studio-muted)]">Opptak tilgjengelig for menigheten</p>
        </div>

        <div
          onClick={() => onTabChange("cms-sider")}
          className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] hover:border-indigo-500 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--studio-muted)] uppercase tracking-wider">Sider</span>
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-[var(--studio-text)]">{pages.length}</div>
          <p className="text-[11px] text-[var(--studio-muted)]">Publiserte sider på nettsiden</p>
        </div>

        <div
          onClick={() => onTabChange("cms-nyheter")}
          className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] hover:border-indigo-500 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--studio-muted)] uppercase tracking-wider">Nyheter & Aktuelt</span>
            <Newspaper className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-black text-[var(--studio-text)]">{news.length}</div>
          <p className="text-[11px] text-[var(--studio-muted)]">Artikler for frivillige og offentlighet</p>
        </div>

        <div
          onClick={() => onTabChange("cms-stab")}
          className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] hover:border-indigo-500 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--studio-muted)] uppercase tracking-wider">Lederskap & Stab</span>
            <Users className="w-4 h-4 text-[var(--studio-icon)]" />
          </div>
          <div className="text-3xl font-black text-[var(--studio-text)]">{staff.length}</div>
          <p className="text-[11px] text-[var(--studio-muted)]">Registrerte ledere og ansatte</p>
        </div>
          </>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hurtighandlinger Nettside CMS */}
        {!planning && (
        <div className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
          <div className="flex items-center gap-2 text-[var(--studio-icon)] font-bold text-sm">
            <Globe className="w-4 h-4" />
            <span>Hurtighandlinger</span>
          </div>
          <div className="space-y-2 text-xs">
            <button
              type="button"
              onClick={() => {
                onCreateIn("cms-nyheter");
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)]/80 text-[var(--studio-text)] font-semibold transition-colors text-left"
            >
              <span>Skriv en ny aktuelt-sak eller nyhet</span>
              <Plus className="w-4 h-4 text-[var(--studio-icon)]" />
            </button>
            <button
              type="button"
              onClick={() => {
                onCreateIn("cms-sider");
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)]/80 text-[var(--studio-text)] font-semibold transition-colors text-left"
            >
              <span>Opprett en ny underside på nettsiden</span>
              <Plus className="w-4 h-4 text-emerald-400" />
            </button>
            <button
              type="button"
              onClick={() => onTabChange("cms-innstillinger")}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)]/80 text-[var(--studio-text)] font-semibold transition-colors text-left"
            >
              <span>Oppdater Vipps, kontonummer eller kontaktinfo</span>
              <Sliders className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>
        )}

        {/* Hurtighandlinger Menighetsplanlegger */}
        {planning && (
        <div className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <Calendar className="w-4 h-4" />
            <span>Hurtighandlinger</span>
          </div>
          <div className="space-y-2 text-xs">
            <button
              type="button"
              onClick={() => onTabChange("planlegger-samlinger")}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)]/80 text-[var(--studio-text)] font-semibold transition-colors text-left"
            >
              <span>Opprett ny gudstjeneste eller samling</span>
              <Plus className="w-4 h-4 text-amber-300" />
            </button>
            {withPlanner && (
            <button
              type="button"
              onClick={() => onTabChange("planlegger-oppgaver")}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)]/80 text-[var(--studio-text)] font-semibold transition-colors text-left"
            >
              <span>Forfall og ubesatte oppgaver</span>
              <ListTodo className="w-4 h-4 text-rose-400" />
            </button>
            )}
            <button
              type="button"
              onClick={() => onTabChange("planlegger-personer")}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)]/80 text-[var(--studio-text)] font-semibold transition-colors text-left"
            >
              <span>Administrer frivillige, ledere og deltakere</span>
              <Users className="w-4 h-4 text-[var(--studio-icon)]" />
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
