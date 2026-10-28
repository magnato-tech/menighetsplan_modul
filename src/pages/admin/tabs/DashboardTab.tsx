import React from "react";
import { Link } from "react-router-dom";
import { useCms } from "../../../context/CmsContext";
import {
  Globe,
  Calendar,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileText,
  Plus,
  Users,
  ListTodo,
  LayoutDashboard,
  Newspaper,
  Sliders,
  Headphones,
  User,
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
import { UpcomingGatheringCard, UpcomingGatheringsPanel } from "./dashboard/UpcomingGatheringsPanel";
import { SiteCheckCard } from "../../../components/admin/SiteCheckCard";
import { STUDIO_AREAS, STUDIO_AREA_NAMES, type StudioArea } from "../studioAreas";
import { useStudioMenuEntries } from "../studioMenu";
import { useLevel } from "../../../hooks/useLevel";
import { hasPlanner } from "../../../utils/level";
import { countPages } from "../../../utils/menu";

interface DashboardTabProps {
  studio: StudioData;
  /** The part of the admin that is chosen: the overview shows what belongs to it (see studioAreas.ts). */
  area: StudioArea;
  /** A web editor has the website part only, so there is no choice of part. */
  webEditor?: boolean;
  onTabChange: (tab: StudioTab) => void;
  /** The choice of part on a phone, where the overview holds it (on a larger screen the side menu does). */
  onAreaChange: (area: StudioArea) => void;
  /** Opens the tab with its editor for a new item already showing. */
  onCreateIn: (tab: StudioTab) => void;
}

// One row of the menu on a phone: large enough to tap, with a thin line between the rows
const MENU_ROW =
  "w-full min-h-[52px] flex items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[var(--studio-text)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer";
const ALERT_RED = "text-[11px] px-2 py-0.5 rounded-md bg-red-900/60 border border-red-700 text-red-300 font-bold";
const ALERT_AMBER = "text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 font-bold";

export const DashboardTab: React.FC<DashboardTabProps> = ({ studio, area, webEditor = false, onTabChange, onAreaChange, onCreateIn }) => {
  const { adminGatherings, adminTasks } = studio;
  const { pages, news, sermons, staff, settings, media } = useCms();
  // The moment the overview was opened, for what «Sjekk nettsiden» counts as ahead and as old
  const [now] = React.useState(() => Date.now());
  const gatherings = React.useMemo(() => adminGatherings.map((item) => item.gathering), [adminGatherings]);
  const publicGatheringsCount = countPublicGatherings(adminGatherings);
  const withPlanner = hasPlanner(useLevel());
  const planning = area === "planlegging";
  const pageCounts = countPages(pages);
  // The menu on a phone: the same entries as the side menu shows for this part
  const menuEntries = useStudioMenuEntries(studio, area, { webEditor });
  // What the planning opens with: the next gatherings, and what must be ordered in the nearest weeks
  const allUpcoming = planning ? upcomingGatherings(adminGatherings, adminTasks, Infinity) : [];
  const upcoming = allUpcoming.slice(0, 3);
  // On a phone the next service comes first: the first gudstjeneste, or else the first gathering
  const nextService = allUpcoming.find((entry) => entry.item.gathering.isGudstjeneste === true) ?? allUpcoming[0];
  const upcomingCount = planning ? upcomingGatherings(adminGatherings, [], Infinity).length : 0;
  const near = planning ? withinWeeks(adminTasks, NEAR_WEEKS) : [];
  const nearToOrder = near.filter(isUrgentTask).length;
  const nearForfall = near.filter((item) => taskStateOf(item) === "forfall").length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-black text-[var(--studio-text)] tracking-tight">
            {planning ? "Planlegging" : "Nettside"}
          </h1>
          <p className={`text-xs sm:text-sm text-[var(--studio-muted)] mt-1 ${planning ? "hidden sm:block" : ""}`}>
            {planning
              ? `Arrangementene, de frivillige og bemanningen i ${settings.churchName}.`
              : `Sidene, nyhetene, talene og utseendet på nettsiden til ${settings.churchName}.`}
          </p>
        </div>

        {/* On a phone these two are rows in the menu below */}
        <div className="hidden md:flex items-center gap-2">
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

      {/* Start page on a phone: the next service, the choice of part, then the menu. Not on a larger screen. */}
      {planning && nextService && (
        <div className="md:hidden">
          <UpcomingGatheringCard upcoming={nextService} first withPlanner={withPlanner} />
        </div>
      )}

      {!webEditor && (
        <div role="tablist" aria-label="Del av admin" className="md:hidden grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--studio-surface)]">
          {STUDIO_AREAS.map((choice) => (
            <button
              key={choice}
              type="button"
              role="tab"
              aria-selected={area === choice}
              onClick={() => onAreaChange(choice)}
              className={`px-2 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                area === choice ? "bg-indigo-600 text-white shadow-sm" : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
              }`}
            >
              {STUDIO_AREA_NAMES[choice]}
            </button>
          ))}
        </div>
      )}

      <nav aria-label="Admin-menyen" className="md:hidden rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] divide-y divide-[var(--studio-border)] overflow-hidden">
        {menuEntries.map((entry) => (
          <button key={entry.tab} type="button" onClick={() => onTabChange(entry.tab)} className={MENU_ROW}>
            <entry.icon className={`w-5 h-5 shrink-0 ${entry.iconClass}`} aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate">{entry.label}</span>
            {entry.count !== undefined && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--studio-bg)] text-[var(--studio-muted)]">{entry.count}</span>
            )}
            {entry.alerts?.map((alert) => (
              <span key={alert.text} title={alert.title} className={alert.tone === "red" ? ALERT_RED : ALERT_AMBER}>
                {alert.text}
              </span>
            ))}
            <ChevronRight className="w-4 h-4 shrink-0 text-[var(--studio-muted)]" aria-hidden="true" />
          </button>
        ))}

        {/* In both parts, as in the side menu */}
        <button type="button" onClick={() => onTabChange("cms-hjelp")} className={MENU_ROW}>
          <CircleHelp className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0 truncate">Hjelp</span>
          <ChevronRight className="w-4 h-4 shrink-0 text-[var(--studio-muted)]" aria-hidden="true" />
        </button>
        <Link to="/minside" className={MENU_ROW}>
          <User className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0 truncate">Gå til Min Side</span>
          <ChevronRight className="w-4 h-4 shrink-0 text-[var(--studio-muted)]" aria-hidden="true" />
        </Link>
        <Link to="/" target="_blank" rel="noreferrer" className={MENU_ROW}>
          <ExternalLink className="w-5 h-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <span className="flex-1 min-w-0 truncate">Åpne offentlig nettside</span>
          <ChevronRight className="w-4 h-4 shrink-0 text-[var(--studio-muted)]" aria-hidden="true" />
        </Link>
      </nav>

      {planning && (
        <UpcomingGatheringsPanel
          upcoming={upcoming}
          withPlanner={withPlanner}
          onShowAll={() => onTabChange("planlegger-samlinger")}
          shownAboveOnPhone={nextService?.item.gathering.id}
        />
      )}

      {/* Stat Cards */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="text-3xl font-black text-[var(--studio-text)]">{pageCounts.published}</div>
          <p className="text-[11px] text-[var(--studio-muted)]">Publiserte sider på nettsiden</p>
          <p className="text-[11px] text-[var(--studio-muted)]">
            {pageCounts.main} hovedfaner · {pageCounts.sub} underfaner
            {pageCounts.scheduled > 0 && ` · ${pageCounts.scheduled} planlagt`}
            {pageCounts.drafts > 0 && ` · ${pageCounts.drafts} ${pageCounts.drafts === 1 ? "kladd" : "kladder"}`}
          </p>
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

      {!planning && <SiteCheckCard pages={pages} news={news} gatherings={gatherings} media={media} now={now} onTabChange={onTabChange} />}

      {/* Quick Actions Grid */}
      <div className="hidden md:grid md:grid-cols-2 gap-6">
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
              onClick={() => onCreateIn("planlegger-samlinger")}
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
