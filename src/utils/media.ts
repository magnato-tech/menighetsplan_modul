import type { CmsMedia, CmsNewsArticle, CmsPage, CmsSermon, CmsStaffMember } from "../data/cmsData";
import type { VisualBlock } from "./cmsBlocks";
import { readGroupsModuleFields, readStaticFields } from "./cmsBlocks";
import { readModulePresentation } from "./modulePresentation";

export const MEDIA_REF_PREFIX = "media:";

export type MediaVariant = "web" | "thumb" | "og";

export interface MediaUsage {
  type: "page" | "news" | "staff" | "sermon" | "block";
  id: string;
  label: string;
}

export function isMediaRef(value: string | undefined | null): boolean {
  return Boolean(value?.trim().startsWith(MEDIA_REF_PREFIX));
}

export function parseMediaId(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed?.startsWith(MEDIA_REF_PREFIX)) return null;
  const id = trimmed.slice(MEDIA_REF_PREFIX.length).trim();
  return id || null;
}

export function toMediaRef(mediaId: string): string {
  return `${MEDIA_REF_PREFIX}${mediaId}`;
}

export function mediaMapFromList(media: CmsMedia[] | undefined | null): Record<string, CmsMedia> {
  const map: Record<string, CmsMedia> = {};
  for (const item of media ?? []) map[item.id] = item;
  return map;
}

export function resolveMediaUrl(
  value: string | undefined | null,
  mediaById: Record<string, CmsMedia>,
  variant: MediaVariant = "web"
): string {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";
  const mediaId = parseMediaId(trimmed);
  if (!mediaId) return trimmed;
  const item = mediaById[mediaId];
  if (!item) return "";
  return item.variants[variant] || item.variants.web || "";
}

export function resolveShareableMediaUrl(
  value: string | undefined | null,
  mediaById: Record<string, CmsMedia>
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!isMediaRef(trimmed)) return undefined;
  const url = resolveMediaUrl(trimmed, mediaById, "og");
  return url || undefined;
}

export const MEDIA_ALT_COMMENT_PREFIX = "<!-- media-alt:";
export const MEDIA_ALT_COMMENT_SUFFIX = "-->";

export function formatMediaAltComment(alt: string): string {
  const trimmed = alt.trim();
  if (!trimmed) return "";
  return `${MEDIA_ALT_COMMENT_PREFIX} ${trimmed} ${MEDIA_ALT_COMMENT_SUFFIX}`;
}

export function parseMediaAltComment(line: string): string | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^<!--\s*media-alt:\s*(.*?)\s*-->$/i);
  return match?.[1]?.trim() || null;
}

function contentContainsMediaRef(content: string, mediaId: string): boolean {
  return content.includes(toMediaRef(mediaId));
}

function scanPageUsages(page: CmsPage, mediaId: string): MediaUsage[] {
  const ref = toMediaRef(mediaId);
  const hits: MediaUsage[] = [];
  const label = page.title || "Uten tittel";

  if (page.heroImage?.includes(ref) || page.heroImage === ref) {
    hits.push({ type: "page", id: page.id, label: `${label} (hovedbilde)` });
  }
  if (page.ogImage?.includes(ref) || page.ogImage === ref) {
    hits.push({ type: "page", id: page.id, label: `${label} (delebilde)` });
  }
  if (page.content && contentContainsMediaRef(page.content, mediaId)) {
    hits.push({ type: "page", id: page.id, label: `${label} (innhold)` });
  }
  return hits;
}

function scanBlocksForMedia(blocks: VisualBlock[] | undefined, mediaId: string, page: CmsPage): MediaUsage[] {
  if (!blocks?.length) return [];
  const ref = toMediaRef(mediaId);
  const hits: MediaUsage[] = [];
  const label = page.title || "Uten tittel";

  for (const block of blocks) {
    if (block.isDynamic) {
      const presentation = readModulePresentation(block);
      if (presentation.backgroundImage?.includes(ref)) {
        hits.push({
          type: "block",
          id: `${page.id}:${block.id}`,
          label: `${label} (${block.title || "modul"})`,
        });
      }
      continue;
    }
    const fields = readStaticFields(block);
    if (fields.imageUrl?.includes(ref)) {
      hits.push({
        type: "block",
        id: `${page.id}:${block.id}`,
        label: `${label} (${block.title || "bildeblokk"})`,
      });
    }
    if (block.type === "module-groups") {
      const groups = readGroupsModuleFields(block);
      if (groups.backgroundImage?.includes(ref)) {
        hits.push({
          type: "block",
          id: `${page.id}:${block.id}`,
          label: `${label} (fellesskapsmodul)`,
        });
      }
    }
  }
  return hits;
}

/** Finds where a media item is referenced in already-loaded CMS content. */
export function findMediaUsages(
  mediaId: string,
  pages: CmsPage[],
  news: CmsNewsArticle[],
  staff: CmsStaffMember[],
  sermons: CmsSermon[] = []
): MediaUsage[] {
  const hits: MediaUsage[] = [];
  const ref = toMediaRef(mediaId);

  for (const page of pages) {
    hits.push(...scanPageUsages(page, mediaId));
    hits.push(...scanBlocksForMedia(page.blocks, mediaId, page));
    if (!page.blocks?.length && page.content) {
      // Legacy content stored only in content string
      const blocksFromContent = page.content;
      if (contentContainsMediaRef(blocksFromContent, mediaId)) {
        const already = hits.some((h) => h.type === "page" && h.id === page.id);
        if (!already) {
          hits.push({ type: "page", id: page.id, label: page.title || "Uten tittel" });
        }
      }
    }
  }

  for (const article of news) {
    if (article.imageUrl?.includes(ref)) {
      hits.push({ type: "news", id: article.id, label: article.title || "Nyhetsartikkel" });
    }
    if (article.content && contentContainsMediaRef(article.content, mediaId)) {
      hits.push({ type: "news", id: article.id, label: `${article.title || "Nyhetsartikkel"} (innhold)` });
    }
  }

  for (const member of staff) {
    if (member.imageUrl?.includes(ref)) {
      hits.push({ type: "staff", id: member.id, label: member.name || "Medarbeider" });
    }
  }

  for (const sermon of sermons) {
    if (sermon.imageUrl?.includes(ref)) {
      hits.push({ type: "sermon", id: sermon.id, label: `Talen «${sermon.title || "Uten tittel"}»` });
    }
  }

  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.type}:${hit.id}:${hit.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterMediaLibrary(
  media: CmsMedia[],
  query: string,
  includeArchived: boolean
): CmsMedia[] {
  const q = query.trim().toLowerCase();
  return media
    .filter((item) => includeArchived || item.status !== "archived")
    .filter((item) => {
      if (!q) return true;
      const haystack = [item.title, item.altText, ...item.tags].join(" ").toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
