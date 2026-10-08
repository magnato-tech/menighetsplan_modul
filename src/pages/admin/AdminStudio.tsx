import React, { Suspense, useState, useEffect, lazy } from "react";

import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { CheckCircle2 } from "lucide-react";

import { useAdminDashboard } from "../../hooks/useAppHooks";

import { StudioTab, ShowFeedback, studioTabUrl, toStudioTab } from "./studio";

import { useTimedMessage } from "../../hooks/useTimedMessage";

import { StudioSidebar } from "./StudioSidebar";

import { AddonGate } from "./AddonGate";

import { LevelGate } from "./LevelGate";

import { StudioTabErrorBoundary } from "../../components/StudioTabErrorBoundary";

import { parseAdminDetailRoute } from "../../utils/adminStudioRoutes";

import { StudioAppearanceProvider, useStudioAppearance } from "./studioAppearance";

import { StudioThemeToggle } from "./StudioThemeToggle";

import { studioBg } from "./studioTheme";

import {

  LazyAdminCmsPanel,

  LazyAddonsTab,

  LazyAnalyticsTab,
  LazySiteTrafficTab,

  LazyDashboardTab,

  LazyDatabaseTab,

  LazyGatheringsTab,

  LazyGroupsTab,

  LazyHelpTab,

  LazyMediaTab,

  LazyNewsTab,

  LazyPersonsTab,

  LazyRolesTab,

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

          {/* A tab is only drawn when the level has it, and one that belongs to an add-on only while the add-on is on */}

          <LevelGate tab={tab}>

            <AddonGate tab={tab}>{children}</AddonGate>

          </LevelGate>

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

  const { contentTheme, toggleContentTheme } = useStudioAppearance();



  if (location.pathname === "/admin/settings") {

    return <Navigate to={studioTabUrl("moduler")} replace />;

  }



  const detailRoute = parseAdminDetailRoute(location.pathname);



  const studio = useAdminDashboard();



  const tabParam = toStudioTab(searchParams.get("tab"));

  const [activeTab, setActiveTab] = useState<StudioTab>(tabParam);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [visitedTabs, setVisitedTabs] = useState<StudioTab[]>([tabParam]);

  const [createRequest, setCreateRequest] = useState<StudioTab | null>(null);



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

    navigate(studioTabUrl(tab));

    setSidebarOpen(false);

  };



  const handleCreateIn = (tab: StudioTab) => {

    setCreateRequest(tab);

    handleTabChange(tab);

  };

  const clearCreateRequest = () => setCreateRequest(null);



  const [feedback, setFeedback] = useTimedMessage<{ text: string; type: "success" | "error" }>();

  const showFeedback: ShowFeedback = (text, type = "success") => setFeedback({ text, type });



  return (

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

        activeTab={detailRoute?.backTab ?? activeTab}

        onTabChange={handleTabChange}

        sidebarOpen={sidebarOpen}

        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}

      />



      <main

        data-studio-theme={contentTheme}

        className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${studioBg}`}

      >

        <div className="mb-4 flex justify-end">

          <StudioThemeToggle

            theme={contentTheme}

            onToggle={toggleContentTheme}

            darkLabel="Mørkt innhold"

            lightLabel="Lyst innhold"

            className="w-auto min-w-[11rem]"

          />

        </div>



        {detailRoute ? (

          <LevelGate tab={detailRoute.backTab}>

            <AdminStudioDetail kind={detailRoute.kind} />

          </LevelGate>

        ) : (

          <>

        <StudioTabPanel tab="dashboard" activeTab={activeTab} visited={visitedTabs.includes("dashboard")}>

          <LazyDashboardTab studio={studio} onTabChange={handleTabChange} onCreateIn={handleCreateIn} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-sider" activeTab={activeTab} visited={visitedTabs.includes("cms-sider")}>

          <LazyAdminCmsPanel

            showFeedback={showFeedback}

            createRequested={createRequest === "cms-sider"}

            onCreateHandled={clearCreateRequest}

          />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-medier" activeTab={activeTab} visited={visitedTabs.includes("cms-medier")}>

          <LazyMediaTab showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-nyheter" activeTab={activeTab} visited={visitedTabs.includes("cms-nyheter")}>

          <LazyNewsTab

            studio={studio}

            showFeedback={showFeedback}

            createRequested={createRequest === "cms-nyheter"}

            onCreateHandled={clearCreateRequest}

          />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-taler" activeTab={activeTab} visited={visitedTabs.includes("cms-taler")}>

          <LazySermonsTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-stab" activeTab={activeTab} visited={visitedTabs.includes("cms-stab")}>

          <LazyStaffTab showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-design" activeTab={activeTab} visited={visitedTabs.includes("cms-design")}>

          <LazyThemeTab showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-innstillinger" activeTab={activeTab} visited={visitedTabs.includes("cms-innstillinger")}>

          <LazySiteSettingsTab />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-overstyringer" activeTab={activeTab} visited={visitedTabs.includes("cms-overstyringer")}>

          <LazyVisibilityTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="cms-hjelp" activeTab={activeTab} visited={visitedTabs.includes("cms-hjelp")}>

          <LazyHelpTab />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-samlinger" activeTab={activeTab} visited={visitedTabs.includes("planlegger-samlinger")}>

          <LazyGatheringsTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-oppgaver" activeTab={activeTab} visited={visitedTabs.includes("planlegger-oppgaver")}>

          <LazyTasksTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-grupper" activeTab={activeTab} visited={visitedTabs.includes("planlegger-grupper")}>

          <LazyGroupsTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-personer" activeTab={activeTab} visited={visitedTabs.includes("planlegger-personer")}>

          <LazyPersonsTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="planlegger-roller" activeTab={activeTab} visited={visitedTabs.includes("planlegger-roller")}>

          <LazyRolesTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="database-admin" activeTab={activeTab} visited={visitedTabs.includes("database-admin")}>

          <LazyDatabaseTab studio={studio} showFeedback={showFeedback} />

        </StudioTabPanel>



        <StudioTabPanel tab="moduler" activeTab={activeTab} visited={visitedTabs.includes("moduler")}>

          <LazyAddonsTab showFeedback={showFeedback} onTabChange={handleTabChange} />

        </StudioTabPanel>

        <StudioTabPanel tab="analyse" activeTab={activeTab} visited={visitedTabs.includes("analyse")}>

          <LazyAnalyticsTab showFeedback={showFeedback} onTabChange={handleTabChange} />

        </StudioTabPanel>

        <StudioTabPanel tab="nettsidebesok" activeTab={activeTab} visited={visitedTabs.includes("nettsidebesok")}>

          <LazySiteTrafficTab showFeedback={showFeedback} />

        </StudioTabPanel>

          </>

        )}

      </main>

    </div>

  );

}



export const AdminStudio: React.FC = () => (

  <StudioAppearanceProvider>

    <AdminStudioContent />

  </StudioAppearanceProvider>

);


