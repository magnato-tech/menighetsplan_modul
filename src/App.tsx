import React, { Suspense, lazy, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { FirebaseDataProvider } from "./context/FirebaseDataContext";
import { CmsProvider, useCms } from "./context/CmsContext";
import { SITE_THEME_CLASS, getThemeCssVariables } from "./utils/themeUtils";
import { isAdminStudioPath, isMinSidePath, isPublicPath, isSignInPath } from "./utils/routes";
import { PreviewQueryPersist } from "./components/public/PreviewQueryPersist";
import { useSiteTraffic } from "./hooks/useSiteTraffic";
import { EmbeddedPreviewGuard } from "./components/public/EmbeddedPreviewGuard";
import { PreviewBridgeNotifier } from "./components/public/PreviewBridgeNotifier";
import { IframeInternalRouteBlock } from "./components/public/IframeInternalRouteBlock";
import { injectPageSeo } from "./utils/seoUtils";
import { seoForPath } from "./utils/siteSeo";
import { Header } from "./components/Header";
import { WriteErrorBanner } from "./components/WriteErrorBanner";
import { PublicNavbar } from "./components/public/PublicNavbar";
import { PublicFooter } from "./components/public/PublicFooter";
import { PublicHashScroll } from "./components/public/PublicHashScroll";
import { ChunkErrorBoundary } from "./components/ChunkErrorBoundary";
import { SessionGate } from "./components/SessionGate";
import { DemoFrame } from "./components/DemoStrip";

// Public pages stay static so they never suspend on first paint.
import { PublicHomePage } from "./pages/public/PublicHomePage";
import { PublicGroupsPage } from "./pages/public/PublicGroupsPage";
import { PublicStaticPage } from "./pages/public/PublicStaticPage";
import { PublicArticlePage } from "./pages/public/PublicArticlePage";
import { PublicSermonsPage } from "./pages/public/PublicSermonsPage";
import { PublicLeadershipPage } from "./pages/public/PublicLeadershipPage";

const AdminStudio = lazy(() =>
  import("./pages/admin/AdminStudio").then((m) => ({ default: m.AdminStudio }))
);
const MyPage = lazy(() => import("./pages/MyPage").then((m) => ({ default: m.MyPage })));
const TaskDetailPage = lazy(() =>
  import("./pages/TaskDetailPage").then((m) => ({ default: m.TaskDetailPage }))
);
const LeaderPage = lazy(() => import("./pages/LeaderPage").then((m) => ({ default: m.LeaderPage })));
const LeaderGroupDetailPage = lazy(() =>
  import("./pages/LeaderGroupDetailPage").then((m) => ({ default: m.LeaderGroupDetailPage }))
);
const LeaderGatheringDetailPage = lazy(() =>
  import("./pages/LeaderGatheringDetailPage").then((m) => ({ default: m.LeaderGatheringDetailPage }))
);
const HusfellesskapPage = lazy(() =>
  import("./pages/HusfellesskapPage").then((m) => ({ default: m.HusfellesskapPage }))
);
const ModulePlaceholderPage = lazy(() =>
  import("./pages/ModulePlaceholderPage").then((m) => ({ default: m.ModulePlaceholderPage }))
);
const SignInPage = lazy(() => import("./pages/SignInPage").then((m) => ({ default: m.SignInPage })));
function LazyRouteFallback() {
  return <p className="p-6 text-sm text-slate-500">Laster…</p>;
}

/**
 * Keeps the tab title, the description and the share card in step with the page being shown.
 * The server writes the same into the HTML it sends (server.ts), from the same rules.
 */
function useSiteSeo(pathname: string) {
  const { pages, news, media, settings } = useCms();

  useEffect(() => {
    const config = seoForPath(pathname, { pages, news, media, settings });
    if (config) return injectPageSeo(config, media);
    document.title = settings.appName;
    return undefined;
  }, [pathname, pages, news, settings, media]);
}

function AppContent() {
  const location = useLocation();
  const { settings } = useCms();
  const themeVariables = useMemo(() => getThemeCssVariables(settings?.theme), [settings?.theme]);
  useSiteSeo(location.pathname);
  // Visits to the public website are counted, anonymously. Min side and admin are not counted.
  useSiteTraffic(location.pathname);

  const isAdminStudio = isAdminStudioPath(location.pathname);
  const isMinSideRoute = isMinSidePath(location.pathname);
  const inIframe = typeof window !== "undefined" && window.parent !== window;

  if (inIframe && !isPublicPath(location.pathname)) {
    return <IframeInternalRouteBlock />;
  }

  if (isSignInPath(location.pathname)) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<LazyRouteFallback />}>
          <SignInPage />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  // The admin is for administrators, and Min side for everyone in the register. Nobody else gets past the gate.
  if (isAdminStudio) {
    return (
      <SessionGate requireAdmin>
        <ChunkErrorBoundary>
          <Suspense fallback={<LazyRouteFallback />}>
            <Routes>
              <Route path="/admin/*" element={<AdminStudio />} />
            </Routes>
          </Suspense>
        </ChunkErrorBoundary>
      </SessionGate>
    );
  }
  if (isMinSideRoute) {
    return (
      <SessionGate>
      <div className="min-h-[calc(100vh-var(--demo-strip,0px))] flex flex-col bg-slate-100 text-slate-800">
        <Header />
        <main className="flex-1 pb-12">
          <ChunkErrorBoundary>
            <Suspense fallback={<LazyRouteFallback />}>
              <Routes>
                <Route path="/minside" element={<MyPage />} />
                <Route path="/leder" element={<LeaderPage />} />
                <Route path="/leder/gruppe/:groupId" element={<LeaderGroupDetailPage />} />
                <Route path="/leder/samling/:gatheringId" element={<LeaderGatheringDetailPage />} />
                <Route path="/oppgave/:taskId" element={<TaskDetailPage />} />
                <Route path="/gruppe/:groupId" element={<LeaderGroupDetailPage />} />
                <Route path="/samling/:gatheringId" element={<LeaderGatheringDetailPage />} />
                <Route path="/husfellesskap" element={<HusfellesskapPage />} />
                <Route path="/husfellesskap/:groupId" element={<HusfellesskapPage />} />
                <Route path="/meldinger" element={<ModulePlaceholderPage module="meldinger" />} />
                <Route path="*" element={<Navigate to="/minside" replace />} />
              </Routes>
            </Suspense>
          </ChunkErrorBoundary>
        </main>
        <footer className="py-6 border-t border-slate-200/60 bg-white/70 text-center text-xs text-slate-500">
          <div className="max-w-md mx-auto px-4 space-y-1">
            <p className="font-semibold text-slate-700">Menighetsplan Min Side</p>
            <p className="text-[11px] text-slate-400">
              Planlegging, gudstjenestelister og frivilligtjeneste
            </p>
          </div>
        </footer>
      </div>
      </SessionGate>
    );
  }

  return (
    <div style={themeVariables} className={`${SITE_THEME_CLASS} min-h-[calc(100vh-var(--demo-strip,0px))] flex flex-col bg-page text-stone-900`}>
      <PreviewQueryPersist />
      <EmbeddedPreviewGuard />
      <PreviewBridgeNotifier />
      <PublicHashScroll />
      <PublicNavbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<PublicHomePage />} />
          <Route path="/kalender" element={<Navigate to="/hva-skjer" replace />} />
          <Route path="/taler" element={<PublicSermonsPage />} />
          <Route path="/fellesskap" element={<PublicGroupsPage />} />
          <Route path="/grupper" element={<PublicGroupsPage />} />
          <Route path="/om-oss" element={<PublicStaticPage forcedSlug="om-oss" />} />
          <Route
            path="/stab"
            element={<PublicStaticPage forcedSlug="stab" fallbackComponent={<PublicLeadershipPage />} />}
          />
          <Route
            path="/lederskap"
            element={<PublicStaticPage forcedSlug="lederskap" fallbackComponent={<PublicLeadershipPage />} />}
          />
          <Route path="/kontakt" element={<PublicStaticPage forcedSlug="kontakt" />} />
          <Route path="/side/:slug" element={<PublicStaticPage />} />
          <Route path="/:slug" element={<PublicStaticPage />} />
          <Route path="/artikkel/:id" element={<PublicArticlePage />} />
          <Route path="/nettside" element={<Navigate to="/" replace />} />
          <Route path="/nettside/:slug" element={<PublicStaticPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <PublicFooter />
    </div>
  );
}

function DataProviders({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const internal = isAdminStudioPath(pathname) || isMinSidePath(pathname);
  const publicPagesOnly = isPublicPath(pathname);

  return (
    <FirebaseDataProvider internal={internal}>
      <CmsProvider publicPagesOnly={publicPagesOnly}>{children}</CmsProvider>
    </FirebaseDataProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DataProviders>
        {/* In the demo installation a strip stands above everything. Elsewhere this adds nothing. */}
        <DemoFrame>
          <AppContent />
        </DemoFrame>
        <WriteErrorBanner />
      </DataProviders>
    </BrowserRouter>
  );
}
