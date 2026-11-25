// The modules on the analysis board, in the order they are shown. Each administrator can hide
// the ones they do not need; what is hidden is stored on their person (`analyticsHiddenModules`).
// The list stores what is hidden rather than what is shown, so a new module appears for everyone.

export const ANALYTICS_MODULES = [
  { id: "oppgaver-tatt", title: "Oppgaver tatt", description: "Oppgaver noen har sagt ja til siste døgn, 7 dager og 30 dager, og ledige plasser de neste 4 ukene." },
  { id: "nokkeltall", title: "Nøkkeltall", description: "Snitt på gudstjeneste, aktive frivillige, bemanningsgrad og andel med i en gruppe." },
  { id: "oppmote", title: "Oppmøte", description: "Oppmøtetall per samling, samlinger som mangler tall, tabell og CSV." },
  { id: "bemanning", title: "Bemanning per arrangement", description: "Hvor mange samlinger som hadde alle plasser bekreftet, og hvilke som ikke hadde det." },
  { id: "flere-oppgaver", title: "Flere oppgaver på samme samling", description: "Hvem som har hatt to eller flere oppgaver på samme samling, og vanlige kombinasjoner." },
  { id: "per-maned", title: "Oppgaver og aktiviteter per måned", description: "Hvor stor del av menigheten som har 0, 1, 2 … 8 eller flere oppgaver i en vanlig måned." },
  { id: "hver-enkelt", title: "Hver enkelt", description: "Tabell per person: oppgaver, gudstjenester, flere oppgaver, grupper og aktiviteter per måned." },
  { id: "frivillighet", title: "Frivillighet og bemanning", description: "Forfall, avslag, svartid, roller som er vanskelige å bemanne, og hvem som trenger avlastning." },
  { id: "grupper", title: "Grupper og fellesskap", description: "Aktivitet per gruppe, stille grupper og personer uten gruppe." },
  { id: "personregister", title: "Personregisteret", description: "Personer, offentlige profiler, fravær og politiattester." },
  { id: "nettside", title: "Nettsiden", description: "Nyheter, taler og sider som er publisert." },
  { id: "datagrunnlag", title: "Datagrunnlag", description: "Hva tallene bygger på, og hva som ikke måles." },
] as const;

export type AnalyticsModuleId = (typeof ANALYTICS_MODULES)[number]["id"];

export function isModuleShown(hidden: readonly string[] | undefined, id: AnalyticsModuleId): boolean {
  return !(hidden ?? []).includes(id);
}

/** How many of the board's modules are hidden. A stored id for a module that no longer exists is not counted. */
export function hiddenModuleCount(hidden: readonly string[] | undefined): number {
  const set = new Set(hidden ?? []);
  return ANALYTICS_MODULES.filter((m) => set.has(m.id)).length;
}
