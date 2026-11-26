import { ChartColumnBig, HandCoins, KeyRound, MousePointerClick, type LucideIcon } from "lucide-react";
import { ADDON_IDS, isAddonOn, type AddonChoices, type AddonId } from "../../utils/addons";
import type { StudioTab } from "./studio";

// How the admin knows the modules of the product: which there are, which parts of each can be
// turned on, and what a part adds to the menu while it is on. The page «Moduler», the menu and
// the gate in front of a tab (AddonGate.tsx) are all drawn from this list, so none of them has
// to be told about a new module.
//
// A product module is what a congregation has or does not have («Analyse»). An add-on is a part
// of one that is turned on by itself («Analysebord»). A new add-on is made by naming it in
// utils/addons.ts, describing it here, and giving its tab a place in studio.ts,
// studioTabLoaders.ts and AdminStudio.tsx like any other tab.

/**
 * The modules of the product, as the product owner named them on 7 October 2026. «Analyse» and
 * «Givertjeneste» are built, or being built. The others are names and nothing more: they stand
 * here so that the structure is made, and tested, for a product with several modules that are
 * turned on without regard to each other. Accounting is deliberately not one of them.
 */
export const PRODUCT_MODULE_IDS = [
  "analyse",
  "givertjeneste",
  "utleie",
  "arrangement",
  "kommunikasjon",
  "skjemaer",
  "ai-assistent",
] as const;

export type ProductModuleId = (typeof PRODUCT_MODULE_IDS)[number];

const MODULE_NAMES: Record<ProductModuleId, string> = {
  analyse: "Analyse",
  givertjeneste: "Givertjeneste",
  utleie: "Utleie",
  arrangement: "Arrangement",
  kommunikasjon: "Kommunikasjon",
  skjemaer: "Skjemaer",
  "ai-assistent": "AI-assistent",
};

export interface AddonMenuEntry {
  tab: StudioTab;
  label: string;
  icon: LucideIcon;
}

export interface StudioAddon {
  id: AddonId;
  /** The product module the add-on is a part of. */
  module: ProductModuleId;
  name: string;
  /** What the add-on is for, in a sentence. */
  summary: string;
  /** What the congregation gets from it, as short points. */
  gives: string[];
  /** What being off means beyond not being in the menu: what stops, and what is kept. */
  whenOff: string;
  icon: LucideIcon;
  /** What it adds to the menu while it is on. */
  menu: AddonMenuEntry[];
}

// Keyed by id, so an add-on named in utils/addons.ts cannot be left without a description
const DESCRIPTIONS: Record<AddonId, Omit<StudioAddon, "id">> = {
  analysebord: {
    module: "analyse",
    name: "Analysebord",
    summary: "Menighetens liv i tall: oppmøte, frivillighet og grupper, sammenlignet med perioden før.",
    gives: [
      "Oppmøte på gudstjenester og samlinger, med egne tall for voksne og barn",
      "Hvem som bærer frivilligheten, og hvor det mangler folk",
      "Grupper, personregister og innholdet på nettsiden",
    ],
    whenOff: "Av: bordet vises ikke, og oppmøtetall kan ikke føres. Det som er ført, blir stående.",
    icon: ChartColumnBig,
    menu: [{ tab: "analyse", label: "Analysebord", icon: ChartColumnBig }],
  },
  nettsidebesok: {
    module: "analyse",
    name: "Besøk på nettsiden",
    summary: "Hvor mye nettsiden brukes, hva som leses og når. Besøkene telles anonymt.",
    gives: [
      "Besøk, sidevisninger og tid per side",
      "Mest besøkte sider, og sider som aldri åpnes",
      "Når besøkene kommer, og hva folk trykker på",
    ],
    whenOff: "Av: nettsiden teller ingen besøk. Tall som alt er telt, blir stående.",
    icon: MousePointerClick,
    menu: [{ tab: "nettsidebesok", label: "Besøk på nettsiden", icon: MousePointerClick }],
  },
  givertjeneste: {
    module: "givertjeneste",
    name: "Givertjeneste",
    summary: "Gaver til menigheten. Under arbeid: foreløpig gaveformål og hvem som har tilgang.",
    gives: [
      "Gaveformål, skilt i ordinær drift og øremerkede gaver",
      "Tilgang som gis til én og én person, uavhengig av andre roller",
    ],
    whenOff: "Av: Gaveformål og Gaveinnstillinger vises ikke. Det som er lagt inn, blir stående.",
    icon: HandCoins,
    menu: [
      { tab: "gaveformal", label: "Gaveformål", icon: HandCoins },
      { tab: "giver-innstillinger", label: "Gaveinnstillinger", icon: KeyRound },
    ],
  },
};

export const STUDIO_ADDONS: StudioAddon[] = ADDON_IDS.map((id) => ({ id, ...DESCRIPTIONS[id] }));

export interface ProductModule {
  id: ProductModuleId;
  name: string;
  /** The parts of the module that can be turned on. A module that is not built has none. */
  addons: StudioAddon[];
}

export const PRODUCT_MODULES: ProductModule[] = PRODUCT_MODULE_IDS.map((id) => ({
  id,
  name: MODULE_NAMES[id],
  addons: STUDIO_ADDONS.filter((addon) => addon.module === id),
}));

/** The modules there is something to turn on in, and the ones that are only planned. */
export const BUILT_MODULES = PRODUCT_MODULES.filter((module) => module.addons.length > 0);
export const PLANNED_MODULES = PRODUCT_MODULES.filter((module) => module.addons.length === 0);

export const moduleName = (id: ProductModuleId): string => MODULE_NAMES[id];

/** The add-on a tab belongs to, or undefined for a tab that is always there. */
export const addonOfTab = (tab: StudioTab): StudioAddon | undefined =>
  STUDIO_ADDONS.find((addon) => addon.menu.some((entry) => entry.tab === tab));

export interface AddonMenuSection {
  heading: string;
  entries: AddonMenuEntry[];
}

/**
 * What the add-ons that are on add to the menu, under the name of the module each is a part
 * of. A module with nothing turned on has no heading in the menu.
 */
export function addonMenuSections(choices: AddonChoices | undefined): AddonMenuSection[] {
  return PRODUCT_MODULES.map((module) => ({
    heading: module.name,
    entries: module.addons.filter((addon) => isAddonOn(choices, addon.id)).flatMap((addon) => addon.menu),
  })).filter((section) => section.entries.length > 0);
}
