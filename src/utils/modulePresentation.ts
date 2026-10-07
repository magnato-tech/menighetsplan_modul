import type { DynamicModuleType, GroupsModuleFields, VisualBlock } from "./cmsBlocks";

/** Key-value presentation config stored in VisualBlock.rawContent for dynamic modules. */
export type ModulePresentationConfig = Record<string, string>;

export interface ModulePresentationField {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "link" | "color" | "image" | "select";
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
}

function parseRaw(raw: string): ModulePresentationConfig {
  const config: ModulePresentationConfig = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    config[match[1].trim()] = match[2];
  }
  return config;
}

function serializeRaw(config: ModulePresentationConfig): string {
  return Object.entries(config)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

export const MODULE_PRESENTATION_DEFAULTS: Record<DynamicModuleType, ModulePresentationConfig> = {
  "module-worship": {
    badge: "",
    linkLabel: "Se detaljer",
    linkUrl: "section:@home:hva-skjer",
    info1Title: "Søndagsskole",
    info1Body:
      "Eget tilrettelagt opplegg for småbarn, barn og tweens under gudstjenesten.",
    info2Title: "Kirkekaffe & Drøs",
    info2Body:
      "Vi samles i kafeen etter gudstjenesten til kaffe, te, saft og en hyggelig prat.",
    info3Title: "Rom for alle",
    info3Body: "Uansett bakgrunn er du hjertelig velkommen. Ingen forkunnskaper kreves.",
    backgroundImage: "",
    backgroundColor: "",
  },
  "module-calendar": {
    title: "",
    backgroundImage: "",
    backgroundColor: "",
  },
  "module-kalender": {
    badge: "Kalender",
    title: "",
    backgroundImage: "",
    backgroundColor: "",
  },
  "module-news": {
    badge: "Aktuelt",
    title: "Nyheter og artikler",
    linkLabel: "Les mer om arbeidet vårt",
    linkUrl: "/om-oss",
    backgroundImage: "",
    backgroundColor: "",
  },
  "module-sermon": {
    badge: "Siste tale fra søndagen",
    linkLabel: "Se hele prekenarkivet",
    linkUrl: "system:taler",
    backgroundImage: "",
    backgroundColor: "",
  },
  "module-groups": {
    badge: "Nære fellesskap",
    title: "Bli med i et husfellesskap",
    body:
      "Tro og liv deles best sammen med andre. I husfellesskapene våre samles vi i hjemmene til et enkelt måltid, bønn og gode samtaler om hverdagen.",
    highlight1: "Grupper for alle aldre",
    highlight2: "Annenhver uke",
    highlight3: "Uforpliktende å prøve",
    backgroundImage: "",
    backgroundColor: "",
  },
  "module-giving": {
    badge: "Givertjeneste & Støtte",
    title: "Støtt menighetens arbeid",
    body:
      "Arbeidet drives utelukkende av frivillige gaver fra medlemmer og støttespillere. Din gave gjør barnekirke, ungdomsarbeid og diakonalt arbeid mulig.",
    backgroundImage: "",
    backgroundColor: "",
  },
};

export const MODULE_PRESENTATION_FIELDS: Record<DynamicModuleType, ModulePresentationField[]> = {
  "module-worship": [
    { key: "badge", label: "Merkelapp over tittel", type: "text", placeholder: "Tom = automatisk fra kalenderen" },
    { key: "linkLabel", label: "Lenketekst", type: "text" },
    { key: "linkUrl", label: "Lenkemål", type: "link" },
    { key: "info1Title", label: "Infokort 1: tittel", type: "text" },
    { key: "info1Body", label: "Infokort 1: tekst", type: "textarea" },
    { key: "info2Title", label: "Infokort 2: tittel", type: "text" },
    { key: "info2Body", label: "Infokort 2: tekst", type: "textarea" },
    { key: "info3Title", label: "Infokort 3: tittel", type: "text" },
    { key: "info3Body", label: "Infokort 3: tekst", type: "textarea" },
    { key: "backgroundImage", label: "Bakgrunnsbilde", type: "image" },
    { key: "backgroundColor", label: "Bakgrunnsfarge", type: "color" },
  ],
  "module-calendar": [
    {
      key: "title",
      label: "Seksjonstittel",
      type: "text",
      placeholder: "Tom = «Hva skjer i [menighetsnavn]»",
    },
    { key: "backgroundImage", label: "Bakgrunnsbilde", type: "image" },
    { key: "backgroundColor", label: "Bakgrunnsfarge", type: "color" },
  ],
  "module-kalender": [
    { key: "badge", label: "Merkelapp", type: "text" },
    {
      key: "title",
      label: "Seksjonstittel",
      type: "text",
      placeholder: "Tom = «Hva skjer i [menighetsnavn]»",
    },
    { key: "backgroundImage", label: "Bakgrunnsbilde", type: "image" },
    { key: "backgroundColor", label: "Bakgrunnsfarge", type: "color" },
  ],
  "module-news": [
    { key: "badge", label: "Merkelapp", type: "text" },
    { key: "title", label: "Seksjonstittel", type: "text" },
    { key: "linkLabel", label: "Lenketekst", type: "text" },
    { key: "linkUrl", label: "Lenkemål", type: "link" },
    { key: "backgroundImage", label: "Bakgrunnsbilde", type: "image" },
    { key: "backgroundColor", label: "Bakgrunnsfarge", type: "color" },
  ],
  "module-sermon": [
    { key: "badge", label: "Merkelapp", type: "text" },
    { key: "linkLabel", label: "Arkivlenke: tekst", type: "text" },
    { key: "linkUrl", label: "Arkivlenke", type: "link" },
    { key: "backgroundImage", label: "Bakgrunnsbilde", type: "image" },
    { key: "backgroundColor", label: "Bakgrunnsfarge", type: "color" },
  ],
  "module-groups": [
    { key: "badge", label: "Merkelapp over tittel", type: "text" },
    { key: "title", label: "Tittel", type: "text" },
    { key: "body", label: "Tekst", type: "textarea" },
    { key: "highlight1", label: "Punkt 1", type: "text" },
    { key: "highlight2", label: "Punkt 2", type: "text" },
    { key: "highlight3", label: "Punkt 3", type: "text" },
    { key: "backgroundImage", label: "Bakgrunnsbilde", type: "image" },
    { key: "backgroundColor", label: "Bakgrunnsfarge", type: "color" },
  ],
  "module-giving": [
    { key: "badge", label: "Merkelapp", type: "text" },
    { key: "title", label: "Tittel", type: "text" },
    { key: "body", label: "Tekst", type: "textarea" },
    { key: "backgroundImage", label: "Bakgrunnsbilde", type: "image" },
    { key: "backgroundColor", label: "Bakgrunnsfarge", type: "color" },
  ],
};

export function isEditableDynamicModule(type: string): boolean {
  return type.startsWith("module-");
}

export function readModulePresentation(block: VisualBlock): ModulePresentationConfig {
  const modType = block.type as DynamicModuleType;
  const defaults = MODULE_PRESENTATION_DEFAULTS[modType] || {};
  const raw = (block.rawContent || "").trim();
  if (!raw) return { ...defaults };
  return { ...defaults, ...parseRaw(raw) };
}

export function applyModulePresentation(
  block: VisualBlock,
  config: ModulePresentationConfig
): VisualBlock {
  const modType = block.type as DynamicModuleType;
  const defaults = MODULE_PRESENTATION_DEFAULTS[modType] || {};
  const merged = { ...defaults, ...config };
  return { ...block, rawContent: serializeRaw(merged) };
}

/** Resolved string: custom value or fallback. */
export function presentationText(
  config: ModulePresentationConfig,
  key: string,
  fallback: string
): string {
  const value = config[key]?.trim();
  return value || fallback;
}

/** Backward-compatible groups fields for GroupsModule. */
const GROUPS_DEFAULTS = MODULE_PRESENTATION_DEFAULTS["module-groups"];

export function groupsFieldsFromPresentation(
  config: ModulePresentationConfig
): GroupsModuleFields {
  return {
    badge: presentationText(config, "badge", GROUPS_DEFAULTS.badge),
    title: presentationText(config, "title", GROUPS_DEFAULTS.title),
    body: presentationText(config, "body", GROUPS_DEFAULTS.body),
    highlights: [
      presentationText(config, "highlight1", GROUPS_DEFAULTS.highlight1),
      presentationText(config, "highlight2", GROUPS_DEFAULTS.highlight2),
      presentationText(config, "highlight3", GROUPS_DEFAULTS.highlight3),
    ],
    backgroundImage: config.backgroundImage || "",
    backgroundImageAlt: config.backgroundImageAlt || "",
    backgroundColor: config.backgroundColor || "",
  };
}
