import { MIN_SIDE_MODULE_REQUIRES, type MinSideModuleId } from "../../utils/minSideModules";
import type { StudioTab } from "./studio";

// What each module of Min side is called on the page «Moduler», and what being off means. Keyed by
// id, so a module named in utils/minSideModules.ts cannot be left without its text.

export interface MinSideModuleText {
  name: string;
  /** What the module is, in a sentence. */
  summary: string;
  /** What being off means: what is hidden, and what is kept. */
  whenOff: string;
}

export const MIN_SIDE_MODULE_TEXT: Record<MinSideModuleId, MinSideModuleText> = {
  grupper: {
    name: "Grupper",
    summary: "Fanen Mine grupper og gruppesidene på Min side.",
    whenOff: "Av: fanen og gruppesidene vises ikke på Min side. Gruppene finnes fortsatt i admin og på nettsiden.",
  },
  gruppechat: {
    name: "Gruppechat",
    summary: "Chat i alle gruppene, og siste melding på gruppekortene.",
    whenOff: "Av: chatten vises ikke. Meldingene blir liggende.",
  },
  husfellesskap: {
    name: "Husfellesskap",
    summary: "Egen visning for husgrupper, med plan for samlingene og verter.",
    whenOff: "Av: husgruppene vises som vanlige grupper.",
  },
  tjeneste: {
    name: "Tjeneste og bemanning",
    summary: "Egne oppgaver, forespørsler, ledige oppgaver og vikarbehov på Min side.",
    whenOff: "Av: fanen Mine oppgaver viser bare innkallinger. Bemanningen i admin er som før.",
  },
  semesterplan: {
    name: "Semesterplan",
    summary: "Gjennomgangen av et semester, ett arrangement om gangen.",
    whenOff: "Av: Min side viser ingen semesterplan, og fanen Semesterplan er borte fra admin. Planer og svar blir liggende.",
  },
  kalender: {
    name: "Kalender",
    summary: "Fanen Kalender på Min side.",
    whenOff: "Av: fanen vises ikke. Kalenderen i admin og på nettsiden er som før.",
  },
};

/** The text under a module's switch when the module it needs is off, e.g. «Krever Grupper». */
export function requiresText(id: MinSideModuleId): string | undefined {
  const required = MIN_SIDE_MODULE_REQUIRES[id];
  return required ? `Krever ${MIN_SIDE_MODULE_TEXT[required].name}` : undefined;
}

/** The admin tabs a Min side module is in. A tab of a module that is off is not drawn (MinSideModuleGate.tsx). */
export const MIN_SIDE_ADMIN_TABS: Partial<Record<StudioTab, MinSideModuleId>> = {
  "planlegger-semesterplan": "semesterplan",
};
