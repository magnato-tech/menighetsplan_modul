import React, { Suspense, useState, useEffect, lazy } from "react";

import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { CheckCircle2 } from "lucide-react";

import { useAdminDashboard } from "../../hooks/useAppHooks";

import { StudioTab, ShowFeedback, studioTabUrl, toStudioTab } from "./studio";

import { areaOfTab, areaToShow, readStoredArea, storeArea, type StudioArea } from "./studioAreas";

import { useLevel } from "../../hooks/useLevel";

import { useTimedMessage } from "../../hooks/useTimedMessage";

import { StudioSidebar } from "./StudioSidebar";
import { readStoredFlag, writeStoredFlag } from "../../utils/storedFlag";
import { UnsavedChangesContext, useUnsavedRegistry } from "../../hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "./tabs/pages/UnsavedChangesDialog";
import { helpArticleIdForTab } from "./help/articles";
import { isWebEditor } from "../../utils/session";
import { webEditorMayOpen } from "./webEditor";

import { AddonGate } from "./AddonGate";

import { LevelGate } from "./LevelGate";

import { DemoGate } from "./DemoGate";

import { StudioTabErrorBoundary } from "../../components/StudioTabErrorBoundary";

import { parseAdminDetailRoute } from "../../utils/adminStudioRoutes";

import { StudioAppearanceProvider, useStudioAppearance } from "./studioAppearance";


import { studioBg } from "./studioTheme";

import {

  LazyAdminCmsPanel,

  LazyAddonsTab,

  LazyAnalyticsTab,
  LazySiteTrafficTab,

  LazyDemoSetupTab,

  LazyDashboardTab,

  LazyDatabaseTab,

  LazyGatheringsTab,

  LazyGroupsTab,

  LazyHelpTab,

  LazyMediaTab,

  LazyNewsTab,

  LazyPersonsTab,

  LazyRolesTab,

  LazyTemplatesTab,
  LazySemesterPlanTab,

  LazyYearWheelTab,
  LazyEmailTab,

  LazySermonsTab,

  LazySiteSettingsTab,

  LazyStaffTab,

  LazyTasksTab,

  LazyThemeTab,

  LazyVisibilityTab,

  prefetchStudioTab,

} from "./studioTabLoaders";



const LazyAdminPersonDetailPage = lazy(() =>

  import("../AdminPersonDetailPage").then((m) => ({ default: m.AdminPersonDetailPage }))

);

const LazyAdminGroupDetailPage = lazy(() =>

  import("../AdminGroupDetailPage").then((m) => ({ default: m.AdminGroupDetailPage }))

);

const LazyAdminTaskDetailPage = lazy(() =>

  import("../AdminTaskDetailPage").then((m) => ({ default: m.AdminTaskDetailPage }))

);

const LazyAdminGatheringDetailPage = lazy(() =>

  import("../AdminGatheringDetailPage").then((m) => ({ default: m.AdminGatheringDetailPage }))

);



function TabLoadingPlaceholder() {

  return <p className="text-sm text-[var(--studio-muted)] p-2">Laster fane…</p>;

}



interface StudioTabPanelProps {

  tab: StudioTab;

  activeTab: StudioTab;

  visited: boolean;

  children: React.ReactNode;

}



function StudioTabPanel({ tab, activeTab, visited, children }: StudioTabPanelProps) {

  if (!visited) return null;

  return (

    <div hidden={activeTab !== tab}>

      <StudioTabErrorBoundary>

        <Suspense fallback={<TabLoadingPlaceholder />}>

          {/* A tab is only drawn when the demo and the level have it, and one that belongs to an add-on only while the add-on is on */}

          <DemoGate tab={tab}>

            <LevelGate tab={tab}>

              <AddonGate tab={tab}>{children}</AddonGate>

            </LevelGate>

          </DemoGate>

        </Suspense>

      </StudioTabErrorBoundary>

    </div>

  );

}



function AdminStudioDetail({ kind }: { kind: "person" | "group" | "gathering" | "task" }) {

  return (

    <StudioTabErrorBoundary>

      <Suspense fallback={<TabLoadingPlaceholder />}>

        {kind === "person" && <LazyAdminPersonDetailPage />}

        {kind === "group" && <LazyAdminGroupDetailPage />}

        {kind === "gathering" && <LazyAdminGatheringDetailPage />}

        {kind === "task" && <LazyAdminTaskDetailPage />}

      </Suspense>

    </StudioTabErrorBoundary>

  );

}



function AdminStudioContent() {

  const location = useLocation();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const { contentTheme } = useStudioAppearance();



  if (location.pathname === "/admin/settings") {

    return <Navigate to={studioTabUrl("moduler")} replace />;

  }



  const detailRoute = parseAdminDetailRoute(location.pathname);



  const studio = useAdminDashboard();

  // A web editor has the website part of the admin only (see webEditor.ts)
  const webEditor = isWebEditor(studio.currentUser);



  const tabParam = toStudioTab(searchParams.get("tab"));

  const [activeTab, setActiveTab] = useState<StudioTab>(tabParam);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [visitedTabs, setVisitedTabs] = useState<StudioTab[]>([tabParam]);

  const [createRequest, setCreateRequest] = useState<StudioTab | null>(null);

  // While a page is edited, the side menu can fold to icons so the editor gets room
  const [pageEditorOpen, setPageEditorOpen] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState(() => readStoredFlag("menighetsplan:admin-meny-utvidet", false));
  const toggleMenu = () => {
    const next = !menuExpanded;
    setMenuExpanded(next);
    writeStoredFlag("menighetsplan:admin-meny-utvidet", next);
  };
  const mayShow = (tab: StudioTab) => visitedTabs.includes(tab) && (!webEditor || webEditorMayOpen(tab));



  useEffect(() => {

    prefetchStudioTab("dashboard");

    prefetchStudioTab(tabParam);

  }, [tabParam]);



  const openTab = (tab: StudioTab) => {

    setActiveTab(tab);

    setVisitedTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]));

  };



  useEffect(() => {

    if (searchParams.has("tab")) openTab(tabParam);

  }, [searchParams, tabParam]);



  const handleTabChange = (tab: StudioTab) => {

    openTab(tab);

    // Help opens on the article for the tab one came from
    navigate(tab === "cms-hjelp" ? `${studioTabUrl(tab)}#${helpArticleIdForTab(activeTab, area)}` : studioTabUrl(tab));

    setSidebarOpen(false);

  };



  const handleCreateIn = (tab: StudioTab) => {

    setCreateRequest(tab);

    handleTabChange(tab);

  };

  const clearCreateRequest = () => setCreateRequest(null);

  // The part of the admin the menu shows (see studioAreas.ts): the part of the open tab, or the one last chosen

  const level = useLevel();

  const [chosenArea, setChosenArea] = useState<StudioArea | null>(readStoredArea);

  const [lastTabIn, setLastTabIn] = useState<Partial<Record<StudioArea, StudioTab>>>({});

  const shownTab = detailRoute?.backTab ?? activeTab;
  // The pages panel stays mounted on other tabs, so only fold the menu while it is the tab shown
  const editingPageShown = pageEditorOpen && shownTab === "cms-sider";

  const area: StudioArea = webEditor ? "nettside" : areaToShow(shownTab, chosenArea, level);

  // Any other tab, or a page of the register or the planning, sends a web editor to the overview
  const outsideWebEditor = webEditor && (Boolean(detailRoute) || !webEditorMayOpen(activeTab));
  useEffect(() => {
    if (outsideWebEditor) navigate(studioTabUrl("dashboard"), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outsideWebEditor]);

  useEffect(() => {

    if (area !== chosenArea) {

      setChosenArea(area);

      storeArea(area);

    }

    if (areaOfTab(shownTab)) setLastTabIn((prev) => ({ ...prev, [area]: shownTab }));

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [area, shownTab]);

  const handleAreaChange = (next: StudioArea) => {

    setChosenArea(next);

    storeArea(next);

    handleTabChange(lastTabIn[next] ?? "dashboard");

  };



  const [feedback, setFeedback] = useTimedMessage<{ text: string; type: "success" | "error" }>();

  const showFeedback: ShowFeedback = (text, type = "success") => setFeedback({ text, type });

  // Editors with changes not saved: marked in the side menu, and asked about before one leaves the studio
  const { entries: unsavedEntries, registry: unsavedRegistry } = useUnsavedRegistry();
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null);
  const leaveStudio = (action: () => void) => {
    if (Object.keys(unsavedEntries).length > 0) setPendingExit(() => action);
    else action();
  };
  const unsavedList = Object.entries(unsavedEntries);
  const exitWhat = unsavedList.length > 1 ? "flere ting" : ({ "cms-nyheter": "artikkelen", "cms-taler": "talen" } as Record<string, string>)[unsavedList[0]?.[0] ?? ""] ?? "siden";
  const saveAllAndExit = async () => {
    const action = pendingExit;
    setPendingExit(null);
    for (const [, entry] of unsavedList) {
      if (!(await entry.save())) return;
    }
    action?.();
  };



  return (

    <UnsavedChangesContext.Provider value={unsavedRegistry}>

    <div className="min-h-[calc(100vh-var(--demo-strip,0px))] flex flex-col md:flex-row font-sans">

      {feedback && (

        <div

          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold transition-all ${

            feedback.type === "success"

              ? "bg-emerald-600 text-white"

              : "bg-rose-600 text-white"

          }`}

        >

          <CheckCircle2 className="w-4 h-4" />

          <span>{feedback.text}</span>

        </div>

      )}



      <StudioSidebar

        studio={studio}

        compact={editingPageShown && !menuExpanded}

        onToggleCompact={editingPageShown ? toggleMenu : undefined}

        activeTab={shownTab}

        area={area}

        onAreaChange={handleAreaChange}

        onTabChange={handleTabChange}

        sidebarOpen={sidebarOpen}

        unsavedTabs={Object.keys(unsavedEntries)}

        onLeaveStudio={leaveStudio}

        webEditor={webEditor}

        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}

      />



      {/* The window scrolls, not this area: an area that only looked like it scrolled held on to everything
          meant to stay at the top while scrolling (the menu bar in Sider, the line with Lagre in the editor) */}
      <main

        data-studio-theme={contentTheme}

        className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 ${studioBg}`}

      >



        {detailRoute && !webEditor ? (

          <LevelGate tab={detailRoute.backTab}>

            <AdminStudioDetail kind={detailRoute.kind} />

          </LevelGate>

        ) : (

          <>

        <StudioTabPanel tab="dashboard" activeTab={activeTab} visited={mayShow("dashboard")}>

          <LazyDashboardTab studio={studio} area={area} onTabChange={handleTabChange} onCreateIn={handleCreateIn} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-sider" activeTab={activeTab} visited={mayShow("cms-sider")}>

          <LazyAdminCmsPanel

            showFeedback={showFeedback}

            createRequested={createRequest === "cms-sider"}

            onCreateHandled={clearCreateRequest}

            onEditorOpenChange={setPageEditorOpen}

          />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-medier" activeTab={activeTab} visited={mayShow("cms-medier")}>

          <LazyMediaTab showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-nyheter" activeTab={activeTab} visited={mayShow("cms-nyheter")}>

          <LazyNewsTab

            studio={studio}

            showFeedback={showFeedback}

            createRequested={createRequest === "cms-nyheter"}

            onCreateHandled={clearCreateRequest}

          />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-taler" activeTab={activeTab} visited={mayShow("cms-taler")}>

          <LazySermonsTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-stab" activeTab={activeTab} visited={mayShow("cms-stab")}>

          <LazyStaffTab showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-design" activeTab={activeTab} visited={mayShow("cms-design")}>

          <LazyThemeTab showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-innstillinger" activeTab={activeTab} visited={mayShow("cms-innstillinger")}>

          <LazySiteSettingsTab />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-overstyringer" activeTab={activeTab} visited={mayShow("cms-overstyringer")}>

          <LazyVisibilityTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-hjelp" activeTab={activeTab} visited={mayShow("cms-hjelp")}>

          <LazyHelpTab area={area} webEditor={webEditor} />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-samlinger" activeTab={activeTab} visited={mayShow("planlegger-samlinger")}>

          <LazyGatheringsTab
            studio={studio}
            showFeedback={showFeedback}
            createRequested={createRequest === "planlegger-samlinger"}
            onCreateHandled={clearCreateRequest}
          />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-oppgaver" activeTab={activeTab} visited={mayShow("planlegger-oppgaver")}>

          <LazyTasksTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-grupper" activeTab={activeTab} visited={mayShow("planlegger-grupper")}>

          <LazyGroupsTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-personer" activeTab={activeTab} visited={mayShow("planlegger-personer")}>

          <LazyPersonsTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-roller" activeTab={activeTab} visited={mayShow("planlegger-roller")}>

          <LazyRolesTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-maler" activeTab={activeTab} visited={mayShow("planlegger-maler")}>

          <LazyTemplatesTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>

        <StudioTabPanel tab="planlegger-semesterplan" activeTab={activeTab} visited={mayShow("planlegger-semesterplan")}>
          <LazySemesterPlanTab studio={studio} showFeedback={showFeedback} />
        </StudioTabPanel>

        <StudioTabPanel tab="arshjul" activeTab={activeTab} visited={mayShow("arshjul")}>
          <LazyYearWheelTab showFeedback={showFeedback} />
        </StudioTabPanel>

        <StudioTabPanel tab="epost" activeTab={activeTab} visited={mayShow("epost")}>
          <LazyEmailTab studio={studio} showFeedback={showFeedback} />
        </StudioTabPanel>



        <StudioTabPanel tab="database-admin" activeTab={activeTab} visited={mayShow("database-admin")}>

          <LazyDatabaseTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="moduler" activeTab={activeTab} visited={mayShow("moduler")}>

          <LazyAddonsTab showFeedback={showFeedback} onTabChange={handleTabChange} />

        </StudioTabPanel>

        <StudioTabPanel tab="analyse" activeTab={activeTab} visited={mayShow("analyse")}>

          <LazyAnalyticsTab showFeedback={showFeedback} onTabChange={handleTabChange} />

        </StudioTabPanel>

        <StudioTabPanel tab="nettsidebesok" activeTab={activeTab} visited={mayShow("nettsidebesok")}>

          <LazySiteTrafficTab showFeedback={showFeedback} />

        </StudioTabPanel>

        {/* Only for the owner of the demo (see utils/demoOwner.ts). The tab itself asks who is looking. */}

        <StudioTabPanel tab="demo-oppsett" activeTab={activeTab} visited={mayShow("demo-oppsett")}>

          <LazyDemoSetupTab showFeedback={showFeedback} />

        </StudioTabPanel>

          </>

        )}

      </main>

      <UnsavedChangesDialog
        open={pendingExit !== null}
        pageTitle={unsavedList.length === 1 ? unsavedList[0][1].title : undefined}
        what={exitWhat}
        onSave={saveAllAndExit}
        onDiscard={() => {
          const action = pendingExit;
          setPendingExit(null);
          action?.();
        }}
        onStay={() => setPendingExit(null)}
      />

    </div>

    </UnsavedChangesContext.Provider>

  );

}



export const AdminStudio: React.FC = () => (

  <StudioAppearanceProvider>

    <AdminStudioContent />

  </StudioAppearanceProvider>

);


