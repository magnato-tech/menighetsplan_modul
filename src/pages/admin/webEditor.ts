import type { StudioTab } from "./studio";

// What a web editor (nettredaktør) has of the admin: the website part, and nothing that rests on the
// register, the planning or the e-mail. Lederskap & Stab is left out, as it is drawn from the register
// with telephone and e-mail (see the plan in «CMS-forbedringer – backlog etter kartlegging»).

export const WEB_EDITOR_TABS: readonly StudioTab[] = [
  "dashboard",
  "cms-sider",
  "cms-nyheter",
  "cms-taler",
  "cms-medier",
  "cms-design",
  "cms-innstillinger",
  "cms-overstyringer",
  "cms-hjelp",
  "nettsidebesok",
];

export const webEditorMayOpen = (tab: StudioTab): boolean => WEB_EDITOR_TABS.includes(tab);
