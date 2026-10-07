import React from "react";
import { Link } from "react-router-dom";
import { useCms } from "../../context/CmsContext";
import { useStockImageCount } from "../../hooks/useStockImageCount";
import {
  Calendar,
  FileText,
  ExternalLink,
  Star,
  Shield,
  Users,
  FolderKanban,
  ListTodo,
  Menu,
  X,
  LayoutDashboard,
  Newspaper,
  Sliders,
  Headphones,
  User,
  Palette,
  Database,
  Badge,
  Images,
  CircleHelp,
  Puzzle,
  LogOut,
} from "lucide-react";
import { countAddonsOn } from "../../utils/addons";
import { STUDIO_ADDONS, addonMenuSections } from "./addons";
import { StudioData, StudioTab, countUrgentTasks } from "./studio";
import { prefetchStudioTab } from "./studioTabLoaders";
import { useStudioAppearance } from "./studioAppearance";
import { StudioThemeToggle } from "./StudioThemeToggle";

function tabPrefetchHandlers(tab: StudioTab) {
  return {
    onMouseEnter: () => prefetchStudioTab(tab),
    onFocus: () => prefetchStudioTab(tab),
    onTouchStart: () => prefetchStudioTab(tab),
  };
}

interface StudioSidebarProps {
  studio: StudioData;
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({ studio, activeTab, onTabChange, sidebarOpen, onToggleSidebar }) => {
  const { currentUser, adminPersons, adminGroups, adminGatherings, adminTasks } = studio;
  const { pages, media, news, sermons, staff, settings, addons } = useCms();
  const urgentTasksCount = countUrgentTasks(adminTasks);
  const { sidebarTheme, toggleSidebarTheme } = useStudioAppearance();
  // The media library shows the images that come with the app next to the uploaded ones
  const mediaCount = media.filter((item) => item.status === "ready").length + useStockImageCount();

  return (
    <>
      {/* Mobile Topbar */}
      <div
        data-studio-theme={sidebarTheme}
        className="md:hidden flex items-center justify-between px-4 py-3 bg-[var(--studio-panel-bg)] border-b border-[var(--studio-border)] text-[var(--studio-text)]"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--studio-icon)]" />
          <span className="font-black text-sm">Menighetsplan Admin Studio</span>
        </div>
        <button
          type="button"
          onClick={() => onToggleSidebar()}
          className="p-2 rounded-lg bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ========================================================= */}
      {/* SIDEBAR NAVIGATION (FULLSKJERMS ARBEIDSFLATE)            */}
      {/* ========================================================= */}
      <aside
        data-studio-theme={sidebarTheme}
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-[var(--studio-panel-bg)] border-r border-[var(--studio-border)] text-[var(--studio-text)] flex flex-col justify-between transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Header Brand */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Shield className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[var(--studio-text)] tracking-tight">Admin & CMS Studio</h2>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Oppdateres i sanntid</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-[var(--studio-muted)] pt-1">
              Fullskjerms administrasjon for {settings.churchName}
            </p>
          </div>

          {/* Nav Section: Dashboard */}
          <div className="space-y-1">
            <button
              type="button"
              {...tabPrefetchHandlers("dashboard")}
              onClick={() => onTabChange("dashboard")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Oversikt & Dashboard</span>
            </button>

            {/* The two ways out of the studio. Each is listed here only. */}
            <div className="pt-2 pb-1 space-y-1.5 border-t border-[var(--studio-border)]">
              <Link
                to="/minside"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[var(--studio-icon)]" />
                  <span>Gå til Min Side</span>
                </div>
                <span className="text-[10px] text-[var(--studio-muted)]">Min profil</span>
              </Link>

              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Åpne offentlig nettside</span>
                </div>
                <span className="text-[10px] text-[var(--studio-muted)]">Forside ↗</span>
              </Link>
            </div>
          </div>

          {/* Nav Section: Nettside & CMS */}
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-[var(--studio-muted)] px-3 py-1">
              Nettside & CMS
            </div>

            <button
              type="button"
              {...tabPrefetchHandlers("cms-sider")}
              onClick={() => onTabChange("cms-sider")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "cms-sider"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4" />
                <span>Sider & Innhold</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {pages.length}
              </span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("cms-nyheter")}
              onClick={() => onTabChange("cms-nyheter")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "cms-nyheter"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Newspaper className="w-4 h-4" />
                <span>Aktuelt & Nyheter</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {news.length}
              </span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("cms-taler")}
              onClick={() => onTabChange("cms-taler")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "cms-taler"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Headphones className="w-4 h-4 text-amber-300" />
                <span>Taler & Prekener</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {sermons.length}
              </span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("cms-stab")}
              onClick={() => onTabChange("cms-stab")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "cms-stab"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Lederskap & Stab</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {staff.length}
              </span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("cms-medier")}
              onClick={() => onTabChange("cms-medier")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "cms-medier"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Images className="w-4 h-4" />
                <span>Mediebibliotek</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {mediaCount}
              </span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("cms-design")}
              onClick={() => onTabChange("cms-design")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "cms-design"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Palette className="w-4 h-4 text-pink-400" />
                <span>Tema & Designsystem</span>
              </div>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("cms-innstillinger")}
              onClick={() => onTabChange("cms-innstillinger")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "cms-innstillinger"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Nettside-innstillinger</span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("cms-overstyringer")}
              onClick={() => onTabChange("cms-overstyringer")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "cms-overstyringer"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <Star className="w-4 h-4 text-amber-400" />
              <span>Forside-overstyring</span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("cms-hjelp")}
              onClick={() => onTabChange("cms-hjelp")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "cms-hjelp"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <CircleHelp className="w-4 h-4" />
              <span>Hjelp</span>
            </button>
          </div>

          {/* Nav Section: Menighetsplanlegger */}
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-[var(--studio-muted)] px-3 py-1">
              Arrangementer & Bemanning
            </div>

            <button
              type="button"
              {...tabPrefetchHandlers("planlegger-samlinger")}
              onClick={() => onTabChange("planlegger-samlinger")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "planlegger-samlinger"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-[var(--studio-icon)]" />
                <span>Arrangementer</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {adminGatherings.length}
              </span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("planlegger-oppgaver")}
              onClick={() => onTabChange("planlegger-oppgaver")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "planlegger-oppgaver"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ListTodo className="w-4 h-4 text-amber-400" />
                <span>Trenger oppfølging</span>
              </div>
              {urgentTasksCount > 0 ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 border border-red-700 text-red-300 font-bold">
                  {urgentTasksCount} ubesatt
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                  {adminTasks.length}
                </span>
              )}
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("planlegger-grupper")}
              onClick={() => onTabChange("planlegger-grupper")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "planlegger-grupper"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FolderKanban className="w-4 h-4" />
                <span>Grupper & Husfellesskap</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {adminGroups.length}
              </span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("planlegger-personer")}
              onClick={() => onTabChange("planlegger-personer")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "planlegger-personer"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Personer</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {adminPersons.length}
              </span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("planlegger-roller")}
              onClick={() => onTabChange("planlegger-roller")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "planlegger-roller"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Badge className="w-4 h-4" />
                <span>Roller</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {studio.adminVolunteerRoles.length}
              </span>
            </button>
          </div>

          {/* Nav Section: System & Database */}
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-[var(--studio-muted)] px-3 py-1">
              System & Database
            </div>

            <button
              type="button"
              {...tabPrefetchHandlers("database-admin")}
              onClick={() => onTabChange("database-admin")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "database-admin"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-[var(--studio-icon)]" />
                <span>Database og Testdata</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                Firestore
              </span>
            </button>

            <button
              type="button"
              {...tabPrefetchHandlers("moduler")}
              onClick={() => onTabChange("moduler")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                activeTab === "moduler"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Puzzle className="w-4 h-4 text-[var(--studio-icon)]" />
                <span>Moduler</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--studio-surface)] text-[var(--studio-muted)]">
                {countAddonsOn(addons)} av {STUDIO_ADDONS.length} på
              </span>
            </button>
          </div>

        {/* Nav sections from the add-ons that are on (see addons.ts). An add-on that is off is not in the menu. */}
          {addonMenuSections(addons).map((section) => (
            <div key={section.heading} className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--studio-muted)] px-3 py-1">
                {section.heading}
              </div>

              {section.entries.map((entry) => (
                <button
                  key={entry.tab}
                  type="button"
                  {...tabPrefetchHandlers(entry.tab)}
                  onClick={() => onTabChange(entry.tab)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                    activeTab === entry.tab
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)]"
                  }`}
                >
                  <entry.icon className="w-4 h-4 text-[var(--studio-icon)]" />
                  <span>{entry.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Sidebar Footer: the look of the menu, and who is signed in */}
        <div className="p-4 border-t border-[var(--studio-border)] bg-[var(--studio-panel-bg)] space-y-2 text-xs">
          <StudioThemeToggle
            theme={sidebarTheme}
            onToggle={toggleSidebarTheme}
            darkLabel="Mørk meny"
            lightLabel="Lys meny"
          />

          <div className="pt-2 border-t border-[var(--studio-border)] text-[11px] text-[var(--studio-muted)] flex items-center justify-between">
            <span>Innlogget som:</span>
            <strong className="text-[var(--studio-text)] truncate max-w-[120px]">{currentUser.name}</strong>
          </div>

          <button
            type="button"
            onClick={() => void studio.signOut()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--studio-border)] text-[11px] font-bold text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Logg ut
          </button>
        </div>
      </aside>
    </>
  );
};
