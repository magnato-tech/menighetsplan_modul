import { Badge, Calendar, CalendarRange, FileText, FolderKanban, Headphones, Images, LayoutTemplate, ListTodo, Mail, Newspaper, Palette, Sliders, Star, Users, type LucideIcon } from "lucide-react";
import { useCms } from "../../context/CmsContext";
import { useLevel } from "../../hooks/useLevel";
import { useStockImageCount } from "../../hooks/useStockImageCount";
import { usePendingProposalCounts } from "../../hooks/useMemberProposals";
import { useExternalCalendarPending } from "../../hooks/useExternalCalendarQueue";
import { hasPlanner } from "../../utils/level";
import { NEAR_WEEKS, isUrgentTask, withinWeeks, type StudioData, type StudioTab } from "./studio";
import type { StudioArea } from "./studioAreas";

/** One row of the admin menu: the same tab, count and warnings as in the side menu (StudioSidebar). */
export interface StudioMenuEntry {
  tab: StudioTab;
  label: string;
  icon: LucideIcon;
  /** The colour of the icon, as the side menu has it */
  iconClass: string;
  /** The number beside the entry */
  count?: number;
  /** Warnings beside the entry, after the number */
  alerts?: { text: string; tone: "red" | "amber"; title?: string }[];
}

/**
 * The entries of one part of the admin, with the rules that decide them. Both the side menu on a
 * larger screen and the start page on a phone use this list, so they cannot disagree. A web editor
 * gets the website part without Lederskap & Stab.
 */
export function useStudioMenuEntries(studio: StudioData, area: StudioArea, options: { webEditor?: boolean } = {}): StudioMenuEntry[] {
  const { webEditor = false } = options;
  const { adminPersons, adminGroups, adminGatherings, adminTasks, adminVolunteerRoles } = studio;
  const { pages, media, news, sermons, staff } = useCms();
  const withPlanner = hasPlanner(useLevel());
  // The media library counts the images that come with the app next to the uploaded ones
  const mediaCount = media.filter((item) => item.status === "ready").length + useStockImageCount();
  const waitingProposals = [...usePendingProposalCounts(withPlanner).values()].reduce((sum, count) => sum + count, 0);
  const urgentTasksCount = withinWeeks(adminTasks, NEAR_WEEKS).filter(isUrgentTask).length;
  const importPending = useExternalCalendarPending();

  const planning: StudioMenuEntry[] = [
    {
      tab: "planlegger-samlinger",
      label: "Kalender",
      icon: Calendar,
      iconClass: "text-[var(--studio-icon)]",
      count: adminGatherings.length,
      alerts: importPending > 0 ? [{ text: `${importPending} må ordnes`, tone: "red" as const, title: "Fra kirkens kalender" }] : [],
    },
    ...(withPlanner
      ? [
          {
            tab: "planlegger-oppgaver" as const,
            label: "Trenger oppfølging",
            icon: ListTodo,
            iconClass: "text-amber-400",
            alerts: urgentTasksCount > 0 ? [{ text: `${urgentTasksCount} må ordnes`, tone: "red" as const }] : [],
          },
          {
            tab: "planlegger-grupper" as const,
            label: "Grupper & Husfellesskap",
            icon: FolderKanban,
            iconClass: "",
            count: adminGroups.length,
            alerts:
              waitingProposals > 0 ? [{ text: String(waitingProposals), tone: "amber" as const, title: "Venter på godkjenning" }] : [],
          },
        ]
      : []),
    { tab: "planlegger-personer", label: "Personer", icon: Users, iconClass: "", count: adminPersons.length },
    { tab: "planlegger-maler", label: "Maler", icon: LayoutTemplate, iconClass: "" },
    { tab: "arshjul", label: "Årshjul", icon: CalendarRange, iconClass: "" },
    ...(withPlanner ? [{ tab: "epost" as const, label: "Send e-post", icon: Mail, iconClass: "" }] : []),
    ...(withPlanner
      ? [{ tab: "planlegger-roller" as const, label: "Roller", icon: Badge, iconClass: "", count: adminVolunteerRoles.length }]
      : []),
  ];

  const website: StudioMenuEntry[] = [
    { tab: "cms-sider", label: "Sider & Innhold", icon: FileText, iconClass: "", count: pages.length },
    { tab: "cms-nyheter", label: "Aktuelt & Nyheter", icon: Newspaper, iconClass: "", count: news.length },
    { tab: "cms-taler", label: "Taler & Prekener", icon: Headphones, iconClass: "text-amber-300", count: sermons.length },
    ...(webEditor ? [] : [{ tab: "cms-stab" as const, label: "Lederskap & Stab", icon: Users, iconClass: "text-emerald-400", count: staff.length }]),
    { tab: "cms-medier", label: "Mediebibliotek", icon: Images, iconClass: "", count: mediaCount },
    { tab: "cms-design", label: "Tema & Designsystem", icon: Palette, iconClass: "text-pink-400" },
    { tab: "cms-innstillinger", label: "Nettside-innstillinger", icon: Sliders, iconClass: "" },
    { tab: "cms-overstyringer", label: "Arrangementer på nettsiden", icon: Star, iconClass: "text-amber-400" },
  ];

  return area === "nettside" ? website : planning;
}
