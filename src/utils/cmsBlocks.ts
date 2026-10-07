import {
  applyModulePresentation,
  groupsFieldsFromPresentation,
  readModulePresentation,
} from "./modulePresentation";
import { stripSectionAnchorComment } from "./cmsLinks";
import { formatMediaAltComment, parseMediaAltComment } from "./media";

export type DynamicModuleType =
  | "module-worship"
  | "module-calendar"
  | "module-kalender"
  | "module-news"
  | "module-sermon"
  | "module-groups"
  | "module-giving";

export interface VisualBlock {
  id: string;
  type: DynamicModuleType | "text" | "grid" | "media-left" | "media-right" | "quote" | "callout" | "cta" | "person-grid";
  title: string;
  isDynamic: boolean;
  hidden?: boolean;
  variant?: string;
  rawContent?: string;
}

/** Wraps one serialized block so the public renderer skips it without dropping the editor card. */
export const HIDDEN_BLOCK_START = "<!-- hidden -->";
export const HIDDEN_BLOCK_END = "<!-- /hidden -->";
/** Marks content the visual editor has saved, so a legacy homepage is not rebuilt on every visit. */
export const CMS_BLOCKS_AUTHORED = "<!-- cms-blocks -->";

export const PERSON_GRID_VARIANTS: { id: string; label: string }[] = [
  { id: "stab", label: "Stab og ansatte" },
  { id: "lederskap", label: "Lederskap" },
  { id: "pastor", label: "Pastorer" },
  { id: "alle", label: "Alle personer" },
];

export interface StaticBlockFields {
  title: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  author: string;
  tone: string;
  ctaLabel: string;
  ctaUrl: string;
  cards: { title: string; body: string }[];
}

/** Redigerbart innhold i husfellesskapsmodulen. Knappene peker fortsatt til /fellesskap og /kontakt. */
export interface GroupsModuleFields {
  badge: string;
  title: string;
  body: string;
  highlights: [string, string, string];
  backgroundImage: string;
  backgroundImageAlt: string;
  backgroundColor: string;
}

export const DEFAULT_GROUPS_BANNER_FIELDS: GroupsModuleFields = {
  badge: "Nære fellesskap",
  title: "Bli med i et husfellesskap",
  body:
    "Tro og liv deles best sammen med andre. I husfellesskapene våre samles vi i hjemmene til et enkelt måltid, bønn og gode samtaler om hverdagen.",
  highlights: ["Grupper for alle aldre", "Annenhver uke", "Uforpliktende å prøve"],
  backgroundImage: "",
  backgroundImageAlt: "",
  backgroundColor: "",
};

export interface DynamicModuleMeta {
  type: DynamicModuleType;
  title: string;
  description: string;
  dataSource: string;
  supportedVariants: { id: string; label: string }[];
}

export const DYNAMIC_MODULES_META: Record<DynamicModuleType, DynamicModuleMeta> = {
  "module-worship": {
    type: "module-worship",
    title: "Neste gudstjeneste",
    description: "Henter automatisk neste fremhevede gudstjeneste med dato, tidspunkt og program.",
    dataSource: "Gudstjenesteplanleggeren (Firebase)",
    supportedVariants: [
      { id: "highlight", label: "Fremhevet kort" },
      { id: "compact", label: "Kompakt infolinje" },
    ],
  },
  "module-calendar": {
    type: "module-calendar",
    title: "Hva skjer",
    description: "De fire neste offentlige arrangementene, uten kalender-merkelapp eller lenke.",
    dataSource: "Arrangementskalenderen (Firebase)",
    supportedVariants: [{ id: "grid", label: "4 kort" }],
  },
  "module-kalender": {
    type: "module-kalender",
    title: "Kalender",
    description: "Full kalender med liste og månedsvisning, samt abonnement på iCal-feed.",
    dataSource: "Arrangementskalenderen (Firebase)",
    supportedVariants: [
      { id: "month", label: "Månedsrutenett" },
      { id: "list", label: "Liste som standard" },
    ],
  },
  "module-news": {
    type: "module-news",
    title: "Nyheter og artikler",
    description: "Viser de nyeste publiserte artiklene fra menighetsarbeidet.",
    dataSource: "CMS Nyhetsdatabase",
    supportedVariants: [
      { id: "grid", label: "3 artikkelkort" },
      { id: "compact", label: "Kompakt liste" },
    ],
  },
  "module-sermon": {
    type: "module-sermon",
    title: "Siste tale fra søndagen",
    description: "Spill av siste tale direkte med lyd og Spotify-integrasjon.",
    dataSource: "CMS Prekenarkiv",
    supportedVariants: [
      { id: "player", label: "Full spiller med bilde" },
      { id: "minimal", label: "Kompakt lydstripe" },
    ],
  },
  "module-groups": {
    type: "module-groups",
    title: "Husfellesskap & Grupper",
    description: "Banner og snarvei til å bli med i et nært fellesskap.",
    dataSource: "Fellesskapsregisteret",
    supportedVariants: [
      { id: "banner", label: "Stort gradientbanner" },
      { id: "cards", label: "2 oppdelte infokort" },
    ],
  },
  "module-giving": {
    type: "module-giving",
    title: "Givertjeneste & Vipps",
    description: "Viser menighetens Vipps-nummer og bankkonto for gaver.",
    dataSource: "Menighetsinnstillinger",
    supportedVariants: [
      { id: "card", label: "Både Vipps og bankkonto" },
      { id: "vipps", label: "Kun Vipps-fokus" },
    ],
  },
};

function blockId(type: string, index: number): string {
  return `block-${type}-${index}`;
}

function pushSegment(segments: string[], body: string, hidden?: boolean) {
  const trimmed = body.trim();
  if (!trimmed) return;
  segments.push(hidden ? `${HIDDEN_BLOCK_START}\n${trimmed}\n${HIDDEN_BLOCK_END}` : trimmed);
}

/**
 * Parses a raw CMS content string into an array of VisualBlocks
 */
export function parseContentToVisualBlocks(content: string): VisualBlock[] {
  if (!content || !content.trim()) return [];

  const lines = content.split("\n");
  const blocks: VisualBlock[] = [];
  let textBuffer: string[] = [];

  const flushTextBuffer = () => {
    const raw = textBuffer.join("\n").trim();
    if (raw) {
      const firstLine = raw.split("\n")[0].trim().replace(/^#+\s*/, "");
      const title = firstLine.length > 0 ? (firstLine.length > 40 ? firstLine.slice(0, 37) + "..." : firstLine) : "Tekstavsnitt";
      blocks.push({
        id: blockId("text", blocks.length),
        type: "text",
        title,
        isDynamic: false,
        rawContent: raw,
      });
    }
    textBuffer = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === CMS_BLOCKS_AUTHORED) {
      i++;
      continue;
    }

    if (trimmed === HIDDEN_BLOCK_START) {
      flushTextBuffer();
      i++;
      const inner: string[] = [];
      while (i < lines.length && lines[i].trim() !== HIDDEN_BLOCK_END) {
        inner.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim() === HIDDEN_BLOCK_END) i++;
      const hiddenBlocks = parseContentToVisualBlocks(inner.join("\n"));
      for (const hiddenBlock of hiddenBlocks) {
        blocks.push({
          ...hiddenBlock,
          hidden: true,
          id: blockId(hiddenBlock.type, blocks.length),
        });
      }
      continue;
    }

    // 1. Dynamic module match: :::module-[name][variant]
    const moduleMatch = trimmed.match(/^:::module-([a-zA-Z0-9_-]+)(?:\[([a-zA-Z0-9_-]+)\])?/);
    if (moduleMatch) {
      flushTextBuffer();
      const modName = `module-${moduleMatch[1]}` as DynamicModuleType;
      const variant = moduleMatch[2] || DYNAMIC_MODULES_META[modName]?.supportedVariants[0]?.id || "default";

      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(":::")) {
        bodyLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith(":::")) {
        i++;
      }

      const meta = DYNAMIC_MODULES_META[modName];
      const rawContent = bodyLines.join("\n").trim();
      blocks.push({
        id: blockId(modName, blocks.length),
        type: modName,
        title: meta?.title || `Modul: ${moduleMatch[1]}`,
        isDynamic: true,
        variant,
        rawContent: rawContent || undefined,
      });
      continue;
    }

    // 2. Personer / stab grid: :::personer[filter] or :::person-grid[filter]
    if (trimmed.startsWith(":::personer") || trimmed.startsWith(":::person-grid")) {
      flushTextBuffer();
      const match = trimmed.match(/:::(?:personer|person-grid)(?:\[(.*?)\])?/);
      const filter = match?.[1] || "alle";
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(":::")) {
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith(":::")) {
        i++;
      }
      const personLabel = PERSON_GRID_VARIANTS.find((variant) => variant.id === filter)?.label;
      blocks.push({
        id: blockId("person-grid", blocks.length),
        type: "person-grid",
        title: personLabel || (filter === "stab" ? "Stab & Ansatte" : "Personoversikt"),
        isDynamic: true,
        variant: filter,
      });
      continue;
    }

    // 3. Structured blocks: :::grid, :::media-left, :::media-right, :::quote, :::callout
    if (
      trimmed.startsWith(":::grid") ||
      trimmed.startsWith(":::media-left") ||
      trimmed.startsWith(":::media-right") ||
      trimmed.startsWith(":::quote") ||
      trimmed.startsWith(":::callout")
    ) {
      flushTextBuffer();
      const blockLines = [line];
      const blockType = trimmed.startsWith(":::grid")
        ? "grid"
        : trimmed.startsWith(":::media-left")
        ? "media-left"
        : trimmed.startsWith(":::media-right")
        ? "media-right"
        : trimmed.startsWith(":::quote")
        ? "quote"
        : "callout";

      i++;
      while (i < lines.length && !lines[i].trim().startsWith(":::")) {
        blockLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith(":::")) {
        blockLines.push(lines[i]);
        i++;
      }

      const fullBlockContent = blockLines.join("\n");
      const titleMap = {
        grid: "Kort-grid (2 kolonner)",
        "media-left": "Bilde med tekst (Venstre)",
        "media-right": "Bilde med tekst (Høyre)",
        quote: "Sitatblokk",
        callout: "Fremhevet infoboks",
      };

      blocks.push({
        id: blockId(blockType, blocks.length),
        type: blockType,
        title: titleMap[blockType] || "Innholdsblokk",
        isDynamic: false,
        rawContent: fullBlockContent,
      });
      continue;
    }

    const ctaMatch =
      trimmed.match(/^\[(?:Knapp|Handling|CTA):\s*(.*?)\]\((.*?)\)/i) ||
      trimmed.match(/^:::cta\[(.*?)\]\((.*?)\)/);
    if (ctaMatch) {
      flushTextBuffer();
      blocks.push({
        id: blockId("cta", blocks.length),
        type: "cta",
        title: ctaMatch[1].trim() || "Handlingsknapp",
        isDynamic: false,
        rawContent: trimmed,
      });
      i++;
      continue;
    }

    // Regular line, append to text buffer
    textBuffer.push(line);
    i++;
  }

  flushTextBuffer();
  return blocks;
}

/**
 * Serializes an array of VisualBlocks back into a clean CMS content string
 */
export function serializeVisualBlocksToContent(blocks: VisualBlock[]): string {
  if (!blocks || blocks.length === 0) return "";

  const segments: string[] = [];

  for (const block of blocks) {
    if (block.type.startsWith("module-")) {
      const variantStr = block.variant ? `[${block.variant}]` : "";
      const inner = block.rawContent?.trim();
      const body = inner
        ? `:::${block.type}${variantStr}\n${inner}\n:::`
        : `:::${block.type}${variantStr}\n:::`;
      pushSegment(segments, body, block.hidden);
    } else if (block.type === "person-grid") {
      const filterStr = block.variant ? `[${block.variant}]` : "";
      pushSegment(segments, `:::personer${filterStr}\n:::`, block.hidden);
    } else if (block.rawContent) {
      pushSegment(segments, block.rawContent, block.hidden);
    }
  }

  const body = segments.join("\n\n");
  if (!body) return "";
  return `${CMS_BLOCKS_AUTHORED}\n\n${body}`;
}

const emptyFields = (): StaticBlockFields => ({
  title: "",
  body: "",
  imageUrl: "",
  imageAlt: "",
  author: "",
  tone: "info",
  ctaLabel: "",
  ctaUrl: "",
  cards: [{ title: "", body: "" }],
});

/** Reads editable banner text and styling for the groups module. */
export function readGroupsModuleFields(block: VisualBlock): GroupsModuleFields {
  return groupsFieldsFromPresentation(readModulePresentation(block));
}

/** Writes editable groups-module fields back into the block. */
export function applyGroupsModuleFields(block: VisualBlock, fields: GroupsModuleFields): VisualBlock {
  return applyModulePresentation(block, {
    badge: fields.badge,
    title: fields.title,
    body: fields.body,
    highlight1: fields.highlights[0],
    highlight2: fields.highlights[1],
    highlight3: fields.highlights[2],
    backgroundImage: fields.backgroundImage,
    backgroundImageAlt: fields.backgroundImageAlt,
    backgroundColor: fields.backgroundColor,
  });
}

/** Reads title, text and image out of a static block so the editor never shows module syntax. */
export function readStaticFields(block: VisualBlock): StaticBlockFields {
  const raw = stripSectionAnchorComment((block.rawContent || "").trim());
  const fields = emptyFields();

  if (block.type === "cta") {
    const match =
      raw.match(/\[(?:Knapp|Handling|CTA):\s*(.*?)\]\((.*?)\)/i) ||
      raw.match(/:::cta\[(.*?)\]\((.*?)\)/);
    fields.ctaLabel = match?.[1]?.trim() || "";
    fields.ctaUrl = match?.[2]?.trim() || "";
    return fields;
  }

  if (block.type === "quote") {
    const match = raw.match(/^:::quote(?:\[(.*?)\])?\n([\s\S]*?)\n:::$/);
    fields.author = match?.[1]?.trim() || "";
    fields.body = (match?.[2] || raw).trim();
    return fields;
  }

  if (block.type === "callout") {
    const match = raw.match(/^:::callout(?:\[([a-zA-Z0-9_-]+)\])?(?:\s+([^\n]+))?\n([\s\S]*?)\n:::$/);
    fields.tone = match?.[1]?.trim() || "info";
    fields.title = match?.[2]?.trim() || "";
    fields.body = (match?.[3] || "").trim();
    return fields;
  }

  if (block.type === "media-left" || block.type === "media-right") {
    const match = raw.match(/^:::media-(?:left|right)(?:\[(.*?)\])?\n([\s\S]*?)\n:::$/);
    fields.imageUrl = match?.[1]?.trim() || "";
    let innerLines = (match?.[2] || "").trim().split("\n");
    const altFromComment = innerLines[0] ? parseMediaAltComment(innerLines[0]) : null;
    if (altFromComment) {
      fields.imageAlt = altFromComment;
      innerLines = innerLines.slice(1);
    }
    if (innerLines[0]?.startsWith("### ") || innerLines[0]?.startsWith("## ")) {
      fields.title = innerLines[0].replace(/^#{2,3}\s*/, "");
      fields.body = innerLines.slice(1).join("\n").trim();
    } else {
      fields.body = innerLines.join("\n").trim();
    }
    return fields;
  }

  if (block.type === "grid") {
    const cards: { title: string; body: string }[] = [];
    const pattern = /:::card(?:\s+([^\n]+))?\n([\s\S]*?)(?=\n:::card|\n:::|$)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(raw))) {
      cards.push({ title: (match[1] || "").trim(), body: match[2].trim() });
    }
    fields.cards = cards.length > 0 ? cards : [{ title: "", body: "" }];
    return fields;
  }

  const lines = raw.split("\n");
  if (lines[0]?.startsWith("## ") || lines[0]?.startsWith("# ")) {
    fields.title = lines[0].replace(/^#{1,3}\s*/, "");
    fields.body = lines.slice(1).join("\n").trim();
  } else {
    fields.body = raw;
  }
  return fields;
}

/** Writes the structured fields back into the block's stored content. */
export function applyStaticFields(block: VisualBlock, fields: StaticBlockFields): VisualBlock {
  let rawContent = block.rawContent || "";
  let title = block.title;

  if (block.type === "cta") {
    const label = fields.ctaLabel.trim() || "Les mer";
    const url = fields.ctaUrl.trim() || "/";
    rawContent = `[Knapp: ${label}](${url})`;
    title = label;
  } else if (block.type === "quote") {
    const author = fields.author.trim();
    rawContent = `:::quote${author ? `[${author}]` : ""}\n${fields.body.trim()}\n:::`;
    title = "Sitatblokk";
  } else if (block.type === "callout") {
    const tone = fields.tone.trim() || "info";
    const heading = fields.title.trim();
    rawContent = `:::callout[${tone}]${heading ? ` ${heading}` : ""}\n${fields.body.trim()}\n:::`;
    title = heading || "Fremhevet infoboks";
  } else if (block.type === "media-left" || block.type === "media-right") {
    const image = fields.imageUrl.trim();
    const heading = fields.title.trim();
    const altLine = formatMediaAltComment(fields.imageAlt);
    rawContent = `:::${block.type}${image ? `[${image}]` : ""}\n${altLine ? `${altLine}\n` : ""}${heading ? `### ${heading}\n` : ""}${fields.body.trim()}\n:::`;
    title = block.type === "media-left" ? "Bilde med tekst (Venstre)" : "Bilde med tekst (Høyre)";
  } else if (block.type === "grid") {
    const cards = fields.cards.filter((card) => card.title.trim() || card.body.trim());
    const body = (cards.length > 0 ? cards : [{ title: "", body: "" }])
      .map((card) => `:::card${card.title.trim() ? ` ${card.title.trim()}` : ""}\n${card.body.trim()}\n:::`)
      .join("\n");
    rawContent = `:::grid\n${body}\n:::`;
    title = "Kort-grid (2 kolonner)";
  } else {
    const heading = fields.title.trim();
    const body = fields.body.trim();
    rawContent = heading ? `## ${heading}\n\n${body}`.trim() : body;
    title = heading || (body ? body.split("\n")[0].slice(0, 40) : "Tekstavsnitt");
  }

  return { ...block, title, rawContent };
}

/** Preview scroll target id for the fixed hero section. */
export const CMS_PREVIEW_TARGET_HERO = "hero";

/**
 * Shortens a card title on whole-word boundaries, keeping at least two words before the ellipsis.
 */
export function shortenHeading(title: string, maxChars = 40): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length <= maxChars) return trimmed;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return trimmed.slice(0, Math.max(1, maxChars - 1)) + "…";
  }

  const minHead = words.slice(0, 2).join(" ");
  if (minHead.length >= maxChars) {
    return minHead.slice(0, Math.max(1, maxChars - 1)) + "…";
  }

  let head = minHead;
  for (let i = 2; i < words.length; i++) {
    const next = `${head} ${words[i]}`;
    if (next.length > maxChars) break;
    head = next;
  }
  return `${head}…`;
}

/** One-line summary shown on the block card. */
export function staticPreviewText(block: VisualBlock): string {
  if (block.type.startsWith("module-")) {
    const config = readModulePresentation(block);
    if (block.type === "module-calendar") {
      const text = config.title?.trim() || block.title;
      const summary = text ? `Hva skjer: ${text}` : "Hva skjer (4 kort)";
      return summary.length > 90 ? `${summary.slice(0, 87)}...` : summary;
    }
    if (block.type === "module-kalender") {
      const text = config.title?.trim() || config.badge?.trim() || block.title;
      return text.length > 90 ? `${text.slice(0, 87)}...` : text;
    }
    const text = config.title?.trim() || config.body?.trim() || config.badge?.trim() || block.title;
    return text.length > 90 ? `${text.slice(0, 87)}...` : text;
  }
  const fields = readStaticFields(block);
  if (block.type === "cta") {
    return fields.ctaLabel ? `${fields.ctaLabel} → ${fields.ctaUrl}` : "Handlingsknapp";
  }
  if (block.type === "grid") {
    const names = fields.cards.map((card) => card.title).filter(Boolean);
    return names.length > 0 ? names.join(" · ") : "Kort-grid";
  }
  const text = fields.body || fields.title || "Tom innholdsblokk";
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

/**
 * Returns default visual blocks for the Forside page
 */
export function getDefaultForsideBlocks(): VisualBlock[] {
  return [
    {
      id: "forside-worship",
      type: "module-worship",
      title: "Neste gudstjeneste",
      isDynamic: true,
      variant: "highlight",
    },
    {
      id: "forside-text-welcome",
      type: "text",
      title: "Velkommen til menighetens fellesskap",
      isDynamic: false,
      rawContent: "## Velkommen til menighetens fellesskap\nEt åpent hjem for alle generasjoner. Vi samles til gudstjeneste, bønn og nære fellesskap der tro og hverdag møtes.",
    },
    {
      id: "forside-calendar",
      type: "module-calendar",
      title: "Kalender: Hva skjer",
      isDynamic: true,
      variant: "grid",
    },
    {
      id: "forside-news",
      type: "module-news",
      title: "Nyheter og artikler",
      isDynamic: true,
      variant: "grid",
    },
    {
      id: "forside-sermon",
      type: "module-sermon",
      title: "Siste tale fra søndagen",
      isDynamic: true,
      variant: "player",
    },
    {
      id: "forside-groups",
      type: "module-groups",
      title: "Husfellesskap & Grupper",
      isDynamic: true,
      variant: "banner",
    },
    {
      id: "forside-giving",
      type: "module-giving",
      title: "Givertjeneste & Vipps",
      isDynamic: true,
      variant: "card",
    },
  ];
}

interface ResolvablePage {
  content?: string;
  blocks?: VisualBlock[];
}

/**
 * The same block list for the editor, the CMS preview and the public page.
 * A homepage that was stored before modules existed keeps its text and gains the standard modules.
 */
export function resolveVisualBlocks(
  page: ResolvablePage | null | undefined,
  options?: { home?: boolean }
): VisualBlock[] {
  if (page?.blocks && page.blocks.length > 0) return page.blocks;

  const raw = page?.content || "";
  const authored = raw.includes(CMS_BLOCKS_AUTHORED);
  const parsed = parseContentToVisualBlocks(raw);
  const hasDynamic = parsed.some((block) => block.isDynamic);
  if (options?.home && !authored && !hasDynamic) {
    const defaults = getDefaultForsideBlocks();
    const staticBlocks = parsed.filter((block) => !block.isDynamic);
    if (staticBlocks.length === 0) return defaults;
    return [defaults[0], ...staticBlocks, ...defaults.slice(2)];
  }
  return parsed;
}
