import { lazy, type ComponentType } from "react";
import type { StudioTab } from "./studio";
import { prefetchModule } from "../../utils/lazyImport";

type TabLoader = () => Promise<{ default: ComponentType<any> }>;

function namedTab<T extends ComponentType<any>>(
  loader: () => Promise<Record<string, T>>,
  exportName: string
): TabLoader {
  return () => loader().then((mod) => ({ default: mod[exportName] }));
}

const TAB_LOADERS: Record<StudioTab, TabLoader> = {
  dashboard: namedTab(() => import("./tabs/DashboardTab"), "DashboardTab"),
  "cms-sider": namedTab(() => import("../../components/admin/AdminCmsPanel"), "AdminCmsPanel"),
  "cms-nyheter": namedTab(() => import("./tabs/NewsTab"), "NewsTab"),
  "cms-taler": namedTab(() => import("./tabs/SermonsTab"), "SermonsTab"),
  "cms-stab": namedTab(() => import("./tabs/StaffTab"), "StaffTab"),
  "cms-medier": namedTab(() => import("./tabs/MediaTab"), "MediaTab"),
  "cms-design": namedTab(() => import("./tabs/ThemeTab"), "ThemeTab"),
  "cms-innstillinger": namedTab(() => import("./tabs/SiteSettingsTab"), "SiteSettingsTab"),
  "cms-overstyringer": namedTab(() => import("./tabs/VisibilityTab"), "VisibilityTab"),
  "cms-hjelp": namedTab(() => import("./tabs/HelpTab"), "HelpTab"),
  "planlegger-samlinger": namedTab(() => import("./tabs/GatheringsTab"), "GatheringsTab"),
  "planlegger-oppgaver": namedTab(() => import("./tabs/TasksTab"), "TasksTab"),
  "planlegger-grupper": namedTab(() => import("./tabs/GroupsTab"), "GroupsTab"),
  "planlegger-personer": namedTab(() => import("./tabs/PersonsTab"), "PersonsTab"),
  "planlegger-roller": namedTab(() => import("./tabs/RolesTab"), "RolesTab"),
  "database-admin": namedTab(() => import("./tabs/DatabaseTab"), "DatabaseTab"),
  moduler: namedTab(() => import("./tabs/AddonsTab"), "AddonsTab"),
  analyse: namedTab(() => import("./tabs/AnalyticsTab"), "AnalyticsTab"),
  nettsidebesok: namedTab(() => import("./tabs/SiteTrafficTab"), "SiteTrafficTab"),
  "demo-oppsett": namedTab(() => import("./tabs/DemoSetupTab"), "DemoSetupTab"),
};

export function prefetchStudioTab(tab: StudioTab): void {
  prefetchModule(TAB_LOADERS[tab]);
}

export const LazyDashboardTab = lazy(TAB_LOADERS.dashboard);
export const LazyAdminCmsPanel = lazy(TAB_LOADERS["cms-sider"]);
export const LazyMediaTab = lazy(TAB_LOADERS["cms-medier"]);
export const LazyNewsTab = lazy(TAB_LOADERS["cms-nyheter"]);
export const LazySermonsTab = lazy(TAB_LOADERS["cms-taler"]);
export const LazyStaffTab = lazy(TAB_LOADERS["cms-stab"]);
export const LazyThemeTab = lazy(TAB_LOADERS["cms-design"]);
export const LazySiteSettingsTab = lazy(TAB_LOADERS["cms-innstillinger"]);
export const LazyVisibilityTab = lazy(TAB_LOADERS["cms-overstyringer"]);
export const LazyHelpTab = lazy(TAB_LOADERS["cms-hjelp"]);
export const LazyGatheringsTab = lazy(TAB_LOADERS["planlegger-samlinger"]);
export const LazyTasksTab = lazy(TAB_LOADERS["planlegger-oppgaver"]);
export const LazyGroupsTab = lazy(TAB_LOADERS["planlegger-grupper"]);
export const LazyPersonsTab = lazy(TAB_LOADERS["planlegger-personer"]);
export const LazyRolesTab = lazy(TAB_LOADERS["planlegger-roller"]);
export const LazyDatabaseTab = lazy(TAB_LOADERS["database-admin"]);
export const LazyAddonsTab = lazy(TAB_LOADERS.moduler);
export const LazyAnalyticsTab = lazy(TAB_LOADERS.analyse);
export const LazySiteTrafficTab = lazy(TAB_LOADERS.nettsidebesok);
export const LazyDemoSetupTab = lazy(TAB_LOADERS["demo-oppsett"]);
