import { useLocation } from "react-router-dom";
import type { StudioTab } from "../pages/admin/studio";

export type AdminDetailKind = "person" | "group" | "gathering" | "task" | "membershipApplication";

export interface AdminDetailRoute {
  kind: AdminDetailKind;
  id: string;
  backTab: StudioTab;
  backLabel: string;
  badge: string;
}

const DETAIL_ROUTES: Array<{
  kind: AdminDetailKind;
  pattern: RegExp;
  backTab: StudioTab;
  backLabel: string;
  badge: string;
}> = [
  {
    kind: "person",
    pattern: /^\/admin\/person\/([^/]+)$/,
    backTab: "planlegger-personer",
    backLabel: "Tilbake til personregister",
    badge: "Personkort",
  },
  {
    kind: "group",
    pattern: /^\/admin\/gruppe\/([^/]+)$/,
    backTab: "planlegger-grupper",
    backLabel: "Tilbake til grupper",
    badge: "Gruppeadministrasjon",
  },
  {
    kind: "gathering",
    pattern: /^\/admin\/samling\/([^/]+)$/,
    backTab: "planlegger-samlinger",
    backLabel: "Tilbake til arrangementer",
    badge: "Kjøreplan",
  },
  {
    kind: "task",
    pattern: /^\/admin\/oppgave\/([^/]+)$/,
    backTab: "planlegger-oppgaver",
    backLabel: "Tilbake til oppgaver",
    badge: "Oppgavekort",
  },
  {
    kind: "membershipApplication",
    pattern: /^\/admin\/medlemskap\/([^/]+)$/,
    backTab: "planlegger-medlemskap",
    backLabel: "Tilbake til Medlemskap",
    badge: "Medlemskap – arkiv",
  },
];

/** Whether the address is Admin Studio (tabs or detail cards). */
export function isAdminStudioPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Reads the open admin detail card from the current address. */
export function useAdminDetailRoute(): AdminDetailRoute | null {
  const { pathname } = useLocation();
  return parseAdminDetailRoute(pathname);
}

export function parseAdminDetailRoute(pathname: string): AdminDetailRoute | null {
  for (const route of DETAIL_ROUTES) {
    const match = pathname.match(route.pattern);
    if (match?.[1]) {
      return {
        kind: route.kind,
        id: match[1],
        backTab: route.backTab,
        backLabel: route.backLabel,
        badge: route.badge,
      };
    }
  }
  return null;
}
